# ContentPreview Component API

## Overview

The ContentPreview component provides iframe-based rendering of complete XHTML documents within the EDITME editor. It serves as a reusable preview component for displaying EPUB navigation documents and spine item content with full fidelity to the original styling and scripting.

## Component Interface

### ContentPreview.svelte

```typescript
interface ContentPreviewProps {
  /** Complete XHTML document string to render in iframe */
  content: string;
  /** Optional CSS class for styling the component wrapper */
  class?: string;
  /** Device size for preview scaling - defaults to 'responsive' */
  deviceSize?: DeviceSize;
  /** Device orientation (portrait/landscape) - not applicable for responsive */
  orientation?: 'portrait' | 'landscape';
  /** Base font size adjustment in pixels from device default */
  fontSizeAdjustment?: number;
  /** Font family override for EPUB reading system compatibility */
  fontFamily?: FontFamily;
}

type DeviceSize = 'responsive' | 'old-iphone' | 'recent-iphone' | 'large-iphone' | 'small-tablet' | 'medium-tablet' | 'large-tablet';

type FontFamily = 'default' | 'serif' | 'sans-serif' | 'monospace';
```

## Props Documentation

#### content

```typescript
content: string;
```

**Input:** Complete XHTML document string including DOCTYPE, html, head, and body elements

**Usage Contexts:**

- **Outline View**: Complete `nav.xhtml` document (EPUB table of contents)
- **Spine Item Preview**: Complete XHTML document for any spine item content

**Content Handling:**

- Renders content exactly as provided with no modifications
- Preserves all original CSS styling and layout
- Allows JavaScript execution from script tags in the XHTML
- Supports natural scrolling when content exceeds iframe dimensions

**Example XHTML Structure:**

```xhtml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>Table of Contents</title>
    <link rel="stylesheet" href="nav.css" />
  </head>
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="chapter1.xhtml">Chapter 1</a></li>
        <li><a href="chapter2.xhtml">Chapter 2</a></li>
      </ol>
    </nav>
  </body>
</html>
```

#### class (optional)

```typescript
class?: string
```

**Input:** CSS class name for styling the component wrapper

**Usage:** Apply custom styling to the component container without affecting iframe content

#### deviceSize (optional)

```typescript
deviceSize?: DeviceSize
```

**Input:** Device type for preview scaling and base styling - defaults to 'responsive'

**Device Types:**

| Device Type | Dimensions (px) | Base Font | Base Margin | Description |
|-------------|-----------------|-----------|-------------|-------------|
| `responsive` | Container size | 16px | 16px | Full-width responsive (default) |
| `old-iphone` | 375 × 667 | 16px | 12px | iPhone SE form factor |
| `recent-iphone` | 390 × 844 | 17px | 14px | iPhone 13 form factor |
| `large-iphone` | 430 × 932 | 18px | 16px | iPhone 15 Pro Max form factor |
| `small-tablet` | 744 × 1133 | 20px | 20px | iPad mini form factor |
| `medium-tablet` | 820 × 1180 | 22px | 24px | iPad Air form factor |
| `large-tablet` | 1024 × 1366 | 24px | 28px | iPad Pro 13" form factor |

**Scaling Behavior:**
- Device previews calculate scale factor using: `Math.min(container.width/device.width, container.height/device.height)`
- Maintains device aspect ratio with letterbox styling (black background fills unused space)
- Scales freely to fit any container size (no minimum/maximum scale limits)
- CSS `transform: scale()` applied to iframe container
- Responsive mode bypasses scaling (100% width/height, fills container)

#### orientation (optional)

```typescript
orientation?: 'portrait' | 'landscape'
```

**Input:** Device orientation for preview display

**Usage:** 
- Available for all device types except 'responsive'
- Toggles between portrait and landscape orientations
- Affects both dimensions and any orientation-specific styling
- Defaults to 'portrait' for device types

#### fontSizeAdjustment (optional)

```typescript
fontSizeAdjustment?: number
```

**Input:** Font size adjustment in pixels from device-specific base font size

**Usage:**
- Adjusts the base body font size for the device type
- Positive values increase font size, negative values decrease
- Recommended range: -4 to +8 pixels
- Applied as CSS override to device-specific base styles

#### fontFamily (optional)

```typescript
fontFamily?: FontFamily
```

**Input:** Font family override for EPUB reading system compatibility

**Font Options:**
- `'default'` - No font family specified, uses original document fonts (default)
- `'serif'` - Standard serif font stack for EPUB readers
- `'sans-serif'` - Standard sans-serif font stack for EPUB readers  
- `'monospace'` - Standard monospace font stack for EPUB readers

**Usage:**
- Overrides document font-family with EPUB-compatible font stacks
- Applied to body element via CSS injection
- Simulates font choices available in typical EPUB reading systems
- Helps test content appearance across different reader font settings

## Component Behavior

### Device Preview System

**Device-Specific Styling:**
- Each device type has predefined base styles (font size, margins, line height)
- Styles are injected into the iframe as CSS overrides
- Device styles complement but don't replace original XHTML styling

**Complete Device Base Styles:**
```css
/* Device-specific base styles injected into iframe */

/* old-iphone (375×667) */
body { font-size: 16px; margin: 12px; line-height: 1.4; }

/* recent-iphone (390×844) */
body { font-size: 17px; margin: 14px; line-height: 1.4; }

/* large-iphone (430×932) */
body { font-size: 18px; margin: 16px; line-height: 1.4; }

/* small-tablet (744×1133) */
body { font-size: 20px; margin: 20px; line-height: 1.5; }

/* medium-tablet (820×1180) */
body { font-size: 22px; margin: 24px; line-height: 1.5; }

/* large-tablet (1024×1366) */
body { font-size: 24px; margin: 28px; line-height: 1.5; }

/* responsive mode - no device-specific styles injected */
```

**Font Family Injection:**
```css
/* Complete CSS injected for each font family option */

/* When fontFamily="serif" */
body { font-family: Georgia, 'Times New Roman', Times, serif !important; }

/* When fontFamily="sans-serif" */
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important; }

/* When fontFamily="monospace" */
body { font-family: 'Courier New', Courier, 'Monaco', 'Menlo', monospace !important; }

/* When fontFamily="default" - no font-family injection */
```

**CSS Injection Implementation:**
```typescript
// CSS injection method for iframe styling
function injectDeviceStyles(iframe: HTMLIFrameElement, deviceType: DeviceSize, fontFamily: FontFamily, fontSizeAdjustment: number) {
  const iframeDoc = iframe.contentDocument;
  const styleElement = iframeDoc.createElement('style');
  
  // Build CSS in correct order
  let css = '';
  
  // 1. Device base styles (font-size, margin, line-height)
  css += getDeviceBaseCSS(deviceType, fontSizeAdjustment);
  
  // 2. Font family override (if not default)
  if (fontFamily !== 'default') {
    css += getFontFamilyCSS(fontFamily);
  }
  
  styleElement.textContent = css;
  
  // Insert as first style element to allow XHTML CSS to override
  const firstStyleOrLink = iframeDoc.head.querySelector('style, link[rel="stylesheet"]');
  if (firstStyleOrLink) {
    iframeDoc.head.insertBefore(styleElement, firstStyleOrLink);
  } else {
    iframeDoc.head.appendChild(styleElement);
  }
}
```

**CSS Injection Method:**
- Styles injected into iframe document head after content loads via `srcdoc`
- Device styles inserted before existing XHTML stylesheets for proper cascade
- XHTML document styles can override device base styles due to CSS specificity
- Injection order: device base styles → font family → font size adjustment (combined into single `<style>` tag)

**Scaling Algorithm Implementation:**
```typescript
// Scaling calculation for device preview
function calculateScaleFactor(containerRect: DOMRect, deviceDimensions: {width: number, height: number}): number {
  const scaleX = containerRect.width / deviceDimensions.width;
  const scaleY = containerRect.height / deviceDimensions.height;
  return Math.min(scaleX, scaleY); // Preserve aspect ratio
}

// Applied as CSS transform
container.style.transform = `scale(${scaleFactor})`;
```

**Scaling Behavior:**
- Device previews calculate scale factor to fit available container space
- Letterbox styling with black background fills unused space
- No minimum or maximum scale limits - scales freely to fit any container
- CSS `transform: scale()` applied to `.content-preview__container`
- Responsive mode bypasses scaling entirely (100% width/height)

**Orientation Handling:**
```typescript
// Orientation dimension calculation
function getDeviceDimensions(deviceType: DeviceSize, orientation: 'portrait' | 'landscape') {
  const baseDimensions = DEVICE_SPECS[deviceType]; // e.g., {width: 390, height: 844}
  
  if (orientation === 'landscape') {
    return {
      width: baseDimensions.height,  // Swap: use height as width
      height: baseDimensions.width   // Swap: use width as height
    };
  }
  
  return baseDimensions; // Portrait uses original dimensions
}
```

- Portrait: Uses device width × height as specified in device table
- Landscape: Swaps dimensions (height becomes width, width becomes height)
- Responsive mode ignores orientation setting entirely
- Orientation changes trigger immediate rescaling calculation

### Preview Controls

**Header Controls:**
- **Device Dropdown**: Compact select for choosing device type
- **Orientation Toggle**: Portrait/landscape switch (disabled for responsive)
- **Font Size Adjustment**: +/- buttons for 1px increments
- **Font Family Dropdown**: Select for serif/sans-serif/monospace/default
- **Current Values Display**: Shows selected device and font settings

**Control Behavior:**
- Changes apply immediately to preview
- Font adjustment and font family persist across device changes
- Orientation resets to portrait when changing devices
- All controls remain enabled regardless of content state (empty content shows empty iframe)

### Rendering Method

- Uses iframe `srcdoc` attribute for direct XHTML content injection
- Injects device-specific CSS styles before original XHTML content
- Applies scaling transform to fit device dimensions in available space
- Full JavaScript execution allowed within iframe context
- Natural scrolling behavior when content exceeds iframe boundaries

**Scaling Behavior:**
- Device presets maintain aspect ratio when scaled to fit available preview space
- Iframe dimensions match device preset, then CSS transform scales to fit container
- Content appears as it would on the selected device size
- User can switch between device sizes via compact dropdown control


### Reactivity

- Component updates automatically when `content` prop changes
- Iframe re-renders with new XHTML content
- No caching or optimization - displays current content immediately

### Error Handling & State Management

**Empty Content:**
- Displays empty iframe when `content` is empty string
- All controls remain enabled and functional
- Device scaling and font injection still applied to empty iframe
- No error messages, placeholder content, or special handling

**Invalid XHTML:**
- Browser handles parsing errors naturally within iframe
- Malformed XHTML may display partially or show browser error page
- Component does not validate or sanitize input content
- CSS injection continues to work regardless of XHTML validity

**State Management:**
- Parent components manage all prop state (deviceSize, orientation, etc.)
- Component does not emit events or manage internal state
- All prop changes trigger immediate re-render
- No debouncing or optimization - updates happen synchronously

## Usage Examples

### Basic Content Preview

```svelte
<script>
  import ContentPreview from '$lib/components/preview/ContentPreview.svelte';

  let navContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>TOC</title></head>
<body>
  <nav>
    <ol>
      <li><a href="ch1.xhtml">Chapter 1</a></li>
    </ol>
  </nav>
</body>
</html>`;
</script>

<ContentPreview content={navContent} />
```

### Spine Item Content Preview

```svelte
<script>
  import ContentPreview from '$lib/components/preview/ContentPreview.svelte';

  let spineContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
  <link rel="stylesheet" href="styles.css"/>
</head>
<body>
  <h1>Chapter 1: Introduction</h1>
  <p>Chapter content...</p>
</body>
</html>`;
</script>

<ContentPreview 
  content={spineContent} 
  deviceSize="recent-iphone"
  orientation="landscape"
  fontSizeAdjustment={1}
  class="chapter-preview" 
/>
```

### Interactive Device Preview

```svelte
<script>
  import ContentPreview from '$lib/components/preview/ContentPreview.svelte';
  
  let deviceSize = 'recent-iphone';
  let orientation = 'portrait';
  let fontAdjustment = 0;
  let fontFamily = 'default';
  let content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test Content</title></head>
<body>
  <h1>Preview Test</h1>
  <p>This content adapts to different device sizes and orientations.</p>
</body>
</html>`;
</script>

<ContentPreview 
  content={content}
  deviceSize={deviceSize}
  orientation={orientation}
  fontSizeAdjustment={fontAdjustment}
  fontFamily={fontFamily}
/>
```

### Integration with LayoutManager

```svelte
<script>
  import ContentPreview from '$lib/components/preview/ContentPreview.svelte';
  import LayoutManager from '$lib/components/LayoutManager.svelte';
  
  let xhtmlContent = '';
  let previewDevice = 'responsive';
  let previewOrientation = 'portrait';
  let fontAdjustment = 0;
  let previewFontFamily = 'default';
</script>

<LayoutManager>
  <div slot="left-content">
    <!-- Editor content -->
  </div>
  
  <div slot="right-header">
    <!-- Device controls in header -->
    <div class="preview-controls">
      <select bind:value={previewDevice}>
        <option value="responsive">Responsive</option>
        <option value="recent-iphone">iPhone</option>
        <option value="large-iphone">iPhone Plus</option>
        <option value="medium-tablet">iPad</option>
      </select>
      
      {#if previewDevice !== 'responsive'}
        <button on:click={() => previewOrientation = previewOrientation === 'portrait' ? 'landscape' : 'portrait'}>
          {previewOrientation === 'portrait' ? '↻' : '↺'}
        </button>
        
        <button on:click={() => fontAdjustment--}>A-</button>
        <span>{fontAdjustment}</span>
        <button on:click={() => fontAdjustment++}>A+</button>
        
        <select bind:value={previewFontFamily}>
          <option value="default">Default</option>
          <option value="serif">Serif</option>
          <option value="sans-serif">Sans-serif</option>
          <option value="monospace">Monospace</option>
        </select>
      {/if}
    </div>
  </div>

  <div slot="right-content">
    <ContentPreview 
      content={xhtmlContent}
      deviceSize={previewDevice}
      orientation={previewOrientation}
      fontSizeAdjustment={fontAdjustment}
      fontFamily={previewFontFamily}
    />
  </div>
</LayoutManager>
```

## Integration Patterns

### Outline View Integration

```svelte
<script>
  // OutlineView.svelte integration example
  import ContentPreview from '$lib/components/preview/ContentPreview.svelte';

  let generatedNavXhtml = '';

  // Update preview when navigation content changes
  $: if (navTextChanged) {
    generatedNavXhtml = await generateNavigationXhtml(navText);
  }
</script>

<ContentPreview content={generatedNavXhtml} />
```

### Transform Pipeline Integration

```svelte
<script>
  // Integration with transform pipeline
  let transformedContent = '';

  async function updatePreview(sourceContent) {
    try {
      transformedContent = await transformPipeline.process(sourceContent);
    } catch (error) {
      // Handle transform errors - component will show empty iframe
      transformedContent = '';
    }
  }
</script>

<ContentPreview content={transformedContent} />
```

## Technical Implementation Notes

### Component DOM Structure

```html
<div class="content-preview {class}">
  <div class="content-preview__container" style="transform: scale(0.75)">
    <div class="content-preview__letterbox">
      <iframe class="content-preview__iframe" srcdoc="..."></iframe>
    </div>
  </div>
</div>
```

**CSS Classes:**
- `.content-preview` - Main wrapper component, accepts optional class prop
- `.content-preview__container` - Scaling container, receives CSS transform
- `.content-preview__letterbox` - Letterbox container with black background
- `.content-preview__iframe` - Iframe element with device dimensions

**CSS Implementation:**
```css
.content-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #000; /* Black background for letterboxing */
}

.content-preview__container {
  transform-origin: center;
  /* transform: scale() applied dynamically */
}

.content-preview__letterbox {
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.content-preview__iframe {
  border: none;
  /* width/height set to device dimensions */
}
```

### Iframe Configuration

- Uses `srcdoc` attribute for content injection
- No sandbox restrictions to allow JavaScript execution
- Inherits parent document's security context
- Standard iframe scrolling behavior

### Security Considerations

- **JavaScript Execution**: Allowed within iframe context
- **Content Trust**: Assumes XHTML content is from trusted sources (EPUB files)
- **Isolation**: Iframe provides standard browser isolation from parent document
- **No Sanitization**: Content is not sanitized or validated before display

### Performance Characteristics

- **No Caching**: Content re-renders on every prop change
- **Direct Injection**: Uses browser's native XHTML parsing
- **Memory Usage**: One iframe per component instance
- **Responsive**: Updates immediately when content prop changes

## Testing Considerations

### Storybook Integration Testing (Primary)

**Device Simulation Testing:**
- CSS transform scaling verification for all device types
- Aspect ratio preservation across container sizes
- Letterbox styling with black background
- Orientation switching dimension calculations
- Responsive mode bypass behavior

**Content Rendering Testing:**
- Real EPUB navigation documents in iframe
- Spine item XHTML content with CSS/JavaScript
- Large content scrolling behavior
- Malformed XHTML graceful degradation
- Empty content handling (empty iframe display)

**Font Control Testing:**
- Device-specific base font injection
- Font family CSS injection verification
- Font size adjustment (+/- pixel increments)
- Font settings persistence across device changes

**User Interaction Testing:**
- Device dropdown functionality
- Orientation toggle behavior
- Font control responsiveness
- Prop change reactivity

### Unit Testing (Minimal/None)

ContentPreview requires real browser APIs (iframe rendering, CSS transforms, device simulation) that cannot be effectively tested with mocks. All testing should be done in Storybook with real browser behavior.

### Browser Compatibility

- Modern browsers with iframe `srcdoc` support
- Standard XHTML parsing capabilities
- JavaScript execution within iframe context
- CSS styling preservation

## Common Use Cases

1. **EPUB Content Preview**: Display generated table of contents or navigation documents
2. **Chapter Content Preview**: Show spine item XHTML content with device-specific scaling
3. **Transform Pipeline Output**: Preview transformed content in real-time across device sizes
4. **Multi-device Testing**: Preview content as it will appear on different device classes
5. **Responsive Design Testing**: Switch between device sizes to test layout adaptability

## Error Recovery

- **Empty Content**: Displays empty iframe with device scaling and font injection still applied, all controls remain enabled
- **Malformed XHTML**: Browser handles parsing naturally, may show partial content or error page within iframe
- **Missing Resources**: CSS/JS files may fail to load but component continues functioning, device CSS injection unaffected
- **JavaScript Errors**: Contained within iframe context, does not affect parent application or component functionality
- **Invalid Props**: Component gracefully handles invalid device types or font families by falling back to defaults
- **Container Resize**: Scaling automatically recalculates when container dimensions change
