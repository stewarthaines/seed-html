<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { t } from '../i18n';
  import { X } from 'phosphor-svelte';

  let {
    currentId,
    linear: initialLinear,
    onSave,
    onClose,
  }: {
    /** The item's current id (idref), pre-filled into the field. */
    currentId: string;
    /** Current linear reading-order flag (checked = in the reading order). */
    linear: boolean;
    onSave: (next: { newId: string; linear: boolean }) => Promise<void>;
    onClose: () => void;
  } = $props();

  // The dialog is mounted fresh each time it opens, so these seed the fields once.
  let id = $state(untrack(() => currentId));
  let linear = $state(untrack(() => initialLinear));
  let saving = $state(false);
  let error = $state<string | null>(null);

  let idInput = $state<HTMLInputElement | null>(null);

  onMount(() => {
    idInput?.focus();
    idInput?.select();
  });

  async function save() {
    if (saving) return;
    const newId = id.trim();
    if (!newId) return;
    saving = true;
    error = null;
    try {
      await onSave({ newId, linear });
      // On success the parent reloads the list and unmounts this dialog.
    } catch (e) {
      error = e instanceof Error ? e.message : $t('Failed to update chapter.');
      saving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'Enter') save();
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="edit-backdrop" onclick={onClose} onkeydown={handleBackdropKeydown} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="edit-dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="edit-spine-title"
    onclick={event => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <header class="edit-header">
      <h2 id="edit-spine-title">{$t('Edit chapter')}</h2>
      <button type="button" class="btn btn-icon" onclick={onClose} aria-label={$t('Close')}
        ><X size={16} aria-hidden="true" /></button
      >
    </header>

    <div class="edit-field">
      <label class="edit-label" for="edit-spine-id">{$t('ID')}</label>
      <input
        bind:this={idInput}
        bind:value={id}
        id="edit-spine-id"
        type="text"
        class="edit-input"
        disabled={saving}
      />
    </div>

    <div class="edit-check">
      <input
        bind:checked={linear}
        id="edit-spine-linear"
        type="checkbox"
        class="edit-checkbox"
        disabled={saving}
      />
      <label class="edit-check-label" for="edit-spine-linear">
        <span>{$t('Include in the linear reading order')}</span>
        <span class="edit-check-hint">
          {$t('Uncheck to keep the item in the book but outside the default reading order.')}
        </span>
      </label>
    </div>

    {#if error}
      <p class="edit-error" role="alert">{error}</p>
    {/if}

    <footer class="edit-footer">
      <button type="button" class="btn btn-secondary" onclick={onClose} disabled={saving}>
        {$t('Cancel')}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        onclick={save}
        disabled={saving || !id.trim()}
      >
        {saving ? $t('Saving…') : $t('Save')}
      </button>
    </footer>
  </div>
</div>

<style>
  .edit-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: rgb(0 0 0 / 0.5);
  }

  .edit-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    inline-size: min(28rem, 100%);
    padding: var(--space-5);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg);
  }

  .edit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .edit-header h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .edit-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .edit-label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
  }

  .edit-input {
    inline-size: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--text-sm);
  }

  .edit-input:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .edit-check {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .edit-checkbox {
    margin-block-start: 0.2em;
    flex-shrink: 0;
  }

  .edit-check-label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .edit-check-hint {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }

  .edit-error {
    margin: 0;
    color: var(--color-error-text, var(--color-text-primary));
    font-size: var(--text-sm);
  }

  .edit-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
