# 15. Device Preview

## Overview

Multi-device preview system with responsive mode and specific device viewport emulation, including orientation toggles and dropdown selection.

## Requirements

- Responsive mode (fills pane, minimum 200px width)
- Multi-device mode with dropdown selection
- Device definitions: iPhone 8, iPhone 14, iPad Mini, iPad, iPad Pro, Pixel Phone
- Portrait/landscape orientation toggle

## Dependencies

- **#12 Transform Pipeline** - for content to preview
- **#13 Text Editor** - for real-time updates

## Technical Approach

- CSS viewport simulation for device dimensions
- JavaScript-controlled iframe sizing
- Device-specific user agent strings
- Orientation state management with smooth transitions

## API Design

```typescript
interface DevicePreview {
  // Device management
  setDevice(deviceId: string): void;
  getCurrentDevice(): DeviceDefinition | null;
  getAvailableDevices(): DeviceDefinition[];

  // Orientation
  setOrientation(orientation: 'portrait' | 'landscape'): void;
  toggleOrientation(): void;
  getCurrentOrientation(): 'portrait' | 'landscape';

  // Preview modes
  setPreviewMode(mode: 'responsive' | 'device'): void;
  getPreviewMode(): 'responsive' | 'device';

  // Content
  updatePreview(xhtmlContent: string): void;
  refreshPreview(): void;

  // Utilities
  getDeviceDimensions(): { width: number; height: number };
  getScaleFactor(): number;
}

interface DeviceDefinition {
  id: string;
  name: string;
  type: 'phone' | 'tablet' | 'desktop';
  dimensions: {
    width: number;
    height: number;
  };
  pixelRatio: number;
  userAgent: string;
  features: string[];
}
```

## Device Definitions

```typescript
const DEVICE_DEFINITIONS: DeviceDefinition[] = [
  {
    id: 'iphone8',
    name: 'iPhone 8',
    type: 'phone',
    dimensions: { width: 375, height: 667 },
    pixelRatio: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    features: ['touch', 'mobile'],
  },
  {
    id: 'iphone14',
    name: 'iPhone 14',
    type: 'phone',
    dimensions: { width: 390, height: 844 },
    pixelRatio: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    features: ['touch', 'mobile', 'notch'],
  },
  {
    id: 'ipadmini',
    name: 'iPad Mini',
    type: 'tablet',
    dimensions: { width: 768, height: 1024 },
    pixelRatio: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    features: ['touch', 'tablet'],
  },
  {
    id: 'ipad',
    name: 'iPad',
    type: 'tablet',
    dimensions: { width: 820, height: 1180 },
    pixelRatio: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    features: ['touch', 'tablet'],
  },
  {
    id: 'ipadpro',
    name: 'iPad Pro',
    type: 'tablet',
    dimensions: { width: 1024, height: 1366 },
    pixelRatio: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    features: ['touch', 'tablet', 'large-screen'],
  },
  {
    id: 'pixelphone',
    name: 'Pixel Phone',
    type: 'phone',
    dimensions: { width: 412, height: 915 },
    pixelRatio: 2.625,
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36',
    features: ['touch', 'mobile', 'android'],
  },
];
```

## Preview Component Structure

```svelte
<script>
  import { onMount } from 'svelte';

  export let content = '';
  export let workspaceId = '';

  let previewMode = 'responsive';
  let selectedDevice = null;
  let orientation = 'portrait';
  let previewFrame;
  let containerElement;

  $: currentDimensions = calculateDimensions();
  $: scaleFactor = calculateScaleFactor();
</script>

<div class="device-preview" bind:this={containerElement}>
  <div class="preview-controls">
    <div class="mode-selector">
      <button
        class="mode-button"
        class:active={previewMode === 'responsive'}
        on:click={() => setPreviewMode('responsive')}
      >
        Responsive
      </button>
      <button
        class="mode-button"
        class:active={previewMode === 'device'}
        on:click={() => setPreviewMode('device')}
      >
        Device
      </button>
    </div>

    {#if previewMode === 'device'}
      <div class="device-controls">
        <select bind:value={selectedDevice} on:change={updateDevice}>
          <option value={null}>Select device...</option>
          {#each DEVICE_DEFINITIONS as device}
            <option value={device.id}>{device.name}</option>
          {/each}
        </select>

        {#if selectedDevice}
          <button
            class="orientation-toggle"
            on:click={toggleOrientation}
            title="Toggle orientation"
          >
            <Icon name={orientation === 'portrait' ? 'phone-portrait' : 'phone-landscape'} />
          </button>

          <span class="dimensions-display">
            {currentDimensions.width} × {currentDimensions.height}
          </span>
        {/if}
      </div>
    {/if}

    <div class="preview-actions">
      <button on:click={refreshPreview} title="Refresh preview">
        <Icon name="refresh" />
      </button>
      <button on:click={openInNewWindow} title="Open in new window">
        <Icon name="external-link" />
      </button>
    </div>
  </div>

  <div class="preview-container" class:responsive={previewMode === 'responsive'}>
    {#if previewMode === 'responsive'}
      <iframe
        bind:this={previewFrame}
        class="preview-frame responsive-frame"
        title="Responsive Preview"
        on:load={handleFrameLoad}
      ></iframe>
    {:else if selectedDevice}
      <div
        class="device-frame"
        style="
          width: {currentDimensions.width}px;
          height: {currentDimensions.height}px;
          transform: scale({scaleFactor});
        "
      >
        <iframe
          bind:this={previewFrame}
          class="preview-frame device-frame-content"
          title="{getSelectedDeviceName()} Preview"
          on:load={handleFrameLoad}
        ></iframe>
      </div>
    {:else}
      <div class="no-device-selected">
        <p>Select a device to preview your content</p>
      </div>
    {/if}
  </div>
</div>
```

## Dimension Calculations

```typescript
const calculateDimensions = (): { width: number; height: number } => {
  if (previewMode === 'responsive') {
    const container = containerElement?.querySelector('.preview-container');
    return {
      width: container?.clientWidth || 400,
      height: container?.clientHeight || 600,
    };
  }

  if (!selectedDevice) return { width: 400, height: 600 };

  const device = DEVICE_DEFINITIONS.find(d => d.id === selectedDevice);
  if (!device) return { width: 400, height: 600 };

  if (orientation === 'landscape') {
    return {
      width: Math.max(device.dimensions.width, device.dimensions.height),
      height: Math.min(device.dimensions.width, device.dimensions.height),
    };
  }

  return {
    width: Math.min(device.dimensions.width, device.dimensions.height),
    height: Math.max(device.dimensions.width, device.dimensions.height),
  };
};

const calculateScaleFactor = (): number => {
  if (previewMode === 'responsive') return 1;

  const container = containerElement?.querySelector('.preview-container');
  if (!container || !selectedDevice) return 1;

  const containerWidth = container.clientWidth - 40; // padding
  const containerHeight = container.clientHeight - 40;

  const deviceWidth = currentDimensions.width;
  const deviceHeight = currentDimensions.height;

  const scaleX = containerWidth / deviceWidth;
  const scaleY = containerHeight / deviceHeight;

  return Math.min(scaleX, scaleY, 1); // Never scale up
};
```

## Preview Content Injection

```typescript
const updatePreviewContent = async (xhtmlContent: string) => {
  if (!previewFrame) return;

  try {
    // Substitute resource URLs for blob URLs
    const processedContent = await blobURLManager.substituteResourceURLs(xhtmlContent, workspaceId);

    // Apply device-specific modifications
    const deviceOptimizedContent = applyDeviceOptimizations(processedContent, selectedDevice);

    // Update iframe content
    const iframeDoc = previewFrame.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(deviceOptimizedContent);
      iframeDoc.close();

      // Apply device-specific user agent (if possible)
      if (selectedDevice) {
        const device = DEVICE_DEFINITIONS.find(d => d.id === selectedDevice);
        if (device && iframeDoc.defaultView) {
          // Note: User agent spoofing is limited in modern browsers
          Object.defineProperty(iframeDoc.defaultView.navigator, 'userAgent', {
            value: device.userAgent,
            configurable: true,
          });
        }
      }
    }
  } catch (error) {
    console.error('Failed to update preview content:', error);
    showErrorInPreview(error);
  }
};
```

## Device-Specific Optimizations

```typescript
const applyDeviceOptimizations = (content: string, deviceId: string | null): string => {
  if (!deviceId) return content;

  const device = DEVICE_DEFINITIONS.find(d => d.id === deviceId);
  if (!device) return content;

  let optimizedContent = content;

  // Add device-specific meta tags
  const metaTags = generateDeviceMetaTags(device);
  optimizedContent = optimizedContent.replace('</head>', `${metaTags}\n</head>`);

  // Add device-specific CSS
  const deviceCSS = generateDeviceCSS(device);
  optimizedContent = optimizedContent.replace('</head>', `<style>${deviceCSS}</style>\n</head>`);

  return optimizedContent;
};

const generateDeviceMetaTags = (device: DeviceDefinition): string => {
  const tags = [
    `<meta name="viewport" content="width=${device.dimensions.width}, initial-scale=1.0, user-scalable=no">`,
    `<meta name="device-type" content="${device.type}">`,
    `<meta name="pixel-ratio" content="${device.pixelRatio}">`,
  ];

  if (device.features.includes('touch')) {
    tags.push('<meta name="touch-capable" content="true">');
  }

  if (device.features.includes('mobile')) {
    tags.push('<meta name="mobile-web-app-capable" content="yes">');
  }

  return tags.join('\n  ');
};

const generateDeviceCSS = (device: DeviceDefinition): string => {
  const css = [];

  // Base responsive styles
  css.push(`
    body {
      -webkit-text-size-adjust: 100%;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  `);

  // Device-specific styles
  if (device.type === 'phone') {
    css.push(`
      @media (max-width: 480px) {
        body { font-size: 16px; }
        h1 { font-size: 1.5em; }
        h2 { font-size: 1.3em; }
      }
    `);
  }

  if (device.features.includes('touch')) {
    css.push(`
      a, button {
        min-height: 44px;
        min-width: 44px;
      }
    `);
  }

  return css.join('\n');
};
```

## Orientation Transitions

```css
.device-frame {
  transition: all 0.3s ease-in-out;
  transform-origin: center center;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: #000;
  padding: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.device-frame-content {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 8px;
  background: white;
}

.responsive-frame {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  min-width: 200px;
}

@media (prefers-reduced-motion: reduce) {
  .device-frame {
    transition: none;
  }
}
```

## Error Handling

- Invalid device selection
- Content loading failures
- Iframe security restrictions
- Scaling calculation errors
- Resource substitution failures

## Testing Considerations

- Test all device definitions
- Test orientation changes
- Test responsive mode scaling
- Test content rendering accuracy
- Test performance with large content
- Test accessibility across devices

## Implementation Notes

- Start with responsive mode
- Add device emulation incrementally
- Test scaling calculations thoroughly
- Consider using existing device emulation libraries
- Ensure accessibility across all preview modes
