<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import { parseOpdsFeed, type OpdsBook } from '../../opds/parse-opds-feed.js';
  import {
    loadSavedFeeds,
    upsertSavedFeed,
    removeSavedFeed,
    DEFAULT_CATALOG_FEED,
    type SavedFeed,
  } from '../../opds/saved-feeds.js';

  let {
    onImport,
    onClose,
  }: {
    onImport: (sourceUrl: string) => Promise<void>;
    onClose: () => void;
  } = $props();

  let url = $state('');
  let books = $state<OpdsBook[]>([]);
  let savedFeeds = $state<SavedFeed[]>([]);
  let loading = $state(false);
  let importing = $state(false);
  let hasFetched = $state(false);
  let error = $state<string | null>(null);

  let urlInput = $state<HTMLInputElement | null>(null);

  const isSaved = $derived(savedFeeds.some(f => f.url === url.trim()));

  // The dropdown always leads with the built-in catalog (pinned, not removable),
  // followed by the user's own saved feeds (most-recent first, deduped).
  const displayFeeds = $derived([
    DEFAULT_CATALOG_FEED,
    ...savedFeeds.filter(f => f.url !== DEFAULT_CATALOG_FEED.url),
  ]);

  onMount(() => {
    savedFeeds = loadSavedFeeds();
    // Default to the most recently used feed, falling back to the built-in
    // catalog when the user hasn't saved any of their own yet.
    url = savedFeeds[0]?.url ?? DEFAULT_CATALOG_FEED.url;
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
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const xml = await response.text();
      const feed = parseOpdsFeed(xml, target);
      books = feed.books;
      hasFetched = true;

      // Auto-remember this feed (most-recent first), labelled by its title.
      // The built-in catalog is pinned separately, so it's never stored.
      if (target !== DEFAULT_CATALOG_FEED.url) {
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
      <button type="button" class="opds-close" onclick={onClose} aria-label={$t('Close')}>✕</button>
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
      <button
        type="button"
        class="opds-remove-btn"
        onclick={removeSelected}
        disabled={!isSaved || loading || importing}
        aria-label={$t('Remove the selected feed from the list')}
      >
        {$t('Remove')}
      </button>
    </div>

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
        class="opds-fetch-btn"
        onclick={fetchFeed}
        disabled={!url.trim() || loading || importing}
      >
        {loading ? $t('Loading…') : $t('Fetch')}
      </button>
    </div>

    {#if error}
      <p class="opds-error" role="alert">{error}</p>
    {/if}

    {#if hasFetched && books.length === 0 && !error}
      <p class="opds-empty">{$t('No EPUBs found in this feed.')}</p>
    {/if}

    {#if books.length > 0}
      <ul class="opds-list">
        {#each books as book (book.href)}
          <li>
            <button
              type="button"
              class="opds-book"
              onclick={() => selectBook(book)}
              disabled={importing}
            >
              {#if book.thumbnailHref}
                <img
                  src={book.thumbnailHref}
                  alt=""
                  class="opds-book-cover"
                  aria-hidden="true"
                  onerror={e => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                />
              {/if}
              <span class="opds-book-text">
                <span class="opds-book-title">{book.title}</span>
                {#if book.author}
                  <span class="opds-book-meta">{book.author}</span>
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
    inline-size: min(34rem, 100%);
    max-block-size: 80vh;
    overflow: hidden auto;
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

  .opds-close {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    font-size: var(--text-lg);
    cursor: pointer;
    line-height: 1;
    padding: var(--space-1);
    border-radius: var(--radius-xs);
  }

  .opds-close:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
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

  .opds-remove-btn {
    flex: 0 0 auto;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-primary);
    color: var(--color-text-secondary);
    font-family: inherit;
    cursor: pointer;
  }

  .opds-remove-btn:not(:disabled):hover {
    border-color: var(--color-border-hover);
    background-color: var(--color-surface-hover);
    color: var(--color-text-primary);
  }

  .opds-remove-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  .opds-fetch-btn {
    flex: 0 0 auto;
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background-color: var(--color-primary);
    color: var(--color-surface);
    font-family: inherit;
    cursor: pointer;
  }

  .opds-fetch-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  .opds-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .opds-book {
    display: flex;
    align-items: center;
    gap: var(--space-3);
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

  /* Cover thumbnail, matching the projects-list style. */
  .opds-book-cover {
    flex-shrink: 0;
    inline-size: 2rem;
    block-size: 3rem;
    object-fit: cover;
    border-radius: var(--radius-xs);
  }

  .opds-book-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-inline-size: 0;
  }

  .opds-book:not(:disabled):hover {
    border-color: var(--color-border-hover);
    background-color: var(--color-surface-hover);
  }

  .opds-book:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .opds-book-title {
    font-weight: 600;
    font-size: var(--text-sm);
  }

  .opds-book-meta {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }
</style>
