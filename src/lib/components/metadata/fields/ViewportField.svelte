<script lang="ts">
  import { t } from '../../../i18n';

  interface Props {
    /** The rendition:viewport string, e.g. "width=1200, height=600". */
    value?: string;
    label?: string;
    error?: string;
    id?: string;
    disabled?: boolean;
    onchange?: (event: { value: string }) => void;
    onblur?: (event: { value: string }) => void;
    onfocus?: (event: { field: string }) => void;
  }

  let {
    value = '',
    label = '',
    error = '',
    id = 'renditionViewport',
    disabled = false,
    onchange,
    onblur,
    onfocus,
  }: Props = $props();

  // rendition:viewport is exactly two positive integers (CSS px): width and
  // height. Parse the incoming string into the two fields, and compose the
  // canonical "width=W, height=H" string back out.
  const parse = (v: string): { width: string; height: string } => {
    const w = /width\s*=\s*(\d+)/i.exec(v);
    const h = /height\s*=\s*(\d+)/i.exec(v);
    return { width: w?.[1] ?? '', height: h?.[1] ?? '' };
  };

  const compose = (w: string, h: string): string => {
    const wn = Number(w);
    const hn = Number(h);
    if (Number.isInteger(wn) && wn > 0 && Number.isInteger(hn) && hn > 0) {
      return `width=${wn}, height=${hn}`;
    }
    // Incomplete or invalid pairs are not persisted (the spec requires both).
    return '';
  };

  let width = $state(parse(value).width);
  let height = $state(parse(value).height);

  // Re-sync from the prop when it changes from outside (e.g. workspace reload).
  $effect(() => {
    const parsed = parse(value);
    width = parsed.width;
    height = parsed.height;
  });

  const emitChange = () => onchange?.({ value: compose(width, height) });
  const emitBlur = () => onblur?.({ value: compose(width, height) });
  const handleFocus = () => onfocus?.({ field: id });
</script>

<div class="metadata-field">
  {#if label}
    <span class="field-label">
      {#if error}
        <span id="{id}-error" class="field-error" role="alert">{error}</span>
      {:else}
        {label}
      {/if}
    </span>
  {/if}

  <div class="viewport-inputs">
    <input
      id="{id}-width"
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
      bind:value={width}
      placeholder={$t('Width')}
      aria-label={$t('Viewport width in pixels')}
      {disabled}
      class="field-input"
      class:error={!!error}
      oninput={emitChange}
      onblur={emitBlur}
      onfocus={handleFocus}
    />
    <span class="viewport-times" aria-hidden="true">×</span>
    <input
      id="{id}-height"
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
      bind:value={height}
      placeholder={$t('Height')}
      aria-label={$t('Viewport height in pixels')}
      {disabled}
      class="field-input"
      class:error={!!error}
      oninput={emitChange}
      onblur={emitBlur}
      onfocus={handleFocus}
    />
    <span class="viewport-unit" aria-hidden="true">px</span>
  </div>

  <p class="field-hint">
    {$t('Both values are required. rendition:viewport is deprecated in EPUB 3.3.')}
  </p>
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
    font-size: 0.875rem;
  }

  .viewport-inputs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .field-input {
    width: 100%;
    min-width: 0;
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

  .viewport-times,
  .viewport-unit {
    flex: none;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .field-error {
    color: var(--color-error);
    font-size: 0.875rem;
  }

  .field-hint {
    margin-block-start: 0.25rem;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
  }
</style>
