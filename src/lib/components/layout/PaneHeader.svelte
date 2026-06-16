<script lang="ts">
  import type { Snippet } from 'svelte';

  // A grey toolbar bar at the top of a pane, holding that pane's controls.
  // Matches the spine editor's header convention with a consistent single-row
  // height. `children` fills the row (left); optional `actions` sit at the right.
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
    gap: var(--space-2);
    /* Match the sidebar header: its 44px touch-target row + 4px block padding +
       1px border ≈ 53px, and its --color-bg-tertiary grey, so all top bars align. */
    min-height: calc(var(--touch-target-min) + var(--space-2) + 1px);
    padding: 0 var(--space-3);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-default);
    box-sizing: border-box;
  }

  .pane-header__main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
  }

  .pane-header__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
</style>
