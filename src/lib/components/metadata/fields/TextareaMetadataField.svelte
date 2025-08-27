<script lang="ts">
  import { t } from '../../../i18n';

  interface Props {
    value?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    label?: string;
    id?: string;
    rows?: number;
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
    rows = 4,
    onchange,
    onblur,
    onfocus
  }: Props = $props();

  // Check if field needs attention (required but empty)
  let needsAttention = $derived(required && (!value || value.trim() === ''));

  const handleInput = (event: Event) => {
    onchange?.({ value: (event.target as HTMLTextAreaElement).value });
  };

  const handleBlur = (event: FocusEvent) => {
    onblur?.({ value: (event.target as HTMLTextAreaElement).value });
  };

  const handleFocus = () => {
    onfocus?.({ field: id });
  };

  const handleKeydown = (event: KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to save (common pattern for multi-line text)
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onblur?.({ value: (event.target as HTMLTextAreaElement).value });
    }
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

  <textarea
    {id}
    {value}
    {placeholder}
    {required}
    {disabled}
    {rows}
    class="field-textarea"
    class:error={!!error}
    class:needs-attention={needsAttention}
    oninput={handleInput}
    onblur={handleBlur}
    onfocus={handleFocus}
    onkeydown={handleKeydown}
    aria-describedby={error ? `${id}-error` : undefined}
    aria-invalid={!!error || needsAttention}
  ></textarea>

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

  .field-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    font-size: 1rem;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    transition: border-color 0.2s ease;
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
    field-sizing: content;
    min-height: calc(1.5em * 3 + 1.5rem); /* 3 rows + padding */
  }

  .field-textarea:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .field-textarea:disabled {
    background-color: var(--color-surface-disabled);
    color: var(--color-text-disabled);
    cursor: not-allowed;
    resize: none;
  }

  .field-textarea.error {
    border-color: var(--color-error);
  }

  .field-textarea.error:focus {
    border-color: var(--color-error);
    box-shadow: 0 0 0 2px var(--color-error-300);
  }

  .field-textarea.needs-attention {
    border-color: var(--color-success-600); /* Green border for required unfilled fields */
  }

  .field-textarea.needs-attention:focus {
    border-color: var(--color-success-600);
    box-shadow: 0 0 0 2px rgba(34, 139, 34, 0.2);
  }

  .field-error {
    margin-block-start: 0.25rem;
    color: var(--color-error);
    font-size: 0.875rem;
  }
</style>
