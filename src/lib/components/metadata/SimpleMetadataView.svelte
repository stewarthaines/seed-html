<script lang="ts">
  import { t } from '../../i18n';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';
  import type { EPUBMetadata } from '../../epub/opf-utils.js';

  interface Props {
    workspace: WorkspaceState;
    focusedField?: keyof EPUBMetadata | null;
  }

  let { workspace, focusedField = null }: Props = $props();

  let metadata = $derived(workspace?.opf?.metadata);
</script>

<div class="simple-metadata-view">
  <div class="preview-header">
    <span class="content-type-icon">📝</span>
    <span class="file-name">{$t('Metadata Summary')}</span>
  </div>

  {#if metadata}
    <div class="preview-body">
      <div class="metadata-summary">
        <div class="field-row" class:focused={focusedField === 'title'}>
          <div class="field-label">{$t('Title')}</div>
          <div class="field-value">{metadata.title || $t('Untitled')}</div>
        </div>

        <div class="field-row" class:focused={focusedField === 'language'}>
          <div class="field-label">{$t('Language')}</div>
          <div class="field-value">{metadata.language || $t('Not specified')}</div>
        </div>

        {#if metadata.creator && metadata.creator.length > 0}
          <div class="field-row" class:focused={focusedField === 'creator'}>
            <div class="field-label">{$t('Creators')}</div>
            <div class="field-value">
              {#each metadata.creator as creator, index}
                {creator.name}{#if index < metadata.creator.length - 1},
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        {#if metadata.description}
          <div class="field-row" class:focused={focusedField === 'description'}>
            <div class="field-label">{$t('Description')}</div>
            <div class="field-value description">{metadata.description}</div>
          </div>
        {/if}

        <div class="field-row" class:focused={focusedField === 'identifier'}>
          <div class="field-label">{$t('Identifier')}</div>
          <div class="field-value identifier">{metadata.identifier || $t('Not specified')}</div>
        </div>
      </div>
    </div>
  {:else}
    <div class="no-content">
      <p>{$t('No metadata available')}</p>
    </div>
  {/if}
</div>

<style>
  .simple-metadata-view {
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
    padding: var(--space-4);
  }

  .metadata-summary {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast) ease;
  }

  .field-row.focused {
    background: var(--color-bg-accent);
    border: 1px solid var(--color-interactive-primary);
  }

  .field-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .field-value {
    font-size: var(--text-base);
    color: var(--color-text-primary);
    line-height: var(--leading-relaxed);
  }

  .field-value.description {
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .field-value.identifier {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    word-break: break-all;
  }

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
</style>
