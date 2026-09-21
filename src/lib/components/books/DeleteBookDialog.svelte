<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import BookCover from './BookCover.svelte';

  let {
    title,
    author,
    chapterCount,
    coverUrl,
    onConfirm,
    onClose,
  }: {
    title: string;
    author?: string;
    chapterCount?: number;
    coverUrl: string | null;
    onConfirm: () => Promise<void>;
    onClose: () => void;
  } = $props();

  let deleting = $state(false);
  let error = $state<string | null>(null);
  let cancelButton = $state<HTMLButtonElement | null>(null);

  onMount(() => {
    cancelButton?.focus();
  });

  // Second summary line: author and chapter count, joined with ' · ', either of
  // which may be absent. Built as an array filter+join rather than a composed
  // string fragment.
  const metaLine = $derived.by(() => {
    const parts = [
      author,
      chapterCount !== undefined ? $t('{count} chapters', { count: chapterCount }) : undefined,
    ].filter((part): part is string => Boolean(part));
    return parts.join(' · ');
  });

  async function confirmDelete() {
    if (deleting) return;
    deleting = true;
    error = null;
    try {
      await onConfirm();
      // On success the parent removes the book and this dialog unmounts.
    } catch (e) {
      error = e instanceof Error ? e.message : $t('Failed to delete book.');
      deleting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="delete-book-backdrop"
  onclick={onClose}
  onkeydown={handleBackdropKeydown}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="delete-book-dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="delete-book-dialog-title"
    onclick={event => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <h2 id="delete-book-dialog-title">{$t('Delete this book?')}</h2>

    <div class="delete-book-summary">
      <BookCover {title} {coverUrl} size="thumb" />
      <div class="delete-book-info">
        <p class="delete-book-title">{title}</p>
        {#if metaLine}
          <p class="delete-book-meta">{metaLine}</p>
        {/if}
      </div>
    </div>

    <p class="delete-book-note">
      {$t('It is removed from this browser. Packaged EPUBs you downloaded are unaffected.')}
    </p>

    {#if error}
      <p class="delete-book-error" role="alert">{error}</p>
    {/if}

    <footer class="delete-book-footer">
      <button
        bind:this={cancelButton}
        type="button"
        class="btn btn-secondary"
        onclick={onClose}
        disabled={deleting}
      >
        {$t('Cancel')}
      </button>
      <button type="button" class="btn btn-danger" onclick={confirmDelete} disabled={deleting}>
        {deleting ? $t('Deleting…') : $t('Delete')}
      </button>
    </footer>
  </div>
</div>

<style>
  .delete-book-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: rgb(0 0 0 / 0.5);
  }

  .delete-book-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    inline-size: min(26rem, 100%);
    padding: var(--space-5);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg);
  }

  .delete-book-dialog h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
  }

  .delete-book-summary {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .delete-book-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .delete-book-title {
    margin: 0;
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
    overflow-wrap: break-word;
  }

  .delete-book-meta {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .delete-book-note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .delete-book-error {
    margin: 0;
    color: var(--color-error-text);
    font-size: var(--text-sm);
  }

  .delete-book-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
