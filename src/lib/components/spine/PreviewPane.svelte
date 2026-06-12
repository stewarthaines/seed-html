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
  import type { PrintSettings } from '$lib/services/settings/settings.service.js';
  import { ArrowsClockwise } from 'phosphor-svelte';

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
  } = $props();

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
  let printStale = $state(false);
  // Non-reactive: the content string last paginated, used to detect edits while
  // Print is active (undefined = not yet paginated this Print session).
  let printRenderedContent: string | undefined = undefined;
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
  let a11yPanelOpen = $state(false);
  let a11yAutoTimer: ReturnType<typeof setTimeout> | undefined;

  // --- Validation report -------------------------------------------------------
  // The latest epubcheck report is dropped into localStorage by the publish plugin.
  // We own the report + open state here (mirroring the a11y panel), so the panel
  // opens from a toolbar button and its open/closed state survives chapter hops.
  let validationReport = $state(readValidationReport());
  let validationPanelOpen = $state(false);
  const validationChapterCount = $derived(
    validationReport ? messagesForChapter(validationReport, chapterId).length : 0
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

  // The button toggles the panel; opening runs a check, closing clears the outlines.
  function toggleA11yPanel(): void {
    if (a11yPanelOpen) {
      a11yPanelOpen = false;
      const doc = previewIframe?.contentDocument;
      if (doc) clearHighlights(doc);
    } else {
      a11yPanelOpen = true;
      void runA11yCheck();
    }
  }

  // The preview re-render invalidates the last report; while the panel is open,
  // re-run the check (debounced) so the author sees fresh results as they edit.
  function scheduleAutoA11yCheck(): void {
    if (!a11yPanelOpen) return;
    clearTimeout(a11yAutoTimer);
    a11yAutoTimer = setTimeout(() => void runA11yCheck(), 500);
  }

  // Preview configuration
  const DEVICE_PRESETS = [
    {
      id: 'desktop',
      name: 'Fill',
      width: '100%',
      height: '100%',
      icon: '🖥️',
      category: 'responsive',
    },
    {
      id: 'galaxy-s23',
      name: 'Pocket',
      width: '360px',
      height: '800px',
      icon: '📱',
      category: 'commute',
    },
    {
      id: 'iphone',
      name: 'Standard',
      width: '375px',
      height: '667px',
      icon: '📱',
      category: 'commute',
    },
    {
      id: 'pixel-7',
      name: 'Large',
      width: '393px',
      height: '851px',
      icon: '📱',
      category: 'commute',
    },
    {
      id: 'iphone-plus',
      name: 'Plus',
      width: '414px',
      height: '736px',
      icon: '📱',
      category: 'commute',
    },
    { id: 'ipad', name: 'Compact', width: '768px', height: '1024px', icon: '📱', category: 'home' },
    {
      id: 'galaxy-tab-s9',
      name: 'Large',
      width: '800px',
      height: '1280px',
      icon: '📱',
      category: 'home',
    },
    {
      id: 'ipad-air',
      name: 'Extra Large',
      width: '820px',
      height: '1180px',
      icon: '📱',
      category: 'home',
    },
    {
      id: 'kindle',
      name: 'Standard',
      width: '600px',
      height: '800px',
      icon: '📚',
      category: 'travel',
    },
    {
      id: 'kobo-clara-2e',
      name: 'Large',
      width: '758px',
      height: '1024px',
      icon: '📚',
      category: 'travel',
    },
    {
      // Paginated print preview (Paged.js). Dimensions are placeholders — print
      // fills the pane and Paged.js sizes its own A4 pages (see isFillDevice).
      id: 'print',
      name: 'Print',
      width: '794px',
      height: '1123px',
      icon: '🖨️',
      category: 'print',
    },
  ] as const;

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
        // i18n: Device category for the paginated print-page preview
        return $t('Print');
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
  let selectedDevice = $state('desktop');
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

  // Update iframe content when the XHTML or the selected device changes. Reading
  // both makes the effect re-run when the user switches to/from Print as well.
  $effect(() => {
    const device = selectedDevice;
    const content = xhtmlContent;
    if (device !== 'print') {
      // Leaving (or never on) print: reset its session state and render plainly.
      printRenderedContent = undefined;
      printStale = false;
      printPaginating = false;
      clearTimeout(printSafetyTimer);
      updatePreviewContent(content);
      return;
    }
    if (printRenderedContent === undefined) {
      // First switch to Print: paginate now.
      writePagedDoc(content);
    } else if (content !== printRenderedContent) {
      // Edited while Print is active: mark stale (re-paginating per keystroke is
      // too heavy); the author refreshes on demand.
      printStale = true;
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

      lastUpdateTime.set(Date.now());

      // The rewrite invalidated any prior axe results; re-check if the panel is open.
      scheduleAutoA11yCheck();
    } catch (error) {
      console.error('Failed to update preview content:', error);
    }
  }

  // --- Print pagination --------------------------------------------------------

  /** Render the current chapter for whichever device is selected. */
  function renderCurrent(): void {
    if (selectedDevice === 'print') writePagedDoc(xhtmlContent);
    else updatePreviewContent(xhtmlContent);
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
    const wrapped = chapterToSection(content);
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
    });

    const iframeDoc = previewIframe.contentDocument;
    if (!iframeDoc) return;

    printPaginating = true;
    printStale = false;
    printRenderedContent = content;
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
    handleDeviceChange(selectedDevice);
  }

  /**
   * Handle device preset selection
   */
  function handleDeviceChange(deviceId: string): void {
    selectedDevice = deviceId;
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
        renderCurrent();
        handleDeviceChange(selectedDevice);
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
    if (selectedDevice === 'print' && !canPaginate) selectedDevice = 'desktop';

    // Initialize with default device
    handleDeviceChange(selectedDevice);

    // Re-apply device sizing on resize. For Print, re-fit the pages to the new
    // width instead — no re-pagination (Paged.js pages stay A4 regardless).
    const onResize = () => {
      if (selectedDevice === 'print') fitPrintToWidth();
      else handleDeviceChange(selectedDevice);
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
    <div class="preview-title">
      <!-- Source/Preview toggle -->
      <button
        class="view-toggle"
        class:active={showSource}
        onclick={toggleSourceView}
        title={showSource ? 'Show rendered preview' : 'Show generated source'}
      >
        {showSource ? $t('Preview') : $t('Source')}
      </button>
      {#if xhtmlContent}
        <span class="content-size">{Math.round(xhtmlContent.length / 1024)}KB</span>
      {/if}

      <!-- Transform status (moved here from the editor pane header). -->
      {#if isTransforming}
        <div class="status-indicator transforming" title="Transform in progress">
          <div class="status-spinner"></div>
          <span>Transforming...</span>
        </div>
      {:else if transformError}
        <div class="status-indicator error" title="Transform error">
          <span class="status-icon">⚠️</span>
          <span>Error</span>
        </div>
      {:else if transformWarnings.length > 0}
        <div class="status-indicator warning" title={`${transformWarnings.length} warnings`}>
          <span class="status-icon">⚠️</span>
          <span>{transformWarnings.length} warnings</span>
        </div>
      {:else if xhtmlContent}
        <div class="status-indicator success" title="Transform successful">
          <span>{formatExecutionTime(executionTime)}</span>
        </div>
      {/if}

      <!-- Print preview: refresh when the chapter changed since it was paginated.
           Placed after the transform status (rather than among the device controls)
           so the control order stays stable as it appears/disappears. -->
      {#if selectedDevice === 'print' && printStale}
        <button
          type="button"
          class="print-refresh"
          onclick={() => writePagedDoc(xhtmlContent)}
          title={$t('Preview out of date')}
          aria-label={$t('Refresh')}
        >
          <ArrowsClockwise size={16} aria-hidden="true" />
        </button>
      {/if}
    </div>

    <div class="preview-controls">
      <!-- Accessibility check (spike): inject axe-core into the preview + run it -->
      {#if canCheckA11y}
        <button
          type="button"
          class="a11y-check"
          class:active={a11yPanelOpen}
          onclick={toggleA11yPanel}
          disabled={!xhtmlContent}
          aria-pressed={a11yPanelOpen}
          title="Accessibility check (axe-core) — re-runs as you edit while open"
        >
          {a11yRunning ? 'Checking…' : 'Accessibility'}
          {#if !a11yRunning && a11yPanelOpen && a11yIssueCount !== null}
            <span class="a11y-count" class:clean={a11yIssueCount === 0}>{a11yIssueCount}</span>
          {/if}
        </button>
      {/if}

      <!-- Validation report (epubcheck), opened like the accessibility panel. -->
      {#if validationReport}
        <button
          type="button"
          class="a11y-check"
          class:active={validationPanelOpen}
          onclick={() => (validationPanelOpen = !validationPanelOpen)}
          aria-pressed={validationPanelOpen}
          title="Validation report (epubcheck) for this chapter"
        >
          EpubCheck
          {#if validationChapterCount > 0}
            <span class="a11y-count">{validationChapterCount}</span>
          {/if}
        </button>
      {/if}

      <!-- Orientation toggle (only show for scaled device frames, not fill/print) -->
      {#if !isFillDevice(selectedDevice)}
        <button
          type="button"
          class="orientation-toggle"
          onclick={toggleOrientation}
          title="Toggle orientation"
          aria-label="Toggle device orientation"
        >
          {deviceOrientation === 'portrait' ? '▭' : '▯'}
        </button>
      {/if}

      <!-- Device selector -->
      <!-- i18n: Accessibility label for device size dropdown menu -->
      <select
        class="device-selector"
        bind:value={selectedDevice}
        onchange={e => handleDeviceChange((e.target as HTMLSelectElement).value)}
        aria-label={$t('Select device preset')}
      >
        {#each Object.entries(groupedDevices) as [category, devices]}
          <optgroup label={getCategoryLabel(category)}>
            {#each devices as device}
              <option value={device.id}>
                {device.icon}
                {device.id === 'print' ? printDeviceLabel : getDeviceLabel(device)}
              </option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>
  </div>

  <!-- Accessibility results panel (spike): plain-text violations, sorted by impact -->
  {#if a11yPanelOpen}
    <div class="a11y-panel" role="region" aria-label="Accessibility issues">
      <div class="a11y-panel-header">
        <strong>
          {a11yViolations.length === 0
            ? 'No accessibility issues found'
            : `${a11yViolations.length} accessibility issue${a11yViolations.length === 1 ? '' : 's'}`}
        </strong>
        <button
          type="button"
          class="a11y-panel-close"
          onclick={() => (a11yPanelOpen = false)}
          aria-label="Close accessibility panel"
          title="Close"
        >
          ✕
        </button>
      </div>
      {#if a11yViolations.length > 0}
        <ul class="a11y-list">
          {#each a11yViolations as v (v.id)}
            <li class="a11y-item">
              <span class="a11y-impact" data-impact={v.impact ?? 'minor'}>
                {v.impact ?? 'n/a'}
              </span>
              <div class="a11y-detail">
                <span class="a11y-help" title={v.description}>{v.help}</span>
                <span class="a11y-meta">
                  {v.nodes.length} element{v.nodes.length === 1 ? '' : 's'} ·
                  <a href={v.helpUrl} target="_blank" rel="noopener noreferrer">learn more</a>
                </span>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <!-- Validation report reference (shares this band with the a11y panel) -->
  {#if validationPanelOpen && validationReport}
    <ChapterValidationPanel
      report={validationReport}
      {chapterId}
      onClose={() => (validationPanelOpen = false)}
    />
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
        {#if printPaginating && selectedDevice === 'print'}
          <div class="print-paginating" role="status">
            <div class="status-spinner"></div>
            <span>{$t('Paginating…')}</span>
          </div>
        {/if}
        <div class="preview-frame-wrapper">
          <div
            class="preview-frame-container"
            class:device-frame={!isFillDevice(selectedDevice)}
            style:transform={!isFillDevice(selectedDevice) ? `scale(${deviceScale})` : 'none'}
            style:transform-origin="top left"
            bind:this={previewContainer}
          >
            {#if transformError}
              <div class="preview-error">
                <div class="error-content">
                  <h3>Transform Error</h3>
                  <p><strong>Stage:</strong> {transformError.stage}</p>
                  <p><strong>Message:</strong> {transformError.message}</p>
                  {#if transformError.stack}
                    <details>
                      <summary>Stack Trace</summary>
                      <pre class="error-stack">{transformError.stack}</pre>
                    </details>
                  {/if}
                </div>
              </div>
            {:else if xhtmlContent}
              <iframe
                bind:this={previewIframe}
                class="preview-iframe"
                title="XHTML Preview"
                onload={handleIframeLoad}
              ></iframe>
            {:else}
              <div class="preview-empty">
                <div class="empty-content">
                  <span class="empty-icon" aria-hidden="true">📝</span>
                  <h3>No Content</h3>
                  <p>Start typing in the editor to see your XHTML preview here.</p>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
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
    justify-content: space-between;
    align-items: center;
    /* Wrap the title/controls groups onto new rows when the pane is narrow,
       matching the editor pane header (.editor-controls). */
    flex-wrap: wrap;
    gap: var(--space-2);
    min-height: 2.75rem;
    padding: 0 var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-button-secondary-bg);
    box-sizing: border-box;
  }

  .preview-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .preview-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  /* Accessibility check button (spike) */
  .a11y-check {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .a11y-check:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .a11y-check.active {
    border-color: var(--color-primary, #0074d9);
    background: var(--color-bg-tertiary, var(--color-bg-secondary));
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

  .a11y-panel-close {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    padding: 0 var(--space-1);
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
    margin-right: var(--space-2);
    min-width: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .orientation-toggle:hover {
    background: var(--color-bg-hover);
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
    background: var(--color-bg-hover);
  }

  .print-refresh:focus {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .device-selector {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .device-selector:focus {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .view-toggle {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .view-toggle:hover {
    background: var(--color-bg-hover);
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

  .status-indicator.success {
    background: var(--color-success-bg);
    color: var(--color-success-text);
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
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .preview-frame-container {
      border: 2px solid var(--color-forced-border);
    }
  }
</style>
