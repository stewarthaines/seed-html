<!--
  Media browser: thumbnails of the manifest's image items; clicking one reports
  its OPF-relative href via onPick (EditorPane formats the snippet and splices
  it at the caret). Deliberately dumb — no management actions, images only.
-->
<script lang="ts">
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '$lib/services/workspace/workspace.service.js';
  import { manifestHrefToPath } from '$lib/epub/path-utils.js';
  import { t } from '$lib/i18n';

  let {
    workspace,
    workspaceService,
    onPick,
  }: {
    workspace: WorkspaceState;
    workspaceService: WorkspaceService;
    onPick?: (href: string) => void;
  } = $props();

  const imageItems = $derived(
    workspace.opf.manifest.filter(item => item.mediaType?.startsWith('image/'))
  );

  // href → object URL for the loaded thumbnails (partial while loading).
  let thumbnails = $state<Record<string, string>>({});
  let loadError = $state(false);

  const basename = (href: string): string => href.split('/').pop() ?? href;

  // Load thumbnail bytes whenever the image set changes; revoke on cleanup.
  $effect(() => {
    const items = imageItems;
    const ws = workspace;
    let cancelled = false;
    const created: string[] = [];
    loadError = false;
    thumbnails = {};

    (async () => {
      for (const item of items) {
        try {
          const path = manifestHrefToPath(ws.pathInfo.basePath, item.href);
          const bytes = await workspaceService.readFile(ws.id, path);
          if (cancelled) return;
          const url = URL.createObjectURL(new Blob([bytes], { type: item.mediaType }));
          created.push(url);
          thumbnails = { ...thumbnails, [item.href]: url };
        } catch {
          if (!cancelled) loadError = true;
        }
      }
    })();

    return () => {
      cancelled = true;
      created.forEach(url => URL.revokeObjectURL(url));
    };
  });
</script>

<div class="media-browser">
  {#if imageItems.length === 0}
    <p class="status">{$t('No images in this project.')}</p>
  {:else}
    {#if loadError}
      <p class="status">{$t('Some images could not be loaded.')}</p>
    {/if}
    <div class="thumb-grid">
      {#each imageItems as item (item.href)}
        <button
          type="button"
          class="thumb"
          onclick={() => onPick?.(item.href)}
          title={$t('Insert {name} at the cursor', { name: basename(item.href) })}
        >
          {#if thumbnails[item.href]}
            <img src={thumbnails[item.href]} alt="" />
          {:else}
            <span class="thumb-placeholder" aria-hidden="true"></span>
          {/if}
          <span class="thumb-name">{basename(item.href)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .media-browser {
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--color-border-default);
    max-height: 11rem;
    overflow-y: auto;
  }

  .status {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .thumb-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 6rem;
    padding: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    cursor: pointer;
  }

  .thumb:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-interactive-primary);
  }

  .thumb:focus-visible {
    outline: 2px solid var(--color-interactive-primary);
    outline-offset: 1px;
  }

  .thumb img,
  .thumb-placeholder {
    width: 100%;
    height: 4rem;
    object-fit: contain;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-xs);
  }

  .thumb-placeholder {
    display: block;
  }

  .thumb-name {
    width: 100%;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
