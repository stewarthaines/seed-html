<!--
  Preview Surface Component (process/SPLIT_PREVIEW.md, phase 1)

  One preview's worth of rendering: the iframe and its device frame, the
  engine glue (raw document.write, Paged.js, foliate/READ.html), source view
  (raw/tree), FXL page box, scaling/resize, and per-render bookkeeping.

  The parent (PreviewPane) owns the header, the options bar, the checks
  panels, and every persisted setting; this component receives settings as
  props, reports render events via onContentEvent, and exposes commands and
  reactive read-outs through its exported functions (bind:this).
-->

<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { writable } from 'svelte/store';
  import type { TransformError } from '$lib/types/spine-editor.js';
  import { t } from '$lib/i18n';
  import { snippetAroundClick } from './preview-click.js';
  import { isHttpContext } from '$lib/reader/open-in-reader.js';
  import { canShowXmlTree, loadXmlTreeViewer } from '$lib/xml-tree/tree-viewer-loader.js';
  import {
    buildReadDocument,
    readerSimCss,
    FOLIATE_CLOSE_HOOK,
    FOLIATE_VIEW_GLOBAL,
    type FoliateViewLike,
    type ReadColumns,
    type ReadFlow,
  } from '$lib/reader/read-preview.js';
  import { buildPagedDocument, chapterToSection } from '$lib/pdf/pdf-export.js';
  import { acceptPreviewSaveData } from '$lib/preview/preview-data.js';
  import { measureSelectors, type SelectorResult } from '$lib/checks/inspect-element.js';
  import type { PrintSettings, PreviewSettings } from '$lib/services/settings/settings.service.js';
  import { DEFAULT_PREVIEW } from '$lib/services/settings/settings.service.js';
  import { FilePdf } from 'phosphor-svelte';
  import { pagedDevicePreviews } from '../../stores/paged-device-previews.js';
  import { parseFxlViewport } from '$lib/epub/fixed-layout.js';
  import {
    isFillDevice,
    typeOfDeviceId,
    usesFoliateDevice,
    engineOfDeviceId,
    FONT_STEPS,
    DEVICE_PRESETS,
    type EngineFlags,
  } from './preview-devices.js';

  // Props using Svelte 5 runes syntax. Settings values (device, source mode,
  // reading flow/columns, reader appearance) are owned and persisted by the
  // parent; this surface consumes them and renders.
  let {
    device,
    deviceLabel = '',
    showSource = false,
    sourceTree = false,
    readFlow = 'paginated',
    readColumns = '2',
    readerTheme = 'light',
    fontStepIndex = 2,
    forceColors = false,
    onContentEvent = undefined,
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
    onGeneratePdf = undefined,
    previewHead = '',
    extensionPreviewHead = '',
    previewAutoUpdate = DEFAULT_PREVIEW.autoUpdate,
    previewIncludeHead = DEFAULT_PREVIEW.includeHead,
    isFixedLayout = false,
    renditionViewport = undefined,
    onSavePreviewData = undefined,
    getPagedStartPage = undefined,
  }: {
    /** The device preset id this surface renders. */
    device: string;
    /** Human label for the device, as shown in the view dropdown, qualified by
     *  its group (e.g. "Commute (phone): Plus") — shown in the hover stats. */
    deviceLabel?: string;
    /** Show the Source view (raw/tree) instead of a rendered preview. */
    showSource?: boolean;
    /** Source view rendering: collapsible tree instead of the raw <pre>. */
    sourceTree?: boolean;
    /** Reading flow for foliate views (parent-persisted). */
    readFlow?: ReadFlow;
    /** Column cap for the fill-size READ.html view (parent-persisted). */
    readColumns?: ReadColumns;
    /** Reader-simulation theme (parent-persisted, shared appearance). */
    readerTheme?: 'light' | 'sepia' | 'dark';
    /** Index into FONT_STEPS (parent-persisted, shared appearance). */
    fontStepIndex?: number;
    /** Simulate readers that force their colours over the author's. */
    forceColors?: boolean;
    /** Render-lifecycle events the parent's checks react to. */
    onContentEvent?: (event: import('./preview-devices.js').SurfaceContentEvent) => void;
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
    /** Generate a PDF of this one chapter. Provided only over http: (Paged.js needs
     *  the origin); when set, the PDF device shows a "Chapter PDF" footer. */
    onGeneratePdf?: (() => void) | undefined;
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
    /** Persist per-chapter data a preview head.xml script saved via `window.seed`
     *  (process/PREVIEW_BRIDGE.md). The app owns the path (built from `idref`);
     *  the iframe supplies only the slot + text. */
    onSavePreviewData?: (idref: string, slot: string, text: string) => void;
  } = $props();

  // The generated content-document filename for the current chapter (e.g.
  // chapter01.xhtml), surfaced next to the Source toggle so authors see the real
  // rendered file. Spine items render to `<id>.xhtml`.

  /** Format the transform's execution time for the status indicator. */
  function formatExecutionTime(ms: number): string {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  // --- Print preview (Paged.js) ------------------------------------------------
  // The "Print" device paginates the current chapter into print pages with the
  // vendored Paged.js polyfill — the same pipeline (and print.css) as "Save as
  // PDF" — so authors see what the printed page will look like. HTTP-only: the
  // polyfill is fetched from the app origin, so the option is hidden on file://.
  /** postMessage token Paged.js pings the parent with when pagination completes. */
  const PAGED_DONE = 'preview-paged';

  // --- READ.html reader preview (foliate) --------------------------------------
  // The "READ.html" device renders the chapter with the vendored foliate-js
  // renderer (public/foliate/ — the same patched engine inside the vendored
  // reader), paginated or scrolled, so the preview matches what Publish → Read
  // shows. HTTP-only like Print and axe: the modules are fetched from the app
  // origin, so the option is hidden on file://. See process/READ_DEVICE_PREVIEW.md.
  const canReadPreview = isHttpContext();
  /** postMessage token the read wrapper pings the parent with after first render. */
  const READ_DONE = 'preview-read';
  /** postMessage type the read wrapper sends on every relocation (page turns). */
  const READ_RELOCATE = 'preview-read-relocate';
  let readRendering = $state(false);
  // Page indicator state, fed by READ_RELOCATE messages. Content pages run
  // 1..pages-2 (the paginator pads one turn page at each end); readPages is the
  // content-page total, 0 while unknown or in scrolled flow (nav hidden).
  let readPage = $state(0);
  let readPages = $state(0);
  // Scrolled-flow position (start/viewSize), tracked from relocates for the
  // position restore below. Not reactive — nothing renders it.
  let readScrollFraction = 0;
  // Reading position to restore after a same-chapter re-render (edits must not
  // reset the view to page one); consumed by the READ_DONE handler. Paginated
  // flow remembers the content page (clamped — the edit may have shortened the
  // chapter), scrolled flow the scroll fraction. A chapter switch starts fresh.
  let pendingReadRestore: { page: number } | { fraction: number } | null = null;
  let readSafetyTimer: ReturnType<typeof setTimeout> | undefined;
  /** Blob URL of the chapter section handed to foliate; revoked on replacement. */
  let readSectionUrl: string | null = null;
  // Options-bar enablement (grounded layout: the reader controls hold their
  // positions and disable in place rather than appear/disappear). Columns
  // applies only while paginated; the pager needs more than one content page.
  // Both are read through pagerState() by the parent's options bar.
  const readColumnsEnabled = $derived(readFlow === 'paginated');
  const readPagerEnabled = $derived(readFlow === 'paginated' && readPages > 1);

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

  let printPaginating = $state(false);
  // A render that produced no document. The chapter transformed fine and was
  // written to the iframe, but the iframe holds nothing to show — the author
  // would otherwise face a blank frame indistinguishable from an empty chapter.
  let renderFailed = $state(false);
  // Files the chapter references that could not be resolved out of the
  // workspace, collected from the rendered document (see data-seed-missing).
  let missingAssets = $state<string[]>([]);
  let renderCheckTimer: ReturnType<typeof setTimeout> | undefined;
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
  let renderedType: ReturnType<typeof typeOfDeviceId> | undefined = undefined;
  // The engine and device that content was rendered with: an engine change
  // (http/file, FXL flip) always re-renders, and the read-position restore only
  // applies when the device matches (page N on a phone ≠ page N on a tablet).
  let renderedEngine: 'paged' | 'foliate' | 'raw' | undefined = undefined;
  let renderedDevice: string | undefined = undefined;
  // The head fragment actually injected last render (''=none), so toggling
  // include/editing head.xml marks the preview stale when auto-update is off.
  let renderedHead = '';
  let printSafetyTimer: ReturnType<typeof setTimeout> | undefined;
  // Page index to restore after Paged.js finishes repaginating (same-chapter
  // re-render only); consumed by the PAGED_DONE handler.
  let pendingPrintPage: number | null = null;

  /**
   * The document + window checks should target: under a reader-engine view the
   * foliate section document (reachable same-origin as
   * `renderer.getContents()[0].doc`, whose sandboxed iframe carries
   * `allow-scripts` so injected bundles run), otherwise the preview iframe.
   * Resolved fresh per use — each foliate re-render replaces the doc. The
   * parent's checks (axe, screen reader) run against this target.
   */
  export function getCheckTarget(): { doc: Document; win: Window } | null {
    if (usesFoliate(device)) {
      const doc = liveFoliateView()?.renderer?.getContents?.()[0]?.doc;
      const win = doc?.defaultView;
      return doc && win ? { doc, win } : null;
    }
    const doc = previewIframe?.contentDocument;
    const win = previewIframe?.contentWindow;
    return doc && win ? { doc, win } : null;
  }

  /**
   * Measure selectors against this surface's live rendered document for the
   * agent bridge — the same engine-correct target axe audits, so a measurement
   * describes the layout the author is actually looking at. Null when nothing
   * is rendered (Source view, or a render that has not produced a document).
   */
  export function measureElements(
    selectors: string[],
    properties: readonly string[]
  ): SelectorResult[] | null {
    if (showSource) return null;
    const target = getCheckTarget();
    if (!target) return null;
    return measureSelectors(target.doc, target.win, selectors, properties);
  }

  /** A render is still in flight, so any measurement may describe the previous
   *  layout — the parent surfaces this as a caveat rather than blocking. */
  export function isRendering(): boolean {
    return readRendering || printPaginating;
  }

  // --- Reader-mode simulation (theme + font size) ------------------------------
  // Per-device base font size (px). Phones get a smaller base than tablets, so the
  // same relative step lands at a smaller px on a phone than on a large tablet.
  const DEVICE_BASE_FONT: Record<string, number> = {
    desktop: 18,
    read: 18,
    iphone: 16,
    'iphone-plus': 16,
    ipad: 18,
    'ipad-air': 19,
    kindle: 17,
    print: 16,
  };
  // Injected reading-system themes (background + text colour), à la Readium CSS.
  const THEME_PALETTES = {
    light: { bg: '#ffffff', fg: '#1a1a1a', scheme: 'light' },
    sepia: { bg: '#f4ecd8', fg: '#5b4636', scheme: 'light' },
    dark: { bg: '#14161a', fg: '#c9c9c9', scheme: 'dark' },
  } as const;

  // Component state
  let deviceOrientation = $state<'portrait' | 'landscape'>('portrait');
  // Source tree availability (http-only — the vendored viewer is fetched from
  // the app origin); the raw/tree choice itself is a parent-owned prop.
  const canSourceTree = canShowXmlTree();
  let sourceTreeEl: HTMLDivElement | undefined = $state();
  let sourceTreeError = $state<string | null>(null);

  // Render the on-disk XHTML into the tree container whenever the tree
  // rendering is active and the content changes. The viewer module loads on
  // first use; a load/parse failure is shown in the pane (the raw view stays
  // one click away).
  $effect(() => {
    const container = sourceTreeEl;
    const content = persistedXhtml;
    if (!container || !content) return;
    let cancelled = false;
    loadXmlTreeViewer()
      .then(viewer => {
        if (cancelled) return;
        const parsed = new DOMParser().parseFromString(content, 'text/xml');
        const parseError = parsed.querySelector('parsererror');
        if (parseError) {
          sourceTreeError = parseError.textContent ?? 'XML parse error';
          container.replaceChildren();
          return;
        }
        sourceTreeError = null;
        viewer.render(parsed, container);
      })
      .catch((error: unknown) => {
        if (!cancelled) sourceTreeError = String(error);
      });
    return () => {
      cancelled = true;
    };
  });
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
  const fxlActive = $derived(isFixedLayout && !isFillDevice(device));
  const fxlPage = $derived(parseFxlViewport(renditionViewport));
  const fxlGeometry = $derived.by(() => {
    const preset = DEVICE_PRESETS.find(d => d.id === device);
    if (!fxlActive || !preset) return null;
    const { width: dw, height: dh } = getDeviceDimensions(preset); // tracks deviceOrientation
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

  // Written documents handled by handleIframeLoad, keyed by their <body> (the
  // Document object survives document.open() cycles; the body is fresh per
  // write). handleIframeLoad is invoked from two sides — the iframe `load`
  // event AND directly after a rewrite's document.close() — because current
  // Firefox leaves a written document at readyState "interactive" on alternate
  // open()/write()/close() cycles and never fires `load` for it. First
  // invocation per written document wins; the other is a no-op.
  const handledBodies = new WeakSet<HTMLElement>();

  // Reactive state
  const lastUpdateTime = writable<number>(Date.now());

  // Whether the reader-mode controls apply: reflowable previews only (not the print
  // preset, not fixed-layout chapters — readers disable user theming/sizing there).
  // Foliate-rendered views (READ.html + device presets) are included: their sim
  // goes through renderer.setStyles() instead of head injection.
  const readerModeActive = $derived(engineOfDevice(device) !== 'paged' && !isFixedLayout);

  /** The reader-simulation CSS for the current controls + device (foliate path). */
  function currentReaderSimCss(): string {
    const palette = THEME_PALETTES[readerTheme];
    const basePx = DEVICE_BASE_FONT[device] ?? 18;
    return readerSimCss({
      basePx: Math.round(basePx * FONT_STEPS[fontStepIndex]),
      bg: palette.bg,
      fg: palette.fg,
      scheme: palette.scheme,
      force: forceColors,
    });
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
    if (!readerModeActive) return;

    // Foliate-rendered views: hand the sim to the engine. The initial render
    // gets the same CSS via the builder's `styles` option (flash-free); this
    // path covers live control changes. No live view yet → nothing to do.
    if (usesFoliate(device)) {
      liveFoliateView()?.renderer?.setStyles?.(currentReaderSimCss());
      return;
    }

    const iframeDoc = previewIframe?.contentDocument;
    // Bail while the document is head-only (no body element yet). A parser-blocking
    // external script (script src) in the chapter head stalls open/write/close
    // mid-parse, and mutating that stalled head (inserting the theme style element)
    // can leave it permanently body-less in some browsers. The iframe `load` event
    // re-applies appearance once the body has parsed.
    if (!iframeDoc?.documentElement || !iframeDoc.head || !iframeDoc.body) return;

    const root = iframeDoc.documentElement;
    const palette = THEME_PALETTES[readerTheme];

    // Font size: inline on the root so em/rem/% cascade and win over stylesheet
    // rules; fixed-px text deliberately stays put (a useful "not responsive" tell).
    const basePx = DEVICE_BASE_FONT[device] ?? 18;
    root.style.fontSize = `${Math.round(basePx * FONT_STEPS[fontStepIndex])}px`;
    // Match UA-rendered chrome (scrollbars, form controls, default canvas).
    root.style.colorScheme = palette.scheme;

    const rules = forceColors
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

  // Re-apply theme/font instantly when a control (prop) changes — no rewrite.
  $effect(() => {
    // Track the controls so this re-runs on change.
    void readerTheme;
    void fontStepIndex;
    void forceColors;
    void device;
    void readerModeActive;
    applyPreviewAppearance();
  });

  // Drive the preview when the XHTML, the selected device, or the preview-head
  // config changes. Per preview type, `previewAutoUpdate` decides whether edits
  // re-render live or just mark the preview stale (author refreshes on demand) —
  // a generalisation of the old "Responsive/Device live, Print on demand" rule.
  $effect(() => {
    void device;
    const content = xhtmlContent;
    const chapter = chapterId;
    const type = typeOfDeviceId(device);
    const auto = previewAutoUpdate[type];
    // Track the head config so toggling include / editing head.xml re-runs this.
    const wantHead = previewIncludeHead[type] && previewHead ? previewHead : '';

    // The engine this render will use (reads isFixedLayout, so an FXL flip
    // re-runs this effect and re-renders through the right engine).
    const engine = engineOfDevice(device);

    if (engine !== 'paged') {
      // Not on a paged view: clear any leftover print pagination state.
      printPaginating = false;
      clearTimeout(printSafetyTimer);
    }
    if (engine !== 'foliate') {
      // Not on foliate: clear any leftover reader-render state.
      readRendering = false;
      clearTimeout(readSafetyTimer);
    }

    // Always render on first show (nothing rendered yet, or only empty content), a
    // chapter change, or a device-type switch (so a stale frame of the previous type
    // never lingers); otherwise honour auto-update. Empty `renderedContent` counts as
    // "not yet rendered" so the first real content shows even when auto-update is off.
    const firstOrSwitch =
      !renderedContent ||
      chapter !== renderedChapterId ||
      type !== renderedType ||
      engine !== renderedEngine;
    if (firstOrSwitch || auto) {
      // untrack: renderNow reads state this effect must NOT depend on — the
      // read preview's page indicator ($state updated by every relocate
      // message) and the flow/columns settings. Tracked, each page turn would
      // re-trigger this effect and re-render in a loop. The effect's real
      // dependencies are all read explicitly above.
      untrack(() => renderNow());
    } else if (content !== renderedContent || wantHead !== renderedHead) {
      previewStale = true;
    }
  });

  // Paged.js pings the parent when pagination finishes: drop the spinner, fit
  // the rendered pages to the pane width, and restore the pre-render page.
  $effect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== previewIframe?.contentWindow) return;
      // A preview head.xml script persisting per-chapter data via window.seed.
      // The bridge stamped the idref into the realm at render time and the
      // message echoes it; acceptPreviewSaveData drops anything whose echo
      // doesn't match the chapter currently previewed (the iframe Window
      // survives document.open() across a chapter switch, so event.source
      // alone can't tell a late message from the previous chapter apart).
      // See process/PREVIEW_BRIDGE.md.
      const seedMsg = event.data as { type?: string } | null;
      if (seedMsg?.type === 'seed-save-data') {
        const save = acceptPreviewSaveData(seedMsg, chapterId);
        if (save) {
          onSavePreviewData?.(save.idref, save.slot, save.text);
        }
        return;
      }
      if (event.data === READ_DONE) {
        // Foliate finished its first render (success or reported failure).
        clearTimeout(readSafetyTimer);
        readRendering = false;
        // Click-to-source deixis works on foliate views too, retargeted at the
        // section document (the wrapper holds only reader chrome).
        wireFoliateDeixis();
        // A foliate re-render replaced the section document; the parent
        // re-runs its open checks (axe, screen reader) against the fresh one.
        onContentEvent?.('section-ready');
        // Restore the pre-render reading position. The first relocate (fired
        // during init, so already handled — same-source messages keep order)
        // has refreshed readPages with the new totals; clamp to them.
        if (pendingReadRestore) {
          const restore = pendingReadRestore;
          pendingReadRestore = null;
          const renderer = liveFoliateView()?.renderer;
          if (renderer?.scrollToAnchor) {
            if ('fraction' in restore) {
              void renderer.scrollToAnchor(restore.fraction);
            } else if (readPages > 0) {
              const target = Math.min(restore.page, readPages);
              void renderer.scrollToAnchor(readPages > 1 ? (target - 1) / (readPages - 1) : 0);
            }
          }
        }
        return;
      }
      if ((event.data as { type?: string } | null)?.type === READ_RELOCATE) {
        const { page, pages, scrolled, fraction } = event.data as {
          page: number;
          pages: number;
          scrolled: boolean;
          fraction: number;
        };
        readPages = scrolled ? 0 : Math.max(0, pages - 2);
        readPage = Math.min(Math.max(1, page), Math.max(1, readPages));
        readScrollFraction = scrolled ? fraction : 0;
        return;
      }
      if (event.data !== PAGED_DONE) return;
      clearTimeout(printSafetyTimer);
      printPaginating = false;
      if (renderedDevice === 'proofs') applyProofsChrome();
      else fitPrintToWidth();
      if (pendingPrintPage !== null) {
        const pages =
          previewIframe?.contentDocument?.querySelectorAll<HTMLElement>('.pagedjs_page');
        // Clamp: the edit may have shortened the chapter below the saved page.
        const target = pages?.[Math.min(pendingPrintPage, (pages?.length ?? 1) - 1)];
        target?.scrollIntoView({ behavior: 'instant', block: 'start' });
        pendingPrintPage = null;
      }
      void injectAbsoluteFolios();
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

      // Try to find an element with an ID (most reliable anchor). The offset
      // is the anchor's viewport-relative top (may be negative for an element
      // straddling the viewport edge) — restore reproduces it exactly.
      let current: Element | null = elementAtScroll;
      while (current && current !== iframeDoc.body) {
        if (current.id) {
          return { element: current, id: current.id, offset: current.getBoundingClientRect().top };
        }
        current = current.parentElement;
      }

      // Fall back to tag name + index if no ID found
      const tagName = elementAtScroll.tagName.toLowerCase();
      const siblings = Array.from(iframeDoc.querySelectorAll(tagName));
      const index = siblings.indexOf(elementAtScroll);

      if (index >= 0) {
        return {
          element: elementAtScroll,
          id: `${tagName}[${index}]`,
          offset: elementAtScroll.getBoundingClientRect().top,
        };
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
        // Put the anchor back at its saved viewport-relative top: the
        // element's document position minus where its top sat in the viewport.
        // Direct assignment — no scrollIntoView hop, no drift.
        const rect = targetElement.getBoundingClientRect();
        const currentScroll = iframeDoc.documentElement.scrollTop || iframeDoc.body?.scrollTop || 0;
        const newScroll = Math.max(0, rect.top + currentScroll - anchor.offset);
        iframeDoc.documentElement.scrollTop = newScroll;
        if (iframeDoc.body) {
          iframeDoc.body.scrollTop = newScroll;
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

  /** The author's preview-head fragment for the current preview type ('' = none),
   *  gated by the per-type `includeHead` setting. */
  function currentWantHead(): string {
    return previewIncludeHead[typeOfDeviceId(device)] && previewHead ? previewHead : '';
  }

  /**
   * Everything spliced into the preview head: the author's gated fragment plus the
   * installed extensions' fragments, which inject into EVERY preview regardless of
   * `includeHead` — they self-guard (A1, process/PREVIEW_HEAD_EXTENSIONS.md).
   */
  function headToInject(): string {
    return [currentWantHead(), extensionPreviewHead].filter(Boolean).join('\n');
  }

  /**
   * Splice the preview-only head fragment(s) into a chapter's head, just before
   * the closing head tag (after the book's own stylesheets, so author CSS can
   * override). Preview only — the published/packaged XHTML never goes through
   * here. The fragment is inserted after blob-URL processing, so it is for INLINE
   * style/script markup; external href/src won't be blob-resolved.
   */
  function withPreviewHead(content: string): string {
    const head = headToInject();
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
   * How long to give a written document before calling it a failed render. A
   * stalled parse never finishes, so any delay would do; this one is short
   * enough to be useful feedback and long enough to outlast a slow blob fetch.
   */
  const RENDER_CHECK_DELAY = 1500;

  /**
   * Report what the author actually got, once the write has had time to settle.
   *
   * Two distinct findings, both invisible until now:
   *  - a document with no body (or an empty one) while the chapter transformed
   *    to real content — an app-level failure, not an empty chapter. The
   *    `body:empty::before` hint in setupIframeInteractivity cannot cover this:
   *    a stalled parse leaves no body for it to attach to.
   *  - assets the chapter references that are not in the workspace, stamped
   *    element-side by the blob URL manager. Author-fixable, and previously only
   *    a console warning.
   *
   * Deliberately driven by a timer rather than the iframe `load` event: the
   * failure this exists to catch is precisely the one where the parse never
   * finishes, so `load` may never arrive.
   */
  function scheduleRenderCheck(): void {
    clearTimeout(renderCheckTimer);
    renderFailed = false;
    missingAssets = [];
    renderCheckTimer = setTimeout(() => {
      const doc = previewIframe?.contentDocument;
      if (!doc) return;
      const body = doc.body;
      renderFailed = !body || (body.childElementCount === 0 && !body.textContent?.trim());
      missingAssets = [
        ...new Set(
          Array.from(doc.querySelectorAll('[data-seed-missing]'), el =>
            el.getAttribute('data-seed-missing')
          ).filter((path): path is string => !!path)
        ),
      ];
    }, RENDER_CHECK_DELAY);
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
      closeFoliateView(); // leaving the READ.html device: mandatory teardown
      pausePreviewMedia(iframeDoc);
      // The parent stops any screen-reader walk over the dying document.
      onContentEvent?.('will-rewrite');
      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();
      scheduleRenderCheck();

      // Re-apply the reader-mode theme + font synchronously: the fresh document
      // dropped them, and relying on the iframe `load` event alone races with a
      // device switch (the appearance effect runs against the old document, then
      // this rewrite replaces it). Doing it here guarantees the new device's base
      // font and the current theme are on the freshly written document.
      applyPreviewAppearance();

      // Run the post-load work directly: document.write is synchronous, so the
      // DOM is complete once close() returns — but current Firefox leaves the
      // written document at readyState "interactive" on alternate rewrite
      // cycles and never fires the iframe `load` event, which would strand
      // scroll restoration and preview interactivity. handleIframeLoad is
      // guarded per written document, so browsers that do fire `load` won't
      // run it twice.
      handleIframeLoad();

      lastUpdateTime.set(Date.now());

      // The rewrite invalidated prior check results and injected affordances;
      // the parent re-establishes whichever panel is open.
      onContentEvent?.('rewrite');
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
  export function renderNow(): void {
    const content = xhtmlContent;
    fxlContentSize = null; // stale overflow badge must not survive a rewrite
    // Findings belong to one render. The built-in path re-arms the check; the
    // paged and foliate engines build documents of their own shape (foliate
    // nests the chapter in a further iframe), so they simply clear it.
    clearTimeout(renderCheckTimer);
    renderFailed = false;
    missingAssets = [];
    // Route on engine: Print → Paged.js; READ.html entry + device presets →
    // foliate (http, reflowable — usesFoliate); everything else (Responsive,
    // file://, fixed layout) → the built-in preview.
    if (engineOfDevice(device) === 'paged') writePagedDoc(content);
    else if (usesFoliate(device)) writeFoliateDoc(content);
    else updatePreviewContent(withPreviewHead(content));
    renderedContent = content;
    renderedChapterId = chapterId;
    renderedType = typeOfDeviceId(device);
    renderedEngine = engineOfDevice(device);
    renderedDevice = device;
    renderedHead = currentWantHead();
    previewStale = false;
  }

  /**
   * Absolute folios: after pagination, seed Paged.js's page counter with the
   * chapter's book-absolute start page (from the app-owned pagemaps, via the
   * getPagedStartPage prop). Post-pagination injection is the ONLY working
   * mechanism — Paged.js rewrites author CSS, so counter rules inside the
   * document are intercepted (verified against the vendored polyfill; see the
   * paged-preview notes). `data-page-number` stays physical, so the pagemap
   * capture is unaffected. An unknown offset (an earlier chapter not yet
   * previewed) keeps the relative 1-based folios — honest, never wrong.
   */
  async function injectAbsoluteFolios(): Promise<void> {
    if (!getPagedStartPage || !chapterId) return;
    const forChapter = chapterId;
    try {
      const start = await getPagedStartPage(forChapter);
      if (!start || start <= 1) return;
      // Still the same chapter's paged render? A switch mid-await replaces the
      // document, and a stale injection would number the wrong chapter.
      if (renderedChapterId !== forChapter || renderedType !== 'pdf') return;
      const doc = previewIframe?.contentDocument;
      if (!doc?.querySelector('.pagedjs_pages')) return;
      const style = doc.createElement('style');
      style.setAttribute('data-seed-absolute-folios', '');
      style.textContent = `.pagedjs_pages { counter-reset: page ${start - 1}; }`;
      doc.head.appendChild(style);
    } catch {
      // Folio seeding is cosmetic — never break the preview over it.
    }
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
      // Inject the preview-only head: the author's fragment (when PDF includeHead
      // is on) plus always-on extension fragments (e.g. the page-index capture).
      headExtra: headToInject(),
      // Install the window.seed bridge + fire the `paginated` hook for the
      // project's head.xml (process/PREVIEW_BRIDGE.md). Keyed to this chapter.
      previewBridge: chapterId ? { idref: chapterId } : undefined,
    });

    const iframeDoc = previewIframe.contentDocument;
    if (!iframeDoc) return;

    printPaginating = true;
    // Print output has a different DOM than the live preview; don't carry over
    // scroll anchors or auto-run axe against Paged.js wrapper elements.
    pendingScrollRestore = null;

    // Keep the reader's place across re-renders of the SAME chapter: remember
    // the page currently at the top of the viewport, by index — pixel offsets
    // don't survive repagination, page boundaries do. A chapter switch (or
    // arriving from a non-print render) starts at page one.
    pendingPrintPage = null;
    if (renderedType === 'pdf' && renderedChapterId === chapterId) {
      const pages = iframeDoc.querySelectorAll<HTMLElement>('.pagedjs_page');
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].getBoundingClientRect().bottom > 1) {
          pendingPrintPage = i;
          break;
        }
      }
    }

    closeFoliateView(); // leaving the READ.html device: mandatory teardown
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

  // --- READ.html reader preview ------------------------------------------------

  /**
   * Close a live foliate view before a document.open() rewrite. Mandatory
   * teardown (see read-preview.ts): close() disconnects the paginator's
   * ResizeObserver — without it, stale observer callbacks fire on the dead view
   * and throw uncaught TypeErrors. A no-op when no read preview is up.
   */
  function closeFoliateView(): void {
    const win = previewIframe?.contentWindow as (Window & Record<string, unknown>) | null;
    const close = win?.[FOLIATE_CLOSE_HOOK];
    if (typeof close === 'function') close();
  }

  /** The live foliate view, when the READ.html preview is currently rendered. */
  function liveFoliateView(): FoliateViewLike | undefined {
    const win = previewIframe?.contentWindow as (Window & Record<string, unknown>) | null;
    const view = win?.[FOLIATE_VIEW_GLOBAL];
    return view && typeof view === 'object' ? (view as FoliateViewLike) : undefined;
  }

  /**
   * Wire click-to-source deixis onto the foliate section document (phase B of
   * FOLIATE_UNIFIED_PREVIEW.md). Under foliate the chapter lives in a nested
   * section iframe, not the preview wrapper; it is reachable same-origin via
   * read-html's open-shadow-root patch as `renderer.getContents()[0].doc`.
   * Attach `handlePreviewClick` to the section already loaded (this runs after
   * READ_DONE, so init is complete and the first `load` has fired), and
   * re-attach on every subsequent `load` so a repagination/reload keeps deixis
   * live. `handlePreviewClick` reads the caret from the event's own document
   * and `estimateDocumentPosition` walks the element's own document — both
   * engine-agnostic. Listeners die with the section document when the view is
   * torn down (document.open paves the wrapper); no manual cleanup. Adding the
   * same handler twice is a no-op (identical type + reference dedupe).
   */
  function wireFoliateDeixis(): void {
    if (!onPreviewClick) return;
    const view = liveFoliateView();
    if (!view) return;
    const attach = (doc: Document | undefined): void => {
      doc?.addEventListener('click', handlePreviewClick);
    };
    view.renderer?.getContents?.().forEach(c => attach(c.doc));
    view.addEventListener?.('load', event => attach(event.detail?.doc));
  }

  /**
   * Apply the flow/columns settings to the live renderer without a re-render;
   * falls back to a full render when no view is up (stale preview, first show).
   * `flow` is an observed attribute; `max-column-count` only changes a CSS
   * custom property, so the explicit render() call is what repaginates
   * (read-html hit this; render() is idempotent where the attribute change
   * already triggered one).
   */
  export function applyReadSettings(): void {
    const renderer = liveFoliateView()?.renderer;
    if (!renderer) {
      renderNow();
      return;
    }
    renderer.setAttribute('flow', readFlow);
    // Device presets are always Auto — the device width decides columns.
    renderer.setAttribute('max-column-count', device === 'read' ? readColumns : '2');
    renderer.render?.();
    // render() reloads the section (a fresh document) without a READ_DONE ping;
    // the parent re-runs open checks against it so highlights aren't stale.
    onContentEvent?.('section-reflow');
  }

  /** Turn a page in the reading direction of the button (RTL-aware via goLeft/goRight). */
  export function readPageLeft(): void {
    void liveFoliateView()?.goLeft?.();
  }

  export function readPageRight(): void {
    void liveFoliateView()?.goRight?.();
  }

  /**
   * Jump to a content page (1-based). The paginator's public seam is a section
   * fraction: it maps `fraction * (textPages - 1)` back to exactly this page.
   */
  export function goToReadPage(value: string): void {
    const renderer = liveFoliateView()?.renderer;
    const target = parseInt(value, 10);
    if (!renderer?.scrollToAnchor || !Number.isFinite(target) || readPages < 1) return;
    const fraction = readPages > 1 ? (target - 1) / (readPages - 1) : 0;
    void renderer.scrollToAnchor(fraction);
  }

  /**
   * Render the current chapter with the foliate renderer — the READ.html entry
   * and (on http, reflowable) the device presets. The wrapper (read-preview.ts)
   * imports the vendored modules from the app origin and opens a one-section
   * book around a blob URL of the chapter; the frame machinery already sizes
   * the iframe to the device, so the engine paginates at true device pixels.
   * The READ_DONE ping (message effect) clears the spinner.
   */
  function writeFoliateDoc(content: string): void {
    if (!previewIframe || !content) return;
    const iframeDoc = previewIframe.contentDocument;
    if (!iframeDoc) return;

    // The chapter document itself is the section; the preview-head fragment
    // (when the READ.html includeHead toggle is on) rides inside it.
    const sectionContent = withPreviewHead(content);
    // Language for foliate's metadata + page-progression direction.
    const lang = chapterToSection(content, chapterId ?? undefined)?.lang ?? undefined;

    closeFoliateView();
    pausePreviewMedia(iframeDoc);
    // The parent stops any screen-reader walk over the dying document.
    onContentEvent?.('will-rewrite');
    // Foliate's DOM is unrelated to the plain preview; no scroll carry-over.
    pendingScrollRestore = null;

    if (readSectionUrl) URL.revokeObjectURL(readSectionUrl);
    readSectionUrl = URL.createObjectURL(
      new Blob([sectionContent], { type: 'application/xhtml+xml' })
    );

    const doc = buildReadDocument({
      sectionUrl: readSectionUrl,
      sectionSize: sectionContent.length,
      flow: readFlow,
      // Device presets: Auto — the device width decides column count honestly.
      // The Single override only exists on the fill-size READ.html entry.
      maxColumnCount: device === 'read' ? readColumns : '2',
      lang,
      doneMessage: READ_DONE,
      relocateMessage: READ_RELOCATE,
      // Reader simulation from the first paint (theme, device base font).
      styles: currentReaderSimCss(),
    });

    readRendering = true;
    // Keep the reader's place across re-renders of the SAME chapter on the
    // SAME device (the print preview's pendingPrintPage contract): remember
    // the content page in paginated flow, the scroll fraction in scrolled.
    // A chapter or device switch starts at the beginning — page N on a phone
    // is not page N on a tablet.
    pendingReadRestore = null;
    if (
      renderedEngine === 'foliate' &&
      renderedChapterId === chapterId &&
      renderedDevice === device
    ) {
      if (readFlow === 'scrolled') {
        if (readScrollFraction > 0) pendingReadRestore = { fraction: readScrollFraction };
      } else if (readPage > 1) {
        pendingReadRestore = { page: readPage };
      }
    }
    // Fresh render: hide the page nav until the first relocate reports counts.
    readPage = 0;
    readPages = 0;
    iframeDoc.open();
    iframeDoc.write(doc);
    iframeDoc.close();

    // Safety: if the wrapper never pings (e.g. module fetch fails), drop the spinner.
    clearTimeout(readSafetyTimer);
    readSafetyTimer = setTimeout(() => {
      readRendering = false;
    }, 10000);
  }

  /**
   * Scale the paginated A4 pages so a full page width fits the pane (the user
   * chose fit-to-width); scroll vertically through pages. Uses CSS `zoom` on the
   * Paged.js page container so the scroll height reflows. Never upscales beyond
   * 1 (real size). Safe to call repeatedly (e.g. on resize) without re-paginating.
   */
  // Proofs chrome — injected AFTER pagination (like the folio seeding) so the
  // Paged.js polisher never processes it: `content: counter(page)` captions
  // evaluate natively in the browser, and pick up the absolute-folio seeding
  // when the offset is known.
  //
  // Layout is the manifest thumbnail grid's auto-fill pattern: tracks share
  // the row evenly instead of leaving flex-wrap's ragged remainder, and the
  // thumb scale follows the width the grid actually resolves (re-applied on
  // pane resize). Scaling is transform-based, NOT `zoom`: each page goes
  // inside a wrapper cell (the grid sizes it) and is transform-scaled within.
  // `zoom` is not interoperable around Paged.js's absolutely-positioned page
  // internals — WebKit reflows the content and leaves the margin boxes
  // unscaled instead of miniaturizing uniformly.
  const PROOFS_TARGET_PX = 150; // minimum thumb width; tracks stretch from here
  const PROOFS_CSS = `
.pagedjs_pages {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${PROOFS_TARGET_PX}px, 1fr));
  gap: 14px;
  padding: 12px;
}
.seed-proofs-cell {
  position: relative;
  /* Clip the page's pre-transform layout box: Firefox counts it into the
     scrollable overflow (Chrome/Safari use post-transform bounds), which
     otherwise makes the grid scroll a huge phantom area. The caption paints
     at the SCALED page bottom — inside the cell's height — so it survives. */
  overflow: hidden;
}
.seed-proofs-cell .pagedjs_page {
  position: relative;
  margin: 0;
  transform-origin: top left;
}
.seed-proofs-cell .pagedjs_page::after {
  content: counter(page);
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  text-align: center;
  /* Counteract the thumb scale so the caption renders at ~12px on screen. */
  font: calc(12px / var(--seed-proofs-zoom, 0.2)) / 1.5 system-ui, sans-serif;
  color: #556;
}`;

  function applyProofsChrome(): void {
    // Never touch the document mid-pagination: the resize observer can fire
    // while Paged.js is still appending pages (it also fires on observe), and
    // wrapping a half-built document leaves the later pages unwrapped and
    // unscaled — full-size pages loose in the grid, horizontal scrollbars.
    // The PAGED_DONE handler applies the chrome once pagination settles.
    if (printPaginating) return;
    if (renderedDevice !== 'proofs') return;
    const iframeDoc = previewIframe?.contentDocument;
    if (!iframeDoc) return;
    const pages = iframeDoc.querySelector<HTMLElement>('.pagedjs_pages');
    const firstPage = iframeDoc.querySelector<HTMLElement>('.pagedjs_page');
    if (!pages || !firstPage) return;

    const pageWidth = firstPage.offsetWidth;
    const pageHeight = firstPage.offsetHeight;
    if (!pageWidth || !pageHeight) return;

    if (!iframeDoc.querySelector('style[data-seed-proofs]')) {
      const style = iframeDoc.createElement('style');
      style.setAttribute('data-seed-proofs', '');
      style.textContent = PROOFS_CSS;
      iframeDoc.head.appendChild(style);
    }

    // Wrap each page in a cell (once); the grid sizes the cell, the page
    // transform-scales within it. Clicks deliberately do nothing beyond text
    // selection — pair Proofs with a Print surface in the split preview to see
    // a page full-size.
    const cells: HTMLElement[] = [];
    iframeDoc.querySelectorAll<HTMLElement>('.pagedjs_page').forEach(page => {
      let cell = page.parentElement;
      if (!cell || !cell.classList.contains('seed-proofs-cell')) {
        cell = iframeDoc.createElement('div');
        cell.className = 'seed-proofs-cell';
        page.replaceWith(cell);
        cell.appendChild(page);
      }
      cells.push(cell);
    });
    if (cells.length === 0) return;

    // Scale to the track width the grid resolved (all tracks are equal 1fr).
    // Re-running on resize re-measures and re-fits.
    const cellWidth = cells[0].offsetWidth;
    if (!cellWidth) return;
    const zoom = Math.min(1, cellWidth / pageWidth);
    pages.style.setProperty('--seed-proofs-zoom', String(zoom));
    for (const cell of cells) {
      cell.style.height = `${Math.round(pageHeight * zoom) + 20}px`;
      const page = cell.querySelector<HTMLElement>('.pagedjs_page');
      if (page) page.style.transform = `scale(${zoom})`;
    }
  }

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
  export function toggleOrientation(): void {
    deviceOrientation = deviceOrientation === 'portrait' ? 'landscape' : 'portrait';
    // Recalculate scaling and container dimensions for new orientation
    applyDeviceSizing(device);
  }

  /**
   * Apply a device preset's frame dimensions and scaling. The device setting
   * itself is parent-owned; the parent calls this after changing it (and the
   * surface calls it for orientation/resize refits).
   */
  export function applyDeviceSizing(deviceId: string): void {
    const preset = DEVICE_PRESETS.find(d => d.id === deviceId);

    if (preset && previewContainer) {
      const wrapper = previewContainer.parentElement;

      if (isFillDevice(preset.id)) {
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
            const scale = calculateOptimalScale(preset);
            const { width: deviceWidth, height: deviceHeight } = getDeviceDimensions(preset);

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
   * Estimate the position of an element within the source document
   */
  function estimateDocumentPosition(element: Element): number {
    // Walk the element's OWN document: the foliate section document when the
    // click landed inside the reader's nested section iframe, the preview
    // iframe otherwise (identical there). Walking the preview wrapper would
    // miss a foliate section element entirely and return 0.
    const iframeDoc = element.ownerDocument;
    if (!iframeDoc?.body) return 0;

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
    // Never mutate a body-less document — the same guard applyPreviewAppearance
    // carries. A `load` that arrives while a written document is still stalled
    // mid-parse would otherwise have us inject the style element below into a
    // half-built head. The watchdog reports the stall; interactivity is restored
    // by the next render's load.
    if (!iframeDoc.body) return;

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

      // Once per written document (see handledBodies). A body-less document is
      // a stalled parse: leave it unmarked so a later real `load` can still
      // run the setup (setupIframeInteractivity guards itself against it).
      if (iframeDoc.body) {
        if (handledBodies.has(iframeDoc.body)) return;
        handledBodies.add(iframeDoc.body);
      }

      // Set up interactivity first. Not on foliate-rendered views: the click
      // deixis and hover outlines belong to the chapter document, and here the
      // iframe holds the wrapper (the chapter lives in foliate's nested
      // section iframe — phase B of FOLIATE_UNIFIED_PREVIEW.md migrates them).
      if (!usesFoliate(device)) setupIframeInteractivity(iframeDoc);

      // Device re-key rebuilt the iframe (fresh Window): the parent re-loads +
      // re-instruments the screen reader preview when its panel is open.
      onContentEvent?.('frame-load');

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
    // Initialize with the current device. (The parent guards the persisted
    // device against http-only presets under file:// before rendering.)
    applyDeviceSizing(device);

    // Re-apply device sizing on resize. For the paged views, re-fit the pages
    // to the new width instead — no re-pagination (Paged.js pages stay A4
    // regardless): Print re-scales the single column, Proofs re-measures its
    // grid tracks and re-fits the thumbs.
    const onResize = () => {
      if (device === 'print') fitPrintToWidth();
      else if (device === 'proofs') applyProofsChrome();
      else applyDeviceSizing(device);
    };

    // A real debounce: one tracked timer, reset per event, so a stream of
    // resize events (window drag, observer bursts) coalesces into a single
    // re-fit instead of queueing one delayed call per event.
    let resizeDebounce: ReturnType<typeof setTimeout> | undefined;
    const scheduleResize = () => {
      clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(onResize, 400);
    };

    // Set up resize observer for responsive scaling
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleResize);

      // Observe the preview content element for size changes
      if (previewContentEl) {
        resizeObserver.observe(previewContentEl);
      }
    }

    // Fallback: window resize listener
    window.addEventListener('resize', scheduleResize);

    // Clicking the host surround (the letterbox around a scaled device frame, or
    // any preview chrome outside the iframe) refocuses the foliate view so arrow-
    // key paging resumes after a deixis click moved focus to the editor. In-iframe
    // text clicks don't bubble here (iframe boundary); the reader's own page
    // margins are handled inside the wrapper (read-preview.ts).
    const onSurroundClick = () => {
      if (usesFoliate(device)) liveFoliateView()?.focus?.({ preventScroll: true });
    };
    previewContentEl?.addEventListener('click', onSurroundClick);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      previewContentEl?.removeEventListener('click', onSurroundClick);
      // Timers this component scheduled must not outlive it — a late fire
      // would touch destroyed state (2026-07 timer audit, ARCHITECTURE_HEALTH
      // workstream 2).
      clearTimeout(resizeDebounce);
      clearTimeout(printSafetyTimer);
      clearTimeout(readSafetyTimer);
      clearTimeout(renderCheckTimer);
      if (readSectionUrl) URL.revokeObjectURL(readSectionUrl);
    };
  });

  // --- Exported read-outs for the parent's header + options bar ---------------
  // Plain functions over $state: calling them from the parent's template
  // creates fine-grained subscriptions, so the parent re-renders on change.

  /** The preview is out of date (auto-update off + content changed). */
  export function isStale(): boolean {
    return previewStale;
  }

  /** Reader pager/columns state for the parent's options bar. */
  export function pagerState(): {
    enabled: boolean;
    page: number;
    pages: number;
    columnsEnabled: boolean;
  } {
    return {
      enabled: readPagerEnabled,
      page: readPage,
      pages: readPages,
      columnsEnabled: readColumnsEnabled,
    };
  }

  /** FXL content overflow beyond the declared page ({w,h} or null) for the badge. */
  export function fxlOverflowSize(): { width: number; height: number } | null {
    return fxlOverflow;
  }
</script>

<div class="preview-surface">
  <!-- Preview content -->
  <div class="preview-content" bind:this={previewContentEl}>
    {#if showSource}
      <!-- Source view: the on-disk XHTML (no preview blob URLs), raw or as a
           collapsible tree. The raw/tree control lives in the preview options
           bar above (http-only, like the tree asset itself). -->
      <div class="source-view">
        {#if sourceTree && canSourceTree && persistedXhtml}
          <div class="source-scroll">
            {#if sourceTreeError}
              <pre class="source-code source-tree-error" dir="ltr">{sourceTreeError}</pre>
            {/if}
            <div class="xml-tree-view" bind:this={sourceTreeEl}></div>
          </div>
        {:else}
          <pre class="source-code" dir="ltr">{persistedXhtml ||
              (xhtmlContent
                ? '<!-- not written to disk -->'
                : '<!-- No content generated yet -->')}</pre>
        {/if}
      </div>
    {:else}
      <!-- Live preview -->
      <div class="preview-viewport">
        <!-- Content-size + success/timing, revealed on hover or keyboard focus (so
             the header stays uncluttered). aria-live keeps it perceivable to AT;
             transform errors/warnings remain in the header, always visible. -->
        {#if xhtmlContent}
          <div class="preview-stats" aria-live="polite">
            {#if deviceLabel}
              <span class="stat-device">{deviceLabel}</span>
            {/if}
            <span class="content-size">{Math.round(xhtmlContent.length / 1024)}KB</span>
            {#if !isTransforming && !transformError && transformWarnings.length === 0}
              <span class="stat-timing" title={$t('Transform successful')}>
                {formatExecutionTime(executionTime)}
              </span>
            {/if}
          </div>
        {/if}
        {#if printPaginating && engineOfDevice(device) === 'paged'}
          <div class="print-paginating" role="status">
            <div class="status-spinner"></div>
            <span>{$t('Paginating…')}</span>
          </div>
        {/if}
        {#if readRendering && device === 'read'}
          <div class="print-paginating" role="status">
            <div class="status-spinner"></div>
            <span>{$t('Paginating…')}</span>
          </div>
        {/if}
        {#if renderFailed || missingAssets.length > 0}
          <div class="preview-problem" role="alert">
            {#if renderFailed}
              <p class="problem-title">{$t('Preview failed to render')}</p>
            {/if}
            {#if missingAssets.length > 0}
              <p class="problem-title">{$t('Missing files')}</p>
              <ul class="problem-list">
                {#each missingAssets as path (path)}
                  <li>{path}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
        <div class="preview-frame-wrapper">
          <div
            class="preview-frame-container"
            class:device-frame={!isFillDevice(device)}
            class:fxl-letterbox={fxlActive}
            style:transform={!isFillDevice(device) ? `scale(${deviceScale})` : 'none'}
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
              {#key device}
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
  {#if device === 'print' && onGeneratePdf}
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
  .preview-surface {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-secondary);
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

  .stat-device {
    color: var(--color-text-primary);
  }

  /* Generated file size shown beside the view dropdown in the header. */
  .content-size {
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
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
    display: flex;
    flex-direction: column;
  }

  .source-scroll {
    flex: 1;
    overflow: auto;
  }

  .source-code {
    flex: 1;
    overflow: auto;
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

  .source-tree-error {
    flex: none;
    color: var(--color-status-error);
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

  /* Render findings: top of the viewport, above the frame. Not an overlay —
     a failed render has nothing behind it to obscure, and a missing file is
     read alongside the content that is missing it. */
  .preview-problem {
    position: absolute;
    inset: 0 0 auto 0;
    z-index: 3;
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-error-text);
    color: var(--color-error-text);
    font-size: var(--text-sm);
  }

  .problem-title {
    margin: 0;
    font-weight: 600;
  }

  .problem-list {
    margin: var(--space-1) 0 0 0;
    padding-left: var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
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
