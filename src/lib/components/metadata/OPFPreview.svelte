<script lang="ts">
  import { t } from '../../i18n';
  import { xmlHighlighter } from '../../utils/xml-highlighter.js';
  import { OPFUtils } from '../../epub/opf-utils.js';
  import SimpleMetadataView from './SimpleMetadataView.svelte';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';
  import type { EPUBMetadata } from '../../epub/opf-utils.js';

  interface Props {
    workspace: WorkspaceState;
    focusedField?: keyof EPUBMetadata | null;
    tabFields?: string[];
    isAdvancedMode?: boolean;
  }

  let { workspace, focusedField = null, tabFields = [], isAdvancedMode = false }: Props = $props();

  let highlightedContent = $state<string>('');
  let error = $state<string | null>(null);

  // Generate OPF content from workspace data (derived state)
  let opfContent = $derived(() => {
    if (!workspace) return '';
    try {
      return OPFUtils.generateOPFXML(workspace.opf);
    } catch (err) {
      console.error('Failed to generate OPF XML:', err);
      return '';
    }
  });

  // Reactive: Update highlighting when workspace or focused field changes
  $effect(() => {
    updateHighlighting();
  });

  const updateHighlighting = () => {
    if (!opfContent()) {
      highlightedContent = '';
      return;
    }

    try {
      const result = xmlHighlighter.highlightOPFContent(opfContent(), {
        focusedField,
        tabFields,
        highlightValues: true,
        highlightTags: true,
        pageProgressionDirection: workspace?.opf?.metadata?.pageProgressionDirection,
      });

      highlightedContent = result.highlightedXML;
      error = null;
    } catch (err) {
      console.error('Failed to highlight XML:', err);
      error = $t('Failed to generate XML preview');
      highlightedContent = '';
    }
  };
</script>

{#if isAdvancedMode}
  <div class="opf-preview">
    <div class="preview-header">
      <span class="content-type-icon">📄</span>
      <span class="file-name">content.opf</span>
    </div>

    {#if error}
      <div class="error-state">
        <p class="error-message">{error}</p>
        <button type="button" class="retry-button" onclick={updateHighlighting}>
          {$t('Retry')}
        </button>
      </div>
    {:else if highlightedContent}
      <div class="preview-body">
        <div class="text-preview">
          <pre class="text-content highlighted-xml" dir="ltr">{@html highlightedContent}</pre>
        </div>
      </div>
    {:else}
      <div class="no-content">
        <p>{$t('No content available')}</p>
      </div>
    {/if}
  </div>
{:else}
  <SimpleMetadataView {workspace} {focusedField} />
{/if}

<style>
  .opf-preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-primary);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-default);
  }

  .content-type-icon {
    font-size: var(--text-lg);
  }

  .file-name {
    font-family: var(--font-mono);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .preview-body {
    flex: 1;
    overflow: auto;
    padding: var(--space-3);
  }

  .text-preview {
    height: 100%;
  }

  .text-content {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: none;
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: auto;
    white-space: pre;
    tab-size: 2;
  }

  .error-state,
  .no-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    padding: var(--space-4);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .error-state {
    color: var(--color-status-error);
  }

  .error-message {
    margin-bottom: var(--space-3);
  }

  .retry-button {
    padding: var(--space-2) var(--space-4);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all var(--duration-fast) ease;
  }

  .retry-button:hover {
    background: var(--color-interactive-secondary-hover);
    border-color: var(--color-border-strong);
  }

  .retry-button:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  /* XML Syntax Highlighting Styles */
  .highlighted-xml :global(.metadata-value) {
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
  }

  .highlighted-xml :global(.metadata-value-focused) {
    font-weight: var(--font-bold);
    color: var(--color-interactive-primary);
    background: var(--color-bg-accent);
    border-radius: var(--radius-xs);
  }

  .highlighted-xml :global(.metadata-tag) {
    color: var(--color-syntax-tag);
  }

  .highlighted-xml :global(.metadata-tag-focused) {
    color: var(--color-interactive-primary);
    font-weight: var(--font-medium);
  }

  /* Left-border markers: a soft grey bar for fields owned by the active tab,
     and the focused-field accent (blue) for the field currently in focus.
     The bar is on the opening tag (.metadata-line) so it sits at the start of
     the element's line. Every highlightable line reserves the bar's width with
     a transparent border + compensating negative margin, so the bar
     appearing/disappearing never shifts the element horizontally. */
  .highlighted-xml :global(.metadata-line) {
    border-inline-start: 3px solid transparent;
    padding-inline-start: 0.4rem;
    margin-inline-start: calc(-0.4rem - 3px);
  }

  .highlighted-xml :global(.metadata-tag-tab.metadata-line) {
    border-inline-start-color: var(--color-border-default);
  }

  .highlighted-xml :global(.metadata-tag-focused.metadata-line) {
    border-inline-start-color: var(--color-interactive-primary);
  }

  /* Enhanced XML syntax highlighting */
  .highlighted-xml {
    font-family: var(--font-mono);
    line-height: var(--leading-relaxed);
  }

  /* XML element styling */
  .highlighted-xml :global(meta),
  .highlighted-xml :global(dc\\:title),
  .highlighted-xml :global(dc\\:language),
  .highlighted-xml :global(dc\\:identifier),
  .highlighted-xml :global(dc\\:creator),
  .highlighted-xml :global(dc\\:contributor),
  .highlighted-xml :global(dc\\:subject),
  .highlighted-xml :global(dc\\:publisher),
  .highlighted-xml :global(dc\\:date),
  .highlighted-xml :global(dc\\:description),
  .highlighted-xml :global(dc\\:rights) {
    display: inline;
  }

  /* Structural element de-emphasis */
  .highlighted-xml :global(.structural-element) {
    color: var(--color-text-tertiary);
  }
</style>
