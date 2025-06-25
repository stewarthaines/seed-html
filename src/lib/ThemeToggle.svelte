<script lang="ts">
  import { themeStore } from './stores/theme';
  
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let showLabel = true;
  
  $: currentTheme = $themeStore.current;
  $: isDark = currentTheme === 'dark';
  
  function handleToggle() {
    themeStore.toggleTheme();
  }
</script>

<button
  class="theme-toggle"
  class:theme-toggle--small={size === 'small'}
  class:theme-toggle--large={size === 'large'}
  on:click={handleToggle}
  aria-label="Toggle theme"
  title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
>
  <span class="theme-toggle__icon" aria-hidden="true">
    {#if isDark}
      <!-- Sun icon for dark mode (clicking switches to light) -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    {:else}
      <!-- Moon icon for light mode (clicking switches to dark) -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    {/if}
  </span>
  
  {#if showLabel}
    <span class="theme-toggle__label">
      {isDark ? 'Light' : 'Dark'}
    </span>
  {/if}
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    outline: none;
  }

  .theme-toggle:hover {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .theme-toggle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .theme-toggle:active {
    transform: translateY(0);
    box-shadow: none;
  }

  /* Size variants */
  .theme-toggle--small {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    gap: var(--space-1);
  }

  .theme-toggle--large {
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-base);
    gap: var(--space-3);
  }

  .theme-toggle__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.2em;
    height: 1.2em;
    flex-shrink: 0;
  }

  .theme-toggle__icon svg {
    width: 100%;
    height: 100%;
  }

  .theme-toggle__label {
    white-space: nowrap;
  }

  /* Icon size adjustments for different button sizes */
  .theme-toggle--small .theme-toggle__icon {
    width: 1em;
    height: 1em;
  }

  .theme-toggle--large .theme-toggle__icon {
    width: 1.4em;
    height: 1.4em;
  }
</style>