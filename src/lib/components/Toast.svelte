<script lang="ts">
  import { X } from 'phosphor-svelte';
  import { t } from '../i18n';
  import { toasts, dismissToast } from '../stores/toast.svelte.js';
</script>

{#if toasts.length > 0}
  <div class="toast-host" role="region" aria-label={$t('Notifications')}>
    {#each toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}" role="status" aria-live="polite">
        <span class="toast-text">{toast.text}</span>
        <button
          type="button"
          class="toast-close"
          aria-label={$t('Dismiss')}
          onclick={() => dismissToast(toast.id)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Fixed, bottom-centred overlay — never reflows page content. */
  .toast-host {
    position: fixed;
    inset-block-end: 16px;
    inset-inline-start: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast, 1500);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    pointer-events: none; /* clicks pass through the gaps; toasts re-enable below */
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    max-inline-size: min(90vw, 480px);
    padding: 10px 12px 10px 16px;
    border-radius: var(--radius-md);
    border-inline-start: 4px solid var(--color-interactive-primary);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg, 0 4px 16px rgb(0 0 0 / 0.15));
  }

  .toast-success {
    border-inline-start-color: var(--color-success-text);
    background: var(--color-success-bg);
    color: var(--color-success-text);
  }

  .toast-error {
    border-inline-start-color: var(--color-error-border);
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .toast-text {
    flex: 1;
    font-size: var(--text-sm);
  }

  .toast-close {
    display: flex;
    align-items: center;
    padding: 0 4px;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }

  .toast-close:hover {
    opacity: 1;
  }
</style>
