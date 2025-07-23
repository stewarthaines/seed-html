<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TextEditorStore } from '../../stores/index.js';
  import './outline-editor.css';

  // Props interface matching API specification
  export let editorStore: TextEditorStore;
  export let placeholder: string = 'Navigation content will be auto-generated from your chapters...';

  // Event dispatcher with typed events
  const dispatch = createEventDispatcher<{
    contentChanged: {
      editorId: string;
      timestamp: number;
      isEmpty: boolean;
    };
  }>();

  // Debouncing timer for content updates
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Subscribe to store for textarea synchronization
  $: currentContent = $editorStore.content;

  function handleTextareaInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    
    // Clear existing timer
    clearTimeout(debounceTimer);
    
    // Debounce content updates (300ms per API specification)
    debounceTimer = setTimeout(() => {
      editorStore.updateContent(target.value);
      
      // Emit lightweight event without content duplication
      dispatch('contentChanged', {
        editorId: 'outline-nav',
        timestamp: Date.now(),
        isEmpty: target.value.trim() === ''
      });
    }, 300);
  }

  // Cleanup timer on component destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    clearTimeout(debounceTimer);
  });
</script>

<div class="outline-editor">
  <textarea
    class="outline-editor__textarea"
    value={currentContent}
    {placeholder}
    on:input={handleTextareaInput}
    aria-label="Navigation content editor"
    aria-describedby="editor-help"
    spellcheck="false"
    aria-multiline="true"
  ></textarea>
  
  <!-- Hidden help text for screen readers -->
  <div id="editor-help" class="sr-only">
    Enter navigation content in plain text. Leave empty to auto-generate from chapter titles.
    Press Ctrl+Enter (Cmd+Enter on Mac) to save navigation content.
  </div>
</div>