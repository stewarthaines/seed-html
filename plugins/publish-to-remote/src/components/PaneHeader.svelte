<script lang="ts">
  import type { Snippet } from 'svelte';

  // A grey toolbar bar at the top of a pane, matching the core app's PaneHeader
  // convention (consistent single-row height) but using the plugin's own tokens.
  let { children, actions }: { children?: Snippet; actions?: Snippet } = $props();
</script>

<div class="pane-header">
  <div class="pane-header__main">{@render children?.()}</div>
  {#if actions}
    <div class="pane-header__actions">{@render actions()}</div>
  {/if}
</div>

<style>
  .pane-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 2.75rem;
    padding: 0 12px;
    background: var(--color-button-secondary-bg);
    border-bottom: 1px solid var(--color-border-default);
    box-sizing: border-box;
  }

  .pane-header__main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .pane-header__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
</style>
