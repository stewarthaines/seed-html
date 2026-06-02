# ContentPreview Component Testing Plan

## Overview

The ContentPreview component requires real browser APIs for iframe rendering, CSS transforms, and device simulation. This testing strategy focuses exclusively on Storybook integration tests using real browser behavior, skipping unit tests entirely as they provide no value for this component.

## Testing Philosophy

**Real Browser Testing Only**: ContentPreview functionality is inherently browser-dependent (iframe rendering, CSS scaling, font injection). Unit tests with mocks would test implementation details rather than user-facing behavior.

**Storybook-First Testing**: All testing occurs in Storybook with real browser APIs, providing authentic validation of device simulation and content rendering.

## Testing Strategy

### Storybook Integration Tests (100% of testing effort)

**Location**:

- `src/stories/ContentPreviewDemo.stories.svelte` (story definitions)
- `src/stories/ContentPreviewDemo.svelte` (demo component with test logic)
- `src/stories/content-preview-demo.css` (demo styling)

**Pattern**: Component Stories (`title: 'Components/Preview/ContentPreview'`)

### Test Coverage Areas

#### 1. Device Scaling & Simulation

- ✅ CSS transform scaling for each device type
- ✅ Aspect ratio preservation during scaling
- ✅ Orientation switching (portrait/landscape)
- ✅ Responsive mode (no scaling)
- ✅ Device dimension accuracy

#### 2. Font Control System

- ✅ Font size adjustment (+/- buttons)
- ✅ Font family injection (serif, sans-serif, monospace, default)
- ✅ Device-specific base font sizes
- ✅ Font persistence across device changes

#### 3. XHTML Content Rendering

- ✅ Complete XHTML document display in iframe
- ✅ CSS and JavaScript execution within iframe
- ✅ Large content handling with natural scrolling
- ✅ Malformed XHTML graceful degradation
- ✅ Empty content handling

#### 4. User Interactions

- ✅ Device dropdown functionality
- ✅ Orientation toggle behavior
- ✅ Font adjustment controls
- ✅ Real-time preview updates
- ✅ Control state management

#### 5. Error Scenarios

- ✅ Invalid XHTML handling
- ✅ Empty content display
- ✅ Control state edge cases
- ✅ Large content performance

## Story Structure

### Demo Component Architecture

```svelte
<!-- ContentPreviewDemo.stories.svelte -->
<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ContentPreviewDemo from './ContentPreviewDemo.svelte';

  export const { Story } = defineMeta({
    title: 'Components/Preview/ContentPreview',
    component: ContentPreviewDemo,
    parameters: {
      docs: {
        description: {
          component: 'Interactive device simulation and content preview testing',
        },
      },
    },
  });
</script>

<Story name="Device Scaling Tests">
  <ContentPreviewDemo scenario="device-scaling" />
</Story>

<Story name="Font Control Tests">
  <ContentPreviewDemo scenario="font-controls" />
</Story>

<Story name="XHTML Rendering Tests">
  <ContentPreviewDemo scenario="xhtml-rendering" />
</Story>

<Story name="Error Handling Tests">
  <ContentPreviewDemo scenario="error-handling" />
</Story>
```

### Demo Component Features

```svelte
<!-- ContentPreviewDemo.svelte -->
<script>
  import ContentPreview from '$lib/components/preview/ContentPreview.svelte';

  export let scenario = 'device-scaling';

  let testResults = [];
  let deviceSize = 'recent-iphone';
  let orientation = 'portrait';
  let fontSizeAdjustment = 0;
  let fontFamily = 'default';

  // Test content variations
  const testContent = {
    basic: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Basic Test</title></head>
<body>
  <h1>Device Preview Test</h1>
  <p>Testing device scaling and font controls.</p>
</body>
</html>`,

    complex: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Complex Content</title>
  <style>
    body { background: #f0f0f0; padding: 20px; }
    .test-content { border: 1px solid #ccc; padding: 15px; }
  </style>
</head>
<body>
  <div class="test-content">
    <h1>Complex XHTML Test</h1>
    <p>This content includes CSS styling and complex layout.</p>
    <ul>
      <li>List item 1</li>
      <li>List item 2</li>
    </ul>
  </div>
  <script>
    console.log('JavaScript execution test');
  </script>
</body>
</html>`,

    malformed: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Malformed</title></head>
<body>
  <h1>Malformed Content
  <p>Missing closing tag test
</body>`,

    empty: ''
  };

  let currentContent = testContent.basic;

  // Real browser testing functions
  function testDeviceScaling() {
    const iframe = document.querySelector('.content-preview iframe');
    const container = iframe?.parentElement;

    if (!container) {
      addTestResult('Device scaling', 'FAIL', 'iframe container not found');
      return;
    }

    const transform = window.getComputedStyle(container).transform;
    const hasScaling = transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)';

    addTestResult(
      'Device scaling applied',
      hasScaling ? 'PASS' : 'FAIL',
      `Transform: ${transform}`
    );
  }

  function testFontInjection() {
    const iframe = document.querySelector('.content-preview iframe');
    const iframeDoc = iframe?.contentDocument;

    if (!iframeDoc) {
      addTestResult('Font injection', 'FAIL', 'iframe content not accessible');
      return;
    }

    const bodyStyle = window.getComputedStyle(iframeDoc.body);
    const expectedSize = getExpectedFontSize(deviceSize, fontSizeAdjustment);
    const actualSize = parseInt(bodyStyle.fontSize);

    addTestResult(
      'Font size injection',
      Math.abs(actualSize - expectedSize) <= 1 ? 'PASS' : 'FAIL',
      `Expected: ${expectedSize}px, Actual: ${actualSize}px`
    );

    if (fontFamily !== 'default') {
      const expectedFamily = getFontFamilyString(fontFamily);
      const hasFontFamily = bodyStyle.fontFamily.includes(expectedFamily.split(',')[0]);

      addTestResult(
        'Font family injection',
        hasFontFamily ? 'PASS' : 'FAIL',
        `Expected: ${expectedFamily}, Actual: ${bodyStyle.fontFamily}`
      );
    }
  }

  function testContentRendering() {
    const iframe = document.querySelector('.content-preview iframe');
    const iframeDoc = iframe?.contentDocument;

    if (!iframeDoc) {
      addTestResult('Content rendering', 'FAIL', 'iframe content not accessible');
      return;
    }

    const hasContent = iframeDoc.body.innerHTML.trim().length > 0;
    const title = iframeDoc.querySelector('h1')?.textContent;

    addTestResult(
      'XHTML content rendered',
      hasContent ? 'PASS' : 'FAIL',
      `Title found: ${title || 'none'}`
    );
  }

  function addTestResult(test, result, details) {
    testResults = [...testResults, {
      test,
      result,
      details,
      timestamp: new Date().toLocaleTimeString()
    }];
  }

  function getExpectedFontSize(device, adjustment) {
    const baseSizes = {
      'old-iphone': 16,
      'recent-iphone': 18,
      'large-iphone': 18,
      'small-tablet': 20,
      'medium-tablet': 22,
      'large-tablet': 24,
      'responsive': 16
    };
    return (baseSizes[device] || 16) + (adjustment || 0);
  }

  function getFontFamilyString(family) {
    const families = {
      'serif': 'Georgia, Times New Roman, Times, serif',
      'sans-serif': '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      'monospace': 'Courier New, Courier, monospace'
    };
    return families[family] || '';
  }

  function runAllTests() {
    testResults = [];
    setTimeout(() => {
      testDeviceScaling();
      testFontInjection();
      testContentRendering();
    }, 100);
  }
</script>

<!-- Component renders here with test controls -->
```

## Automated Testing with Play Functions

### Device Scaling Automation

```svelte
<Story
  name="Automated Device Scaling"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    
    const canvas = within(canvasElement);
    
    // Test device switching
    const deviceSelect = canvas.getByDisplayValue(/iphone|tablet|responsive/i);
    await userEvent.selectOptions(deviceSelect, 'large-tablet');
    
    // Wait for scaling to apply
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify scaling applied
    const iframe = canvas.getByTitle(/preview/i) || document.querySelector('iframe');
    const container = iframe.parentElement;
    const transform = window.getComputedStyle(container).transform;
    
    if (transform === 'none') {
      throw new Error('Device scaling not applied to large tablet');
    }
    
    // Test orientation toggle
    const orientationBtn = canvas.getByRole('button', { name: /orientation|portrait|landscape/i });
    await userEvent.click(orientationBtn);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify orientation change affected dimensions
    const newTransform = window.getComputedStyle(container).transform;
    if (newTransform === transform) {
      throw new Error('Orientation toggle did not change scaling');
    }
  }}
>
  <ContentPreviewDemo scenario="automated-scaling" />
</Story>
```

### Font Control Automation

```svelte
<Story
  name="Automated Font Controls"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    
    const canvas = within(canvasElement);
    
    // Test font size adjustment
    const fontUpBtn = canvas.getByRole('button', { name: /\+|increase|larger/i });
    await userEvent.click(fontUpBtn);
    await userEvent.click(fontUpBtn); // +2px
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify font size injection
    const iframe = document.querySelector('iframe');
    const iframeDoc = iframe.contentDocument;
    const bodyFontSize = window.getComputedStyle(iframeDoc.body).fontSize;
    
    if (!bodyFontSize.includes('20px')) { // 18px base + 2px adjustment for recent-iphone
      throw new Error(`Expected 20px, got ${bodyFontSize}`);
    }
    
    // Test font family selection
    const fontSelect = canvas.getByDisplayValue(/default|serif|sans-serif|monospace/i);
    await userEvent.selectOptions(fontSelect, 'serif');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify font family injection
    const bodyFontFamily = window.getComputedStyle(iframeDoc.body).fontFamily;
    if (!bodyFontFamily.toLowerCase().includes('georgia')) {
      throw new Error(`Expected serif font, got ${bodyFontFamily}`);
    }
  }}
>
  <ContentPreviewDemo scenario="automated-fonts" />
</Story>
```

## Testing Scenarios by Category

### 1. Device Scaling Tests

- Switch between all device types
- Verify CSS transform scaling applied
- Test orientation toggle for each device
- Confirm responsive mode has no scaling
- Visual verification of aspect ratio preservation

### 2. Font Control Tests

- Font size adjustment in 1px increments
- Font family switching between all options
- Device base font size verification
- Font persistence across device changes
- Combined font size + family changes

### 3. Content Rendering Tests

- Basic XHTML document display
- Complex XHTML with CSS and JavaScript
- Large content with scrolling behavior
- Malformed XHTML graceful handling
- Empty content edge case

### 4. Error Handling Tests

- Invalid XHTML parsing
- Missing content scenarios
- Control state consistency
- Performance with large documents

## Benefits of Storybook-Only Testing

### Real Browser Validation

- ✅ Authentic iframe behavior
- ✅ Actual CSS transform scaling
- ✅ Real font rendering and injection
- ✅ True device simulation accuracy
- ✅ Performance characteristics validation

### User Experience Focus

- ✅ Tests actual user interactions
- ✅ Visual verification of device simulation
- ✅ Real content rendering validation
- ✅ Authentic error handling behavior

### Development Efficiency

- ✅ No complex iframe mocking required
- ✅ No CSS transform simulation needed
- ✅ Real browser API integration testing
- ✅ Visual debugging capabilities
- ✅ Screenshot automation for documentation

### Maintenance Benefits

- ✅ Tests user-facing behavior, not implementation
- ✅ Resilient to internal refactoring
- ✅ Clear visual feedback on failures
- ✅ Comprehensive integration testing

## Test Execution

### Manual Testing

```bash
npm run storybook
# Navigate to Components/Preview/ContentPreview
# Execute test scenarios interactively
```

### Automated Testing

```bash
npm run test:stories
# Runs play function automation
```

### Screenshot Documentation

```bash
npm run screenshots
# Captures visual evidence of device simulation
```

## Success Criteria

### Device Simulation

- [ ] All device types scale correctly within available space
- [ ] Orientation switching works for all devices except responsive
- [ ] CSS transforms maintain aspect ratios
- [ ] Responsive mode fills available space without scaling

### Font Controls

- [ ] Font size adjustment works in 1px increments
- [ ] Font family injection applies correctly for all options
- [ ] Device base fonts render at expected sizes
- [ ] Font settings persist across device changes

### Content Rendering

- [ ] XHTML documents render completely in iframe
- [ ] CSS and JavaScript execute within iframe
- [ ] Large content scrolls naturally
- [ ] Malformed content degrades gracefully
- [ ] Empty content displays empty iframe

### User Interactions

- [ ] All controls respond immediately to user input
- [ ] Control states remain consistent
- [ ] Multiple rapid changes handled smoothly
- [ ] Visual feedback provided for all actions

This testing strategy ensures comprehensive validation of ContentPreview functionality using real browser behavior, providing confidence in device simulation accuracy and user experience quality.
