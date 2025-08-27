<script lang="ts">
  import { t } from '../../i18n';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';

  interface Props {
    workspace: WorkspaceState;
    workspaceService: WorkspaceService;
  }

  let { workspace, workspaceService }: Props = $props();

  let opfContent = $state<string>('');
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Reactive: Load OPF content when workspace changes
  $effect(() => {
    if (workspace && workspaceService) {
      loadOPFContent();
    }
  });

  const loadOPFContent = async () => {
    if (!workspace || !workspaceService) return;

    try {
      loading = true;
      error = null;

      const content = await workspaceService.readFile(
        workspace.id,
        workspace.pathInfo.rootfilePath
      );

      const decoder = new TextDecoder('utf-8');
      opfContent = decoder.decode(content);
    } catch (err) {
      console.error('Failed to load content.opf:', err);
      error = $t('Failed to load content.opf file');
      opfContent = '';
    } finally {
      loading = false;
    }
  };
</script>

<div class="opf-preview">
  <div class="preview-header">
    <span class="content-type-icon">📄</span>
    <span class="file-name">content.opf</span>
  </div>

  {#if loading}
    <div class="loading-state">
      <p>{$t('Loading preview…')}</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-message">{error}</p>
      <button type="button" class="retry-button" onclick={loadOPFContent}>
        {$t('Retry')}
      </button>
    </div>
  {:else if opfContent}
    <div class="preview-body">
      <div class="text-preview">
        <pre class="text-content" dir="ltr">{opfContent}</pre>
      </div>
    </div>
  {:else}
    <div class="no-content">
      <p>{$t('No content available')}</p>
    </div>
  {/if}
</div>

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
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    tab-size: 2;
  }

  .loading-state,
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
</style>
