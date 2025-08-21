<script lang="ts">
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';
  import type { ExtensionManager } from '../../extensions/extension-manager.js';
  import type { ExtensionInfo } from '../../extensions/types.js';

  interface Props {
    workspace: WorkspaceState;
    extensionManager: ExtensionManager;
  }

  let { workspace, extensionManager }: Props = $props();

  // Reactive extension list
  let extensions = $state<ExtensionInfo[]>([]);
  let extensionsLoading = $state(false);

  // Load extensions when workspace changes
  $effect(() => {
    if (workspace?.id && extensionManager) {
      extensionsLoading = true;
      extensionManager.listWorkspaceExtensions(workspace.id)
        .then(exts => {
          extensions = exts;
          extensionsLoading = false;
        })
        .catch(() => {
          extensions = [];
          extensionsLoading = false;
        });
    }
  });

  // Computed values from workspace metadata
  let title = $derived(workspace?.opf?.metadata?.title || 'Untitled');
  let author = $derived.by(() => {
    const creators = workspace?.opf?.metadata?.creator;
    return creators && creators.length > 0 ? creators.join(', ') : null;
  });
</script>

<div class="workspace-header">
  <h2 class="workspace-title" title={title}>
    {title}
  </h2>
  
  {#if author}
    <span class="separator">•</span>
    <span class="workspace-author" title={author}>
      {author}
    </span>
  {/if}

  {#if extensions.length > 0 || extensionsLoading}
    <span class="separator">•</span>
    <span class="workspace-extensions">
      {#if extensionsLoading}
        Loading extensions...
      {:else}
        {extensions.map(ext => ext.name).join(', ')}
      {/if}
    </span>
  {/if}
</div>

<style>
  .workspace-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-4);
    padding-block: var(--space-2);
    min-height: 40px;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    overflow: hidden;
  }

  .workspace-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
    flex-shrink: 0;
  }

  .separator {
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    font-weight: bold;
  }

  .workspace-author {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
    flex-shrink: 2;
    min-width: 0;
  }

  .workspace-extensions {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 3;
    min-width: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .workspace-header {
      padding-inline: var(--space-3);
    }

    .workspace-title {
      max-width: none; /* Allow title to take more space */
    }

    .workspace-author {
      max-width: 120px;
    }

    .workspace-extensions {
      max-width: 100px;
    }
  }

  @media (max-width: 640px) {
    .workspace-author {
      display: none;
    }
    
    .workspace-extensions {
      display: none;
    }
  }
</style>