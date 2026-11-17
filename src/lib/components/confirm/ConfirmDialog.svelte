<script lang="ts">
  import { t } from '../../i18n';
  import { answerConfirm, currentConfirm } from './confirm.svelte';

  const request = $derived(currentConfirm());
  const uid = $props.id();

  let cancelButton = $state<HTMLButtonElement | null>(null);

  // Focus the safe answer whenever a request appears, as the native dialog
  // effectively did: Enter on a fresh dialog must not delete anything.
  $effect(() => {
    if (request) cancelButton?.focus();
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      answerConfirm(false);
    }
  }
</script>

{#if request}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="confirm-backdrop" onclick={() => answerConfirm(false)} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-dialog"
      role="alertdialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="{uid}-message"
      onclick={event => event.stopPropagation()}
      onkeydown={handleKeydown}
    >
      <p id="{uid}-message" class="confirm-message">{request.message}</p>
      <footer class="confirm-footer">
        <button
          bind:this={cancelButton}
          type="button"
          class="btn btn-secondary"
          onclick={() => answerConfirm(false)}
        >
          {request.cancelLabel ?? $t('Cancel')}
        </button>
        <button
          type="button"
          class="btn {request.danger ? 'btn-danger' : 'btn-primary'}"
          onclick={() => answerConfirm(true)}
        >
          {request.confirmLabel}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: rgb(0 0 0 / 0.5);
  }

  .confirm-dialog {
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

  .confirm-message {
    margin: 0;
    overflow-wrap: break-word;
  }

  .confirm-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
