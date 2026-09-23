<script lang="ts">
  import { X } from 'phosphor-svelte';
  import { t } from '../i18n.js';
  import { statusMessage, clearStatus } from '../status.js';
</script>

<!-- Transient status: a fixed overlay so it never reflows the surface. -->
{#if $statusMessage}
  <div
    class="status-toast"
    class:error={$statusMessage.type === 'error'}
    class:success={$statusMessage.type === 'success'}
    role="status"
    aria-live="polite"
  >
    <span class="status-toast-text">{$statusMessage.text}</span>
    <button
      type="button"
      class="status-toast-close"
      aria-label={$t('Dismiss')}
      onclick={clearStatus}><X size={16} aria-hidden="true" /></button
    >
  </div>
{/if}

<style>
  .status-toast {
    position: fixed;
    inset-block-end: 16px;
    inset-inline-start: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    max-inline-size: min(90%, 480px);
    padding: 10px 12px 10px 16px;
    border-radius: 6px;
    border-inline-start: 4px solid var(--color-info-border);
    background: var(--color-info-bg);
    color: var(--color-info-text);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .status-toast.success {
    border-inline-start-color: var(--color-success-border);
    background: var(--color-success-bg);
    color: var(--color-success-text);
  }

  .status-toast.error {
    border-inline-start-color: var(--color-error-border);
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .status-toast-text {
    flex: 1;
    overflow-wrap: anywhere;
  }

  .status-toast-close {
    display: inline-flex;
    background: none;
    border: none;
    color: inherit;
    padding: 4px;
    cursor: pointer;
    opacity: 0.7;
  }

  .status-toast-close:hover {
    opacity: 1;
  }
</style>
