<script lang="ts">
  interface Props {
    value?: string;
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    label?: string;
    id?: string;
    placeholder?: string;
    onchange?: (event: { value: string }) => void;
    onblur?: (event: { value: string }) => void;
    onfocus?: (event: { field: string }) => void;
  }

  let {
    value = '',
    options = [],
    required = false,
    disabled = false,
    error = '',
    label = '',
    id = '',
    placeholder = '',
    onchange,
    onblur,
    onfocus
  }: Props = $props();

  // Check if field needs attention (required but empty)
  let needsAttention = $derived(required && (!value || value.trim() === ''));

  const handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    // onchange?.({ value: target.value });
    onblur?.({ value: target.value });
  };

  const handleBlur = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    onblur?.({ value: target.value });
  };

  const handleFocus = () => {
    onfocus?.({ field: id });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      onblur?.({ value: (event.target as HTMLSelectElement).value });
    }
  };
</script>

<div class="metadata-field">
  {#if label}
    <label for={id} class="field-label" class:needs-attention={needsAttention}>
      {#if error}
        <div id="{id}-error" class="field-error" role="alert">
          {error}
        </div>
      {:else}
        {label}
      {/if}
    </label>
  {/if}

  <select
    {id}
    {value}
    {required}
    {disabled}
    class="field-select"
    class:error={!!error}
    class:needs-attention={needsAttention}
    onchange={handleChange}
    onblur={handleBlur}
    onfocus={handleFocus}
    onkeydown={handleKeydown}
    aria-describedby={error ? `${id}-error` : undefined}
    aria-invalid={!!error || needsAttention}
  >
    {#if placeholder && !required}
      <option value="">{placeholder}</option>
    {/if}
    {#each options as option}
      <option value={option.value}>
        {option.label}
      </option>
    {/each}
  </select>
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

  .field-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    transition: border-color 0.2s ease;
    cursor: pointer;
  }

  .field-select:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .field-select:disabled {
    background-color: var(--color-surface-disabled);
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }

  .field-select.error {
    border-color: var(--color-error);
  }

  .field-select.error:focus {
    border-color: var(--color-error);
    box-shadow: 0 0 0 2px var(--color-error-300);
  }

  .field-select.needs-attention {
    border-color: var(--color-success-600); /* Green border for required unfilled fields */
  }

  .field-select.needs-attention:focus {
    border-color: var(--color-success-600);
    box-shadow: 0 0 0 2px rgba(34, 139, 34, 0.2);
  }

  .field-error {
    margin-block-start: 0.25rem;
    color: var(--color-error);
    font-size: 0.875rem;
  }
</style>
