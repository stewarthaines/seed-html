<script lang="ts">
  import { t } from '../i18n.js';
  import { formatFileSize } from '../format.js';
  import type { ShelfBook } from '../remote-status.js';

  // The import confirm: cover when known, what happens, size and source.
  let {
    book,
    destinationName,
    busy = false,
    onCancel,
    onImport,
  }: {
    book: ShelfBook;
    destinationName: string;
    /** The download is under way. */
    busy?: boolean;
    onCancel: () => void;
    onImport: () => void;
  } = $props();

  let importButton = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    importButton?.focus();
  });
</script>

<div
  class="overlay"
  role="presentation"
  onclick={() => {
    if (!busy) onCancel();
  }}
>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-title"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    }}
  >
    <div class="cover-slot">
      {#if book.thumbnailUrl}
        <img src={book.thumbnailUrl} alt="" class="cover" />
      {:else}
        <div class="cover placeholder"><span>{book.key}</span></div>
      {/if}
    </div>
    <div class="body">
      <h2 id="import-title">{$t('Import {title}?', { title: book.title })}</h2>
      <p>
        {$t('It becomes a new book on this device. The copy on the destination stays as it is.')}
      </p>
      <small>
        {$t('{size} from {destination}', {
          size: formatFileSize(book.size),
          destination: destinationName,
        })}
      </small>
      <div class="buttons">
        <button type="button" class="btn btn-secondary" onclick={onCancel} disabled={busy}>
          {$t('Cancel')}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          bind:this={importButton}
          onclick={onImport}
          disabled={busy}
        >
          {busy ? $t('Downloading…') : $t('Import')}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.35);
  }

  .dialog {
    display: flex;
    gap: 20px;
    inline-size: min(100%, 560px);
    padding: 24px;
    border: 1px solid var(--color-border-strong);
    border-radius: 4px;
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  }

  .dialog:focus {
    outline: none;
  }

  .cover-slot {
    flex-shrink: 0;
  }

  .cover {
    display: block;
    inline-size: 96px;
    block-size: 144px;
    object-fit: cover;
    border: 1px solid var(--color-border-default);
    border-radius: 2px;
  }

  .cover.placeholder {
    display: flex;
    align-items: flex-end;
    padding: 8px;
    background: var(--color-surface-secondary);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 10px;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
  }

  small {
    color: var(--color-text-secondary);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-block-start: 8px;
  }

  @media (max-width: 480px) {
    .dialog {
      flex-direction: column;
    }
  }
</style>
