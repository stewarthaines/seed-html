<script lang="ts">
  import { t } from '../../i18n';
  import { titleHue, generateCoverSvg } from '../../epub/cover-generator';
  import HueSelector from '../HueSelector.svelte';
  import type {
    WorkspaceState,
    WorkspaceService,
  } from '../../services/workspace/workspace.service.js';
  import type { EPUBMetadata } from '../../epub/opf-utils.js';

  interface Props {
    workspace: WorkspaceState;
    focusedField?: keyof EPUBMetadata | null;
    readOnly?: boolean;
    workspaceService?: WorkspaceService;
    onGenerateCover?: (hue?: number) => Promise<void>;
  }

  let {
    workspace,
    focusedField = null,
    readOnly = false,
    workspaceService,
    onGenerateCover,
  }: Props = $props();

  let metadata = $derived(workspace?.opf?.metadata);
  let generating = $state(false);
  // null = follow the title-derived hue; a number = explicit user choice.
  let coverHue = $state<number | null>(null);
  const effectiveHue = $derived(coverHue ?? titleHue(metadata?.title ?? ''));

  // Whether the project already has a cover-image — drives "Update" vs "Generate".
  const hasCover = $derived(
    !!workspace?.opf?.manifest?.some(m => m.properties?.includes('cover-image'))
  );

  // Live preview: once the user touches the hue, render the prospective cover SVG
  // (vector, instant) in place of the stored cover, so they see the new hue
  // before committing. Cleared (null) until the slider is moved.
  const previewUrl = $derived.by(() => {
    if (coverHue === null) return null;
    const svg = generateCoverSvg(
      metadata?.title ?? '',
      metadata?.creator?.[0]?.name ?? '',
      effectiveHue
    );
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  // The current cover-image, loaded from storage as a blob URL. Re-runs whenever
  // the workspace changes (e.g. after Generate replaces appState.workspace).
  let coverUrl = $state<string | null>(null);
  $effect(() => {
    const ws = workspace;
    const svc = workspaceService;
    const item = ws?.opf?.manifest?.find(m => m.properties?.includes('cover-image'));
    if (!ws || !svc || !item) {
      coverUrl = null;
      return;
    }

    let stale = false;
    let url: string | null = null;
    const fullPath = ws.pathInfo.basePath ? `${ws.pathInfo.basePath}/${item.href}` : item.href;
    svc
      .readFile(ws.id, fullPath)
      .then(buffer => {
        if (stale) return;
        url = URL.createObjectURL(new Blob([buffer], { type: item.mediaType || 'image/png' }));
        coverUrl = url;
      })
      .catch(() => {
        if (!stale) coverUrl = null;
      });

    return () => {
      stale = true;
      if (url) URL.revokeObjectURL(url);
      coverUrl = null;
    };
  });

  async function handleGenerate() {
    if (generating || !onGenerateCover) return;
    generating = true;
    try {
      await onGenerateCover(coverHue ?? undefined);
    } finally {
      generating = false;
    }
  }
</script>

<div class="simple-metadata-view">
  <div class="preview-header">
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

      {#if previewUrl || coverUrl}
        <div class="cover-current">
          <div class="field-label">{$t('Cover')}</div>
          <img
            src={previewUrl ?? coverUrl}
            alt={$t('Current cover image')}
            class="cover-image"
          />
        </div>
      {/if}

      {#if onGenerateCover && !readOnly}
        <div class="cover-action">
          <HueSelector
            value={effectiveHue}
            disabled={generating}
            onInput={h => (coverHue = h)}
          />
          <button
            type="button"
            class="btn btn-secondary"
            disabled={generating}
            onclick={handleGenerate}
          >
            {#if generating}
              {hasCover ? $t('Updating…') : $t('Generating…')}
            {:else}
              {hasCover ? $t('Update cover image') : $t('Generate cover image')}
            {/if}
          </button>
          <p class="cover-hint">
            {hasCover
              ? $t('Updates the cover from the current title and author.')
              : $t('Creates a new cover from the current title and author.')}
          </p>
        </div>
      {/if}
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

  .cover-current {
    display: flex;
    flex-direction: column;
    align-items: flex-start; /* don't stretch the cover across the cross axis */
    gap: var(--space-2);
    margin-block-start: var(--space-4);
    padding: var(--space-3);
  }

  .cover-image {
    width: auto;
    height: auto;
    max-height: 40vh;
    max-width: 50%;
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }

  .cover-action {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-block-start: var(--space-5);
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-border-default);
  }

  .cover-hint {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
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
