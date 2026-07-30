<!--
  Preview Pane Component

  Right pane of the spine editor displaying real-time XHTML preview
  with transform status, error handling, and device simulation options.

  Features:
  - Real-time XHTML preview in iframe
  - Device simulation (iPhone, iPad, etc.)
  - Transform status and error display
  - Source view toggle for debugging
  - Performance metrics display
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import type { TransformError } from '$lib/types/spine-editor.js';
  import { t, translate, currentLocale } from '$lib/i18n';
  import ChapterValidationPanel from './ChapterValidationPanel.svelte';
  import PreviewSurface from './PreviewSurface.svelte';
  import {
    readValidationReport,
    messagesForChapter,
    VALIDATION_REPORT_STORAGE_KEY,
  } from '$lib/plugins/validation-report';
  import {
    contentPhrase,
    isStructuralPhrase,
    resolveAnnounceTarget,
    speakablePhrase,
    walkAnnouncements,
    type VsrLike,
  } from './sr-walk.js';
  import { SpeechService } from '$lib/speech/speech.service.js';
  import { isHttpContext } from '$lib/reader/open-in-reader.js';
  import { canShowXmlTree } from '$lib/xml-tree/tree-viewer-loader.js';
  import type { ReadColumns, ReadFlow } from '$lib/reader/read-preview.js';
  import { MARGIN_MM } from '$lib/pdf/pdf-export.js';
  import type { PrintSettings, PreviewSettings } from '$lib/services/settings/settings.service.js';
  import { DEFAULT_PREVIEW } from '$lib/services/settings/settings.service.js';
  import {
    ArrowsClockwise,
    CaretLeft,
    CaretRight,
    DeviceRotate,
    RowsIcon,
    SquareIcon,
    X,
    CircleHalf,
  } from 'phosphor-svelte';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import { layoutStore } from '../../stores/layout';
  import { pagedDevicePreviews } from '../../stores/paged-device-previews.js';
  import { persisted, asBoolean, asInt, asEnum, asString } from '../../state/persisted.svelte.js';
  import { parseFxlViewport } from '$lib/epub/fixed-layout.js';
  import {
    DEVICE_PRESETS,
    isFillDevice,
    usesFoliateDevice,
    engineOfDeviceId,
    FONT_STEPS,
    type EngineFlags,
    type SurfaceContentEvent,
  } from './preview-devices.js';

  // Props using Svelte 5 runes syntax
  let {
    xhtmlContent = '',
    persistedXhtml = undefined,
    isTransforming = false,
    transformError = null,
    transformWarnings = [],
    executionTime = 0,
    onNavigate = undefined,
    onPreviewClick = null,
    chapterId = null,
    printSettings = undefined,
    projectIdentifier = null,
    onGeneratePdf = undefined,
    previewHead = '',
    extensionPreviewHead = '',
    previewAutoUpdate = DEFAULT_PREVIEW.autoUpdate,
    previewIncludeHead = DEFAULT_PREVIEW.includeHead,
    isFixedLayout = false,
    renditionViewport = undefined,
    advancedMode = false,
    onSavePreviewData = undefined,
    getPagedStartPage = undefined,
    spineNeighbors = undefined,
  }: {
    xhtmlContent?: string;
    /** The XHTML as written to the workspace this render (no blob URLs) — what
     *  the Source view shows. Absent when the render skipped persistence, in
     *  which case the on-disk file may be stale and the view says so. */
    persistedXhtml?: string;
    isTransforming?: boolean;
    transformError?: TransformError | null;
    transformWarnings?: string[];
    executionTime?: number;
    onNavigate: ((chapterId: string) => void) | undefined;
    onPreviewClick?:
      | ((detail: { text: string; documentPosition: number; elementType: string }) => void)
      | null;
    /** Selected spine-item id, used to filter the validation report to this chapter. */
    chapterId?: string | null;
    /** Project print settings, applied to the Paged.js print preview's @page. */
    printSettings?: PrintSettings;
    /** Book-absolute start page for a chapter (from the app-owned pagemaps), or
     *  null when unknown (an earlier chapter not yet previewed). Drives the
     *  paged preview's absolute folios; absent → relative 1-based folios. */
    getPagedStartPage?: ((idref: string) => Promise<number | null>) | undefined;
    /** Spine neighbors of the previewed chapter, for the header's previous/next
     *  arrows (null at either end). Navigation goes through onNavigate. */
    spineNeighbors?: { prev: string | null; next: string | null } | undefined;
    /** Generate a PDF of this one chapter. Provided only over http: (Paged.js needs
     *  the origin); when set, the PDF device shows a "Chapter PDF" footer. */
    onGeneratePdf?: (() => void) | undefined;
    /** Current project's package identifier (dc:identifier) — the epubcheck report
     *  is only surfaced when it was produced for this same project. */
    projectIdentifier?: string | null;
    /** Contents of the project's `preview/head.xml` (inline style/script markup),
     *  injected into the preview head for the preview types whose `includeHead`
     *  is on. Authoring-time only — never reaches the packaged EPUB. */
    previewHead?: string;
    /** Preview-head fragments from installed extensions (process/PREVIEW_HEAD_EXTENSIONS.md).
     *  Injected into EVERY preview regardless of `includeHead` (fragments self-guard);
     *  authoring-time only, never packaged. */
    extensionPreviewHead?: string;
    /** Per preview type, whether the preview re-renders live on every edit. */
    previewAutoUpdate?: PreviewSettings['autoUpdate'];
    /** Per preview type, whether to inject `previewHead` into the preview <head>. */
    previewIncludeHead?: PreviewSettings['includeHead'];
    /** Fixed-layout (pre-paginated) chapter: reader theme/font controls don't apply,
     *  so they're hidden (readers disable user font sizing for fixed layout). */
    isFixedLayout?: boolean;
    /** rendition:viewport string ("width=W, height=H") — drives the fixed-layout
     *  page box in the device presets. Defaults apply when absent or invalid. */
    renditionViewport?: string;
    /** Advanced mode: the generated-Source view is hidden from the dropdown in basic mode. */
    advancedMode?: boolean;
    /** Persist per-chapter data a preview head.xml script saved via `window.seed`
     *  (process/PREVIEW_BRIDGE.md). The app owns the path (built from `idref`);
     *  the iframe supplies only the slot + text. */
    onSavePreviewData?: (idref: string, slot: string, text: string) => void;
  } = $props();

  // The generated content-document filename for the current chapter (e.g.
  // chapter01.xhtml), surfaced next to the Source toggle so authors see the real
  // rendered file. Spine items render to `<id>.xhtml`.

  // --- Accessibility check -----------------------------------------------------
  // Inject axe-core into the same-origin preview iframe and run it on demand so the
  // author gets in-context feedback they can fix immediately (tweak the stylesheet,
  // re-check). axe-core (MPL-2.0) is vendored at public/axe.min.js and served over
  // http; file:// can't fetch it, so the button is hidden there.
  const canCheckA11y = isHttpContext();

  // --- Print preview (Paged.js) ------------------------------------------------
  // The "Print" device paginates the current chapter into print pages with the
  // vendored Paged.js polyfill — the same pipeline (and print.css) as "Save as
  // PDF" — so authors see what the printed page will look like. HTTP-only: the
  // polyfill is fetched from the app origin, so the option is hidden on file://.
  const canPaginate = isHttpContext();

  // READ.html / foliate device previews are HTTP-only too (the modules are
  // fetched from the app origin) — gates the dropdown entries and the engine
  // classification below.
  const canReadPreview = isHttpContext();
  const readFlow = persisted<ReadFlow>(
    'seedhtml_preview_read_flow',
    'paginated',
    asEnum(['paginated', 'scrolled'])
  );
  const readColumns = persisted<ReadColumns>(
    'seedhtml_preview_read_columns',
    '2',
    asEnum(['1', '2'])
  );

  // Engine routing via the shared helpers (preview-devices.ts) so parent and
  // surface classify a device id identically.
  const engineFlags = (): EngineFlags => ({
    httpOk: canReadPreview,
    isFixedLayout,
    devicePresetsPaged: pagedDevicePreviews.current,
  });
  const usesFoliate = (id: string): boolean => usesFoliateDevice(id, engineFlags());
  const engineOfDevice = (id: string): 'paged' | 'foliate' | 'raw' =>
    engineOfDeviceId(id, engineFlags());

  // The rendering surface (process/SPLIT_PREVIEW.md phase 1): all engine and
  // iframe machinery lives there; this pane drives it via props and its
  // exported commands/read-outs.
  let surfaceRef = $state<ReturnType<typeof PreviewSurface> | undefined>();

  /** Checks re-establishment on a surface's render lifecycle. Events from a
   *  surface a check is not bound to are ignored — that check's document is
   *  untouched by the other surface's re-render. */
  function handleSurfaceContentEvent(event: SurfaceContentEvent, which: 1 | 2 = 1): void {
    const a11yBound = which === boundIndexA11y;
    const srBound = which === boundIndexSr;
    if (event === 'will-rewrite') {
      // A screen-reader walk must not keep stepping through the dying document,
      // and its queued speech would outlive the rewrite.
      if (srBound) {
        cancelSrActivity();
        srHoverTarget = null;
      }
      return;
    }
    if (event === 'rewrite' || event === 'section-ready') {
      // The rewrite invalidated any prior axe results; re-check if open, and
      // re-establish the screen-reader affordances on the fresh document.
      if (a11yBound) scheduleAutoA11yCheck();
      if (srBound && activePanel === 'sr') void ensureSrReady();
      return;
    }
    if (event === 'frame-load') {
      // Device re-key rebuilt the iframe (fresh Window): reload + re-instrument
      // the screen reader preview when its panel is open.
      if (srBound && activePanel === 'sr') void ensureSrReady();
      return;
    }
    // 'section-reflow': same section view re-laid-out; refresh stale highlights.
    if (a11yBound) scheduleAutoA11yCheck();
  }

  interface AxeViolation {
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{ target: string[]; html: string }>;
  }
  interface AxeWindow extends Window {
    axe?: { run: (context: Document | Element) => Promise<{ violations: AxeViolation[] }> };
  }

  let a11yRunning = $state(false);
  let a11yIssueCount = $state<number | null>(null);
  let a11yViolations = $state<AxeViolation[]>([]);
  let a11yAutoTimer: ReturnType<typeof setTimeout> | undefined;

  // The header's panel toggles (Accessibility / EpubCheck / Reader / Screen
  // reader) are mutually exclusive — at most one panel open at a time in the
  // band below the header.
  type PanelId = 'a11y' | 'epubcheck' | 'reader' | 'sr';
  let activePanel = $state<PanelId | null>(null);

  // --- Validation report -------------------------------------------------------
  // The latest epubcheck report is dropped into localStorage by the publish plugin.
  // We own the report + open state here (mirroring the a11y panel), so the panel
  // opens from a toolbar button and its open/closed state survives chapter hops.
  let validationReport = $state(readValidationReport());
  // Only surface a report that was produced for THIS project. The report is a
  // single global localStorage entry shared across projects, so without this an
  // unrelated project's report (and its colliding chapter ids) would leak in.
  // Requires a known project identifier on both sides (never matches on undefined).
  const validationReportMatches = $derived(
    !!projectIdentifier && validationReport?.identifier === projectIdentifier
  );
  const validationChapterCount = $derived(
    validationReport && validationReportMatches
      ? messagesForChapter(validationReport, chapterId).length
      : 0
  );

  $effect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === VALIDATION_REPORT_STORAGE_KEY) {
        validationReport = readValidationReport();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  const IMPACT_RANK: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const impactRank = (impact: string | null): number =>
    impact && impact in IMPACT_RANK ? IMPACT_RANK[impact] : 4;

  function loadAxe(doc: Document, win: AxeWindow): Promise<void> {
    if (win.axe) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const script = doc.createElement('script');
      // Vendored axe.min.js served from the app origin (resolves under any base path).
      script.src = new URL('axe.min.js', document.baseURI).href;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load axe-core'));
      doc.head.appendChild(script);
    });
  }

  function clearHighlights(doc: Document): void {
    doc.querySelectorAll<HTMLElement>('[data-axe-violation]').forEach(el => {
      el.removeAttribute('data-axe-violation');
      el.style.outline = '';
      el.title = '';
    });
  }

  function highlightViolations(doc: Document, violations: AxeViolation[]): void {
    clearHighlights(doc);
    for (const v of violations) {
      for (const node of v.nodes) {
        const selector = node.target[node.target.length - 1];
        let el: HTMLElement | null = null;
        try {
          el = doc.querySelector<HTMLElement>(selector);
        } catch {
          el = null;
        }
        if (!el) continue;
        el.setAttribute('data-axe-violation', v.id);
        el.style.outline = '2px solid #e53935';
        el.title = `${v.help} (${v.impact ?? 'n/a'})`;
      }
    }
  }

  /**
   * The document + window axe should audit: under a reader-engine view the
   * foliate section document (reachable same-origin as
   * `renderer.getContents()[0].doc`, whose sandboxed iframe carries
   * `allow-scripts` so the injected axe bundle runs), otherwise the preview
   * iframe. Resolved fresh per run — each foliate re-render replaces the doc.
   */
  function a11yTarget(): { doc: Document; win: AxeWindow } | null {
    const target = surfaceFor(boundIndexA11y)?.getCheckTarget();
    return target ? { doc: target.doc, win: target.win as AxeWindow } : null;
  }

  async function runA11yCheck(): Promise<void> {
    const target = a11yTarget();
    if (!target) return;
    const { doc, win } = target;
    a11yRunning = true;
    try {
      await loadAxe(doc, win);
      const results = await win.axe!.run(doc);
      const violations = results.violations
        .slice()
        .sort((a, b) => impactRank(a.impact) - impactRank(b.impact));
      a11yIssueCount = violations.length;
      a11yViolations = violations;
      // eslint-disable-next-line no-console
      console.table(
        violations.map(v => ({ impact: v.impact, help: v.help, nodes: v.nodes.length }))
      );
      highlightViolations(doc, violations);
    } catch (error) {
      console.error('Accessibility check failed:', error);
      a11yIssueCount = null;
    } finally {
      a11yRunning = false;
    }
  }

  // Open a specific header panel, or close all with null. The panels are mutually
  // exclusive. Opening Accessibility runs a check; leaving it clears the in-iframe
  // highlight outlines.
  function setPanel(next: PanelId | null): void {
    if (activePanel === 'a11y' && next !== 'a11y') {
      const doc = a11yTarget()?.doc;
      if (doc) clearHighlights(doc);
    }
    if (activePanel === 'sr' && next !== 'sr') teardownSrInstrumentation();
    activePanel = next;
    if (next === 'a11y') void runA11yCheck();
    if (next === 'sr') void openSrPanel();
  }

  // Toggle a panel (button behaviour): re-selecting the open one closes it.
  function togglePanel(panel: PanelId): void {
    setPanel(activePanel === panel ? null : panel);
  }

  // The header panels currently offerable, in display order. Availability varies:
  // Accessibility needs http(s) (axe is fetched from the origin), EpubCheck needs a
  // matching validation report, Reader needs a reflowable non-fixed-layout preview.
  // When more than one is available they collapse into a single dropdown.
  const availablePanels = $derived.by(() => {
    const list: { id: PanelId; label: string; disabled: boolean }[] = [];
    // On foliate views axe runs against the section document (phase B), so it is
    // offered everywhere http(s) allows the bundle fetch.
    if (canCheckA11y) {
      list.push({ id: 'a11y', label: $t('Accessibility'), disabled: !xhtmlContent });
    }
    if (validationReport && validationReportMatches) {
      list.push({ id: 'epubcheck', label: 'EpubCheck', disabled: false });
    }
    if (readerModeActiveAny) {
      list.push({ id: 'reader', label: $t('Reader'), disabled: false });
    }
    // On foliate views the walk targets the section document (phase B); still
    // not on the paged views (Paged.js wrapper elements are not the chapter).
    // Split: superset — offered when EITHER surface's view supports it; the
    // binding rule decides which document it runs against.
    if (
      canSrPreview &&
      (engineOfDevice(selectedDevice.current) !== 'paged' ||
        (splitOn.current && engineOfDevice(selectedDevice2.current) !== 'paged'))
    ) {
      // <!-- i18n: preview Checks dropdown entry — announcement preview -->
      list.push({ id: 'sr', label: $t('Screen reader'), disabled: !xhtmlContent });
    }
    return list;
  });

  // Close a panel the current preview no longer offers (e.g. switching to Print
  // drops Screen reader and Reader) so it can't linger orphaned over the wrong
  // document. setPanel runs the panel's own teardown (highlights, sr chrome).
  $effect(() => {
    if (activePanel && !availablePanels.some(p => p.id === activePanel)) setPanel(null);
  });

  // Option text for the collapsed panel dropdown, appending a count where known.
  function panelOptionLabel(p: { id: PanelId; label: string }): string {
    if (p.id === 'epubcheck' && validationChapterCount > 0) {
      return `${p.label} (${validationChapterCount})`;
    }
    if (p.id === 'a11y' && activePanel === 'a11y' && a11yIssueCount !== null) {
      return `${p.label} (${a11yIssueCount})`;
    }
    return p.label;
  }

  // The preview re-render invalidates the last report; while the panel is open,
  // re-run the check (debounced) so the author sees fresh results as they edit.
  function scheduleAutoA11yCheck(): void {
    if (activePanel !== 'a11y') return;
    clearTimeout(a11yAutoTimer);
    a11yAutoTimer = setTimeout(() => void runA11yCheck(), 500);
  }

  // --- Screen reader announcement preview ---------------------------------------
  // Walks a hovered preview block with the vendored virtual screen reader
  // (public/sr-preview/, lazy-loaded into the preview iframe like axe-core) and
  // captions the announcement phrases over the preview; optionally speaks them.
  // A simulator: phrasing approximates the accessibility tree, not any specific
  // screen reader's dialect. HTTP-only — the bundle is fetched from the origin.
  const canSrPreview = isHttpContext();

  interface VsrWindow extends Window {
    __seedVsr?: VsrLike;
    __seedVsrError?: string;
  }

  let srLoadError = $state(false);
  let srWalking = $state(false);
  // caption: what the author reads (structural vocabulary in the app locale);
  // verbatim: the library's raw phrase, kept reachable as the row's title.
  let srPhrases = $state<{ caption: string; verbatim: string }[]>([]);
  let srCaptionOpen = $state(false);
  let srCaptionLabel = $state('');
  let srDocLang = $state('');
  let srVoices = $state<SpeechSynthesisVoice[]>([]);
  let srCaptionListEl = $state<HTMLOListElement | null>(null);
  let srAbort: AbortController | null = null;
  let srHoverTarget: Element | null = null;
  const speech = new SpeechService();

  const srSpeak = persisted('seedhtml_sr_speak', false, asBoolean);
  // Rate is stored ×10 (5–20 → 0.5×–2.0×) to keep the integer codec.
  const srRate = persisted('seedhtml_sr_rate', 10, asInt({ min: 5, max: 20 }));
  const srVoice = persisted('seedhtml_sr_voice', '', asString);
  // Audience mode, not a verbosity dial: screen readers announce structure;
  // reading apps' built-in narration (read aloud) voices content only.
  const srMode = persisted<'screenreader' | 'readaloud'>(
    'seedhtml_sr_mode',
    'screenreader',
    asEnum(['screenreader', 'readaloud'])
  );

  // Voices for the picker: the book's language first, then the app locale's —
  // the picked voice reads only the book's text, so voices in other languages
  // are noise and are dropped (macOS installs dozens). Only when neither
  // language matches any installed voice does the full list appear, rather
  // than an empty picker.
  const srVoiceOptions = $derived.by(() => {
    const book = srDocLang ? speech.voicesForLang(srVoices, srDocLang) : [];
    const app = speech.voicesForLang(srVoices, $currentLocale).filter(v => !book.includes(v));
    const relevant = [...book, ...app];
    // engines can register the same voice twice (identical voiceURI) — the
    // picker keys options by voiceURI, so keep the first of each
    const seen = new Set<string>();
    return (relevant.length > 0 ? relevant : srVoices).filter(
      v => !seen.has(v.voiceURI) && !!seen.add(v.voiceURI)
    );
  });

  /**
   * The document + window the screen-reader walk operates on: under a
   * reader-engine view the foliate section (`renderer.getContents()[0].doc`
   * and its `defaultView` — the sandboxed section iframe carries `allow-scripts`
   * so the vsr module runs there), the preview iframe otherwise. Resolved fresh
   * per use: a reader re-render replaces the section realm, so `__seedVsr` and
   * the injected instrumentation must be re-established (a flow/column change
   * reuses the same view, so they survive that — see paginator `render()`).
   */
  function srTarget(): { doc: Document; win: VsrWindow } | null {
    const target = surfaceFor(boundIndexSr)?.getCheckTarget();
    return target ? { doc: target.doc, win: target.win as VsrWindow } : null;
  }

  /** The window currently hosting the walk (section under foliate) — the signal
   *  loadVsr polls to notice its target realm was replaced mid-load. */
  const srWindow = (): VsrWindow | null => srTarget()?.win ?? null;

  /**
   * Load the vendored virtual screen reader into the walk's document (once per
   * Window — the module global survives document.open() rewrites, same as
   * win.axe). The inline script publishes success/failure as Window globals.
   */
  function loadVsr(doc: Document, win: VsrWindow): Promise<void> {
    if (win.__seedVsr) return Promise.resolve();
    if (!doc.querySelector('[data-seed-sr-loader]')) {
      const script = doc.createElement('script');
      script.setAttribute('data-seed-sr-loader', '');
      const url = new URL('sr-preview/virtual-screen-reader.js', document.baseURI).href;
      script.textContent =
        `import(${JSON.stringify(url)})` +
        `.then(m => { window.__seedVsr = m.virtual; })` +
        `.catch(e => { window.__seedVsrError = String((e && e.message) || e); });`;
      doc.head.appendChild(script);
    }
    // Poll for the global rather than listening for an event: opening the panel
    // resizes the pane, which re-renders the preview, and document.open() strips
    // every listener from the iframe's Window mid-load. The in-flight import
    // itself survives the rewrite (it belongs to the Window realm), so the
    // global appearing is the reliable completion signal.
    return new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (srWindow() !== win) {
          // The target realm was replaced (device re-key, or a reader re-render
          // building a fresh section); the new one starts its own load — moot.
          reject(new Error('preview window replaced'));
        } else if (win.__seedVsr) {
          resolve();
        } else if (win.__seedVsrError) {
          reject(new Error(win.__seedVsrError));
        } else if (Date.now() - started > 10000) {
          reject(new Error('Timed out loading the virtual screen reader'));
        } else {
          setTimeout(tick, 100);
        }
      };
      tick();
    });
  }

  /**
   * Make the current preview document announceable: load the library and add
   * the hover affordance. Called on panel open and again after every rewrite
   * and device re-key while the panel is active (the fresh document wiped the
   * injected pieces; the library itself is cached on the Window / by http).
   */
  async function ensureSrReady(): Promise<void> {
    const target = srTarget();
    if (!target) return;
    const { doc, win } = target;
    srLoadError = false;
    try {
      await loadVsr(doc, win);
    } catch (error) {
      // The load may have raced a preview rewrite or device re-key; it only
      // failed for real if the current Window still lacks the library (a
      // replaced Window gets its own load from the iframe's load hook).
      const currentWin = srWindow();
      if (currentWin === win && !currentWin?.__seedVsr) {
        console.error('Screen reader preview failed to load:', error);
        srLoadError = true;
      }
      return;
    }
    // Instrument the document that is CURRENT after the await — the one
    // captured above may have been rewritten away while the library loaded.
    const currentDoc = srTarget()?.doc;
    if (activePanel !== 'sr' || !currentDoc?.body) return;
    srDocLang =
      currentDoc.documentElement.getAttribute('lang') ??
      currentDoc.documentElement.getAttribute('xml:lang') ??
      '';
    setupSrInstrumentation(currentDoc);
  }

  /** Inject the announce button + styles into the preview document (idempotent). */
  function setupSrInstrumentation(doc: Document): void {
    if (!doc.body || doc.querySelector('[data-seed-sr-style]')) return;
    const style = doc.createElement('style');
    style.setAttribute('data-seed-sr-style', '');
    style.textContent = `
      [data-seed-sr-target] {
        outline: 2px dashed #7c3aed !important;
        outline-offset: 3px;
      }
      button[data-seed-sr-announce] {
        position: absolute;
        display: none;
        /* Anchored inside the block's top-right corner: inside so it reads as
           part of the outlined block (covering content is fine — transient
           hover chrome), top so reaching it never crosses the block's nested
           children, which would re-target the hover en route. */
        transform: translateX(-100%);
        z-index: 2147483647;
        font: 600 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        white-space: nowrap;
        hyphens: none;
        color: #fff;
        background: #7c3aed;
        border: 0;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }
    `;
    doc.head.appendChild(style);

    const button = doc.createElement('button');
    button.type = 'button';
    button.setAttribute('data-seed-sr-announce', '');
    button.textContent = $t('Announce');
    button.addEventListener('click', event => {
      // Keep the click from reaching the click-to-source document listener.
      event.preventDefault();
      event.stopPropagation();
      if (srHoverTarget) void announceElement(srHoverTarget);
    });
    doc.body.appendChild(button);

    doc.addEventListener('mouseover', handleSrMouseOver);
    doc.documentElement.addEventListener('mouseleave', handleSrMouseLeave);
  }

  /** Remove every injected piece and stop any activity. Library stays cached. */
  function teardownSrInstrumentation(): void {
    cancelSrActivity();
    srCaptionOpen = false;
    srHoverTarget = null;
    const doc = srTarget()?.doc;
    if (!doc) return;
    doc.removeEventListener('mouseover', handleSrMouseOver);
    doc.documentElement.removeEventListener('mouseleave', handleSrMouseLeave);
    doc
      .querySelectorAll('[data-seed-sr-style], [data-seed-sr-announce], [data-seed-sr-loader]')
      .forEach(el => el.remove());
    doc
      .querySelectorAll('[data-seed-sr-target]')
      .forEach(el => el.removeAttribute('data-seed-sr-target'));
  }

  function handleSrMouseOver(event: MouseEvent): void {
    if (srWalking) return;
    // Realm-safe element check: the target belongs to the iframe's realm, so
    // the host's `instanceof Element` is always false for it.
    const target = event.target as Element | null;
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return;
    const doc = target.ownerDocument;
    if (!doc) return;
    const button = doc.querySelector<HTMLButtonElement>('button[data-seed-sr-announce]');
    if (!button || target === button || button.contains(target)) return;
    const block = resolveAnnounceTarget(target);
    if (!block || block === srHoverTarget) return;
    setSrHover(doc, button, block);
  }

  function handleSrMouseLeave(): void {
    if (srWalking) return;
    const doc = srTarget()?.doc;
    const button = doc?.querySelector<HTMLButtonElement>('button[data-seed-sr-announce]');
    if (doc && button) setSrHover(doc, button, null);
  }

  /** Move the hover outline + announce button to a block (or clear with null). */
  function setSrHover(doc: Document, button: HTMLButtonElement, block: Element | null): void {
    srHoverTarget?.removeAttribute('data-seed-sr-target');
    srHoverTarget = block;
    if (!block) {
      button.style.display = 'none';
      return;
    }
    block.setAttribute('data-seed-sr-target', '');
    const win = doc.defaultView;
    const rect = block.getBoundingClientRect();
    const scrollX = win?.scrollX ?? 0;
    const scrollY = win?.scrollY ?? 0;
    button.style.display = 'block';
    // Top-right corner, inside the block (the translate right-aligns).
    button.style.left = `${rect.right + scrollX - 3}px`;
    button.style.top = `${rect.top + scrollY + 3}px`;
  }

  /** Abort the running walk and silence queued speech. Caption content stands. */
  function cancelSrActivity(): void {
    srAbort?.abort();
    srAbort = null;
    speech.cancel();
    srWalking = false;
  }

  /** Caption heading for a walk target, e.g. `<li>` — or the whole chapter. */
  function srLabelFor(el: Element): string {
    const doc = srTarget()?.doc;
    return el === doc?.body ? $t('Whole chapter') : `<${el.tagName.toLowerCase()}>`;
  }

  /** Walk one element, streaming phrases into the caption (and speech). */
  async function announceElement(el: Element): Promise<void> {
    const win = srTarget()?.win;
    const vsr = win?.__seedVsr;
    if (!vsr) return;
    cancelSrActivity();
    const controller = new AbortController();
    srAbort = controller;
    srPhrases = [];
    srCaptionLabel = srLabelFor(el);
    srCaptionOpen = true;
    srWalking = true;
    const lang = srDocLang || undefined;
    // The session always starts on the body so the target announces with its
    // full document context (list nesting level, position, set size); the
    // cursor then jumps to the target inside walkAnnouncements.
    const body = srTarget()?.doc?.body;
    try {
      await walkAnnouncements(vsr, body ?? el, {
        signal: controller.signal,
        target: el === body ? undefined : el,
        onPhrase: phrase => {
          if (srMode.current === 'readaloud') {
            // Read-aloud audience: content only, the way reading apps'
            // built-in narration voices a chapter. Everything speaks with
            // the book-language voice.
            const content = contentPhrase(phrase);
            if (content === null) return;
            // a table's name repeats via its caption element — drop the echo
            if (srPhrases.at(-1)?.caption === content) return;
            srPhrases = [...srPhrases, { caption: content, verbatim: phrase }];
            if (srSpeak.current) {
              speech.speak(
                content,
                { rate: srRate.current / 10, voiceURI: srVoice.current || null, lang },
                srVoices
              );
            }
            return;
          }
          // Structure follows the listener, content follows the book — the
          // convention real screen readers use. Structural phrases render and
          // speak in the app locale's vocabulary and default voice; content is
          // spoken verbatim with the book-language voice, and only content
          // gets the author's picked voice.
          const structural = isStructuralPhrase(phrase);
          const caption = structural ? speakablePhrase(phrase, translate) : phrase;
          srPhrases = [...srPhrases, { caption, verbatim: phrase }];
          if (srSpeak.current) {
            if (structural) {
              speech.speak(caption, { rate: srRate.current / 10, lang: $currentLocale }, srVoices);
            } else {
              speech.speak(
                phrase,
                { rate: srRate.current / 10, voiceURI: srVoice.current || null, lang },
                srVoices
              );
            }
          }
        },
      });
    } catch (error) {
      console.error('Screen reader walk failed:', error);
    } finally {
      if (srAbort === controller) srWalking = false;
    }
  }

  function announceChapter(): void {
    const body = srTarget()?.doc?.body;
    if (body) void announceElement(body);
  }

  function closeSrCaption(): void {
    cancelSrActivity();
    srCaptionOpen = false;
  }

  async function openSrPanel(): Promise<void> {
    void speech.getVoices().then(voices => (srVoices = voices));
    await ensureSrReady();
  }

  // Keep the caption scrolled to the newest phrase as the walk streams.
  $effect(() => {
    void srPhrases.length;
    srCaptionListEl?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  });

  // Component teardown: never leave queued speech playing.
  $effect(() => () => cancelSrActivity());

  // Category labels for dropdown groups
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'responsive':
        // i18n: Device category for responsive preview that fills available space
        return $t('Responsive');
      case 'commute':
        // i18n: Device category for mobile phone reading while traveling or commuting
        return $t('Commute (phone)');
      case 'home':
        // i18n: Device category for tablet reading in comfortable home settings
        return $t('Home (tablet)');
      case 'travel':
        // i18n: Device category for e-reader devices designed for portable reading
        return $t('Travel (e-ink)');
      case 'print':
        // i18n: Dropdown group label for the paginated PDF page preview
        return $t('PDF');
      default:
        return category;
    }
  };

  // Device size labels
  const getDeviceLabel = (device: (typeof DEVICE_PRESETS)[number]) => {
    const name: string = device.name;
    switch (name) {
      case 'Fill':
        // i18n: Responsive view that fills all available preview space
        return $t('Fill');
      case 'Pocket':
        // i18n: Device size for smallest mobile phones that fit in pocket
        return $t('Pocket');
      case 'Standard':
        // i18n: Device size for typical/common mobile phone or e-reader screen
        return $t('Standard');
      case 'Large':
        // i18n: Device size for larger mobile phones or e-readers
        return $t('Large');
      case 'Plus':
        // i18n: Device size for extra large mobile phones
        return $t('Plus');
      case 'Compact':
        // i18n: Device size for smaller tablet screens
        return $t('Compact');
      case 'Extra Large':
        // i18n: Device size for largest tablet screens
        return $t('Extra Large');
      case 'Print':
        // i18n: The paginated print-page preview option
        return $t('Print');
      case 'Proofs':
        // i18n: The chapter-proofs preview option — a grid of small print pages
        return $t('Proofs');
      default:
        return name;
    }
  };

  // Component state
  // Remember the chosen preview device across spine items and sessions. Restored
  // value is validated against the presets (and the onMount guard below drops a
  // stale 'print' under file://); falls back to 'desktop'.
  const selectedDevice = persisted(
    'seedhtml_preview_device',
    'desktop',
    asEnum(DEVICE_PRESETS.map(d => d.id))
  );
  let showSource = $state(false);
  // Source view rendering: raw <pre> (always available) or the collapsible
  // tree (http-only — the vendored viewer is fetched from the app origin).
  // Session-local; not persisted.
  const canSourceTree = canShowXmlTree();
  let sourceTree = $state(false);

  // --- Split preview (process/SPLIT_PREVIEW.md phase 2) ------------------------
  // A second, independent surface below the first. Its settings mirror the
  // top's under `_2` keys; the split itself persists, and the splitter
  // position persists through PaneForge (autoSaveId seedhtml-preview-panes).
  const splitOn = persisted('seedhtml_preview_split', false, asBoolean);
  const selectedDevice2 = persisted(
    'seedhtml_preview_device_2',
    'desktop',
    asEnum(DEVICE_PRESETS.map(d => d.id))
  );
  let showSource2 = $state(false);
  let sourceTree2 = $state(false);
  const readFlow2 = persisted<ReadFlow>(
    'seedhtml_preview_read_flow_2',
    'paginated',
    asEnum(['paginated', 'scrolled'])
  );
  const readColumns2 = persisted<ReadColumns>(
    'seedhtml_preview_read_columns_2',
    '2',
    asEnum(['1', '2'])
  );
  let surfaceRef2 = $state<ReturnType<typeof PreviewSurface> | undefined>();
  const surfaceFor = (which: 1 | 2) => (which === 1 ? surfaceRef : surfaceRef2);

  function toggleSplit(): void {
    // The surfaces remount into the new layout; each fresh instance sizes and
    // renders itself (mount sizing + the first-show render effect).
    splitOn.current = !splitOn.current;
  }

  // --- Check binding (split) ----------------------------------------------------
  // Every check runs against ONE document. Binding rule: a check targets the
  // top surface when the top surface's view supports it, otherwise the bottom
  // (process/SPLIT_PREVIEW.md). The screen reader follows the same rule — one
  // injected walker, one speech queue; two documents cannot share it.
  function viewSupportsCheck(check: 'a11y' | 'sr', dev: string, source: boolean): boolean {
    if (source) return false; // the Source view has no rendered document
    // axe can audit any rendered document; the SR walk stays off the paged
    // views (Paged.js wrapper elements are not the chapter).
    return check === 'a11y' ? true : engineOfDevice(dev) !== 'paged';
  }
  const boundIndexA11y = $derived(
    viewSupportsCheck('a11y', selectedDevice.current, showSource)
      ? 1
      : splitOn.current && viewSupportsCheck('a11y', selectedDevice2.current, showSource2)
        ? 2
        : 1
  );
  const boundIndexSr = $derived(
    viewSupportsCheck('sr', selectedDevice.current, showSource)
      ? 1
      : splitOn.current && viewSupportsCheck('sr', selectedDevice2.current, showSource2)
        ? 2
        : 1
  );

  // --- Fixed-layout page box -------------------------------------------------
  // For pre-paginated books the device presets behave like a real FXL reading
  // system: the page renders at its DECLARED viewport size and is contain-fit
  // into the device frame (letterboxed). This inner page scale is orthogonal
  // to the outer deviceScale frame fit and depends only on fixed pixel sizes,
  // so it needs no resize handling.
  const fxlActive = $derived(isFixedLayout && !isFillDevice(selectedDevice.current));
  const fxlPage = $derived(parseFxlViewport(renditionViewport));
  const fxlPageLabel = $derived(`${fxlPage.width}×${fxlPage.height}`);
  // Measured overflow of the FXL page beyond its declared box, read from the
  // rendering surface (which measures the document as it renders).
  const fxlOverflow = $derived(surfaceRef ? surfaceRef.fxlOverflowSize() : null);

  // Reader pager/columns state for the options bar, read from the surface.
  const pager = $derived(
    surfaceRef?.pagerState() ?? {
      enabled: false,
      page: 0,
      pages: 0,
      columnsEnabled: readFlow.current === 'paginated',
    }
  );
  const pager2 = $derived(
    surfaceRef2?.pagerState() ?? {
      enabled: false,
      page: 0,
      pages: 0,
      columnsEnabled: readFlow2.current === 'paginated',
    }
  );

  // Everything the shared options-bar snippet needs, per surface.
  const bar1 = $derived({
    which: 1 as 1 | 2,
    device: selectedDevice.current,
    showSource,
    sourceTree,
    flow: readFlow.current,
    columns: readColumns.current,
    pager,
  });
  const bar2 = $derived({
    which: 2 as 1 | 2,
    device: selectedDevice2.current,
    showSource: showSource2,
    sourceTree: sourceTree2,
    flow: readFlow2.current,
    columns: readColumns2.current,
    pager: pager2,
  });

  /** A surface's options bar renders only when its view has inputs
   *  (process/PREVIEW_OPTIONS_BAR.md). */
  const barVisible = (bar: typeof bar1): boolean =>
    bar.showSource ? canSourceTree : usesFoliate(bar.device) || !isFillDevice(bar.device);

  // Group devices by category for dropdown
  const groupedDevices = $derived.by(() => {
    const groups: Record<string, (typeof DEVICE_PRESETS)[number][]> = {};

    for (const device of DEVICE_PRESETS) {
      // Paged previews (Print, Proofs) are HTTP-only (Paged.js is fetched from
      // the app origin).
      if (device.category === 'print' && !canPaginate) continue;
      if (!groups[device.category]) {
        groups[device.category] = [];
      }
      groups[device.category].push(device);
    }

    return groups;
  });

  // The responsive (fill) preset(s), rendered ungrouped at the top of the view
  // dropdown alongside Source rather than under a category header.
  const responsiveDevices = $derived(DEVICE_PRESETS.filter(d => d.category === 'responsive'));

  // The READ.html reader preset, ungrouped right after Responsive (a one-item
  // optgroup would just repeat its own label). HTTP-only; hidden for
  // fixed-layout chapters (foliate's pre-paginated renderer is out of scope —
  // renderNow falls back to the plain render if the device is still selected).
  const readDevices = $derived(
    canReadPreview && !isFixedLayout ? DEVICE_PRESETS.filter(d => d.category === 'read') : []
  );

  // Reader-mode preview state (theme + font size + force-colours). View-only — never
  // written to the generated/exported XHTML; persisted app-wide like the device.
  const previewTheme = persisted<'light' | 'sepia' | 'dark'>(
    'seedhtml_preview_theme',
    'light',
    asEnum(['light', 'sepia', 'dark'])
  );
  const fontStep = persisted(
    'seedhtml_preview_font_step',
    2,
    asInt({ min: 0, max: FONT_STEPS.length - 1 })
  );
  const forceColors = persisted('seedhtml_preview_force_colors', false, asBoolean);

  // Props identical for both surfaces: the chapter's data, the shared reader
  // appearance, and the pass-through callbacks.
  const sharedSurfaceProps = $derived({
    xhtmlContent,
    persistedXhtml,
    isTransforming,
    transformError,
    transformWarnings,
    executionTime,
    onNavigate,
    onPreviewClick,
    chapterId,
    printSettings,
    onGeneratePdf,
    previewHead,
    extensionPreviewHead,
    previewAutoUpdate,
    previewIncludeHead,
    isFixedLayout,
    renditionViewport,
    onSavePreviewData,
    getPagedStartPage,
    readerTheme: previewTheme.current,
    fontStepIndex: fontStep.current,
    forceColors: forceColors.current,
  });

  // Whether the reader-mode controls apply: reflowable previews only (not the print
  // preset, not fixed-layout chapters — readers disable user theming/sizing there).
  // Foliate-rendered views (READ.html + device presets) are included: their sim
  // goes through renderer.setStyles() instead of head injection.
  const readerModeActive = $derived(
    engineOfDevice(selectedDevice.current) !== 'paged' && !isFixedLayout
  );
  // Split: the reader panel controls SHARED appearance (theme/font), so it is
  // offered when either surface shows a reflowable rendered view.
  const readerModeActiveAny = $derived(
    readerModeActive ||
      (splitOn.current && engineOfDevice(selectedDevice2.current) !== 'paged' && !isFixedLayout)
  );

  function decreaseFont(): void {
    if (fontStep.current > 0) fontStep.current -= 1;
  }
  function increaseFont(): void {
    if (fontStep.current < FONT_STEPS.length - 1) fontStep.current += 1;
  }

  // Page-size CSS token → short dropdown label.
  const PAGE_SIZE_LABELS: Record<string, string> = {
    A4: 'A4',
    A5: 'A5',
    A6: 'A6',
    B5: 'B5',
    letter: 'Letter',
    legal: 'Legal',
  };
  // The Print option shows the current page size + margin (e.g. "A4 18mm") rather
  // than a redundant "Print" under the "Print" group heading.
  const printDeviceLabel = $derived.by(() => {
    const size = printSettings?.custom_size?.trim() || printSettings?.page_size || 'A4';
    const sizeLabel = PAGE_SIZE_LABELS[size] ?? size;
    const mm = MARGIN_MM[printSettings?.margin ?? 'normal'] ?? MARGIN_MM.normal;
    const margin = printSettings?.custom_margin?.trim() || `${mm}mm`;
    return `${sizeLabel} ${margin}`;
  });

  function setReadFlow(value: string, which: 1 | 2 = 1): void {
    (which === 1 ? readFlow : readFlow2).current = value as ReadFlow;
    surfaceFor(which)?.applyReadSettings();
  }

  function setReadColumns(value: string, which: 1 | 2 = 1): void {
    (which === 1 ? readColumns : readColumns2).current = value as ReadColumns;
    surfaceFor(which)?.applyReadSettings();
  }

  function setSourceTree(value: boolean, which: 1 | 2): void {
    if (which === 1) sourceTree = value;
    else sourceTree2 = value;
  }

  /**
   * Handle device preset selection: the setting is pane-owned, the frame
   * sizing lives in the surface.
   */
  function handleDeviceChange(deviceId: string, which: 1 | 2 = 1): void {
    (which === 1 ? selectedDevice : selectedDevice2).current =
      deviceId as (typeof DEVICE_PRESETS)[number]['id'];
    surfaceFor(which)?.applyDeviceSizing(deviceId);
  }

  /**
   * Toggle source view
   */
  // Pick either the generated-source view or a device preset from a view
  // dropdown. Switching away from source re-renders the preview and re-applies
  // the chosen device's dimensions/scaling.
  function handleViewSelect(value: string, which: 1 | 2 = 1): void {
    if (value === 'source') {
      // The Source view is advanced-only; ignore the selection in basic mode
      // (the option is also hidden from the dropdown there).
      if (advancedMode) {
        if (which === 1) showSource = true;
        else showSource2 = true;
      }
      return;
    }
    const wasSource = which === 1 ? showSource : showSource2;
    if (which === 1) showSource = false;
    else showSource2 = false;
    if (wasSource) {
      // Leaving the source view: re-render, then re-apply the chosen device's
      // dimensions/scaling once the preview iframe is back in the DOM.
      setTimeout(() => {
        surfaceFor(which)?.renderNow();
        handleDeviceChange(value, which);
      }, 0);
    } else {
      handleDeviceChange(value, which);
    }
  }

  onMount(() => {
    // Print and READ.html previews are HTTP-only; never start on them under file://.
    if (engineOfDevice(selectedDevice.current) === 'paged' && !canPaginate)
      selectedDevice.current = 'desktop';
    if (selectedDevice.current === 'read' && !canReadPreview) selectedDevice.current = 'desktop';
    if (engineOfDevice(selectedDevice2.current) === 'paged' && !canPaginate)
      selectedDevice2.current = 'desktop';
    if (selectedDevice2.current === 'read' && !canReadPreview) selectedDevice2.current = 'desktop';

    return () => {
      // Timers this component scheduled must not outlive it (2026-07 timer audit).
      clearTimeout(a11yAutoTimer);
    };
  });
</script>

<div class="preview-pane-container">
  <!-- Header with controls -->
  <div class="preview-header">
    <!-- These wrappers are display:contents (structure/branching only): every
         control is a direct flex item of .preview-header, so narrow panes pack
         the device + panel dropdowns onto one shared wrap row. The device
         dropdown right-floats via margin-inline-start:auto. -->
    <div class="header-main">
      <div class="preview-title">
        <!-- Previous/next chapter navigation (replaces the filename readout —
             the chapter's identity is already in the sidebar and editor). -->
        {#if chapterId}
          <div class="chapter-nav">
            <button
              type="button"
              class="btn btn-icon chapter-nav-btn"
              disabled={!spineNeighbors?.prev}
              onclick={() => spineNeighbors?.prev && onNavigate?.(spineNeighbors.prev)}
              aria-label={$t('Previous chapter')}
              title={spineNeighbors?.prev ?? undefined}
            >
              <CaretLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="btn btn-icon chapter-nav-btn"
              disabled={!spineNeighbors?.next}
              onclick={() => spineNeighbors?.next && onNavigate?.(spineNeighbors.next)}
              aria-label={$t('Next chapter')}
              title={spineNeighbors?.next ?? undefined}
            >
              <CaretRight size={16} aria-hidden="true" />
            </button>
          </div>
        {/if}

        <!-- Transform status: failures stay persistently visible in the header. The
           success (timing) + content-size move to the hover/focus overlay below. -->
        {#if isTransforming}
          <div class="status-indicator transforming" title={$t('Transform in progress')}>
            <div class="status-spinner"></div>
            <span>{$t('Transforming...')}</span>
          </div>
        {:else if transformError}
          <div class="status-indicator error" title={$t('Transform error')}>
            <span class="status-icon">⚠️</span>
            <span>{$t('Error')}</span>
          </div>
        {:else if transformWarnings.length > 0}
          <div
            class="status-indicator warning"
            title={$t('{n} warnings', { n: transformWarnings.length })}
          >
            <span class="status-icon">⚠️</span>
            <span>{transformWarnings.length} {$t('warnings')}</span>
          </div>
        {/if}

        <!-- On-demand refresh: shown when the current preview type has auto-update off
           and the chapter (or injected head) changed since it was last rendered.
           Placed after the transform status (rather than among the device controls)
           so the control order stays stable as it appears/disappears. -->
        {#if surfaceRef?.isStale()}
          <button
            type="button"
            class="print-refresh"
            onclick={() => surfaceRef?.renderNow()}
            title={$t('Preview out of date')}
            aria-label={$t('Refresh')}
          >
            <ArrowsClockwise size={16} aria-hidden="true" />
          </button>
        {/if}

        <!-- Fixed-layout page box: the declared size the author is composing
             against; warning-coloured when the chapter's content exceeds it. -->
        {#if fxlActive}
          <div
            class="status-indicator fxl-badge"
            class:warning={fxlOverflow}
            title={fxlOverflow
              ? $t('Content is {cw}×{ch}px; the declared page is {pw}×{ph}px', {
                  cw: fxlOverflow.width,
                  ch: fxlOverflow.height,
                  pw: fxlPage.width,
                  ph: fxlPage.height,
                })
              : $t('Declared fixed-layout page size')}
          >
            {#if fxlOverflow}<span class="status-icon">⚠️</span>{/if}
            <span
              >{fxlOverflow ? $t('overflows {size}', { size: fxlPageLabel }) : fxlPageLabel}</span
            >
          </div>
        {/if}

        <!-- View selector: the generated Source view + the device presets. Source and
             the responsive (fill) preset sit ungrouped at the top; the sized device
             presets follow under their category groups. The option list is shared
             with the split's second dropdown. -->
        {#snippet deviceOptions()}
          {#if advancedMode}
            <option value="source">{$t('Source')}</option>
          {/if}
          {#each responsiveDevices as device}
            <option value={device.id}>{$t('Responsive')}</option>
          {/each}
          {#each readDevices as device}
            <!-- i18n-ignore: product name, not translated -->
            <option value={device.id}>READ.html</option>
          {/each}
          {#each Object.entries(groupedDevices) as [category, devices]}
            {#if category !== 'responsive' && category !== 'read'}
              <optgroup label={getCategoryLabel(category)}>
                {#each devices as device}
                  <option value={device.id}>
                    {device.id === 'print' ? printDeviceLabel : getDeviceLabel(device)}
                  </option>
                {/each}
              </optgroup>
            {/if}
          {/each}
        {/snippet}
        <!-- i18n: Accessibility label for the view / device dropdown menu -->
        <select
          class="device-selector"
          value={showSource ? 'source' : selectedDevice.current}
          onchange={e => handleViewSelect((e.target as HTMLSelectElement).value, 1)}
          aria-label={$t('Select view')}
        >
          {@render deviceOptions()}
        </select>
        {#if splitOn.current}
          <!-- The split's second dropdown, driving the bottom surface. -->
          <!-- i18n: Accessibility label for the split preview's second view dropdown -->
          <select
            class="device-selector second-view"
            value={showSource2 ? 'source' : selectedDevice2.current}
            onchange={e => handleViewSelect((e.target as HTMLSelectElement).value, 2)}
            aria-label={$t('Select second view')}
          >
            {@render deviceOptions()}
          </select>
        {/if}
      </div>
    </div>

    <div class="preview-controls">
      {#if availablePanels.length >= 2}
        <!-- More than one panel available: collapse into a single dropdown, with a
             "Checks" entry as the none-open state. -->
        <select
          class="device-selector panel-selector"
          value={activePanel ?? ''}
          onchange={e =>
            setPanel(((e.currentTarget as HTMLSelectElement).value || null) as PanelId | null)}
          aria-label={$t('Show panel')}
        >
          <option value="">{$t('Checks')}</option>
          {#each availablePanels as panel}
            <option value={panel.id} disabled={panel.disabled}>{panelOptionLabel(panel)}</option>
          {/each}
        </select>
      {:else}
        <!-- Accessibility check: inject axe-core and run it against the preview
             (the foliate section document on reader-engine views). -->
        {#if canCheckA11y}
          <button
            type="button"
            class="a11y-check"
            class:active={activePanel === 'a11y'}
            onclick={() => togglePanel('a11y')}
            disabled={!xhtmlContent}
            aria-pressed={activePanel === 'a11y'}
            title={$t('Accessibility check (axe-core) — re-runs as you edit while open')}
          >
            {a11yRunning ? $t('Checking…') : $t('Accessibility')}
            {#if !a11yRunning && activePanel === 'a11y' && a11yIssueCount !== null}
              <span class="a11y-count" class:clean={a11yIssueCount === 0}>{a11yIssueCount}</span>
            {/if}
          </button>
        {/if}

        <!-- Validation report (epubcheck), opened like the accessibility panel.
           Only shown when the report belongs to the current project. -->
        {#if validationReport && validationReportMatches}
          <button
            type="button"
            class="a11y-check"
            class:active={activePanel === 'epubcheck'}
            onclick={() => togglePanel('epubcheck')}
            aria-pressed={activePanel === 'epubcheck'}
            title={$t('Validation report (epubcheck) for this chapter')}
          >
            EpubCheck
            {#if validationChapterCount > 0}
              <span class="a11y-count">{validationChapterCount}</span>
            {/if}
          </button>
        {/if}

        <!-- Reader-mode panel toggle (theme + text size). Reflowable previews only —
           hidden for the print preset and fixed-layout chapters. The controls live
           in a closable panel below the header (like the other checks). -->
        {#if readerModeActive}
          <button
            type="button"
            class="a11y-check"
            class:active={activePanel === 'reader'}
            onclick={() => togglePanel('reader')}
            aria-pressed={activePanel === 'reader'}
            title={$t('Reading preview (theme and text size)')}
          >
            {$t('Reader')}
          </button>
        {/if}
      {/if}
    </div>

    <!-- Split toggle: add/remove the second preview surface
         (process/SPLIT_PREVIEW.md). Between the checks dropdown and the pinned
         hide-preview button, mirroring the editor pane's toggle and icons. -->
    <button
      type="button"
      class="btn btn-icon btn-icon-lg"
      onclick={toggleSplit}
      aria-pressed={splitOn.current}
      title={splitOn.current ? $t('Switch to single preview') : $t('Add second preview pane')}
      aria-label={splitOn.current ? $t('Switch to single preview') : $t('Add second preview pane')}
    >
      {#if splitOn.current}
        <SquareIcon size={16} aria-hidden="true" />
      {:else}
        <RowsIcon size={16} aria-hidden="true" />
      {/if}
    </button>

    <!-- Collapse the preview pane (spine view only) — mirrors the sidebar's
         toggle, right edge instead of left. Pinned to the header's top-right
         corner (out of flow, so it never adds row height): right of the Checks
         dropdown on a single row, right of the device dropdown when the
         controls wrap. Reopened from the rail that replaces the pane
         (LayoutManager). -->
    <button
      type="button"
      class="btn btn-icon btn-icon-lg preview-collapse"
      onclick={() => layoutStore.toggleSpinePreview()}
      aria-expanded="true"
      aria-label={$t('Hide preview')}
      title={$t('Hide preview')}
    >
      <CaretRight size={16} aria-hidden="true" />
    </button>
  </div>

  <!-- Preview options bar: the inputs specific to a surface's current preview,
       kept in fixed positions and disabled-in-place (never
       appearing/disappearing) so the permanent header above stays still.
       Present only when that preview has options — the reader controls for
       foliate views, the orientation toggle for scaled device frames, the
       raw/tree rendering for the Source view (online only). One snippet, two
       renderings: the TOP surface's bar here in band 2 (above the checks
       panels), the BOTTOM surface's attached to the top of the lower split
       pane. See process/PREVIEW_OPTIONS_BAR.md + process/SPLIT_PREVIEW.md. -->
  {#snippet optionsBar(bar: typeof bar1)}
    <div class="preview-options">
      {#if bar.showSource}
        <select
          class="device-selector read-control"
          value={bar.sourceTree ? 'tree' : 'raw'}
          onchange={e =>
            setSourceTree((e.currentTarget as HTMLSelectElement).value === 'tree', bar.which)}
          aria-label={$t('Source rendering')}
        >
          <option value="raw">{$t('Raw')}</option>
          <option value="tree">{$t('Tree')}</option>
        </select>
      {/if}
      {#if !bar.showSource && usesFoliate(bar.device)}
        <!-- Reading flow — always live. Applied to the running renderer, no re-render. -->
        <select
          class="device-selector read-control"
          value={bar.flow}
          onchange={e => setReadFlow((e.currentTarget as HTMLSelectElement).value, bar.which)}
          aria-label={$t('Reading flow')}
        >
          <!-- i18n: Reading flow option — paginated pages -->
          <option value="paginated">{$t('Pages')}</option>
          <!-- i18n: Reading flow option — continuous vertical scroll -->
          <option value="scrolled">{$t('Scroll')}</option>
        </select>

        <!-- Column cap — the fill-size READ.html entry only (device widths decide
             columns honestly). Held in place and disabled under Scroll. -->
        {#if bar.device === 'read'}
          <select
            class="device-selector read-control"
            value={bar.columns}
            onchange={e => setReadColumns((e.currentTarget as HTMLSelectElement).value, bar.which)}
            aria-label={$t('Columns')}
            disabled={!bar.pager.columnsEnabled}
          >
            <!-- i18n: Column setting — up to two columns where they fit -->
            <option value="2">{$t('Auto columns')}</option>
            <!-- i18n: Column setting — always a single column -->
            <option value="1">{$t('Single column')}</option>
          </select>
        {/if}

        <!-- Page navigation: reading-direction-aware turn buttons + a direct page
             picker (arrow keys work too while the preview is focused). Held in
             place and disabled under Scroll or a single-page chapter. -->
        <span class="read-pager">
          <button
            type="button"
            class="orientation-toggle"
            onclick={() => surfaceFor(bar.which)?.readPageLeft()}
            disabled={!bar.pager.enabled}
            aria-label={$t('Previous page')}
            title={$t('Previous page')}
          >
            <CaretLeft size={16} aria-hidden="true" />
          </button>
          <select
            class="device-selector read-control"
            value={String(bar.pager.enabled ? bar.pager.page : 1)}
            onchange={e =>
              surfaceFor(bar.which)?.goToReadPage((e.currentTarget as HTMLSelectElement).value)}
            aria-label={$t('Page')}
            disabled={!bar.pager.enabled}
          >
            {#if bar.pager.enabled}
              {#each Array.from({ length: bar.pager.pages }, (_, i) => i + 1) as n}
                <option value={String(n)}>{n} / {bar.pager.pages}</option>
              {/each}
            {:else}
              <option value="1">1 / 1</option>
            {/if}
          </select>
          <button
            type="button"
            class="orientation-toggle"
            onclick={() => surfaceFor(bar.which)?.readPageRight()}
            disabled={!bar.pager.enabled}
            aria-label={$t('Next page')}
            title={$t('Next page')}
          >
            <CaretRight size={16} aria-hidden="true" />
          </button>
        </span>
      {/if}

      <!-- Orientation — scaled device frames only (not the fill presets or print). -->
      {#if !bar.showSource && !isFillDevice(bar.device)}
        <button
          type="button"
          class="orientation-toggle"
          onclick={() => surfaceFor(bar.which)?.toggleOrientation()}
          title={$t('Toggle orientation')}
          aria-label={$t('Toggle device orientation')}
        >
          <DeviceRotate size={16} aria-hidden="true" />
        </button>
      {/if}
    </div>
  {/snippet}
  {#if barVisible(bar1)}
    {@render optionsBar(bar1)}
  {/if}

  <!-- Accessibility results panel (spike): plain-text violations, sorted by impact -->
  {#if activePanel === 'a11y'}
    <div class="a11y-panel" role="region" aria-label={$t('Accessibility issues')}>
      <div class="a11y-panel-header">
        <strong>
          {a11yViolations.length === 0
            ? $t('No accessibility issues found')
            : $t('{count} accessibility issues', { count: a11yViolations.length })}
        </strong>
        <button
          type="button"
          class="btn btn-icon"
          onclick={() => togglePanel('a11y')}
          aria-label={$t('Close accessibility panel')}
          title={$t('Close')}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {#if a11yViolations.length > 0}
        <ul class="a11y-list">
          {#each a11yViolations as v (v.id)}
            <li class="a11y-item">
              <span class="a11y-impact" data-impact={v.impact ?? 'minor'}>
                {v.impact ?? $t('n/a')}
              </span>
              <div class="a11y-detail">
                <span class="a11y-help" title={v.description}>{v.help}</span>
                <span class="a11y-meta">
                  {v.nodes.length}
                  {$t('element')}{v.nodes.length === 1 ? '' : 's'} ·
                  <a href={v.helpUrl} target="_blank" rel="noopener noreferrer"
                    >{$t('learn more')}</a
                  >
                </span>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <!-- Validation report reference (shares this band with the a11y panel) -->
  {#if activePanel === 'epubcheck' && validationReport && validationReportMatches}
    <ChapterValidationPanel
      report={validationReport}
      {chapterId}
      onClose={() => (activePanel = null)}
    />
  {/if}

  <!-- Reader-mode panel: theme + text size + force-colours, in the same band as the
       other checks. Reflowable previews only. -->
  {#if activePanel === 'reader' && readerModeActiveAny}
    <div class="a11y-panel reader-panel" role="region" aria-label={$t('Reading preview settings')}>
      <div class="a11y-panel-header">
        <strong>{$t('Reading preview')}</strong>
        <button
          type="button"
          class="btn btn-icon"
          onclick={() => togglePanel('reader')}
          aria-label={$t('Close reading preview panel')}
          title={$t('Close')}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div class="reader-panel-body">
        <!-- Theme -->
        <div class="reader-field">
          <span class="reader-label" id="reader-theme-label">{$t('Theme')}</span>
          <div class="theme-options" role="radiogroup" aria-labelledby="reader-theme-label">
            <button
              type="button"
              class="theme-option"
              class:selected={previewTheme.current === 'light'}
              role="radio"
              aria-checked={previewTheme.current === 'light'}
              onclick={() => (previewTheme.current = 'light')}
            >
              {$t('Light')}
            </button>
            <button
              type="button"
              class="theme-option"
              class:selected={previewTheme.current === 'sepia'}
              role="radio"
              aria-checked={previewTheme.current === 'sepia'}
              onclick={() => (previewTheme.current = 'sepia')}
            >
              {$t('Sepia')}
            </button>
            <button
              type="button"
              class="theme-option"
              class:selected={previewTheme.current === 'dark'}
              role="radio"
              aria-checked={previewTheme.current === 'dark'}
              onclick={() => (previewTheme.current = 'dark')}
            >
              {$t('Dark')}
            </button>
          </div>
        </div>

        <!-- Text size -->
        <div class="reader-field">
          <span class="reader-label">{$t('Text size')}</span>
          <div class="font-size-control">
            <button
              type="button"
              class="font-step"
              onclick={decreaseFont}
              disabled={fontStep.current === 0}
              aria-label={$t('Decrease text size')}
              title={$t('Decrease text size')}
            >
              A<span class="font-step-sign">−</span>
            </button>
            <span class="font-step-readout" aria-live="polite"
              >{fontStep.current + 1}/{FONT_STEPS.length}</span
            >
            <button
              type="button"
              class="font-step"
              onclick={increaseFont}
              disabled={fontStep.current === FONT_STEPS.length - 1}
              aria-label={$t('Increase text size')}
              title={$t('Increase text size')}
            >
              A<span class="font-step-sign">+</span>
            </button>
          </div>
        </div>

        <!-- Force reading-system colours -->
        <label class="reader-toggle">
          <input type="checkbox" bind:checked={forceColors.current} />
          <CircleHalf size={16} aria-hidden="true" />
          <span>{$t('Force reading-system colours')}</span>
        </label>
        <p class="reader-note">
          {$t('Approximates a reading system. Preview only.')}
        </p>
      </div>
    </div>
  {/if}

  <!-- Screen reader announcement panel: hover affordance options + whole-chapter
       walk, in the same band as the other checks. HTTP-only (vendored library). -->
  {#if activePanel === 'sr'}
    <div class="a11y-panel reader-panel" role="region" aria-label={$t('Screen reader preview')}>
      <div class="a11y-panel-header">
        <strong>{$t('Screen reader preview')}</strong>
        <button
          type="button"
          class="btn btn-icon"
          onclick={() => togglePanel('sr')}
          aria-label={$t('Close screen reader panel')}
          title={$t('Close')}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div class="reader-panel-body">
        {#if srLoadError}
          <p class="reader-note">{$t('Could not load the screen reader preview.')}</p>
        {:else}
          <div class="reader-field">
            <span class="reader-label" id="sr-mode-label">{$t('Announcement style')}</span>
            <div class="theme-options" role="radiogroup" aria-labelledby="sr-mode-label">
              <button
                type="button"
                class="theme-option"
                class:selected={srMode.current === 'screenreader'}
                role="radio"
                aria-checked={srMode.current === 'screenreader'}
                onclick={() => (srMode.current = 'screenreader')}
              >
                {$t('Screen reader')}
              </button>
              <button
                type="button"
                class="theme-option"
                class:selected={srMode.current === 'readaloud'}
                role="radio"
                aria-checked={srMode.current === 'readaloud'}
                onclick={() => (srMode.current = 'readaloud')}
              >
                {$t('Read aloud')}
              </button>
            </div>
          </div>

          <label class="reader-toggle">
            <input type="checkbox" bind:checked={srSpeak.current} />
            <span>{$t('Speak announcements aloud')}</span>
          </label>

          <div class="reader-field">
            <label class="reader-label" for="sr-rate">{$t('Rate')}</label>
            <div class="sr-rate-control">
              <input
                id="sr-rate"
                type="range"
                min="5"
                max="20"
                step="1"
                bind:value={srRate.current}
              />
              <span class="sr-rate-readout">{(srRate.current / 10).toFixed(1)}×</span>
            </div>
          </div>

          {#if srVoiceOptions.length > 0}
            <div class="reader-field">
              <label class="reader-label" for="sr-voice">{$t('Voice')}</label>
              <select id="sr-voice" class="sr-voice-select" bind:value={srVoice.current}>
                <option value="">{$t('Default voice')}</option>
                {#each srVoiceOptions as voice (voice.voiceURI)}
                  <option value={voice.voiceURI}>{voice.name} ({voice.lang})</option>
                {/each}
              </select>
            </div>
          {/if}

          <div class="sr-chapter-row">
            {#if srWalking}
              <button type="button" class="sr-chapter-btn" onclick={cancelSrActivity}>
                {$t('Stop')}
              </button>
              <span class="reader-note">{$t('Announcing…')}</span>
            {:else}
              <button type="button" class="sr-chapter-btn" onclick={announceChapter}>
                {$t('Read whole chapter')}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- The rendering surface (iframe, engines, source view) — see
       process/SPLIT_PREVIEW.md phase 1. The SR caption overlays this region:
       parent-owned check state over surface-owned pixels. -->
  <div class="preview-body">
    <!-- Screen reader caption: the announced block's phrases, streamed over the
         bottom of the preview (VoiceOver-caption style). One block at a time. -->
    {#if activePanel === 'sr' && srCaptionOpen}
      <div
        class="sr-caption"
        role="region"
        aria-live="polite"
        aria-label={$t('Screen reader announcements')}
      >
        <div class="sr-caption-header">
          <span class="sr-caption-label">{srCaptionLabel}</span>
          <button
            type="button"
            class="sr-caption-close"
            onclick={closeSrCaption}
            aria-label={$t('Close announcements')}
            title={$t('Close')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <ol class="sr-caption-list" bind:this={srCaptionListEl}>
          {#each srPhrases as item, i (i)}
            <li
              class:current={srWalking && i === srPhrases.length - 1}
              title={item.caption === item.verbatim ? undefined : item.verbatim}
            >
              {item.caption}
            </li>
          {/each}
        </ol>
      </div>
    {/if}
    {#if splitOn.current}
      <!-- Two independent surfaces, stacked; the splitter position persists
           through PaneForge's autosave (process/SPLIT_PREVIEW.md). -->
      <PaneGroup direction="vertical" autoSaveId="seedhtml-preview-panes">
        <Pane defaultSize={50} minSize={15}>
          <div class="preview-split-pane">
            <PreviewSurface
              bind:this={surfaceRef}
              device={selectedDevice.current}
              {showSource}
              {sourceTree}
              readFlow={readFlow.current}
              readColumns={readColumns.current}
              onContentEvent={e => handleSurfaceContentEvent(e, 1)}
              onRequestDevice={id => handleDeviceChange(id, 1)}
              {...sharedSurfaceProps}
            />
          </div>
        </Pane>
        <PaneResizer />
        <Pane defaultSize={50} minSize={15}>
          <div class="preview-split-pane">
            <!-- The bottom surface's options bar attaches to its pane's top
                 edge (the top surface's stays in band 2 under the header). -->
            {#if barVisible(bar2)}
              {@render optionsBar(bar2)}
            {/if}
            <PreviewSurface
              bind:this={surfaceRef2}
              device={selectedDevice2.current}
              showSource={showSource2}
              sourceTree={sourceTree2}
              readFlow={readFlow2.current}
              readColumns={readColumns2.current}
              onContentEvent={e => handleSurfaceContentEvent(e, 2)}
              onRequestDevice={id => handleDeviceChange(id, 2)}
              {...sharedSurfaceProps}
            />
          </div>
        </Pane>
      </PaneGroup>
    {:else}
      <PreviewSurface
        bind:this={surfaceRef}
        device={selectedDevice.current}
        {showSource}
        {sourceTree}
        readFlow={readFlow.current}
        readColumns={readColumns.current}
        onContentEvent={e => handleSurfaceContentEvent(e, 1)}
        onRequestDevice={id => handleDeviceChange(id, 1)}
        {...sharedSurfaceProps}
      />
    {/if}
  </div>
</div>

<style>
  .preview-pane-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
  }

  .preview-header {
    display: flex;
    align-items: center;
    /* Single row when it fits; when it doesn't, items wrap as ONE flat set
       (the group wrappers are display:contents — see .header-main), so a
       narrow pane packs the two dropdowns onto a shared second row. */
    flex-wrap: wrap;
    gap: var(--space-2);
    /* Match the sidebar header height + grey (see PaneHeader) so all top bars align. */
    min-height: var(--touch-target-min);
    padding: var(--space-1) var(--space-3);
    /* The collapse toggle is pinned to the top-right corner; reserve its column
       so the dropdowns never slide under it. */
    padding-inline-end: calc(var(--touch-target-min) + var(--space-2));
    position: relative;
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
    box-sizing: border-box;
  }

  /* Flat header-height square flush with the pane's top-right corner, like the
     sidebar toggle on the left edge — out of flow so it adds no row height. */
  .preview-collapse {
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    border-radius: 0;
  }

  /* The grouping wrappers render as display:contents, so the filename, status
     badges, and BOTH dropdowns are siblings in the header's single wrapping
     flex container. Flex wrapping cannot interleave lines across nested
     containers — with the old nested groups, a pane too narrow for
     filename + device dropdown produced THREE rows (filename / device /
     panel) because the panel selector lived in a sibling box and couldn't
     join the device dropdown's wrap line. Flat, the rows pack naturally:
     wide = one row, narrow = filename row + a shared dropdowns row. The
     wrappers stay in the markup for structure/branching only; inherited
     text styles still apply through display:contents. */
  .header-main {
    display: contents;
  }

  .preview-title {
    display: contents;
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  /* Previous/next chapter arrows, sitting where the filename readout was. */
  .chapter-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }

  .chapter-nav-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  /* Right-float the device dropdown (replaces the old space-between of the
     .header-main group); the panel selector packs beside it, not floated. */
  select.device-selector {
    margin-inline-start: auto;
  }
  select.panel-selector {
    margin-inline-start: 0;
  }

  /* The split's second dropdown packs beside the first instead of floating. */
  select.second-view {
    margin-inline-start: 0;
  }

  /* The preview options bar: a second toolbar under the permanent header,
     holding the current preview's own inputs (reader flow/columns/pager,
     orientation). One shade lighter than the header so the two bands read as
     distinct; wraps like the header when narrow. */
  .preview-options {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-height: var(--touch-target-min);
    padding: var(--space-1) var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-secondary);
    box-sizing: border-box;
  }

  /* The read controls sit left-aligned in the options bar, not right-floated
     (they carry .device-selector for its visual style, which floats by default). */
  select.read-control {
    margin-inline-start: 0;
  }

  /* The prev / page-picker / next trio is one control: a real (small) flex box,
     deliberately NOT display:contents, so it wraps as a unit. */
  .read-pager {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  /* The mutually-exclusive panel toggles (Accessibility / EpubCheck / Reader).
     display:contents like the other header groups (see .header-main). */
  .preview-controls {
    display: contents;
  }

  /* Accessibility check button (spike) */
  .a11y-check {
    /* Match the left pane's .generator-toggle-btn sizing. */
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .a11y-check:hover:not(:disabled) {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
    border-color: var(--color-hover-accent);
  }

  .a11y-check:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .a11y-check.active {
    border-color: var(--color-accent);
    background: var(--color-bg-tertiary);
  }

  .a11y-count {
    min-width: 1.2em;
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs);
    background: var(--color-error-text, #e53935);
    color: #fff;
    font-size: var(--text-xs);
    text-align: center;
  }

  .a11y-count.clean {
    background: var(--color-success-text, #2e7d32);
  }

  /* The rendering surface's region: fills the pane below the header/bars and
     anchors the SR caption overlay. */
  .preview-body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Each split pane hosts (optionally) an options bar and a surface, stacked. */
  .preview-split-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  /* Horizontal splitter between the two surfaces — same treatment as the
     app-level pane resizers (LayoutManager), rotated for the vertical group. */
  .preview-body :global([data-pane-resizer]) {
    background: var(--color-border-strong);
    block-size: 4px;
    inline-size: auto;
    cursor: row-resize;
    transition: background-color var(--duration-fast) ease;
  }

  .preview-body :global([data-pane-resizer]:hover),
  .preview-body :global([data-pane-resizer][data-resize-handle-active]) {
    background: var(--color-accent);
  }

  .preview-body :global([data-pane-resizer]:focus-visible) {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .a11y-panel {
    max-height: 220px;
    overflow-y: auto;
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-secondary);
    font-size: var(--text-sm);
  }

  .a11y-panel-header {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-default);
  }

  .a11y-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .a11y-item {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
  }

  .a11y-impact {
    flex-shrink: 0;
    min-width: 64px;
    padding: 2px var(--space-1);
    border-radius: var(--radius-xs);
    color: #fff;
    font-size: var(--text-xs);
    text-transform: capitalize;
    text-align: center;
    background: #9e9e9e;
  }

  .a11y-impact[data-impact='critical'] {
    background: #b71c1c;
  }
  .a11y-impact[data-impact='serious'] {
    background: #e53935;
  }
  .a11y-impact[data-impact='moderate'] {
    background: #f57c00;
  }
  .a11y-impact[data-impact='minor'] {
    background: #9e9e9e;
  }

  .a11y-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .a11y-help {
    color: var(--color-text-primary);
  }

  .a11y-meta {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .a11y-meta a {
    color: var(--color-primary, #0074d9);
  }

  .orientation-toggle {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    min-width: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .orientation-toggle:hover:not(:disabled) {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
  }

  .orientation-toggle:focus {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  /* Pager buttons (prev/next) share .orientation-toggle; dim in place when the
     pager is disabled (Scroll flow or a single-page chapter). */
  .orientation-toggle:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* Icon-only "re-paginate" button, shown after the transform status when the
     print preview is out of date. */
  .print-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-accent, var(--color-bg-secondary));
    color: var(--color-text-primary);
    line-height: 0;
    cursor: pointer;
  }

  .print-refresh:hover {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
  }

  .print-refresh:focus {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  /* Match the left pane's .file-selector dropdown sizing + focus treatment. */
  .device-selector,
  .panel-selector {
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .device-selector:focus,
  .panel-selector:focus {
    outline: none;
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--color-focus);
  }

  /* Disabled-in-place options-bar controls: dimmed, non-interactive, but holding
     their slot so the bar's layout never shifts. */
  .device-selector:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* Reader-mode panel (theme + text size + force colours) */
  .reader-panel-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .reader-field {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .reader-label {
    min-width: 72px;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .theme-options {
    display: inline-flex;
  }

  .theme-option {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-left: none;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .theme-option:first-child {
    border-left: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  .theme-option:last-child {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .theme-option:hover:not(.selected) {
    background: var(--color-hover-accent);
    color: var(--color-on-accent);
  }

  .theme-option.selected {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
  }

  .theme-option:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
    z-index: 1;
  }

  .font-size-control {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .font-step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .font-step:hover:not(:disabled) {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
  }

  .font-step:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .font-step:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .font-step-sign {
    margin-left: 1px;
  }

  .font-step-readout {
    min-width: 2.5em;
    text-align: center;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  /* Force-colours checkbox: a labelled toggle with an explicit on/off box. */
  .reader-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .reader-toggle input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .reader-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  /* --- Screen reader preview panel + caption --------------------------------- */

  .sr-rate-control {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sr-rate-control input[type='range'] {
    width: 120px;
  }

  .sr-rate-readout {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    min-width: 2.5em;
  }

  .sr-voice-select {
    max-width: 16rem;
    font-size: var(--text-sm);
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
  }

  .sr-chapter-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sr-chapter-btn {
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .sr-chapter-btn:hover {
    background: var(--color-bg-secondary);
  }

  /* The caption is deliberately dark in both themes — the VoiceOver caption-panel
     look — so announced phrases read as system captions over the book page. */
  .sr-caption {
    position: absolute;
    inset-block-end: var(--space-3);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    z-index: 4;
    display: flex;
    flex-direction: column;
    width: min(34rem, calc(100% - 2 * var(--space-3)));
    max-height: 38%;
    background: rgba(20, 20, 22, 0.88);
    color: #f5f5f6;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }

  .sr-caption-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }

  .sr-caption-label {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: var(--text-xs);
    color: rgba(245, 245, 246, 0.7);
  }

  .sr-caption-close {
    display: inline-flex;
    align-items: center;
    border: 0;
    background: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-sm);
  }

  .sr-caption-close:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .sr-caption-list {
    margin: 0;
    padding: var(--space-1) 0;
    list-style: none;
    overflow-y: auto;
  }

  .sr-caption-list li {
    padding: 2px var(--space-2);
    font-size: var(--text-sm);
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .sr-caption-list li.current {
    background: rgba(255, 255, 255, 0.14);
  }

  /* Compact transform-status pill in the header (moved from the editor pane). */
  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }

  .status-indicator.transforming {
    background: var(--color-info-bg);
    color: var(--color-info-text);
  }

  .status-indicator.error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .status-indicator.warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }

  .status-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin var(--duration-normal) linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .status-spinner {
      animation: none;
    }
  }
</style>
