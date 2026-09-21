<script lang="ts">
  import { t } from '../../i18n';
  import BookCover from './BookCover.svelte';
  import BookMenu from './BookMenu.svelte';

  interface Book {
    id: string;
    title: string;
    author?: string;
    lastModified: Date;
    coverUrl: string | null;
    readOnly?: boolean;
    hasError?: boolean;
  }

  let {
    books,
    currentBookId,
    isLoading,
    onOpen,
    onDuplicate,
    onDelete,
  }: {
    books: Book[];
    currentBookId: string | null;
    isLoading: boolean;
    onOpen: (id: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
  } = $props();

  // Copied verbatim from WorkspaceItem.svelte's getRelativeTime so no new
  // translations are needed for these relative-time strings.
  function getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      return $t('Just now');
    } else if (hours < 24) {
      return $t('{count}h ago', { count: hours });
    } else if (days === 1) {
      return $t('1 day ago');
    } else if (days < 7) {
      return $t('{count} days ago', { count: days });
    } else {
      return $t('{count}w ago', { count: Math.floor(days / 7) });
    }
  }

  // Author and relative time, joined with ' · '; author is omitted when absent.
  function secondaryLine(book: Book): string {
    return [book.author, getRelativeTime(book.lastModified)]
      .filter((part): part is string => Boolean(part))
      .join(' · ');
  }

  function menuItems(): { id: string; label: string; danger?: boolean }[] {
    return [
      { id: 'open', label: $t('Open') },
      { id: 'duplicate', label: $t('Duplicate') },
      { id: 'delete', label: $t('Delete…'), danger: true },
    ];
  }

  function handleMenuSelect(bookId: string, actionId: string) {
    if (actionId === 'open') onOpen(bookId);
    else if (actionId === 'duplicate') onDuplicate(bookId);
    else if (actionId === 'delete') onDelete(bookId);
  }
</script>

<p class="label">{$t('Your books')}</p>

{#if isLoading}
  <div class="books-grid">
    {#each [0, 1, 2, 3] as skeletonIndex (skeletonIndex)}
      <div class="book-skeleton"></div>
    {/each}
  </div>
{:else if books.length === 0}
  <p class="books-empty">{$t('No books yet.')}</p>
{:else}
  <div class="books-grid">
    {#each books as book (book.id)}
      <article class="book">
        <button
          type="button"
          class="book-open"
          class:current={book.id === currentBookId}
          onclick={() => onOpen(book.id)}
          aria-label={$t('Open {title}', { title: book.title })}
        >
          <BookCover title={book.title} coverUrl={book.coverUrl} />
        </button>

        <div class="book-row">
          <p class="book-title">{book.title}</p>
          <BookMenu
            label={$t('More actions for {title}', { title: book.title })}
            items={menuItems()}
            onSelect={actionId => handleMenuSelect(book.id, actionId)}
            visible={book.id === currentBookId}
          />
        </div>

        <p class="book-secondary">
          <span>{secondaryLine(book)}</span>
          {#if book.readOnly}
            <span class="book-tag">{$t('Read-only')}</span>
          {/if}
          {#if book.hasError}
            <span class="book-error">{$t('Error')}</span>
          {/if}
        </p>
      </article>
    {/each}
  </div>
{/if}

<style>
  .label {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .books-empty {
    margin: 0;
    padding-block-start: var(--space-4);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .books-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-8) var(--space-8);
    border-block-start: 1px solid var(--color-border-subtle);
    padding-block-start: var(--space-6);
  }

  @media (max-width: 1100px) {
    .books-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 800px) {
    .books-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .books-grid {
      grid-template-columns: 1fr;
    }
  }

  .book-skeleton {
    aspect-ratio: 2 / 3;
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-sm);
  }

  .book {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .book-open {
    display: block;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .book-open.current {
    outline: 3px solid var(--color-interactive-primary);
    outline-offset: 3px;
  }

  .book-open:focus-visible {
    outline: 3px solid var(--color-focus-ring);
    outline-offset: 3px;
  }

  .book-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .book-title {
    margin: 0;
    min-width: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .book-secondary {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .book-tag {
    padding-inline: var(--space-1);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-xs);
    color: var(--color-text-secondary);
  }

  .book-error {
    color: var(--color-error-text);
  }

  /* Reveal a book's menu trigger when its card is hovered or has focus within,
     even when it isn't the current book (BookMenu itself keeps the trigger
     visible unconditionally for the current book via its `visible` prop). */
  :global(.book:hover .book-menu .book-menu-trigger),
  :global(.book:focus-within .book-menu .book-menu-trigger) {
    opacity: 1;
    pointer-events: auto;
  }
</style>
