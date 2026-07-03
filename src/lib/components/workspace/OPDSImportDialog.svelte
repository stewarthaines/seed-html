<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import { parseOpdsFeed, type OpdsBook } from '../../opds/parse-opds-feed.js';
  import {
    loadSavedFeeds,
    upsertSavedFeed,
    removeSavedFeed,
    loadSelectedFeedUrl,
    saveSelectedFeedUrl,
    DEFAULT_CATALOG_FEEDS,
    isBuiltinFeed,
    type SavedFeed,
  } from '../../opds/saved-feeds.js';
  import { X } from 'phosphor-svelte';

  let {
    onImport,
    onClose,
    advancedMode = false,
  }: {
    onImport: (sourceUrl: string) => Promise<void>;
    onClose: () => void;
    /** Advanced mode reveals the free-form catalog URL + Fetch; basic mode is
        limited to the built-in/saved feeds in the dropdown. */
    advancedMode?: boolean;
  } = $props();

  let url = $state('');
  let books = $state<OpdsBook[]>([]);
  let savedFeeds = $state<SavedFeed[]>([]);
  let loading = $state(false);
  let importing = $state(false);
  let hasFetched = $state(false);
  let error = $state<string | null>(null);

  let urlInput = $state<HTMLInputElement | null>(null);

  // A feed can be removed only if it's one of the user's own saved feeds — never
  // the pinned built-in catalogs, even if an old copy lingers in localStorage.
  const canRemove = $derived(!isBuiltinFeed(url) && savedFeeds.some(f => f.url === url.trim()));

  // The dropdown always leads with the built-in catalogs (pinned, not removable),
  // followed by the user's own saved feeds (most-recent first, deduped).
  const displayFeeds = $derived([
    ...DEFAULT_CATALOG_FEEDS,
    ...savedFeeds.filter(f => !isBuiltinFeed(f.url)),
  ]);

  onMount(() => {
    savedFeeds = loadSavedFeeds();
    // Re-open on the feed the user last loaded (sticky across opens), as long as it's
    // still available. Otherwise fall back to the most recent saved feed, then the
    // built-in catalog.
    const remembered = loadSelectedFeedUrl();
    const defaultUrl = DEFAULT_CATALOG_FEEDS[0].url;
    const available = new Set([
      ...DEFAULT_CATALOG_FEEDS.map(f => f.url),
      ...savedFeeds.map(f => f.url),
    ]);
    url = remembered && available.has(remembered) ? remembered : defaultUrl;
    urlInput?.focus();
    // Auto-fetch the latest feed so the dialog opens already populated.
    if (url.trim()) fetchFeed();
  });

  // Load the feed picked from the saved-feeds dropdown.
  function handleSavedSelect() {
    if (url.trim()) fetchFeed();
  }

  function removeSelected() {
    savedFeeds = removeSavedFeed(url.trim());
  }

  async function fetchFeed() {
    const target = url.trim();
    if (!target || loading) return;

    loading = true;
    error = null;
    books = [];
    hasFetched = false;

    try {
      // Bypass the HTTP cache so the dialog always reflects the live catalog — a
      // freshly-published EPUB should show up the moment the feed is opened, not a
      // stale copy the browser cached from a previous fetch.
      const response = await fetch(target, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const xml = await response.text();
      const feed = parseOpdsFeed(xml, target);
      books = feed.books;
      hasFetched = true;

      // Remember this as the selected feed so the dialog re-opens on it next time.
      saveSelectedFeedUrl(target);

      // Auto-remember this feed (most-recent first), labelled by its title.
      // The built-in catalogs are pinned separately, so they're never stored —
      // which also keeps their fixed labels and disables their Remove button.
      if (!isBuiltinFeed(target)) {
        savedFeeds = upsertSavedFeed(target, feed.title);
      }
    } catch (e) {
      error =
        e instanceof Error
          ? $t(
              'Could not load the feed: {error}. The server may not allow cross-origin requests.',
              {
                error: e.message,
              }
            )
          : $t('Could not load the feed.');
    } finally {
      loading = false;
    }
  }

  async function selectBook(book: OpdsBook) {
    if (importing) return;
    importing = true;
    error = null;
    try {
      await onImport(book.href);
      // On success the app navigates into the new workspace and this dialog
      // unmounts; nothing more to do here.
    } catch (e) {
      error = e instanceof Error ? e.message : $t('Failed to import the selected book.');
      importing = false;
    }
  }

  function handleUrlKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      fetchFeed();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  // Format an OPDS atom:updated / dc:issued timestamp as a short local date.
  // Returns null for missing/unparseable values so the field is simply omitted.
  function formatDate(value?: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="opds-backdrop" onclick={onClose} onkeydown={handleBackdropKeydown} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="opds-dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="opds-dialog-title"
    onclick={event => event.stopPropagation()}
  >
    <header class="opds-header">
      <h2 id="opds-dialog-title">{$t('Import from Catalog')}</h2>
      <button type="button" class="btn btn-icon" onclick={onClose} aria-label={$t('Close')}
        ><X size={16} aria-hidden="true" /></button
      >
    </header>

    <div class="opds-saved-row">
      <select
        class="opds-saved-select"
        bind:value={url}
        onchange={handleSavedSelect}
        aria-label={$t('Saved feeds')}
        disabled={loading || importing}
      >
        <option value="" disabled>{$t('Saved feeds…')}</option>
        {#each displayFeeds as feed (feed.url)}
          <option value={feed.url}>{feed.title ?? feed.url}</option>
        {/each}
      </select>
      {#if canRemove}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={removeSelected}
          disabled={loading || importing}
          aria-label={$t('Remove the selected feed from the list')}
        >
          {$t('Remove')}
        </button>
      {/if}
    </div>

    <!-- Advanced mode only: fetch an arbitrary catalog URL. Basic mode sticks to
         the built-in/saved feeds in the dropdown above. -->
    {#if advancedMode}
      <div class="opds-url-row">
        <input
          bind:this={urlInput}
          bind:value={url}
          type="url"
          class="opds-url-input"
          placeholder={$t('https://example.com/catalog.xml')}
          aria-label={$t('Catalog URL')}
          onkeydown={handleUrlKeydown}
          disabled={loading || importing}
        />
        <button
          type="button"
          class="btn btn-primary"
          onclick={fetchFeed}
          disabled={!url.trim() || loading || importing}
        >
          {loading ? $t('Loading…') : $t('Fetch')}
        </button>
      </div>
    {/if}

    {#if error}
      <p class="opds-error" role="alert">{error}</p>
    {/if}

    {#if hasFetched && books.length === 0 && !error}
      <p class="opds-empty">{$t('No EPUBs found in this feed.')}</p>
    {/if}

    {#if books.length > 0}
      <ul class="opds-grid">
        {#each books as book (book.href)}
          <li>
            <button
              type="button"
              class="opds-card"
              onclick={() => selectBook(book)}
              disabled={importing}
            >
              <span class="opds-card-cover" aria-hidden="true">
                {#if book.thumbnailHref}
                  <img
                    src={book.thumbnailHref}
                    alt=""
                    loading="lazy"
                    onerror={e => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                  />
                {/if}
              </span>
              <span class="opds-card-body">
                <span class="opds-card-title">{book.title}</span>
                {#if book.author}
                  <span class="opds-card-author">{book.author}</span>
                {/if}
                {#if formatDate(book.updated)}
                  <span class="opds-card-date">{formatDate(book.updated)}</span>
                {/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if importing}
      <p class="opds-importing">{$t('Importing…')}</p>
    {/if}
  </div>
</div>

<style>
  .opds-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: rgb(0 0 0 / 0.5);
  }

  .opds-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    inline-size: min(46rem, 100%);
    max-block-size: 80vh;
    /* The header and feed controls stay put; only the results grid scrolls. */
    overflow: hidden;
    padding: var(--space-5);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg);
  }

  .opds-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .opds-header h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .opds-saved-row {
    display: flex;
    gap: var(--space-2);
  }

  .opds-saved-select {
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--text-sm);
  }

  .opds-url-row {
    display: flex;
    gap: var(--space-2);
  }

  .opds-url-input {
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--text-sm);
  }

  .opds-error {
    margin: 0;
    color: var(--color-error-text, var(--color-text-primary));
    font-size: var(--text-sm);
  }

  .opds-empty,
  .opds-importing {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  /* Results grid: ~3 cards per row in the dialog's width, reflowing as it narrows.
     It's the scroll container (min-block-size: 0 lets it shrink within the flex
     column so it scrolls instead of growing the dialog past its max height). */
  .opds-grid {
    list-style: none;
    margin: 0;
    padding: var(--space-1);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: var(--space-3);
    overflow-y: auto;
    min-block-size: 0;
  }

  .opds-grid li {
    display: flex;
  }

  .opds-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    inline-size: 100%;
    text-align: left;
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .opds-card:not(:disabled):hover {
    border-color: var(--color-border-hover);
    background-color: var(--color-surface-hover);
  }

  .opds-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Fixed-ratio cover area: a muted box (shown when no/broken image) that any
     thumbnail fills, so every card is the same height. */
  .opds-card-cover {
    position: relative;
    display: block;
    inline-size: 100%;
    aspect-ratio: 2 / 3;
    background-color: var(--color-surface-secondary);
    border-radius: var(--radius-xs);
    overflow: hidden;
  }

  .opds-card-cover img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .opds-card-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-inline-size: 0;
  }

  .opds-card-title {
    font-weight: 600;
    font-size: var(--text-sm);
  }

  .opds-card-author,
  .opds-card-date {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }
</style>
