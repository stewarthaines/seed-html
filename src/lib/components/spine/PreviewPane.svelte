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
  import { writable } from 'svelte/store';
  import type { TransformError } from '$lib/types/spine-editor.js';
  import { t } from '$lib/i18n';
  import ChapterValidationPanel from './ChapterValidationPanel.svelte';
  import {
    readValidationReport,
    messagesForChapter,
    VALIDATION_REPORT_STORAGE_KEY,
  } from '$lib/plugins/validation-report';
  import { snippetAroundClick } from './preview-click.js';
  import { resolveAnnounceTarget, walkAnnouncements, type VsrLike } from './sr-walk.js';
  import { SpeechService } from '$lib/speech/speech.service.js';
  import { isHttpContext } from '$lib/reader/open-in-reader.js';
  import { buildPagedDocument, chapterToSection, MARGIN_MM } from '$lib/pdf/pdf-export.js';
  import type { PrintSettings, PreviewSettings } from '$lib/services/settings/settings.service.js';
  import {
    DEFAULT_PREVIEW,
    previewTypeForDevice,
  } from '$lib/services/settings/settings.service.js';
  import {
    ArrowsClockwise,
    CaretRight,
    FilePdf,
    DeviceRotate,
    X,
    CircleHalf,
  } from 'phosphor-svelte';
  import { layoutStore } from '../../stores/layout';
  import { persisted, asBoolean, asInt, asEnum, asString } from '../../state/persisted.svelte.js';
  import { parseFxlViewport } from '$lib/epub/fixed-layout.js';

  // Props using Svelte 5 runes syntax
  let {
    xhtmlContent = '',
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
    previewAutoUpdate = DEFAULT_PREVIEW.autoUpdate,
    previewIncludeHead = DEFAULT_PREVIEW.includeHead,
    isFixedLayout = false,
    renditionViewport = undefined,
    advancedMode = false,
  }: {
    xhtmlContent?: string;
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
  } = $props();

  // The generated content-document filename for the current chapter (e.g.
  // chapter01.xhtml), surfaced next to the Source toggle so authors see the real
  // rendered file. Spine items render to `<id>.xhtml`.
  const renderedFilename = $derived(chapterId ? `${chapterId}.xhtml` : '');

  /** Format the transform's execution time for the status indicator. */
  function formatExecutionTime(ms: number): string {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  // --- Accessibility check -----------------------------------------------------
  // Inject axe-core into the same-origin preview iframe and run it on demand so the
  // author gets in-context feedback they can fix immediately (tweak the stylesheet,
  // re-check). axe-core (MPL-2.0) is vendored at public/axe.min.js and served over
  // http; file:// can't fetch it, so the button is hidden there.
  const canCheckA11y = typeof location !== 'undefined' && location.protocol !== 'file:';

  // --- Print preview (Paged.js) ------------------------------------------------
  // The "Print" device paginates the current chapter into print pages with the
  // vendored Paged.js polyfill — the same pipeline (and print.css) as "Save as
  // PDF" — so authors see what the printed page will look like. HTTP-only: the
  // polyfill is fetched from the app origin, so the option is hidden on file://.
  const canPaginate = typeof location !== 'undefined' && location.protocol !== 'file:';
  /** Devices that fill the pane rather than rendering a scaled device frame. */
  const isFillDevice = (id: string) => id === 'desktop' || id === 'print';
  /** postMessage token Paged.js pings the parent with when pagination completes. */
  const PAGED_DONE = 'preview-paged';

  let printPaginating = $state(false);
  // The preview is out of date because auto-update is off for the current type and
  // the chapter (or the injected head) changed since the last render. Drives the
  // on-demand Refresh badge; was print-only, now applies to every preview type.
  let previewStale = $state(false);
  // Non-reactive bookkeeping for what was last written to the iframe, so we can
  // detect edits (and device-type switches) and decide whether to re-render or just
  // mark the preview stale (undefined = nothing rendered yet this session).
  let renderedContent: string | undefined = undefined;
  // The chapter id that content belonged to, so switching chapters re-renders
  // (rather than just marking the old chapter stale).
  let renderedChapterId: string | null | undefined = undefined;
  // The preview type last rendered, so switching device type always re-renders even
  // when that type's auto-update is off (otherwise a stale frame of the old type
  // would linger).
  let renderedType: ReturnType<typeof previewTypeForDevice> | undefined = undefined;
  // The head fragment actually injected last render (''=none), so toggling
  // include/editing head.xml marks the preview stale when auto-update is off.
  let renderedHead = '';
  let printSafetyTimer: ReturnType<typeof setTimeout> | undefined;

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

  async function runA11yCheck(): Promise<void> {
    const doc = previewIframe?.contentDocument;
    const win = previewIframe?.contentWindow as AxeWindow | null;
    if (!doc || !win) return;
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
      const doc = previewIframe?.contentDocument;
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
    if (canCheckA11y) {
      list.push({ id: 'a11y', label: $t('Accessibility'), disabled: !xhtmlContent });
    }
    if (validationReport && validationReportMatches) {
      list.push({ id: 'epubcheck', label: 'EpubCheck', disabled: false });
    }
    if (readerModeActive) {
      list.push({ id: 'reader', label: $t('Reader'), disabled: false });
    }
    if (canSrPreview && selectedDevice.current !== 'print') {
      // <!-- i18n: preview Checks dropdown entry — announcement preview -->
      list.push({ id: 'sr', label: $t('Screen reader'), disabled: !xhtmlContent });
    }
    return list;
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
  let srPhrases = $state<string[]>([]);
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

  // Voices for the picker: the preview document's language first, rest after.
  const srVoiceOptions = $derived.by(() => {
    const matching = srDocLang ? speech.voicesForLang(srVoices, srDocLang) : [];
    return [...matching, ...srVoices.filter(v => !matching.includes(v))];
  });

  /**
   * Load the vendored virtual screen reader into the preview iframe (once per
   * iframe Window — the module global survives document.open() rewrites, same
   * as win.axe). The inline script publishes success/failure as Window globals.
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
        if (previewIframe?.contentWindow !== win) {
          // Device re-key replaced the Window; the new iframe's load hook
          // starts its own load — this one is moot.
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
    const doc = previewIframe?.contentDocument;
    const win = previewIframe?.contentWindow as VsrWindow | null;
    if (!doc || !win) return;
    srLoadError = false;
    try {
      await loadVsr(doc, win);
    } catch (error) {
      // The load may have raced a preview rewrite or device re-key; it only
      // failed for real if the current Window still lacks the library (a
      // replaced Window gets its own load from the iframe's load hook).
      const currentWin = previewIframe?.contentWindow as VsrWindow | null;
      if (currentWin === win && !currentWin?.__seedVsr) {
        console.error('Screen reader preview failed to load:', error);
        srLoadError = true;
      }
      return;
    }
    // Instrument the document that is CURRENT after the await — the one
    // captured above may have been rewritten away while the library loaded.
    const currentDoc = previewIframe?.contentDocument;
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
    const doc = previewIframe?.contentDocument;
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
    const doc = previewIframe?.contentDocument;
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
    const doc = previewIframe?.contentDocument;
    return el === doc?.body ? $t('Whole chapter') : `<${el.tagName.toLowerCase()}>`;
  }

  /** Walk one element, streaming phrases into the caption (and speech). */
  async function announceElement(el: Element): Promise<void> {
    const win = previewIframe?.contentWindow as VsrWindow | null;
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
    const body = previewIframe?.contentDocument?.body;
    try {
      await walkAnnouncements(vsr, body ?? el, {
        signal: controller.signal,
        target: el === body ? undefined : el,
        onPhrase: phrase => {
          srPhrases = [...srPhrases, phrase];
          if (srSpeak.current) {
            speech.speak(
              phrase,
              { rate: srRate.current / 10, voiceURI: srVoice.current || null, lang },
              srVoices
            );
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
    const body = previewIframe?.contentDocument?.body;
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

  // Preview configuration
  const DEVICE_PRESETS = [
    { id: 'desktop', name: 'Fill', width: '100%', height: '100%', category: 'responsive' },
    { id: 'iphone', name: 'Standard', width: '375px', height: '667px', category: 'commute' },
    { id: 'iphone-plus', name: 'Plus', width: '414px', height: '736px', category: 'commute' },
    { id: 'ipad', name: 'Compact', width: '768px', height: '1024px', category: 'home' },
    { id: 'ipad-air', name: 'Extra Large', width: '820px', height: '1180px', category: 'home' },
    { id: 'kindle', name: 'Standard', width: '600px', height: '800px', category: 'travel' },
    {
      // Paginated print preview (Paged.js). Dimensions are placeholders — print
      // fills the pane and Paged.js sizes its own A4 pages (see isFillDevice).
      id: 'print',
      name: 'Print',
      width: '794px',
      height: '1123px',
      category: 'print',
    },
  ] as const;

  // --- Reader-mode simulation (theme + font size) ------------------------------
  // Per-device base font size (px). Phones get a smaller base than tablets, so the
  // same relative step lands at a smaller px on a phone than on a large tablet.
  const DEVICE_BASE_FONT: Record<string, number> = {
    desktop: 18,
    iphone: 16,
    'iphone-plus': 16,
    ipad: 18,
    'ipad-air': 19,
    kindle: 17,
    print: 16,
  };
  // Five relative steps; the middle (index 2) is the device's base size.
  const FONT_STEPS = [0.85, 0.92, 1.0, 1.15, 1.3] as const;
  // Injected reading-system themes (background + text colour), à la Readium CSS.
  const THEME_PALETTES = {
    light: { bg: '#ffffff', fg: '#1a1a1a', scheme: 'light' },
    sepia: { bg: '#f4ecd8', fg: '#5b4636', scheme: 'light' },
    dark: { bg: '#14161a', fg: '#c9c9c9', scheme: 'dark' },
  } as const;

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
  let deviceOrientation = $state<'portrait' | 'landscape'>('portrait');
  let showSource = $state(false);
  let previewIframe: HTMLIFrameElement | undefined = $state();
  let previewContainer: HTMLDivElement | undefined = $state();
  let previewContentEl: HTMLDivElement | undefined = $state();
  let deviceScale = $state(1);

  // --- Fixed-layout page box -------------------------------------------------
  // For pre-paginated books the device presets behave like a real FXL reading
  // system: the page renders at its DECLARED viewport size and is contain-fit
  // into the device frame (letterboxed). This inner page scale is orthogonal
  // to the outer deviceScale frame fit and depends only on fixed pixel sizes,
  // so it needs no resize handling.
  const fxlActive = $derived(isFixedLayout && !isFillDevice(selectedDevice.current));
  const fxlPage = $derived(parseFxlViewport(renditionViewport));
  const fxlPageLabel = $derived(`${fxlPage.width}×${fxlPage.height}`);
  const fxlGeometry = $derived.by(() => {
    const device = DEVICE_PRESETS.find(d => d.id === selectedDevice.current);
    if (!fxlActive || !device) return null;
    const { width: dw, height: dh } = getDeviceDimensions(device); // tracks deviceOrientation
    // Contain-fit; deliberately unclamped — real readers upscale small pages.
    const scale = Math.min(dw / fxlPage.width, dh / fxlPage.height);
    return {
      scale,
      offsetX: (dw - fxlPage.width * scale) / 2,
      offsetY: (dh - fxlPage.height * scale) / 2,
    };
  });
  // Measured content extent of the FXL page document (null = not measured).
  let fxlContentSize = $state<{ width: number; height: number } | null>(null);
  const fxlOverflow = $derived(
    fxlContentSize &&
      (fxlContentSize.width > fxlPage.width + 1 || fxlContentSize.height > fxlPage.height + 1)
      ? fxlContentSize
      : null
  );

  let pendingScrollRestore: {
    anchor: { element: Element | null; id: string | null; offset: number } | null;
    fallbackScrollTop: number;
  } | null = $state(null);

  // Reactive state
  const lastUpdateTime = writable<number>(Date.now());

  // Group devices by category for dropdown
  const groupedDevices = $derived.by(() => {
    const groups: Record<string, (typeof DEVICE_PRESETS)[number][]> = {};

    for (const device of DEVICE_PRESETS) {
      // Print preview is HTTP-only (Paged.js is fetched from the app origin).
      if (device.id === 'print' && !canPaginate) continue;
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

  // Whether the reader-mode controls apply: reflowable previews only (not the print
  // preset, not fixed-layout chapters — readers disable user theming/sizing there).
  const readerModeActive = $derived(selectedDevice.current !== 'print' && !isFixedLayout);

  function decreaseFont(): void {
    if (fontStep.current > 0) fontStep.current -= 1;
  }
  function increaseFont(): void {
    if (fontStep.current < FONT_STEPS.length - 1) fontStep.current += 1;
  }

  /**
   * Apply the reader-mode theme + font size to the LIVE preview iframe, without
   * re-running the transform. Called after every content write (from
   * handleIframeLoad) and reactively when the controls change, so toggling is
   * instant. View-only — nothing here touches the generated/exported XHTML.
   *
   * Theme colours are injected as a style element at the START of the document head
   * so the book's own stylesheets (and preview/head.xml, which come later) win on equal
   * specificity — faithfully reproducing how reader "night mode" lets an author's
   * explicit colours through (and how dark-text-on-dark-bg happens). The
   * force-colours toggle re-applies them with `!important` to simulate the
   * aggressive readers that override author colours.
   */
  function applyPreviewAppearance(): void {
    const iframeDoc = previewIframe?.contentDocument;
    // Bail while the document is head-only (no body element yet). A parser-blocking
    // external script (script src) in the chapter head stalls open/write/close
    // mid-parse, and mutating that stalled head (inserting the theme style element)
    // can leave it permanently body-less in some browsers. The iframe `load` event
    // re-applies appearance once the body has parsed.
    if (!iframeDoc?.documentElement || !iframeDoc.head || !iframeDoc.body) return;
    if (!readerModeActive) return;

    const root = iframeDoc.documentElement;
    const palette = THEME_PALETTES[previewTheme.current];

    // Font size: inline on the root so em/rem/% cascade and win over stylesheet
    // rules; fixed-px text deliberately stays put (a useful "not responsive" tell).
    const basePx = DEVICE_BASE_FONT[selectedDevice.current] ?? 18;
    root.style.fontSize = `${Math.round(basePx * FONT_STEPS[fontStep.current])}px`;
    // Match UA-rendered chrome (scrollbars, form controls, default canvas).
    root.style.colorScheme = palette.scheme;

    const rules = forceColors.current
      ? `html { background: ${palette.bg} !important; }
         body { background: ${palette.bg} !important; }
         body, body * { color: ${palette.fg} !important; }`
      : `html { background: ${palette.bg}; }
         body { color: ${palette.fg}; }`;

    let style = iframeDoc.querySelector<HTMLStyleElement>('style[data-preview-theme]');
    if (!style) {
      style = iframeDoc.createElement('style');
      style.setAttribute('data-preview-theme', '');
      // First child of <head> → author CSS (later in document order) overrides.
      iframeDoc.head.insertBefore(style, iframeDoc.head.firstChild);
    }
    style.textContent = rules;
  }

  // Re-apply theme/font instantly when a control changes (no content rewrite).
  $effect(() => {
    // Track the controls so this re-runs on change.
    void previewTheme.current;
    void fontStep.current;
    void forceColors.current;
    void selectedDevice.current;
    void readerModeActive;
    applyPreviewAppearance();
  });

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

  // Drive the preview when the XHTML, the selected device, or the preview-head
  // config changes. Per preview type, `previewAutoUpdate` decides whether edits
  // re-render live or just mark the preview stale (author refreshes on demand) —
  // a generalisation of the old "Responsive/Device live, Print on demand" rule.
  $effect(() => {
    const device = selectedDevice.current;
    const content = xhtmlContent;
    const chapter = chapterId;
    const type = typeOfDevice(device);
    const auto = previewAutoUpdate[type];
    // Track the head config so toggling include / editing head.xml re-runs this.
    const wantHead = previewIncludeHead[type] && previewHead ? previewHead : '';

    if (device !== 'print') {
      // Not on print: clear any leftover print pagination state.
      printPaginating = false;
      clearTimeout(printSafetyTimer);
    }

    // Always render on first show (nothing rendered yet, or only empty content), a
    // chapter change, or a device-type switch (so a stale frame of the previous type
    // never lingers); otherwise honour auto-update. Empty `renderedContent` counts as
    // "not yet rendered" so the first real content shows even when auto-update is off.
    const firstOrSwitch =
      !renderedContent || chapter !== renderedChapterId || type !== renderedType;
    if (firstOrSwitch || auto) {
      renderNow();
    } else if (content !== renderedContent || wantHead !== renderedHead) {
      previewStale = true;
    }
  });

  // Paged.js pings the parent when pagination finishes: drop the spinner and fit
  // the rendered pages to the pane width.
  $effect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== previewIframe?.contentWindow || event.data !== PAGED_DONE) return;
      clearTimeout(printSafetyTimer);
      printPaginating = false;
      fitPrintToWidth();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  /**
   * Find a scroll anchor element that can be used to restore scroll position
   */
  function findScrollAnchor(
    iframeDoc: Document
  ): { element: Element | null; id: string | null; offset: number } | null {
    try {
      const viewport = iframeDoc.documentElement;
      const scrollTop = viewport.scrollTop || iframeDoc.body.scrollTop;

      // Find element at current scroll position (center of viewport)
      const centerX = viewport.clientWidth / 2;
      const checkY = Math.min(100, viewport.clientHeight / 4); // Look near top of viewport
      const elementAtScroll = iframeDoc.elementFromPoint(centerX, checkY);

      if (!elementAtScroll || elementAtScroll === iframeDoc.body || elementAtScroll === viewport) {
        return { element: null, id: null, offset: scrollTop };
      }

      // Try to find an element with an ID (most reliable anchor)
      let current: Element | null = elementAtScroll;
      while (current && current !== iframeDoc.body) {
        if (current.id) {
          const elementRect = current.getBoundingClientRect();
          const offset = scrollTop - (elementRect.top + scrollTop - checkY);
          return { element: current, id: current.id, offset };
        }
        current = current.parentElement;
      }

      // Fall back to tag name + index if no ID found
      const tagName = elementAtScroll.tagName.toLowerCase();
      const siblings = Array.from(iframeDoc.querySelectorAll(tagName));
      const index = siblings.indexOf(elementAtScroll);

      if (index >= 0) {
        const elementRect = elementAtScroll.getBoundingClientRect();
        const offset = scrollTop - (elementRect.top + scrollTop - checkY);
        return { element: elementAtScroll, id: `${tagName}[${index}]`, offset };
      }

      return { element: null, id: null, offset: scrollTop };
    } catch (error) {
      console.warn('Failed to find scroll anchor:', error);
      return null;
    }
  }

  /**
   * Restore scroll position using anchor element or fallback to pixel position
   */
  function restoreScrollPosition(
    iframeDoc: Document,
    anchor: { element: Element | null; id: string | null; offset: number } | null,
    fallbackScrollTop: number
  ): void {
    if (!anchor) {
      // Simple fallback to pixel position
      iframeDoc.documentElement.scrollTop = fallbackScrollTop;
      if (iframeDoc.body) {
        iframeDoc.body.scrollTop = fallbackScrollTop;
      }
      return;
    }

    try {
      let targetElement: Element | null = null;

      // Try to find element by ID first
      if (anchor.id) {
        if (anchor.id.includes('[') && anchor.id.includes(']')) {
          // Tag name + index format
          const [tagName, indexStr] = anchor.id.split('[');
          const index = parseInt(indexStr.replace(']', ''), 10);
          const elements = iframeDoc.querySelectorAll(tagName);
          targetElement = elements[index] || null;
        } else {
          // Direct ID lookup
          targetElement = iframeDoc.getElementById(anchor.id);
        }
      }

      if (targetElement) {
        // Scroll to element with offset
        targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });

        // Apply additional offset if needed
        if (anchor.offset !== 0) {
          const currentScroll =
            iframeDoc.documentElement.scrollTop || iframeDoc.body?.scrollTop || 0;
          const newScroll = Math.max(0, currentScroll + anchor.offset);
          iframeDoc.documentElement.scrollTop = newScroll;
          if (iframeDoc.body) {
            iframeDoc.body.scrollTop = newScroll;
          }
        }
      } else {
        // Fallback to pixel position
        iframeDoc.documentElement.scrollTop = fallbackScrollTop;
        if (iframeDoc.body) {
          iframeDoc.body.scrollTop = fallbackScrollTop;
        }
      }
    } catch (error) {
      console.warn('Failed to restore scroll position:', error);
      // Final fallback
      iframeDoc.documentElement.scrollTop = fallbackScrollTop;
      if (iframeDoc.body) {
        iframeDoc.body.scrollTop = fallbackScrollTop;
      }
    }
  }

  /** The preview type of a device preset id (falls back to responsive). */
  function typeOfDevice(id: string): ReturnType<typeof previewTypeForDevice> {
    const category = DEVICE_PRESETS.find(d => d.id === id)?.category ?? 'responsive';
    return previewTypeForDevice(category);
  }

  /** The preview-head fragment to inject for the current preview type ('' = none). */
  function currentWantHead(): string {
    return previewIncludeHead[typeOfDevice(selectedDevice.current)] && previewHead
      ? previewHead
      : '';
  }

  /**
   * Splice the project's preview-only head fragment into a chapter's head, just
   * before the closing head tag (after the book's own stylesheets, so author CSS
   * can override). Preview only — the published/packaged XHTML never goes through
   * here. The fragment is inserted after blob-URL processing, so it is for INLINE
   * style/script markup; external href/src in head.xml won't be blob-resolved.
   */
  function withPreviewHead(content: string): string {
    const head = currentWantHead();
    if (!head) return content;
    return content.replace('</head>', `${head}\n</head>`);
  }

  /**
   * Pause any playing media before a same-document rewrite. document.open()
   * is not a navigation, so the old document never unloads — and a PLAYING
   * audio/video element detached by the rewrite keeps playing (browsers
   * protect it from GC until it pauses), with its stop control gone.
   */
  function pausePreviewMedia(iframeDoc: Document): void {
    for (const media of iframeDoc.querySelectorAll<HTMLMediaElement>('audio, video')) {
      try {
        media.pause();
      } catch {
        // A dead/foreign media element must not block the rewrite.
      }
    }
  }

  /**
   * Update iframe with new XHTML content while preserving scroll position
   */
  function updatePreviewContent(content: string): void {
    if (!previewIframe || !content) return;

    try {
      const iframeDoc = previewIframe.contentDocument;
      if (!iframeDoc) return;

      // Save scroll position and find anchor before updating
      const scrollTop = iframeDoc.documentElement.scrollTop || iframeDoc.body?.scrollTop || 0;
      const scrollAnchor = scrollTop > 0 ? findScrollAnchor(iframeDoc) : null;

      // Store scroll restoration data for when the content loads
      pendingScrollRestore = { anchor: scrollAnchor, fallbackScrollTop: scrollTop };

      // Update content (preserves XHTML and blob URLs)
      pausePreviewMedia(iframeDoc);
      // A screen-reader walk must not keep stepping through the dying document,
      // and its queued speech would outlive the rewrite.
      cancelSrActivity();
      srHoverTarget = null;
      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();

      // Re-apply the reader-mode theme + font synchronously: the fresh document
      // dropped them, and relying on the iframe `load` event alone races with a
      // device switch (the appearance effect runs against the old document, then
      // this rewrite replaces it). Doing it here guarantees the new device's base
      // font and the current theme are on the freshly written document.
      applyPreviewAppearance();

      lastUpdateTime.set(Date.now());

      // The rewrite invalidated any prior axe results; re-check if the panel is open.
      scheduleAutoA11yCheck();

      // The fresh document dropped the announce affordances; re-add them.
      if (activePanel === 'sr') void ensureSrReady();
    } catch (error) {
      console.error('Failed to update preview content:', error);
    }
  }

  // --- Print pagination --------------------------------------------------------

  /**
   * Render the current chapter for whichever device is selected, then record what
   * was rendered (content, chapter, preview type, injected head) so the auto-update
   * effect can decide between re-rendering and showing the stale Refresh badge.
   * The single entry point for both the effect and the on-demand Refresh button.
   */
  function renderNow(): void {
    const content = xhtmlContent;
    fxlContentSize = null; // stale overflow badge must not survive a rewrite
    if (selectedDevice.current === 'print') writePagedDoc(content);
    else updatePreviewContent(withPreviewHead(content));
    renderedContent = content;
    renderedChapterId = chapterId;
    renderedType = typeOfDevice(selectedDevice.current);
    renderedHead = currentWantHead();
    previewStale = false;
  }

  /**
   * Paginate the current chapter into print pages in the preview iframe using the
   * same Paged.js document builder as the PDF export (so the preview matches the
   * exported PDF). The chapter content already has its assets resolved to blob
   * URLs upstream, so no BlobURLManager is needed here. Pagination runs once per
   * write; the 'preview-paged' ping (handled by the message effect) clears the
   * spinner and fits the pages to the pane width.
   */
  function writePagedDoc(content: string): void {
    if (!previewIframe || !content) return;
    const wrapped = chapterToSection(content, chapterId ?? undefined);
    if (!wrapped) {
      // Malformed / no <body>: fall back to the plain render rather than a blank
      // paginated frame.
      updatePreviewContent(content);
      return;
    }
    const doc = buildPagedDocument([wrapped.section], {
      title: 'Print preview',
      doneMessage: PAGED_DONE,
      stylesheetHrefs: wrapped.hrefs,
      lang: wrapped.lang ?? undefined,
      print: printSettings,
      previewChrome: true,
      // Inject the project's preview-only head fragment (when PDF includeHead is on).
      headExtra: currentWantHead(),
    });

    const iframeDoc = previewIframe.contentDocument;
    if (!iframeDoc) return;

    printPaginating = true;
    // Print output has a different DOM than the live preview; don't carry over
    // scroll anchors or auto-run axe against Paged.js wrapper elements.
    pendingScrollRestore = null;

    pausePreviewMedia(iframeDoc);
    iframeDoc.open();
    iframeDoc.write(doc);
    iframeDoc.close();

    // Safety: if Paged.js never pings (e.g. it throws), don't leave the spinner up.
    clearTimeout(printSafetyTimer);
    printSafetyTimer = setTimeout(() => {
      printPaginating = false;
    }, 10000);
  }

  /**
   * Scale the paginated A4 pages so a full page width fits the pane (the user
   * chose fit-to-width); scroll vertically through pages. Uses CSS `zoom` on the
   * Paged.js page container so the scroll height reflows. Never upscales beyond
   * 1 (real size). Safe to call repeatedly (e.g. on resize) without re-paginating.
   */
  function fitPrintToWidth(): void {
    const iframeDoc = previewIframe?.contentDocument;
    if (!iframeDoc) return;
    const pages = iframeDoc.querySelector<HTMLElement>('.pagedjs_pages');
    const firstPage = iframeDoc.querySelector<HTMLElement>('.pagedjs_page');
    if (!pages || !firstPage) return;

    pages.style.removeProperty('zoom');
    const pageWidth = firstPage.offsetWidth;
    const available = iframeDoc.documentElement.clientWidth;
    if (!pageWidth || !available) return;

    // Leave a little breathing room around the page box.
    const scale = Math.min(1, (available * 0.94) / pageWidth);
    pages.style.setProperty('zoom', String(scale));
  }

  /**
   * Get device dimensions accounting for orientation
   */
  function getDeviceDimensions(device: (typeof DEVICE_PRESETS)[number]) {
    const originalWidth = parseInt(device.width.replace('px', ''));
    const originalHeight = parseInt(device.height.replace('px', ''));

    if (deviceOrientation === 'landscape') {
      // Swap width and height for landscape
      return { width: originalHeight, height: originalWidth };
    }

    return { width: originalWidth, height: originalHeight };
  }

  /**
   * Calculate optimal scale for device preview to fit available space
   */
  function calculateOptimalScale(device: (typeof DEVICE_PRESETS)[number]): number {
    if (isFillDevice(device.id)) return 1;

    try {
      // Get the preview content element (responds to split pane changes)
      if (!previewContentEl) return 1;

      const viewportRect = previewContentEl.getBoundingClientRect();
      // Account for padding and some breathing room
      const availableWidth = Math.max(200, viewportRect.width - 40);
      const availableHeight = Math.max(200, viewportRect.height - 40);

      // Get device dimensions (accounting for orientation)
      const { width: deviceWidth, height: deviceHeight } = getDeviceDimensions(device);

      // Calculate aspect ratios
      const containerAspectRatio = availableWidth / availableHeight;
      const deviceAspectRatio = deviceWidth / deviceHeight;

      let scale;
      if (containerAspectRatio > deviceAspectRatio) {
        // Container is wider than device → fill height
        scale = availableHeight / deviceHeight;
      } else {
        // Container is taller than device → fill width
        scale = availableWidth / deviceWidth;
      }

      // Apply reasonable bounds (10% to 200%)
      return Math.min(Math.max(scale, 0.1), 2.0);
    } catch (error) {
      console.warn('Failed to calculate optimal scale:', error);
      return 1;
    }
  }

  /**
   * Toggle device orientation between portrait and landscape
   */
  function toggleOrientation(): void {
    deviceOrientation = deviceOrientation === 'portrait' ? 'landscape' : 'portrait';
    // Recalculate scaling and container dimensions for new orientation
    handleDeviceChange(selectedDevice.current);
  }

  /**
   * Handle device preset selection
   */
  function handleDeviceChange(deviceId: string): void {
    selectedDevice.current = deviceId as (typeof DEVICE_PRESETS)[number]['id'];
    const device = DEVICE_PRESETS.find(d => d.id === deviceId);

    if (device && previewContainer) {
      const wrapper = previewContainer.parentElement;

      if (isFillDevice(device.id)) {
        // Desktop / print: fill available space (print pages size themselves).
        previewContainer.style.width = '100%';
        previewContainer.style.height = '100%';
        previewContainer.style.maxWidth = 'none';
        previewContainer.style.maxHeight = 'none';

        // Wrapper fills available space for desktop
        if (wrapper) {
          wrapper.style.width = '100%';
          wrapper.style.height = '100%';
        }

        deviceScale = 1;
      } else {
        // Calculate scale for container transform
        setTimeout(() => {
          if (previewContainer) {
            const scale = calculateOptimalScale(device);
            const { width: deviceWidth, height: deviceHeight } = getDeviceDimensions(device);

            // Set container to device dimensions (accounting for orientation)
            previewContainer.style.width = deviceWidth + 'px';
            previewContainer.style.height = deviceHeight + 'px';
            previewContainer.style.maxWidth = deviceWidth + 'px';
            previewContainer.style.maxHeight = deviceHeight + 'px';

            // Set wrapper to scaled dimensions for proper flex centering
            if (wrapper) {
              wrapper.style.width = Math.round(deviceWidth * scale) + 'px';
              wrapper.style.height = Math.round(deviceHeight * scale) + 'px';
            }

            deviceScale = scale;
          }
        }, 0);
      }
    }
  }

  /**
   * Toggle source view
   */
  // Pick either the generated-source view or a device preset from the single view
  // dropdown. Switching away from source re-renders the preview and re-applies the
  // chosen device's dimensions/scaling.
  function handleViewSelect(value: string): void {
    if (value === 'source') {
      // The Source view is advanced-only; ignore the selection in basic mode
      // (the option is also hidden from the dropdown there).
      if (advancedMode) showSource = true;
      return;
    }
    const wasSource = showSource;
    showSource = false;
    if (wasSource) {
      // Leaving the source view: re-render, then re-apply the chosen device's
      // dimensions/scaling once the preview iframe is back in the DOM.
      setTimeout(() => {
        renderNow();
        handleDeviceChange(value);
      }, 0);
    } else {
      handleDeviceChange(value);
    }
  }

  /**
   * Estimate the position of an element within the source document
   */
  function estimateDocumentPosition(element: Element): number {
    const iframeDoc = previewIframe?.contentDocument;
    if (!iframeDoc) return 0;

    try {
      // Create a tree walker to traverse all text nodes before the target element
      const walker = iframeDoc.createTreeWalker(iframeDoc.body, NodeFilter.SHOW_TEXT, null);

      let position = 0;
      let node: Node | null;

      while ((node = walker.nextNode())) {
        // Stop if we've reached our target element
        if (element.contains(node)) {
          break;
        }
        position += node.textContent?.length || 0;
      }

      return position;
    } catch (error) {
      console.warn('Failed to estimate document position:', error);
      return 0;
    }
  }

  /**
   * Handle clicks on elements in the preview iframe
   */
  function handlePreviewClick(event: MouseEvent): void {
    if (!onPreviewClick) return;

    const target = event.target as Element;
    if (!target) return;

    try {
      // An image or video first: the blob rewrite preserved the manifest href on
      // data-source-href (the blob: URL erases it), and its filename is a robust
      // search key in any source syntax — matched by the same position-hinted
      // search the text path uses.
      const media = target.closest('img, video');
      const sourceHref = media?.getAttribute('data-source-href');
      if (media && sourceHref) {
        const filename = sourceHref.split('/').pop() ?? sourceHref;
        if (filename.length >= 3) {
          onPreviewClick({
            text: filename,
            documentPosition: estimateDocumentPosition(media),
            elementType: media.tagName.toLowerCase(),
          });
          return;
        }
      }

      // Prefer the exact text node + caret under the cursor: a single rendered
      // text node is a contiguous, markup-free slice of the source, so a short
      // snippet from it matches even when the element has inline markup.
      const caret = caretFromPoint(target.ownerDocument, event.clientX, event.clientY);
      if (caret && caret.node.nodeType === Node.TEXT_NODE) {
        const snippet = snippetAroundClick(caret.node.textContent || '', caret.offset);
        if (snippet.length >= 3) {
          const parent = caret.node.parentElement || target;
          onPreviewClick({
            text: snippet,
            documentPosition: estimateDocumentPosition(parent),
            elementType: parent.tagName.toLowerCase(),
          });
          return;
        }
      }

      // Fallback (no caret API, or no usable text node): match the whole closest
      // block element, as before — works for unstyled text.
      const textElement =
        target.closest('p, h1, h2, h3, h4, h5, h6, div, span, li, blockquote, td, th') || target;
      const clickedText = textElement.textContent?.trim();
      if (!clickedText || clickedText.length < 8 || clickedText.length > 500) return;

      onPreviewClick({
        text: clickedText,
        documentPosition: estimateDocumentPosition(textElement),
        elementType: textElement.tagName.toLowerCase(),
      });
    } catch (error) {
      console.warn('Failed to handle preview click:', error);
    }
  }

  /**
   * Resolve the text node + offset under a click, across browser caret APIs.
   * Returns null when neither API is available or the point has no caret.
   */
  function caretFromPoint(
    doc: Document,
    x: number,
    y: number
  ): { node: Node; offset: number } | null {
    type CaretDoc = Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null;
    };
    const cdoc = doc as CaretDoc;
    if (typeof cdoc.caretRangeFromPoint === 'function') {
      const range = cdoc.caretRangeFromPoint(x, y);
      if (range) return { node: range.startContainer, offset: range.startOffset };
    }
    if (typeof cdoc.caretPositionFromPoint === 'function') {
      const pos = cdoc.caretPositionFromPoint(x, y);
      if (pos) return { node: pos.offsetNode, offset: pos.offset };
    }
    return null;
  }

  /**
   * Set up iframe interactivity (event listeners and styling)
   * Called both on initial load and after content updates
   */
  function setupIframeInteractivity(iframeDoc: Document): void {
    // Add click event listener to the iframe document
    iframeDoc.addEventListener('click', handlePreviewClick);

    // Add any global styles or scripts for preview enhancement.
    // Fixed-layout pages skip the responsive-img rule: shrinking oversized art
    // to fit would mask exactly the composition overflow being diagnosed.
    const style = iframeDoc.createElement('style');
    style.textContent = `
      body {
        /* margin: 0; */
        /* padding: 0; */
        /* font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; */
        /* line-height: 1.6; */
      }

      ${
        fxlActive
          ? ''
          : `/* Ensure images are responsive */
      img {
        max-width: 100%;
        height: auto;
      }`
      }

      /* Add some visual feedback for empty content */
      body:empty::before {
        content: 'No content to preview';
        color: #666;
        font-style: italic;
        display: block;
        text-align: center;
        padding: 2rem;
      }

      /* Indicate clickable text elements */
      p, h1, h2, h3, h4, h5, h6, div, span, li, blockquote, td, th {
        cursor: pointer;
      }

      /* Images/videos are click-to-source too (see handlePreviewClick). */
      img[data-source-href], video[data-source-href] {
        cursor: pointer;
      }
      img[data-source-href]:hover, video[data-source-href]:hover {
        outline: 1px solid rgba(59, 130, 246, 0.3);
        outline-offset: 1px;
      }

      /* Visual feedback on hover */
      p:hover, h1:hover, h2:hover, h3:hover, h4:hover, h5:hover, h6:hover,
      div:hover, span:hover, li:hover, blockquote:hover, td:hover, th:hover {
        /* background-color: rgba(59, 130, 246, 0.1); */
        outline: 1px solid rgba(59, 130, 246, 0.3);
        outline-offset: 1px;
      }
    `;
    iframeDoc.head.appendChild(style);
  }

  /**
   * Fixed-layout composition feedback: record the content's true extent against
   * the declared page box, then clip like a real FXL reader (no scrollbars in
   * the page — the badge carries the overflow diagnosis, so nothing is lost).
   */
  function measureFxlPage(iframeDoc: Document): void {
    if (!fxlActive) {
      fxlContentSize = null;
      return;
    }
    if (!iframeDoc.documentElement || !iframeDoc.body) return;
    // Measure BEFORE injecting the clip style — root scroll sizes with
    // overflow:hidden applied vary across engines.
    fxlContentSize = {
      width: Math.max(iframeDoc.documentElement.scrollWidth, iframeDoc.body.scrollWidth),
      height: Math.max(iframeDoc.documentElement.scrollHeight, iframeDoc.body.scrollHeight),
    };
    if (!iframeDoc.querySelector('style[data-fxl-clip]')) {
      const clip = iframeDoc.createElement('style');
      clip.setAttribute('data-fxl-clip', '');
      clip.textContent = 'html { overflow: hidden; }';
      iframeDoc.head.appendChild(clip);
    }
  }

  /**
   * Handle iframe load event
   */
  function handleIframeLoad(): void {
    if (previewIframe?.contentDocument) {
      const iframeDoc = previewIframe.contentDocument;

      // Set up interactivity first
      setupIframeInteractivity(iframeDoc);

      // Device re-key rebuilt the iframe (fresh Window): reload + re-instrument
      // the screen reader preview when its panel is open.
      if (activePanel === 'sr') void ensureSrReady();

      // Fixed-layout: measure the page against its declared viewport, then clip.
      measureFxlPage(iframeDoc);

      // Re-apply the reader-mode theme + font size (the fresh document dropped them).
      applyPreviewAppearance();

      if (onNavigate && previewIframe.contentDocument) {
        previewIframe.contentDocument.addEventListener('click', e => {
          const target = e.target as HTMLAnchorElement;
          if (target.tagName === 'A' && target.href) {
            const href = target.getAttribute('href');
            if (href && href.includes('.xhtml')) {
              e.preventDefault();
              // Extract chapter ID from Text/chapter1.xhtml
              const match = href.match(/([^/]+)\.xhtml(#.*)?$/);
              if (match) {
                const chapterId = match[1];
                onNavigate(chapterId);
              }
            }
          }
        });
      }

      // Restore scroll position if we have pending data
      if (pendingScrollRestore) {
        // Use requestAnimationFrame to ensure DOM is fully ready
        requestAnimationFrame(() => {
          restoreScrollPosition(
            iframeDoc,
            pendingScrollRestore!.anchor,
            pendingScrollRestore!.fallbackScrollTop
          );
          // Clear the pending data
          pendingScrollRestore = null;
        });
      }
    }
  }

  // Add resize listener to update scaling when viewport changes
  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    // Print preview is HTTP-only; never start on it under file://.
    if (selectedDevice.current === 'print' && !canPaginate) selectedDevice.current = 'desktop';

    // Initialize with default device
    handleDeviceChange(selectedDevice.current);

    // Re-apply device sizing on resize. For Print, re-fit the pages to the new
    // width instead — no re-pagination (Paged.js pages stay A4 regardless).
    const onResize = () => {
      if (selectedDevice.current === 'print') fitPrintToWidth();
      else handleDeviceChange(selectedDevice.current);
    };

    // Set up resize observer for responsive scaling
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        // Debounce resize events
        setTimeout(onResize, 400);
      });

      // Observe the preview content element for size changes
      if (previewContentEl) {
        resizeObserver.observe(previewContentEl);
      }
    }

    // Fallback: window resize listener
    const handleResize = () => {
      setTimeout(onResize, 400);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
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
        <!-- Rendered content-document filename for the current chapter. -->
        {#if renderedFilename}
          <span class="rendered-filename" title={$t('Rendered chapter file')}>
            {renderedFilename}
          </span>
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
        {#if previewStale}
          <button
            type="button"
            class="print-refresh"
            onclick={() => renderNow()}
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
             presets follow under their category groups. -->
        <!-- i18n: Accessibility label for the view / device dropdown menu -->
        <select
          class="device-selector"
          value={showSource ? 'source' : selectedDevice.current}
          onchange={e => handleViewSelect((e.target as HTMLSelectElement).value)}
          aria-label={$t('Select view')}
        >
          {#if advancedMode}
            <option value="source">{$t('Source')}</option>
          {/if}
          {#each responsiveDevices as device}
            <option value={device.id}>{$t('Responsive')}</option>
          {/each}
          {#each Object.entries(groupedDevices) as [category, devices]}
            {#if category !== 'responsive'}
              <optgroup label={getCategoryLabel(category)}>
                {#each devices as device}
                  <option value={device.id}>
                    {device.id === 'print' ? printDeviceLabel : getDeviceLabel(device)}
                  </option>
                {/each}
              </optgroup>
            {/if}
          {/each}
        </select>

        <div class="preview-device">
          <!-- Orientation toggle (only show for scaled device frames, not fill/print) -->
          {#if !isFillDevice(selectedDevice.current)}
            <button
              type="button"
              class="orientation-toggle"
              onclick={toggleOrientation}
              title={$t('Toggle orientation')}
              aria-label={$t('Toggle device orientation')}
            >
              <DeviceRotate size={16} aria-hidden="true" />
            </button>
          {/if}
        </div>
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
        <!-- Accessibility check (spike): inject axe-core into the preview + run it -->
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
  {#if activePanel === 'reader' && readerModeActive}
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

          <!-- i18n: fidelity note under the screen reader preview options -->
          <p class="reader-note">
            {$t('Approximate announcements — real screen readers word things differently.')}
          </p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Preview content -->
  <div class="preview-content" bind:this={previewContentEl}>
    {#if showSource}
      <!-- Source view -->
      <div class="source-view">
        <pre class="source-code" dir="ltr">{xhtmlContent ||
            '<!-- No content generated yet -->'}</pre>
      </div>
    {:else}
      <!-- Live preview -->
      <div class="preview-viewport">
        <!-- Content-size + success/timing, revealed on hover or keyboard focus (so
             the header stays uncluttered). aria-live keeps it perceivable to AT;
             transform errors/warnings remain in the header, always visible. -->
        {#if xhtmlContent}
          <div class="preview-stats" aria-live="polite">
            <span class="content-size">{Math.round(xhtmlContent.length / 1024)}KB</span>
            {#if !isTransforming && !transformError && transformWarnings.length === 0}
              <span class="stat-timing" title={$t('Transform successful')}>
                {formatExecutionTime(executionTime)}
              </span>
            {/if}
          </div>
        {/if}
        {#if printPaginating && selectedDevice.current === 'print'}
          <div class="print-paginating" role="status">
            <div class="status-spinner"></div>
            <span>{$t('Paginating…')}</span>
          </div>
        {/if}
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
              {#each srPhrases as phrase, i (i)}
                <li class:current={srWalking && i === srPhrases.length - 1}>{phrase}</li>
              {/each}
            </ol>
          </div>
        {/if}
        <div class="preview-frame-wrapper">
          <div
            class="preview-frame-container"
            class:device-frame={!isFillDevice(selectedDevice.current)}
            class:fxl-letterbox={fxlActive}
            style:transform={!isFillDevice(selectedDevice.current)
              ? `scale(${deviceScale})`
              : 'none'}
            style:transform-origin="top left"
            bind:this={previewContainer}
          >
            {#if transformError}
              <div class="preview-error">
                <div class="error-content">
                  <h3>{$t('Transform Error')}</h3>
                  <p><strong>{$t('Stage:')}</strong> {transformError.stage}</p>
                  <p><strong>{$t('Message:')}</strong> {transformError.message}</p>
                  {#if transformError.stack}
                    <details>
                      <summary>{$t('Stack Trace')}</summary>
                      <pre class="error-stack">{transformError.stack}</pre>
                    </details>
                  {/if}
                </div>
              </div>
            {:else if xhtmlContent}
              <!-- Re-key the iframe on the device so a device switch destroys and
                   recreates it (the render effect repopulates it) rather than reusing
                   it via updatePreviewContent's open/write/close. The reuse path leaves
                   document.body transiently null mid-rewrite, which an embedded chapter
                   script's pending window handler can fire into; a fresh iframe gives
                   each render its own clean document lifecycle. -->
              <!-- Fixed layout: the iframe IS the page — sized to the declared
                   viewport and contain-fit into the device frame (translate
                   centers the scaled box; transforms don't affect layout, so
                   flex-centering can't). Undefined bindings fall back to the
                   100%×100% CSS for reflowable/fill modes. -->
              {#key selectedDevice.current}
                <iframe
                  bind:this={previewIframe}
                  class="preview-iframe"
                  class:fxl-page={fxlActive}
                  style:width={fxlGeometry ? `${fxlPage.width}px` : undefined}
                  style:height={fxlGeometry ? `${fxlPage.height}px` : undefined}
                  style:transform={fxlGeometry
                    ? `translate(${fxlGeometry.offsetX}px, ${fxlGeometry.offsetY}px) scale(${fxlGeometry.scale})`
                    : undefined}
                  style:transform-origin={fxlGeometry ? 'top left' : undefined}
                  title={$t('XHTML Preview')}
                  onload={handleIframeLoad}
                ></iframe>
              {/key}
            {:else}
              <div class="preview-empty">
                <div class="empty-content">
                  <span class="empty-icon" aria-hidden="true">📝</span>
                  <h3>{$t('No Content')}</h3>
                  <p>{$t('Start typing in the editor to see your XHTML preview here.')}</p>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Per-chapter PDF: a footer (styled like the sidebar's EPUB/PDF footer) shown
       when the PDF device is selected. The parent passes onGeneratePdf only over
       http: (Paged.js needs the origin); opens a window with just this chapter. -->
  {#if selectedDevice.current === 'print' && onGeneratePdf}
    <div class="pdf-footer">
      <button
        type="button"
        class="btn btn-secondary pdf-generate-button"
        onclick={() => onGeneratePdf?.()}
      >
        <FilePdf size={18} aria-hidden="true" />
        <span>{$t('Chapter PDF')}</span>
      </button>
    </div>
  {/if}
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

  /* The rendered chapter filename, sitting left of the Source toggle. As a
     flex item it may shrink and ellipsize rather than force the header wider
     than the pane. */
  .rendered-filename {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Right-float the device dropdown (replaces the old space-between of the
     .header-main group); the panel selector packs beside it, not floated. */
  select.device-selector {
    margin-inline-start: auto;
  }
  select.panel-selector {
    margin-inline-start: 0;
  }

  .preview-device {
    display: flex;
    align-items: center;
    gap: var(--space-2);
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

  /* Per-chapter PDF footer — mirrors the sidebar's EPUB/PDF footer
     (.package-epub-section + the secondary .pdf-button), theme-aware via tokens. */
  .pdf-footer {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3);
    border-top: 1px solid var(--color-border-default);
    background: var(--color-button-secondary-bg);
  }

  /* Layout only; .btn .btn-secondary supplies the chrome + hover. */
  .pdf-generate-button {
    flex: 1;
    min-width: 0;
    min-height: 36px;
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

  .orientation-toggle:hover {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
  }

  .orientation-toggle:focus {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
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

  /* Content-size + timing overlay: top-centre of the viewport, hidden until the
     author hovers or focuses into the preview (keeps the header uncluttered).
     aria-live keeps it perceivable to assistive tech even while visually hidden. */
  .preview-stats {
    position: absolute;
    top: var(--space-2);
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--color-bg-secondary) 90%, transparent);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .preview-viewport:hover .preview-stats,
  .preview-viewport:focus-within .preview-stats {
    opacity: 1;
  }

  .stat-timing {
    color: var(--color-success-text, var(--color-text-secondary));
  }

  /* Generated file size shown beside the view dropdown in the header. */
  .content-size {
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
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

  .preview-content {
    flex: 1;
    overflow: hidden;
    background: var(--color-bg-primary);
  }

  .source-view {
    height: 100%;
    overflow: auto;
  }

  .source-code {
    margin: 0;
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: var(--leading-relaxed);
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    white-space: pre-wrap;
    /* word-break: break-all; */
  }

  .preview-viewport {
    position: relative;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--color-bg-tertiary);
  }

  /* Overlay while Paged.js paginates the print preview. */
  .print-paginating {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    gap: var(--space-2);
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--color-bg-tertiary) 80%, transparent);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .preview-frame-wrapper {
    /* Wrapper dimensions will be set dynamically via JavaScript */
    position: relative;
  }

  .preview-frame-container {
    width: 100%;
    height: 100%;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .preview-frame-container.device-frame {
    box-shadow: var(--shadow-lg);
    border: 2px solid var(--color-border-strong);
  }

  .preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: white;
  }

  /* FXL: the device frame becomes a letterbox stage — the checkerboard reads
     as "not part of the page", so aspect mismatch between the declared page
     and the device is immediately visible. */
  .preview-frame-container.fxl-letterbox {
    background: repeating-conic-gradient(
        var(--color-bg-secondary) 0% 25%,
        var(--color-bg-tertiary) 0% 50%
      )
      0 0 / 16px 16px;
  }

  /* The page edge; box-shadow (not outline) so it scales with the transform. */
  .preview-iframe.fxl-page {
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--color-border-strong) 60%, transparent),
      var(--shadow-md);
  }

  .preview-error,
  .preview-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
  }

  .error-content,
  .empty-content {
    text-align: center;
    max-width: 400px;
  }

  .error-content {
    color: var(--color-error-text);
  }

  .error-content h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
  }

  .error-content p {
    margin: var(--space-1) 0;
    font-size: var(--text-sm);
  }

  .error-stack {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-align: left;
    background: var(--color-bg-secondary);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    margin-top: var(--space-2);
    overflow-x: auto;
  }

  .empty-content {
    color: var(--color-text-secondary);
  }

  .empty-icon {
    font-size: var(--text-4xl);
    display: block;
    margin-bottom: var(--space-3);
  }

  .empty-content h3 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-lg);
    color: var(--color-text-primary);
  }

  .empty-content p {
    margin: 0;
    font-size: var(--text-sm);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .status-spinner {
      animation: none;
    }

    .preview-stats {
      transition: none;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .preview-frame-container {
      border: 2px solid var(--color-forced-border);
    }
  }
</style>
