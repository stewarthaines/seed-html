<script lang="ts">
  import { t } from '../../i18n';

  let {
    id = '',
    label = '',
    active = false,
    errorCount = 0,
    disabled = false,
    onSelect,
  }: {
    id?: string;
    label?: string;
    active?: boolean;
    errorCount?: number;
    disabled?: boolean;
    onSelect?: (detail: { tabId: string }) => void;
  } = $props();

  const handleClick = () => {
    if (!disabled) {
      onSelect?.({ tabId: id });
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      onSelect?.({ tabId: id });
    }
  };
</script>

<button
  class="metadata-tab"
  class:active
  class:has-errors={errorCount > 0}
  class:disabled
  {disabled}
  onclick={handleClick}
  onkeydown={handleKeydown}
  aria-controls={active ? `metadata-panel-${id}` : undefined}
  id="metadata-tab-{id}"
>
  <span class="tab-label">{label}</span>

  {#if errorCount > 0}
    <span class="error-indicator" aria-label={$t('validation.errorsCount', { count: errorCount })}>
      !
    </span>
  {/if}
</button>

<style>
  .metadata-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 1rem;
    border: none;
    border-block-end: 2px solid transparent;
    background-color: transparent;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .metadata-tab:hover:not(.disabled) {
    color: var(--color-text-primary);
    background-color: var(--color-surface-hover);
  }

  .metadata-tab:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
    border-radius: var(--radius-sm);
  }

  .metadata-tab.active {
    color: var(--color-primary);
    border-block-end-color: var(--color-primary);
    background-color: var(--color-surface-primary);
  }

  .metadata-tab.has-errors {
    color: var(--color-error);
  }

  .metadata-tab.has-errors.active {
    border-block-end-color: var(--color-error);
  }

  .metadata-tab.disabled {
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }

  .tab-label {
    flex: 1;
  }

  .error-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background-color: var(--color-error);
    color: var(--color-surface);
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
  }

  /* RTL support */
  :global([dir='rtl']) .metadata-tab {
    flex-direction: row-reverse;
  }
</style>
