<script lang="ts">
  import { t } from '../../../i18n';

  interface Props {
    value?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    label?: string;
    id?: string;
    onchange?: (event: { value: string }) => void;
    onblur?: (event: { value: string }) => void;
    onfocus?: (event: { field: string }) => void;
  }

  let {
    value = '',
    required = false,
    disabled = false,
    error = '',
    label = '',
    id = '',
    onchange,
    onblur,
    onfocus
  }: Props = $props();

  // Check if field needs attention (required but empty)
  let needsAttention = $derived(required && (!value || value.trim() === ''));

  const handleInput = (event: Event) => {
    onchange?.({ value: (event.target as HTMLInputElement).value });
  };

  const handleBlur = (event: FocusEvent) => {
    onblur?.({ value: (event.target as HTMLInputElement).value });
  };

  const handleFocus = () => {
    onfocus?.({ field: id });
  };

  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onchange?.({ value: today });
    onblur?.({ value: today }); // Also trigger blur to save the value
  };
</script>

<div class="metadata-field">
  {#if label}
    <label for={id} class="field-label" class:needs-attention={needsAttention}>
      {label}
      {#if required}
        <span class="required" aria-label={$t('Required field')}>*</span>
      {/if}
    </label>
  {/if}

  <div class="date-input-wrapper">
    <input
      {id}
      type="date"
      {value}
      {required}
      {disabled}
      class="field-input"
      class:error={!!error}
      class:needs-attention={needsAttention}
      oninput={handleInput}
      onblur={handleBlur}
      onfocus={handleFocus}
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={!!error}
    />

    {#if !disabled}
      <button
        type="button"
        class="today-button"
        onclick={setToday}
        aria-label={$t('Set to today')}
      >
        {$t('Today')}
      </button>
    {/if}
  </div>

  {#if error}
    <div id="{id}-error" class="field-error" role="alert">
      {error}
    </div>
  {/if}
</div>

<style>
  .metadata-field {
    margin-block-end: 1rem;
  }

  .field-label {
    display: block;
    font-weight: 500;
    margin-block-end: 0.5rem;
    color: var(--color-text-primary);
    font-size: 0.875rem; /* Smaller label like Craigslist */
  }

  .field-label.needs-attention {
    color: var(--color-success-600); /* Green color for required unfilled fields */
  }

  .required {
    color: var(--color-error);
    margin-inline-start: 0.25rem;
  }

  .date-input-wrapper {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .field-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    transition: border-color 0.2s ease;
  }

  .field-input:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .field-input:disabled {
    background-color: var(--color-surface-disabled);
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }

  .field-input.error {
    border-color: var(--color-error);
  }

  .field-input.error:focus {
    border-color: var(--color-error);
    box-shadow: 0 0 0 2px var(--color-error-300);
  }

  .field-input.needs-attention {
    border-color: var(--color-success-600); /* Green border for required unfilled fields */
  }

  .field-input.needs-attention:focus {
    border-color: var(--color-success-600);
    box-shadow: 0 0 0 2px rgba(34, 139, 34, 0.2);
  }

  .today-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-primary);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .today-button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .today-button:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .field-error {
    margin-block-start: 0.25rem;
    color: var(--color-error);
    font-size: 0.875rem;
  }
</style>
