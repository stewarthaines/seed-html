<script lang="ts">
  import { t } from '../../i18n';
  import { titleHue, generateCoverSvg, type CoverMode } from '../../epub/cover-generator';
  import type {
    WorkspaceState,
    WorkspaceService,
  } from '../../services/workspace/workspace.service.js';
  import type { EPUBMetadata } from '../../epub/opf-utils.js';
  import { manifestHrefToPath } from '../../epub/path-utils.js';

  interface Props {
    workspace: WorkspaceState;
    focusedField?: keyof EPUBMetadata | null;
    readOnly?: boolean;
    workspaceService?: WorkspaceService;
    /** Persisted cover hue/mode + the title/author the cover was last generated with —
        drives the before/after preview when the title or author has changed. The
        generator's controls live on the Cover screen. */
    coverSettings?: { hue?: number; mode?: CoverMode; title?: string; author?: string };
    /** Kept for the caller's sake; the Cover screen generates covers now. */
    onGenerateCover?: (hue?: number, mode?: CoverMode) => Promise<void>;
    // When embedded under an external tab strip (advanced mode), hide the built-in
    // "Metadata Summary" header so it isn't doubled up.
    showHeader?: boolean;
  }

  let {
    workspace,
    focusedField = null,
    workspaceService,
    coverSettings,
    showHeader = true,
  }: Props = $props();

  let metadata = $derived(workspace?.opf?.metadata);

  const currentTitle = $derived(metadata?.title ?? '');
  const currentAuthor = $derived(metadata?.creator?.[0]?.name ?? '');

  // The persisted cover choice (source of truth once a cover has been committed).
  // Null hue → no choice stored yet, so we fall back to the title-derived hue.
  const storedHue = $derived(coverSettings?.hue ?? null);
  const storedMode: CoverMode = $derived(coverSettings?.mode ?? 'dark');
  // Title/author the saved cover was rendered with (null = unknown / legacy cover).
  const storedTitle = $derived(coverSettings?.title ?? null);
  const storedAuthor = $derived(coverSettings?.author ?? null);

  // Once a hue is stored, the title no longer feeds the colour.
  const titleSeedHue = $derived(titleHue(currentTitle));
  const effectiveHue = $derived(storedHue ?? titleSeedHue);
  const effectiveMode: CoverMode = $derived(storedMode);

  // The title/author have drifted from the saved cover (only knowable once
  // persisted) — drives the before/after in the preview.
  const isDirty = $derived(
    (storedTitle !== null && currentTitle !== storedTitle) ||
      (storedAuthor !== null && currentAuthor !== storedAuthor)
  );

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
    const fullPath = manifestHrefToPath(ws.pathInfo.basePath, item.href);
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

  /* Light/dark toggle: two "Aa" chips previewing each theme at the current hue. */

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
