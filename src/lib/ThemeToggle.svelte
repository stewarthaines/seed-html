<script lang="ts">
  import { themeStore } from './stores/theme';
  import { Sun, Moon } from 'phosphor-svelte';

  let {
    size = 'medium',
    showLabel = true,
  }: {
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
  } = $props();

  let currentTheme = $derived($themeStore.current);
  let isDark = $derived(currentTheme === 'dark');

  function handleToggle() {
    themeStore.toggleTheme();
  }
</script>

<button
  class="theme-toggle"
  class:theme-toggle--small={size === 'small'}
  class:theme-toggle--large={size === 'large'}
  onclick={handleToggle}
  aria-label="Toggle theme"
  title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
>
  <span class="theme-toggle__icon" aria-hidden="true">
    {#if isDark}
      <!-- Sun: dark mode active, clicking switches to light -->
      <Sun weight="regular" aria-hidden="true" />
    {:else}
      <!-- Moon: light mode active, clicking switches to dark -->
      <Moon weight="regular" aria-hidden="true" />
    {/if}
  </span>

  {#if showLabel}
    <span class="theme-toggle__label">
      {isDark ? 'Light' : 'Dark'}
    </span>
  {/if}
</button>

<style>
  /* Flat icon button — matches the sidebar's .append-button-nav reference. */
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    inline-size: var(--touch-target-min);
    block-size: var(--touch-target-min);
    background-color: transparent;
    color: var(--color-text-secondary);
    border: none;
    border-radius: var(--radius-xs);
    font-family: var(--font-sans);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    outline: none;
  }

  .theme-toggle:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .theme-toggle:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus); /* Using accessibility tokens */
    outline-offset: var(--focus-ring-offset);
  }

  /* Size variants control only the icon size; the button stays a 44px touch target. */
  .theme-toggle--small {
    gap: var(--space-1);
  }

  .theme-toggle--large {
    padding-block: var(--space-3); /* Using logical properties */
    padding-inline: var(--space-4);
    font-size: var(--text-base);
    gap: var(--space-3);
  }

  .theme-toggle__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 1.2em; /* Using logical properties */
    block-size: 1.2em;
    flex-shrink: 0;
  }

  /* The icon svg is rendered by the Phosphor child component, so reach it with
     :global to size it to the wrapper (per-variant 1em/1.2em/1.4em). */
  .theme-toggle__icon :global(svg) {
    inline-size: 100%; /* Using logical properties */
    block-size: 100%;
  }

  .theme-toggle__label {
    white-space: nowrap;
  }

  /* Icon size adjustments for different button sizes using logical properties */
  .theme-toggle--small .theme-toggle__icon {
    inline-size: 1em; /* Using logical properties */
    block-size: 1em;
  }

  .theme-toggle--large .theme-toggle__icon {
    inline-size: 1.4em; /* Using logical properties */
    block-size: 1.4em;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .theme-toggle {
      border: 2px solid var(--color-forced-border);
    }

    .theme-toggle:focus-visible {
      outline: 3px solid var(--color-forced-active);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .theme-toggle {
      transition: none;
    }

    .theme-toggle:hover {
      transform: none;
    }

    .theme-toggle:active {
      transform: none;
    }
  }
</style>
