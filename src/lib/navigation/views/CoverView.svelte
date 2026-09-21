<!--
  CoverView — Book › Cover. The book's cover large, the generator's controls
  (text style, hue, Update or Generate, Reset), a way to use an image of your
  own, and how the cover reads at shelf and list size. The generator itself is
  the app's (src/lib/epub/cover-generator.ts); the app writes the files.
-->
<script lang="ts">
  import { t } from '../../i18n';
  import {
    titleHue,
    generateCoverSvg,
    coverBackgroundColor,
    coverTextColor,
    type CoverMode,
  } from '../../epub/cover-generator';
  import HueSelector from '../../components/HueSelector.svelte';
  import { BookCover } from '../../components/books';
  import { showToast } from '../../stores/toast.svelte.js';
  import { importFileToManifest, reliableMediaType } from '../../import/import-media.js';
  import type {
    WorkspaceState,
    WorkspaceService,
  } from '../../services/workspace/workspace.service.js';

  let {
    workspace,
    workspaceService,
    coverSettings,
    onGenerateCover,
    readOnly = false,
    onWorkspaceUpdate,
  }: {
    workspace: WorkspaceState;
    workspaceService: WorkspaceService;
    /** Persisted hue/mode and the title/author the cover was last generated with. */
    coverSettings?: { hue?: number; mode?: CoverMode; title?: string; author?: string };
    onGenerateCover?: (hue?: number, mode?: CoverMode) => Promise<void>;
    readOnly?: boolean;
    onWorkspaceUpdate?: (workspace: WorkspaceState) => void;
  } = $props();

  const metadata = $derived(workspace?.opf?.metadata);
  const currentTitle = $derived(metadata?.title ?? '');
  const currentAuthor = $derived(metadata?.creator?.[0]?.name ?? '');

  // The persisted choice; before any cover is generated, the title seeds the hue.
  const storedHue = $derived(coverSettings?.hue ?? null);
  const storedMode: CoverMode = $derived(coverSettings?.mode ?? 'dark');
  const storedTitle = $derived(coverSettings?.title ?? null);
  const storedAuthor = $derived(coverSettings?.author ?? null);

  // Unsaved tweaks; null means "the stored value".
  let draftHue = $state<number | null>(null);
  let draftMode = $state<CoverMode | null>(null);
  const titleSeedHue = $derived(titleHue(currentTitle));
  const effectiveHue = $derived(draftHue ?? storedHue ?? titleSeedHue);
  const effectiveMode: CoverMode = $derived(draftMode ?? storedMode);
  const hasDraft = $derived(
    effectiveHue !== (storedHue ?? titleSeedHue) || effectiveMode !== storedMode
  );
  const textDrift = $derived(
    (storedTitle !== null && currentTitle !== storedTitle) ||
      (storedAuthor !== null && currentAuthor !== storedAuthor)
  );
  const isDirty = $derived(hasDraft || textDrift);

  const coverItem = $derived(
    workspace?.opf?.manifest?.find(m => m.properties?.includes('cover-image')) ?? null
  );
  const hasCover = $derived(coverItem !== null);
  // A cover the generator made (a PNG with a stem-matched SVG) can be updated in
  // place; any other image is the author's own.
  const generatedCover = $derived(
    !!coverItem &&
      coverItem.mediaType === 'image/png' &&
      !!workspace.opf.manifest.some(m => m.href === coverItem.href.replace(/\.[^.]+$/, '.svg'))
  );

  const prospectiveUrl = $derived.by(() => {
    const svg = generateCoverSvg(currentTitle, currentAuthor, effectiveHue, effectiveMode);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  // The stored cover as a blob URL; reloaded after an in-place update.
  let coverUrl = $state<string | null>(null);
  let coverVersion = $state(0);
  $effect(() => {
    void coverVersion;
    const ws = workspace;
    const item = coverItem;
    if (!ws || !item) {
      coverUrl = null;
      return;
    }
    let stale = false;
    let url: string | null = null;
    const fullPath = ws.pathInfo.basePath ? `${ws.pathInfo.basePath}/${item.href}` : item.href;
    workspaceService
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

  // What the big picture shows: the proposal while anything differs, else the stored cover.
  const shownUrl = $derived(!hasCover || isDirty ? prospectiveUrl : coverUrl);

  let generating = $state(false);
  let importing = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  function resetCover() {
    draftHue = null;
    draftMode = null;
  }

  async function handleGenerate() {
    if (generating || !onGenerateCover) return;
    const wasUpdate = hasCover;
    generating = true;
    try {
      await onGenerateCover(effectiveHue, effectiveMode);
      resetCover();
      coverVersion++;
      showToast(wasUpdate ? $t('Cover image updated') : $t('Cover image generated'), 'success');
    } finally {
      generating = false;
    }
  }

  // An image of the author's own: imported into the manifest and marked as the
  // cover; any previous cover-image mark is cleared.
  async function handleOwnImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || importing || readOnly) return;
    importing = true;
    try {
      const mediaType = reliableMediaType(file);
      const imported = await importFileToManifest(workspace, workspaceService, file, mediaType);
      let ws = imported.workspace;
      const added = ws.opf.manifest.find(m => m.href === imported.href);
      for (const item of ws.opf.manifest) {
        if (item.properties?.includes('cover-image') && item.id !== added?.id) {
          ws = await workspaceService.updateManifestItem(ws, item.id, {
            properties: item.properties.filter(p => p !== 'cover-image'),
          });
        }
      }
      if (added) {
        ws = await workspaceService.updateManifestItem(ws, added.id, {
          properties: [...(added.properties ?? []), 'cover-image'],
        });
      }
      onWorkspaceUpdate?.(ws);
      coverVersion++;
      showToast($t('Cover image updated'), 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : $t('Failed to import file'), 'error');
    } finally {
      importing = false;
    }
  }
</script>

<div class="cover-view">
  <div class="cover-main">
    <h1 class="title">{$t('Cover')}</h1>

    <div class="stage">
      <div class="big">
        <BookCover title={currentTitle || $t('Untitled')} coverUrl={shownUrl} />
      </div>

      <div class="controls">
        {#if generatedCover || !hasCover}
          <div class="field">
            <span class="label" id="cover-text-label">{$t('Text')}</span>
            <div class="seg" role="group" aria-labelledby="cover-text-label">
              {#each ['dark', 'light'] as const as m (m)}
                <button
                  type="button"
                  class="seg-option"
                  class:active={effectiveMode === m}
                  style="background: {coverBackgroundColor(
                    effectiveHue,
                    m
                  )}; color: {coverTextColor(m)}"
                  aria-pressed={effectiveMode === m}
                  onclick={() => (draftMode = m)}
                  disabled={generating || readOnly}
                >
                  {m === 'dark' ? $t('Light on dark') : $t('Dark on light')}
                </button>
              {/each}
            </div>
          </div>

          <div class="field">
            <span class="label">{$t('Colour')}</span>
            <HueSelector
              value={effectiveHue}
              disabled={generating || readOnly}
              showSwatch={false}
              mode={effectiveMode}
              onInput={h => (draftHue = h)}
            />
          </div>

          <p class="from">
            <strong>{currentTitle || $t('Untitled')}</strong>
            {#if currentAuthor}· <strong>{currentAuthor}</strong>{/if}
            <span class="muted">— {$t('Details')}</span>
          </p>

          <div class="actions">
            <button
              type="button"
              class="btn btn-primary"
              disabled={generating || readOnly || !onGenerateCover}
              onclick={handleGenerate}
            >
              {#if generating}
                {hasCover ? $t('Updating…') : $t('Generating…')}
              {:else}
                {hasCover ? $t('Update cover') : $t('Generate cover')}
              {/if}
            </button>
            {#if hasDraft}
              <button
                type="button"
                class="btn btn-secondary"
                disabled={generating}
                onclick={resetCover}
              >
                {$t('Reset')}
              </button>
            {/if}
          </div>
        {:else}
          <p class="from"><span class="muted">{$t('Your own image')}</span> · {coverItem?.href}</p>
        {/if}

        {#if !readOnly}
          <div class="own">
            <button
              type="button"
              class="btn btn-link"
              disabled={importing}
              onclick={() => fileInput?.click()}
            >
              {importing ? $t('Importing…') : $t('Use my own image…')}
            </button>
            <input
              bind:this={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
              class="sr-only"
              aria-label={$t('Use my own image…')}
              onchange={handleOwnImage}
            />
          </div>
        {/if}
      </div>
    </div>
  </div>

  <aside class="cover-aside" aria-label={$t('Cover')}>
    <p class="label">{$t('On the shelf')}</p>
    <div class="shelf-row">
      <div class="shelf-cover"><BookCover title={currentTitle} coverUrl={shownUrl} /></div>
    </div>
    <p class="label">{$t('In a reading app')}</p>
    <div class="list">
      <div class="row">
        <BookCover title={currentTitle} coverUrl={shownUrl} size="thumb" />
        <span class="row-text">
          <strong>{currentTitle || $t('Untitled')}</strong>
          {#if currentAuthor}<span class="muted">{currentAuthor}</span>{/if}
        </span>
      </div>
    </div>
  </aside>
</div>

<style>
  .cover-view {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    min-block-size: 100%;
    background: var(--color-bg-primary);
  }

  .cover-main {
    padding-block: var(--space-6);
    padding-inline: var(--space-8);
    border-inline-end: 1px solid var(--color-border-default);
  }

  .title {
    margin: 0 0 var(--space-5);
    font-size: var(--text-3xl);
    font-weight: var(--font-bold);
  }

  .stage {
    display: flex;
    gap: var(--space-8);
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .big {
    inline-size: 300px;
    flex-shrink: 0;
  }

  .controls {
    flex: 1;
    min-inline-size: 240px;
    padding-block-start: var(--space-2);
  }

  .field {
    margin-block-end: var(--space-5);
  }

  .label {
    display: block;
    margin-block-end: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .seg {
    display: inline-flex;
    gap: var(--space-2);
  }

  .seg-option {
    padding-block: var(--space-2);
    padding-inline: var(--space-3);
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: var(--text-base);
    cursor: pointer;
  }

  .seg-option.active {
    border-color: var(--color-interactive-primary);
  }

  .seg-option:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .seg-option:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .from {
    margin: 0 0 var(--space-5);
    color: var(--color-text-primary);
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .own {
    margin-block-start: var(--space-4);
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .cover-aside {
    padding-block: var(--space-6);
    padding-inline: var(--space-8);
    background: var(--color-bg-tertiary);
  }

  .shelf-row {
    margin-block-end: var(--space-6);
  }

  .shelf-cover {
    inline-size: 120px;
  }

  .list {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
  }

  .row {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    padding-block: var(--space-2);
    padding-inline: var(--space-3);
  }

  .row-text {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  @media (max-width: 900px) {
    .cover-view {
      grid-template-columns: 1fr;
    }

    .cover-main {
      border-inline-end: 0;
      border-block-end: 1px solid var(--color-border-default);
    }
  }
</style>
