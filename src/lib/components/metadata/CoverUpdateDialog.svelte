<script lang="ts">
  import { t } from '../../i18n';

  let {
    currentUrl,
    incomingUrl,
    onConfirm,
    onCancel,
  }: {
    /** Blob/data URL of the cover currently stored in the EPUB. */
    currentUrl: string;
    /** Data URL of the prospective cover the user is about to write. */
    incomingUrl: string;
    /** Commit the new cover. The parent closes the dialog. */
    onConfirm: () => Promise<void> | void;
    onCancel: () => void;
  } = $props();

  let saving = $state(false);

  async function confirm() {
    if (saving) return;
    saving = true;
    try {
      await onConfirm();
      // On success the parent writes the cover and unmounts this dialog.
    } finally {
      saving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onCancel();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="cover-backdrop" onclick={onCancel} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="cover-dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="cover-update-title"
    onclick={event => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <header class="cover-dialog-header">
      <h2 id="cover-update-title">{$t('Update cover image')}</h2>
      <p class="cover-dialog-subtitle">
        {$t('Replace the current cover with the new one?')}
      </p>
    </header>

    <div class="cover-image-pair">
      <figure>
        <figcaption>{$t('Current')}</figcaption>
        <img src={currentUrl} alt={$t('Current')} />
      </figure>
      <figure>
        <figcaption>{$t('Incoming')}</figcaption>
        <img src={incomingUrl} alt={$t('Incoming')} />
      </figure>
    </div>

    <footer class="cover-dialog-footer">
      <button type="button" class="btn btn-secondary" onclick={onCancel} disabled={saving}>
        {$t('Cancel')}
      </button>
      <button type="button" class="btn btn-primary" onclick={confirm} disabled={saving}>
        {saving ? $t('Updating…') : $t('Update cover')}
      </button>
    </footer>
  </div>
</div>

<style>
  .cover-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: rgb(0 0 0 / 0.5);
  }

  .cover-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    inline-size: min(40rem, 100%);
    max-block-size: 90vh;
    padding: var(--space-5);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg);
  }

  .cover-dialog-header h2 {
    margin: 0;
    font-size: var(--text-lg);
  }

  .cover-dialog-subtitle {
    margin-block: var(--space-1) 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .cover-image-pair {
    display: flex;
    gap: var(--space-4);
    padding: var(--space-3);
  }

  .cover-image-pair figure {
    margin: 0;
    flex: 1;
    text-align: center;
  }

  .cover-image-pair figcaption {
    margin-block-end: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .cover-image-pair img {
    max-inline-size: 100%;
    max-block-size: 16rem;
    object-fit: contain;
    border: 1px solid var(--color-border-subtle, var(--color-border-default));
  }

  .cover-dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
