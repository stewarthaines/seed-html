<script lang="ts">
  // A labelled on/off switch. `disabled` keeps it readable and focusable but
  // inert, with `title` saying why.
  let {
    checked,
    label,
    disabled = false,
    busy = false,
    title,
    onChange,
  }: {
    checked: boolean;
    label: string;
    disabled?: boolean;
    /** A change is being written; the switch shows its new state and waits. */
    busy?: boolean;
    title?: string;
    onChange: (checked: boolean) => void;
  } = $props();
</script>

<button
  type="button"
  role="switch"
  class="switch"
  class:muted={disabled}
  aria-checked={checked}
  aria-disabled={disabled || busy}
  aria-busy={busy}
  {title}
  onclick={() => {
    if (!disabled && !busy) onChange(!checked);
  }}
>
  <span class="track" class:on={checked} aria-hidden="true"></span>
  <span class="switch-label">{label}</span>
</button>

<style>
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 13px;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .switch.muted {
    color: var(--color-text-tertiary);
    cursor: default;
  }

  .switch[aria-busy='true'] {
    cursor: progress;
  }

  .track {
    position: relative;
    inline-size: 34px;
    block-size: 18px;
    border-radius: 9px;
    background: var(--color-border-strong);
    transition: background-color 0.15s ease;
  }

  .track::after {
    content: '';
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    inline-size: 14px;
    block-size: 14px;
    border-radius: 7px;
    background: var(--color-surface-primary);
    transition: transform 0.15s ease;
  }

  .track.on {
    background: var(--color-button-primary-bg);
  }

  .track.on::after {
    transform: translateX(16px);
  }

  :global([dir='rtl']) .track.on::after {
    transform: translateX(-16px);
  }

  .switch:focus-visible {
    outline: none;
  }

  .switch:focus-visible .track {
    box-shadow: 0 0 0 2px var(--color-button-focus-ring);
  }
</style>
