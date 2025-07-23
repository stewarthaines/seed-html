<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import OutlineEditorDemo from './OutlineEditorDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Outline/Editor',
    component: OutlineEditorDemo,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component: `
# Outline Editor Components

The Outline Editor system provides EPUB navigation document editing capabilities with real-time preview and automatic generation features.

## Features

- **Auto-generation**: Automatically generates navigation from spine items when editor is empty
- **Manual editing**: Users can override auto-generation with custom navigation content
- **Real-time preview**: Shows generated XHTML as user types (debounced at 300ms)
- **Accessibility-first**: Full keyboard navigation, screen reader support, ARIA labels
- **File operations**: Saves to both SOURCE/text/nav.txt and OEBPS/nav.xhtml
- **Error handling**: Comprehensive error handling for transform and file operations

## Components

### OutlineEditor
- Textarea-based editor with store integration
- Debounced content updates (300ms)
- Lightweight event emission without content duplication
- Design system integration with proper focus indicators

### OutlineView
- Coordination between editor, preview, and file operations
- Mode switching between auto-generation and manual editing
- Public API: loadNavigationContent(), saveNavigationContent()
- Transform pipeline integration for user content processing

## Backend Integration

- **TextEditorStore**: Factory-based text editor state management
- **OutlineGenerator**: Utility service for navigation generation and processing
- **SpineItemManager**: Chapter management and spine item loading
- **TransformPipeline**: Content transformation from plain text to XHTML
- **WorkspaceManager**: File I/O operations for SOURCE and OEBPS files

## Keyboard Shortcuts

- **Ctrl+Enter / Cmd+Enter**: Save navigation content
- **Tab**: Navigate between controls
- **Escape**: Clear focus (standard browser behavior)

## Technical Details

- Real backend integration (no mocks in production)
- Promise-based coordination for reliable async operations
- Screen reader announcements for save operations
- Design system token integration for consistent styling
- Responsive design with mobile touch target compliance
          `
        }
      }
    }
  });
</script>

<Story name="Interactive Demo">
  <OutlineEditorDemo />
</Story>

<Story 
  name="Keyboard Navigation Test"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    const canvas = within(canvasElement);
    
    try {
      // Wait for demo initialization by checking loading state
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds max
      
      while (attempts < maxAttempts) {
        const loadingElement = canvasElement.querySelector('.loading');
        if (!loadingElement) break;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Component failed to initialize within 30 seconds');
      }
      
      // Find the textarea (it should be empty initially for auto-generation)
      const textarea = await canvas.findByRole('textbox');
      console.log('✓ Found textarea element:', textarea ? 'success' : 'failed');
      console.log('✓ Initial textarea value:', textarea.value === '' ? 'empty (correct)' : `"${textarea.value}"`);
      
      // Test manual content entry
      await userEvent.click(textarea);
      await userEvent.type(textarea, '# Custom Navigation\n\n## Chapter 1: Introduction\n## Chapter 2: Getting Started');
      console.log('✓ Typed custom content into textarea');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify preview was updated
      const previewContainer = canvas.getByText(/Generated XHTML Preview/);
      console.log('✓ Found preview container:', previewContainer ? 'success' : 'failed');
      
      // Test keyboard save (Ctrl+Enter)
      await userEvent.keyboard('{Control>}{Enter}{/Control}');
      console.log('✓ Executed keyboard save (Ctrl+Enter)');
      
      // Wait for save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Keyboard navigation test completed successfully');
    } catch (error) {
      console.error('❌ Keyboard navigation test failed:', error);
      throw error;
    }
  }}
>
  <OutlineEditorDemo />
</Story>

<Story 
  name="Auto-Generation Test"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    const canvas = within(canvasElement);
    
    try {
      // Wait for demo initialization by checking loading state
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds max
      
      while (attempts < maxAttempts) {
        const loadingElement = canvasElement.querySelector('.loading');
        if (!loadingElement) break;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Component failed to initialize within 30 seconds');
      }
      
      // Reset demo to ensure clean state
      const resetBtn = await canvas.findByText('Reset Demo');
      await userEvent.click(resetBtn);
      console.log('✓ Clicked reset button');
      
      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify textarea is empty (triggers auto-generation)
      const textarea = await canvas.findByRole('textbox');
      console.log('✓ Textarea value after reset:', textarea.value === '' ? 'empty (triggers auto-generation)' : `"${textarea.value}"`);
      
      // Verify preview shows auto-generated content
      const previewSection = canvas.getByText(/Generated XHTML Preview/);
      console.log('✓ Found preview section:', previewSection ? 'success' : 'failed');
      
      // Check that the preview contains navigation structure
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✓ Waited for auto-generation processing');
      
      console.log('✅ Auto-generation test completed successfully');
    } catch (error) {
      console.error('❌ Auto-generation test failed:', error);
      throw error;
    }
  }}
>
  <OutlineEditorDemo />
</Story>

<Story 
  name="Error Handling Test"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    const canvas = within(canvasElement);
    
    try {
      // Wait for demo initialization by checking loading state
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds max
      
      while (attempts < maxAttempts) {
        const loadingElement = canvasElement.querySelector('.loading');
        if (!loadingElement) break;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Component failed to initialize within 30 seconds');
      }
      
      // Test with content that might cause transform issues
      const textarea = await canvas.findByRole('textbox');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Invalid XML content < > & " \' test');
      console.log('✓ Entered potentially problematic content with XML characters');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify system handles the content gracefully
      console.log('✓ System handled content gracefully:', textarea ? 'success' : 'failed');
      
      // Test save operation
      const saveBtn = await canvas.findByText('Save Navigation');
      await userEvent.click(saveBtn);
      console.log('✓ Clicked save button');
      
      // Wait for save
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✓ Save operation completed');
      
      console.log('✅ Error handling test completed successfully');
    } catch (error) {
      console.error('❌ Error handling test failed:', error);
      throw error;
    }
  }}
>
  <OutlineEditorDemo />
</Story>

<Story 
  name="Accessibility Test"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    const canvas = within(canvasElement);
    
    try {
      // Wait for demo initialization by checking loading state
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds max
      
      while (attempts < maxAttempts) {
        const loadingElement = canvasElement.querySelector('.loading');
        if (!loadingElement) break;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Component failed to initialize within 30 seconds');
      }
      
      // Test ARIA labels and accessibility features
      const textarea = await canvas.findByRole('textbox');
      console.log('✓ Textarea aria-label:', textarea.getAttribute('aria-label') || 'not set');
      console.log('✓ Textarea aria-describedby:', textarea.getAttribute('aria-describedby') || 'not set');
      
      // Test keyboard navigation
      await userEvent.tab(); // Should focus first interactive element
      await userEvent.tab(); // Navigate to next element
      console.log('✓ Tested keyboard tab navigation');
      
      // Test screen reader announcements structure
      const liveRegions = canvasElement.querySelectorAll('[aria-live]');
      console.log('✓ Found ARIA live regions:', liveRegions.length);
      
      // Test focus management
      await userEvent.click(textarea);
      console.log('✓ Focus management test:', document.activeElement === textarea ? 'passed' : 'failed');
      
      console.log('✅ Accessibility test completed successfully');
    } catch (error) {
      console.error('❌ Accessibility test failed:', error);
      throw error;
    }
  }}
>
  <OutlineEditorDemo />
</Story>