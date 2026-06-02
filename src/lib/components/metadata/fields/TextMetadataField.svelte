<script lang="ts">
  import { t as _t } from '../../../i18n';

  interface Props {
    value?: string;
    placeholder?: string;
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
    placeholder = '',
    required = false,
    disabled = false,
    error = '',
    label = '',
    id = '',
    onchange,
    onblur,
    onfocus,
  }: Props = $props();

  // Local state that tracks the actual DOM input value
  let localValue = $state(value);

  // Sync local value with prop when prop changes (from parent updates)
  $effect(() => {
    localValue = value;
  });

  // Check if field needs attention based on visual/DOM state, not prop state
  let needsAttention = $derived(required && (!localValue || localValue.trim() === ''));

  const handleInput = (event: Event) => {
    localValue = (event.target as HTMLInputElement).value;
    onchange?.({ value: localValue });
  };

  const handleBlur = (event: FocusEvent) => {
    localValue = (event.target as HTMLInputElement).value;
    onblur?.({ value: localValue });
  };

  const handleFocus = () => {
    onfocus?.({ field: id });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      localValue = (event.target as HTMLInputElement).value;
      onblur?.({ value: localValue });
    }
  };
</script>

<div class="metadata-field">
  {#if label}
    <label for={id} class="field-label" class:needs-attention={needsAttention}>
      {#if error}
        <span id="{id}-error" class="field-error" role="alert">
          {error}
        </span>
      {:else}
        {label}
      {/if}
    </label>
  {/if}

  <input
    {id}
    type="text"
    bind:value={localValue}
    {placeholder}
    {required}
    {disabled}
    class="field-input"
    class:error={!!error}
    class:needs-attention={needsAttention}
    oninput={handleInput}
    onblur={handleBlur}
    onfocus={handleFocus}
    onkeydown={handleKeydown}
    aria-describedby={error ? `${id}-error` : undefined}
    aria-invalid={!!error || needsAttention}
  />
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

  .field-input {
    width: 100%;
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

  .field-error {
    margin-block-start: 0.25rem;
    color: var(--color-error);
    font-size: 0.875rem;
  }
</style>
