<script lang="ts">
  import { onMount } from 'svelte';

  // Component props
  export let content: string;
  export let deviceSize: DeviceSize = 'responsive';
  export let orientation: 'portrait' | 'landscape' = 'portrait';
  export let fontSizeAdjustment: number = 0;
  export let fontFamily: FontFamily = 'default';
  export let onNavigate: ((chapterId: string) => void) | undefined = undefined;
  let className: string = '';
  export { className as class };

  // Types
  type DeviceSize =
    | 'responsive'
    | 'old-iphone'
    | 'recent-iphone'
    | 'large-iphone'
    | 'small-tablet'
    | 'medium-tablet'
    | 'large-tablet';
  type FontFamily = 'default' | 'serif' | 'sans-serif' | 'monospace';

  // Device specifications
  const DEVICE_SPECS = {
    'old-iphone': { width: 375, height: 667, fontSize: 16, margin: 12, lineHeight: 1.4 },
    'recent-iphone': { width: 390, height: 844, fontSize: 17, margin: 14, lineHeight: 1.4 },
    'large-iphone': { width: 430, height: 932, fontSize: 18, margin: 16, lineHeight: 1.4 },
    'small-tablet': { width: 744, height: 1133, fontSize: 20, margin: 20, lineHeight: 1.5 },
    'medium-tablet': { width: 820, height: 1180, fontSize: 22, margin: 24, lineHeight: 1.5 },
    'large-tablet': { width: 1024, height: 1366, fontSize: 24, margin: 28, lineHeight: 1.5 },
  };

  // Component elements
  let containerElement: HTMLDivElement;
  let wrapperElement: HTMLDivElement;
  let iframeElement: HTMLIFrameElement;

  // Font family CSS mappings
  const FONT_FAMILIES = {
    default: '',
    serif: 'Georgia, "Times New Roman", Times, serif !important',
    'sans-serif':
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important',
    monospace: '"Courier New", Courier, "Monaco", "Menlo", monospace !important',
  };

  function getDeviceDimensions(deviceType: DeviceSize, orientation: 'portrait' | 'landscape') {
    if (deviceType === 'responsive') {
      return null; // Responsive mode doesn't use fixed dimensions
    }

    const spec = DEVICE_SPECS[deviceType];
    if (orientation === 'landscape') {
      return { width: spec.height, height: spec.width };
    }
    return { width: spec.width, height: spec.height };
  }

  function getDeviceBaseCSS(deviceType: DeviceSize, fontSizeAdjustment: number): string {
    if (deviceType === 'responsive') {
      return '';
    }

    const spec = DEVICE_SPECS[deviceType];
    const adjustedFontSize = spec.fontSize + fontSizeAdjustment;

    return `body {
      font-size: ${adjustedFontSize}px;
      margin: ${spec.margin}px;
      line-height: ${spec.lineHeight};
    }`;
  }

  function getFontFamilyCSS(fontFamily: FontFamily): string {
    if (fontFamily === 'default') {
      return '';
    }

    return `body { font-family: ${FONT_FAMILIES[fontFamily]}; }`;
  }

  function injectDeviceStyles(
    iframe: HTMLIFrameElement | null,
    deviceType: DeviceSize,
    fontFamily: FontFamily,
    fontSizeAdjustment: number
  ) {
    if (!iframe) return;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    // Remove any existing injected styles
    if (iframeDoc.head) {
      const existingStyle = iframeDoc.head.querySelector('.device-injected-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    }

    // Build CSS
    let css = '';
    css += getDeviceBaseCSS(deviceType, fontSizeAdjustment);
    // css += getFontFamilyCSS(fontFamily);

    if (css) {
      const styleElement = iframeDoc.createElement('style');
      styleElement.className = 'device-injected-styles';
      styleElement.textContent = css;

      // Insert as first style element to allow XHTML CSS to override
      if (iframeDoc.head) {
        const firstStyleOrLink = iframeDoc.head.querySelector('style, link[rel="stylesheet"]');
        if (firstStyleOrLink) {
          iframeDoc.head.insertBefore(styleElement, firstStyleOrLink);
        } else {
          iframeDoc.head.appendChild(styleElement);
        }
      }
    }
  }

  function calculateScaleFactor(
    containerRect: { width: number; height: number },
    deviceDimensions: { width: number; height: number }
  ): number {
    const scaleX = containerRect.width / deviceDimensions.width;
    const scaleY = containerRect.height / deviceDimensions.height;
    return Math.min(scaleX, scaleY);
  }

  function updateLayout() {
    if (!containerElement || !wrapperElement || !iframeElement) return;

    const dimensions = getDeviceDimensions(deviceSize, orientation);

    if (!dimensions) {
      // Responsive mode
      wrapperElement.style.transform = '';
      wrapperElement.style.width = '100%';
      wrapperElement.style.height = '100%';
      iframeElement.style.width = '100%';
      iframeElement.style.height = '100%';
      return;
    }

    // Device mode with scaling
    const containerRect = containerElement.getBoundingClientRect();
    const scaleFactor = calculateScaleFactor(containerRect, dimensions);

    // Set iframe to device dimensions
    iframeElement.style.width = `${dimensions.width}px`;
    iframeElement.style.height = `${dimensions.height}px`;

    // Apply scaling transform
    wrapperElement.style.transform = `scale(${scaleFactor})`;
    wrapperElement.style.transformOrigin = 'center';
    wrapperElement.style.width = `${dimensions.width}px`;
    wrapperElement.style.height = `${dimensions.height}px`;
  }

  function handleIframeLoad() {
    if (iframeElement) {
      injectDeviceStyles(iframeElement, deviceSize, fontFamily, fontSizeAdjustment);

      // Add click handler for navigation
      if (onNavigate && iframeElement.contentDocument) {
        iframeElement.contentDocument.addEventListener('click', e => {
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
    }
  }

  // Reactive updates
  $: if (iframeElement && content) {
    // Update iframe content
    iframeElement.srcdoc = content;
  }

  $: if (containerElement && wrapperElement && iframeElement) {
    updateLayout();
  }

  $: if (iframeElement) {
    // Re-inject styles when font settings change
    injectDeviceStyles(iframeElement, deviceSize, fontFamily, fontSizeAdjustment);
  }

  onMount(() => {
    updateLayout();

    // Handle container resize
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateLayout();
      });
    }

    if (containerElement && resizeObserver) {
      resizeObserver.observe(containerElement);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  });
</script>

<div class="content-preview {className}" bind:this={containerElement}>
  <div class="content-preview__container" bind:this={wrapperElement}>
    <div class="content-preview__letterbox">
      <iframe
        class="content-preview__iframe"
        bind:this={iframeElement}
        srcdoc={content}
        on:load={handleIframeLoad}
        title="Content Preview"
      ></iframe>
    </div>
  </div>
</div>

<style>
  .content-preview {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    background: #000; /* Black background for letterboxing */
    overflow: hidden;
  }

  .content-preview__container {
    transform-origin: center;
    width: 100%;
    height: 100%;
  }

  .content-preview__letterbox {
    background: #000;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }

  .content-preview__iframe {
    border: none;
    background: white;
    /* Provide minimum dimensions for responsive mode */
    min-width: 320px;
    min-height: 400px;
  }
</style>
