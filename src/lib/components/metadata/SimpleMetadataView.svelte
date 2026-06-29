<script lang="ts">
  import { t } from '../../i18n';
  import {
    titleHue,
    generateCoverSvg,
    coverBackgroundColor,
    coverTextColor,
    type CoverMode,
  } from '../../epub/cover-generator';
  import HueSelector from '../HueSelector.svelte';
  import { showToast } from '../../stores/toast.svelte.js';
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
    /** Persisted cover hue/mode + the title/author the cover was last generated with —
        seeds the controls and drives the live before/after preview. */
    coverSettings?: { hue?: number; mode?: CoverMode; title?: string; author?: string };
    onGenerateCover?: (hue?: number, mode?: CoverMode) => Promise<void>;
    // When embedded under an external tab strip (advanced mode), hide the built-in
    // "Metadata Summary" header so it isn't doubled up.
    showHeader?: boolean;
  }

  let {
    workspace,
    focusedField = null,
    readOnly = false,
    workspaceService,
    coverSettings,
    onGenerateCover,
    showHeader = true,
  }: Props = $props();

  let metadata = $derived(workspace?.opf?.metadata);
  let generating = $state(false);

  const currentTitle = $derived(metadata?.title ?? '');
  const currentAuthor = $derived(metadata?.creator?.[0]?.name ?? '');

  // The persisted cover choice (source of truth once a cover has been committed).
  // Null hue → no choice stored yet, so we fall back to the title-derived hue.
  const storedHue = $derived(coverSettings?.hue ?? null);
  const storedMode: CoverMode = $derived(coverSettings?.mode ?? 'dark');
  // Title/author the saved cover was rendered with (null = unknown / legacy cover).
  const storedTitle = $derived(coverSettings?.title ?? null);
  const storedAuthor = $derived(coverSettings?.author ?? null);

  // Unsaved in-editor tweaks. Null = "use the stored value". Cleared on commit
  // (and via Reset), so the controls can diverge from settings until committed.
  let draftHue = $state<number | null>(null);
  let draftMode = $state<CoverMode | null>(null);

  // The hue/mode the controls and preview currently reflect. Once a hue is stored,
  // the title no longer feeds the colour — fixing the "jumps with the title" issue.
  const titleSeedHue = $derived(titleHue(currentTitle));
  const effectiveHue = $derived(draftHue ?? storedHue ?? titleSeedHue);
  const effectiveMode: CoverMode = $derived(draftMode ?? storedMode);

  // An unsaved hue/mode tweak — drives the Reset button (Reset can't undo a title edit).
  const hasDraft = $derived(
    effectiveHue !== (storedHue ?? titleSeedHue) || effectiveMode !== storedMode
  );
  // The title/author have drifted from the saved cover (only knowable once persisted).
  const textDrift = $derived(
    (storedTitle !== null && currentTitle !== storedTitle) ||
      (storedAuthor !== null && currentAuthor !== storedAuthor)
  );
  // Anything that makes the proposed cover differ from the stored one — drives the
  // live before/after in the preview.
  const isDirty = $derived(hasDraft || textDrift);

  // Whether the project already has a cover-image — drives "Update" vs "Generate".
  const hasCover = $derived(
    !!workspace?.opf?.manifest?.some(m => m.properties?.includes('cover-image'))
  );

  // The prospective cover SVG (vector, instant) for the current title/author/hue/mode —
  // shown as the "New" image in the before/after preview.
  const prospectiveUrl = $derived.by(() => {
    const svg = generateCoverSvg(currentTitle, currentAuthor, effectiveHue, effectiveMode);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  function resetCover() {
    draftHue = null;
    draftMode = null;
  }

  // The current cover-image, loaded from storage as a blob URL. Re-runs whenever the
  // workspace changes (e.g. after Generate replaces appState.workspace) and whenever
  // coverVersion is bumped — needed when Update overwrites the cover in place (same
  // path/manifest item), where the file bytes change but nothing else might.
  let coverUrl = $state<string | null>(null);
  let coverVersion = $state(0);
  $effect(() => {
    void coverVersion; // re-read after an in-place cover overwrite
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

  // Save immediately — the before/after lives in the preview, so there's no confirm
  // step. The proposed rendering the user sees is exactly what gets written.
  async function handleGenerate() {
    if (generating || !onGenerateCover) return;
    const wasUpdate = hasCover;
    generating = true;
    try {
      await onGenerateCover(effectiveHue, effectiveMode);
      // The choice is now persisted — settle the controls on the stored values and
      // force the stored-cover blob to reload (the file was overwritten in place).
      resetCover();
      coverVersion++;
      showToast(
        wasUpdate ? $t('Cover image updated') : $t('Cover image generated'),
        'success'
      );
    } finally {
      generating = false;
    }
  }
</script>

<div class="simple-metadata-view">
  {#if showHeader}
    <div class="preview-header">
      <span class="file-name">{$t('Metadata Summary')}</span>
    </div>
  {/if}

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

      {#if hasCover && isDirty && coverUrl}
        <!-- Before/after: the stored cover vs the proposed rendering, live. -->
        <div class="cover-current">
          <div class="field-label">{$t('Cover')}</div>
          <div class="cover-compare">
            <figure>
              <figcaption>{$t('Current')}</figcaption>
              <img src={coverUrl} alt={$t('Current')} class="cover-image" />
            </figure>
            <figure>
              <figcaption>{$t('New')}</figcaption>
              <img src={prospectiveUrl} alt={$t('New')} class="cover-image" />
            </figure>
          </div>
        </div>
      {:else if hasCover ? coverUrl : prospectiveUrl}
        <div class="cover-current">
          <div class="field-label">{$t('Cover')}</div>
          <img
            src={hasCover ? coverUrl : prospectiveUrl}
            alt={$t('Current cover image')}
            class="cover-image"
          />
        </div>
      {/if}

      {#if onGenerateCover && !readOnly}
        <div class="cover-action">
          <div class="cover-theme" role="group" aria-label={$t('Cover text style')}>
            {#each ['dark', 'light'] as const as m (m)}
              <button
                type="button"
                class="cover-theme-option"
                class:active={effectiveMode === m}
                style="background: {coverBackgroundColor(effectiveHue, m)}; color: {coverTextColor(
                  m
                )}"
                aria-pressed={effectiveMode === m}
                title={m === 'dark'
                  ? $t('Light text on a dark cover')
                  : $t('Dark text on a light cover')}
                onclick={() => (draftMode = m)}
                disabled={generating}
              >
                Aa
              </button>
            {/each}
          </div>
          <HueSelector
            value={effectiveHue}
            disabled={generating}
            showSwatch={false}
            mode={effectiveMode}
            onInput={h => (draftHue = h)}
          />
          <div class="cover-buttons">
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
            {#if hasDraft}
              <button
                type="button"
                class="btn btn-link"
                disabled={generating}
                onclick={resetCover}
              >
                {$t('Reset')}
              </button>
            {/if}
          </div>
          <p class="cover-hint">
            {hasCover
              ? $t('Updates the cover with the colour and theme above.')
              : $t('Creates a cover with the colour and theme above.')}
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
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    /* Match the sidebar/pane header height + grey (see PaneHeader) so top bars align. */
    min-height: var(--touch-target-min);
    padding: 0 var(--space-3);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-default);
    box-sizing: border-box;
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

  .preview-body .field-row {
    gap: 0;
    padding: var(--space-1);
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

  /* Before/after: the stored cover beside the proposed rendering. */
  .cover-compare {
    align-self: stretch;
    display: flex;
    gap: var(--space-4);
  }

  .cover-compare figure {
    margin: 0;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .cover-compare figcaption {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .cover-compare .cover-image {
    max-width: 100%;
    max-height: 32vh;
  }

  .cover-action {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-block-start: var(--space-5);
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-border-default);
  }

  .cover-buttons {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* Light/dark toggle: two "Aa" chips previewing each theme at the current hue. */
  .cover-theme {
    display: flex;
    gap: var(--space-2);
  }

  .cover-theme-option {
    inline-size: 2.5rem;
    block-size: 2rem;
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: var(--text-base);
    cursor: pointer;
    transition: border-color var(--duration-fast) ease;
  }

  .cover-theme-option.active {
    border-color: var(--color-interactive-primary);
  }

  .cover-theme-option:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .cover-theme-option:disabled {
    cursor: not-allowed;
    opacity: 0.6;
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
