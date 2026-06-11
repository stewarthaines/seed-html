<script lang="ts">
  import { t } from '../i18n';
  import { coverBackgroundColor } from '../epub/cover-generator';

  let {
    value,
    disabled = false,
    showSwatch = true,
    onInput,
  }: {
    value: number;
    disabled?: boolean;
    /** Show the color swatch. Hidden where a live cover preview makes it redundant. */
    showSwatch?: boolean;
    onInput: (hue: number) => void;
  } = $props();
</script>

<div class="hue-selector">
  {#if showSwatch}
    <span class="hue-swatch" style="background: {coverBackgroundColor(value)}" aria-hidden="true"
    ></span>
  {/if}
  <input
    class="hue-slider"
    type="range"
    min="0"
    max="359"
    step="1"
    {value}
    {disabled}
    aria-label={$t('Cover background hue')}
    oninput={e => onInput(Number(e.currentTarget.value))}
  />
</div>

<style>
  .hue-selector {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .hue-swatch {
    flex-shrink: 0;
    inline-size: 2rem;
    block-size: 2rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
  }

  /* Full-spectrum rainbow track so it reads as a hue picker; the swatch shows
     the actual (muted) cover color. */
  .hue-slider {
    flex: 1;
    min-inline-size: 0;
    -webkit-appearance: none;
    appearance: none;
    block-size: 0.75rem;
    border-radius: var(--radius-sm);
    background: linear-gradient(
      to right,
      hsl(0, 100%, 50%),
      hsl(60, 100%, 50%),
      hsl(120, 100%, 50%),
      hsl(180, 100%, 50%),
      hsl(240, 100%, 50%),
      hsl(300, 100%, 50%),
      hsl(360, 100%, 50%)
    );
    cursor: pointer;
  }

  .hue-slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hue-slider:focus-visible {
    outline: var(--focus-ring-width, 2px) solid var(--color-focus);
    outline-offset: 2px;
  }

  /* Thumb — a white knob with a ring so it's visible over any hue. */
  .hue-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    inline-size: 1.1rem;
    block-size: 1.1rem;
    border-radius: 50%;
    background: var(--color-surface-primary, #fff);
    border: 2px solid var(--color-border-strong, #555);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }

  .hue-slider::-moz-range-thumb {
    inline-size: 1.1rem;
    block-size: 1.1rem;
    border-radius: 50%;
    background: var(--color-surface-primary, #fff);
    border: 2px solid var(--color-border-strong, #555);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }

  /* Keep the gradient visible on Firefox (track paints over the background). */
  .hue-slider::-moz-range-track {
    block-size: 0.75rem;
    border-radius: var(--radius-sm);
    background: transparent;
  }
</style>
