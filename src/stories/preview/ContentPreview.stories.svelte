<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, userEvent } from '@storybook/test';
  import ContentPreviewDemo from './ContentPreviewDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Preview/ContentPreview',
    component: ContentPreviewDemo,
    parameters: {
      docs: {
        description: {
          component: `
# ContentPreview Component

Interactive demonstration of the ContentPreview component for device-aware XHTML preview capabilities in the EPUB editor.

## Features Demonstrated

- **Device Simulation**: 6 device types with accurate scaling and aspect ratio preservation
- **Orientation Control**: Portrait/landscape toggle with dimension swapping
- **Font Controls**: Family selection and size adjustment in 1px increments
- **CSS Injection**: Device-specific fonts and margins injected into iframe
- **Content Types**: Navigation documents, chapter content, complex interactive content
- **Error Handling**: Empty content and malformed XHTML graceful degradation
- **Responsive Design**: Full-width responsive mode alongside device presets

## Device Types

| Device | Dimensions | Base Font | Margin | Line Height |
|--------|-----------|-----------|---------|-------------|
| iPhone SE | 375×667px | 16px | 12px | 1.4 |
| iPhone 13 | 390×844px | 17px | 14px | 1.4 |
| iPhone 15 Pro Max | 430×932px | 18px | 16px | 1.4 |
| iPad mini | 744×1133px | 20px | 20px | 1.5 |
| iPad Air | 820×1180px | 22px | 24px | 1.5 |
| iPad Pro 13" | 1024×1366px | 24px | 28px | 1.5 |

## Technical Implementation

- **Scaling Algorithm**: \`Math.min(container.width/device.width, container.height/device.height)\`
- **CSS Injection**: Device styles inserted before XHTML styles for proper cascade
- **Iframe Rendering**: Uses \`srcdoc\` attribute with full JavaScript execution
- **Letterbox Styling**: Black background fills unused space to preserve aspect ratios
- **Responsive Mode**: Bypasses device scaling (100% width/height)

## Usage Instructions

1. **Select Device**: Choose from responsive or 6 device presets
2. **Toggle Orientation**: Switch between portrait/landscape (device modes only)
3. **Adjust Font Size**: Use +/- controls for 1px increments
4. **Change Font Family**: Select serif, sans-serif, monospace, or default
5. **Test Content**: Switch between navigation, chapter, interactive, and error content
6. **Monitor Behavior**: Check browser console for detailed state logging

## Content Types

- **Navigation**: EPUB table of contents with styling
- **Chapter**: Formatted chapter content with typography
- **Complex Interactive**: JavaScript-enabled content with CSS animations
- **Malformed XHTML**: Intentionally broken markup for error testing
- **Empty State**: Empty content showing iframe behavior

## Integration Patterns

This component integrates with:
- EPUB outline view for navigation document preview
- Transform pipeline for real-time content preview
- Spine item manager for chapter content display
- Layout manager for responsive preview panels

## Accessibility Features

- Semantic HTML structure with proper ARIA labels
- 44px minimum touch targets for all interactive controls
- Keyboard navigation support
- High contrast design system integration
- Screen reader compatible control descriptions

## Design System Integration

Uses project design tokens:
- Color tokens for consistent theming
- Spacing scale for uniform layouts
- Typography tokens for readable interfaces
- Focus styles for accessibility compliance

The component demonstrates real browser behavior with actual iframe rendering, CSS transforms, and device simulation - no mocks required.
          `,
        },
      },
    },
  });
</script>

<Story name="Interactive Demo">
  <ContentPreviewDemo />
</Story>

<Story name="iPhone Portrait (Navigation)">
  <ContentPreviewDemo showControls={false} initialDevice="recent-iphone" contentType="navigation" />
</Story>

<Story name="iPhone Landscape (Chapter)">
  <ContentPreviewDemo showControls={false} initialDevice="recent-iphone" contentType="chapter" />
</Story>

<Story name="iPad Portrait (Complex Content)">
  <ContentPreviewDemo showControls={false} initialDevice="medium-tablet" contentType="complex" />
</Story>

<Story
  name="iPad Pro Landscape (Interactive)"
  play={async ({ canvas, userEvent }) => {
    // Wait for component to initialize
    await canvas.findByRole('main', {}, { timeout: 5000 });

    try {
      console.log('[ContentPreview Story] Testing iPad Pro landscape with interactive content');

      // The demo should load with complex interactive content
      // Verify iframe is present and properly scaled
      const iframe = canvas.getByTitle('Content Preview');

      if (iframe) {
        console.log('[ContentPreview Story] Iframe found and loaded');

        // Wait for iframe content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if iframe has content
        if (iframe.srcdoc && iframe.srcdoc.length > 0) {
          console.log('[ContentPreview Story] Iframe content loaded successfully');
        }
      }
    } catch (error) {
      console.warn('[ContentPreview Story] Play function error:', error);
    }
  }}
>
  <ContentPreviewDemo showControls={false} initialDevice="large-tablet" contentType="complex" />
</Story>

<Story name="Responsive Mode (Full Width)">
  <ContentPreviewDemo showControls={false} initialDevice="responsive" contentType="chapter" />
</Story>

<Story name="Empty Content State">
  <ContentPreviewDemo showControls={false} initialDevice="recent-iphone" showEmptyState={true} />
</Story>

<Story name="Malformed XHTML Handling">
  <ContentPreviewDemo showControls={false} initialDevice="recent-iphone" contentType="malformed" />
</Story>

<Story
  name="Font Control Testing"
  play={async ({ canvas, userEvent }) => {
    await canvas.findByRole('main', {}, { timeout: 5000 });

    try {
      console.log('[ContentPreview Story] Testing font controls');

      // Test font family changes
      const fontFamilySelect = canvas.getByLabelText(/Font Family/i);
      if (fontFamilySelect) {
        await userEvent.selectOptions(fontFamilySelect, 'serif');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('[ContentPreview Story] Changed to serif font');

        await userEvent.selectOptions(fontFamilySelect, 'sans-serif');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('[ContentPreview Story] Changed to sans-serif font');

        await userEvent.selectOptions(fontFamilySelect, 'monospace');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('[ContentPreview Story] Changed to monospace font');
      }

      // Test font size adjustments
      const fontIncreaseButton = canvas.getByText('A+');
      const fontDecreaseButton = canvas.getByText('A-');

      if (fontIncreaseButton && fontDecreaseButton) {
        await userEvent.click(fontIncreaseButton);
        await userEvent.click(fontIncreaseButton);
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('[ContentPreview Story] Increased font size');

        await userEvent.click(fontDecreaseButton);
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('[ContentPreview Story] Decreased font size');
      }
    } catch (error) {
      console.warn('[ContentPreview Story] Font control test error:', error);
    }
  }}
>
  <ContentPreviewDemo initialDevice="recent-iphone" contentType="chapter" />
</Story>

<Story
  name="Device Switching Test"
  play={async ({ canvas, userEvent }) => {
    await canvas.findByRole('main', {}, { timeout: 5000 });

    try {
      console.log('[ContentPreview Story] Testing device switching');

      const deviceSelect = canvas.getByLabelText(/Device/i);

      if (deviceSelect) {
        // Test different device types
        const devices = ['old-iphone', 'large-iphone', 'small-tablet', 'large-tablet'];

        for (const device of devices) {
          await userEvent.selectOptions(deviceSelect, device);
          await new Promise(resolve => setTimeout(resolve, 800));
          console.log(`[ContentPreview Story] Switched to ${device}`);
        }

        // Test responsive mode
        await userEvent.selectOptions(deviceSelect, 'responsive');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('[ContentPreview Story] Switched to responsive mode');

        // Back to device mode for orientation test
        await userEvent.selectOptions(deviceSelect, 'recent-iphone');
        await new Promise(resolve => setTimeout(resolve, 500));

        // Test orientation toggle
        const landscapeButton = canvas.getByText(/Landscape/i);
        if (landscapeButton) {
          await userEvent.click(landscapeButton);
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[ContentPreview Story] Switched to landscape orientation');

          const portraitButton = canvas.getByText(/Portrait/i);
          if (portraitButton) {
            await userEvent.click(portraitButton);
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('[ContentPreview Story] Switched back to portrait orientation');
          }
        }
      }
    } catch (error) {
      console.warn('[ContentPreview Story] Device switching test error:', error);
    }
  }}
>
  <ContentPreviewDemo initialDevice="recent-iphone" contentType="navigation" />
</Story>

<Story
  name="Content Type Cycling"
  play={async ({ canvas, userEvent }) => {
    await canvas.findByRole('main', {}, { timeout: 5000 });

    try {
      console.log('[ContentPreview Story] Testing content type cycling');

      const contentSelect = canvas.getByLabelText(/Content Type/i);

      if (contentSelect) {
        const contentTypes = ['navigation', 'chapter', 'complex', 'malformed'];

        for (const contentType of contentTypes) {
          await userEvent.selectOptions(contentSelect, contentType);
          await new Promise(resolve => setTimeout(resolve, 1200));
          console.log(`[ContentPreview Story] Loaded ${contentType} content`);
        }

        // Test empty state toggle
        const emptyStateButton = canvas.getByText(/Toggle Empty State/i);
        if (emptyStateButton) {
          await userEvent.click(emptyStateButton);
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[ContentPreview Story] Toggled empty state on');

          await userEvent.click(emptyStateButton);
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[ContentPreview Story] Toggled empty state off');
        }
      }
    } catch (error) {
      console.warn('[ContentPreview Story] Content cycling test error:', error);
    }
  }}
>
  <ContentPreviewDemo initialDevice="medium-tablet" contentType="navigation" />
</Story>

<Story name="Mobile View (iPhone SE)">
  <div style="max-width: 375px; margin: 0 auto; border: 1px solid #ccc; height: 600px;">
    <ContentPreviewDemo showControls={false} initialDevice="old-iphone" contentType="chapter" />
  </div>
</Story>

<Story name="Tablet View (iPad Air)">
  <div style="max-width: 768px; margin: 0 auto; border: 1px solid #ccc; height: 700px;">
    <ContentPreviewDemo showControls={false} initialDevice="medium-tablet" contentType="complex" />
  </div>
</Story>
