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
  import { buildPagedDocument, chapterToSection, MARGIN_MM } from '$lib/pdf/pdf-export.js';
  import type { PrintSettings, PreviewSettings } from '$lib/services/settings/settings.service.js';
  import {
    DEFAULT_PREVIEW,
    previewTypeForDevice,
  } from '$lib/services/settings/settings.service.js';
  import {
    ArrowsClockwise,
    FilePdf,
    DeviceRotate,
    X,
    CircleHalf,
    Code,
    BookOpenText,
  } from 'phosphor-svelte';
  import { persisted, asBoolean, asInt, asEnum } from '../../state/persisted.svelte.js';

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

  // The header's panel toggles (Accessibility / EpubCheck / Reader) are mutually
  // exclusive — at most one panel open at a time in the band below the header.
  type PanelId = 'a11y' | 'epubcheck' | 'reader';
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
      // eslint-disable-next-line no-console
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
    activePanel = next;
    if (next === 'a11y') void runA11yCheck();
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
    'editme_preview_device',
    'desktop',
    asEnum(DEVICE_PRESETS.map(d => d.id))
  );
  let deviceOrientation = $state<'portrait' | 'landscape'>('portrait');
  let showSource = $state(false);
  let previewIframe: HTMLIFrameElement | undefined = $state();
  let previewContainer: HTMLDivElement | undefined = $state();
  let previewContentEl: HTMLDivElement | undefined = $state();
  let deviceScale = $state(1);
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

  // Reader-mode preview state (theme + font size + force-colours). View-only — never
  // written to the generated/exported XHTML; persisted app-wide like the device.
  const previewTheme = persisted<'light' | 'sepia' | 'dark'>(
    'editme_preview_theme',
    'light',
    asEnum(['light', 'sepia', 'dark'])
  );
  const fontStep = persisted(
    'editme_preview_font_step',
    2,
    asInt({ min: 0, max: FONT_STEPS.length - 1 })
  );
  const forceColors = persisted('editme_preview_force_colors', false, asBoolean);

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
    const size = printSettings?.page_size ?? 'A4';
    const sizeLabel = PAGE_SIZE_LABELS[size] ?? size;
    const mm = MARGIN_MM[printSettings?.margin ?? 'normal'] ?? MARGIN_MM.normal;
    return `${sizeLabel} ${mm}mm`;
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
  function toggleSourceView(): void {
    showSource = !showSource;

    if (!showSource) {
      setTimeout(() => {
        // Re-render for the active device (paginated when Print is selected) and
        // re-apply device dimensions/scaling after returning from the source view.
        renderNow();
        handleDeviceChange(selectedDevice.current);
      }, 0);
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

    // Add any global styles or scripts for preview enhancement
    const style = iframeDoc.createElement('style');
    style.textContent = `
      body {
        /* margin: 0; */
        /* padding: 0; */
        /* font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; */
        /* line-height: 1.6; */
      }

      /* Ensure images are responsive */
      img {
        max-width: 100%;
        height: auto;
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
   * Handle iframe load event
   */
  function handleIframeLoad(): void {
    if (previewIframe?.contentDocument) {
      const iframeDoc = previewIframe.contentDocument;

      // Set up interactivity first
      setupIframeInteractivity(iframeDoc);

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
    <!-- Source + device stay together (space-between) and grow to fill their row,
         so when the header wraps only the panel toggles below drop to a second row,
         leaving the device dropdown floated to the right edge of the first row. -->
    <div class="header-main">
      <div class="preview-title">
        <!-- Source/Preview toggle, left-aligned to mirror the editor pane's toggle.
             Icon-only: it shows the view you'll switch TO — an open book (rendered
             preview) while viewing source, </> (generated source) while previewing. -->
        <button
          class="view-toggle"
          class:active={showSource}
          onclick={toggleSourceView}
          title={showSource ? $t('Show rendered preview') : $t('Show generated source')}
          aria-label={showSource ? $t('Show rendered preview') : $t('Show generated source')}
        >
          {#if showSource}
            <BookOpenText size={18} aria-hidden="true" />
          {:else}
            <Code size={18} aria-hidden="true" />
          {/if}
        </button>

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

        <!-- Device selector -->
        <!-- i18n: Accessibility label for device size dropdown menu -->
        <select
          class="device-selector"
          bind:value={selectedDevice.current}
          onchange={e => handleDeviceChange((e.target as HTMLSelectElement).value)}
          aria-label={$t('Select device preset')}
        >
          {#each Object.entries(groupedDevices) as [category, devices]}
            <optgroup label={getCategoryLabel(category)}>
              {#each devices as device}
                <option value={device.id}>
                  {device.id === 'print' ? printDeviceLabel : getDeviceLabel(device)}
                </option>
              {/each}
            </optgroup>
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
             "Panels" entry as the none-open state. -->
        <select
          class="device-selector panel-selector"
          value={activePanel ?? ''}
          onchange={e =>
            setPanel(((e.currentTarget as HTMLSelectElement).value || null) as PanelId | null)}
          aria-label={$t('Show panel')}
        >
          <option value="">{$t('Panels')}</option>
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
          {$t(
            'Approximates a reading system (theming and text size). Preview only — it never changes the exported EPUB.'
          )}
        </p>
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
        <div class="preview-frame-wrapper">
          <div
            class="preview-frame-container"
            class:device-frame={!isFillDevice(selectedDevice.current)}
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
              {#key selectedDevice.current}
                <iframe
                  bind:this={previewIframe}
                  class="preview-iframe"
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
    /* Single row when it fits; when it doesn't, only the panel toggles
       (.preview-controls) wrap to a second row — .header-main keeps Source + the
       device dropdown together on the first row (see .header-main). */
    flex-wrap: wrap;
    gap: var(--space-2);
    /* Match the sidebar header height + grey (see PaneHeader) so all top bars align. */
    min-height: var(--touch-target-min);
    padding: var(--space-1) var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
    box-sizing: border-box;
  }

  /* Source (left) + device controls (right). Basis `auto` so line-breaking uses its
     real content width (not a reserved 360px, which wrapped the toggles far too
     early and left the first row mostly empty). It still grows to fill its row, so
     on a single row the device dropdown sits at the right of the cluster, and when
     the header is genuinely too narrow only the toggle group below wraps — the
     dropdown stays on the first row. */
  .header-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .preview-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  /* The rendered chapter filename, sitting left of the Source toggle. */
  .rendered-filename {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .preview-device {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* The mutually-exclusive panel toggles (Accessibility / EpubCheck / Reader). */
  .preview-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
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

  .view-toggle {
    /* Match the left pane's .generator-toggle-btn sizing. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }

  .view-toggle:hover {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
  }

  .view-toggle.active {
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent-primary);
  }

  /* Generated file size shown beside the Source/Preview toggle in the header. */
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

    .view-toggle {
      transition: none;
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
