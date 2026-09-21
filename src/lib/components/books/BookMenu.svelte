<script lang="ts">
  import { tick } from 'svelte';

  let {
    label,
    items,
    onSelect,
    alwaysVisible = false,
    visible = false,
  }: {
    /** Trigger's aria-label — already translated by the parent (e.g. "More actions for {title}"). */
    label: string;
    items: { id: string; label: string; danger?: boolean }[];
    onSelect: (id: string) => void;
    /** When true, the trigger is always shown (never hidden until hover/focus). */
    alwaysVisible?: boolean;
    /** Parent-controlled override to keep the trigger visible (e.g. the current book). */
    visible?: boolean;
  } = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);
  let menu = $state<HTMLDivElement | null>(null);
  let itemRefs: (HTMLButtonElement | null)[] = [];

  async function openMenu() {
    open = true;
    await tick();
    itemRefs[0]?.focus();
  }

  function closeMenu(returnFocus = false) {
    open = false;
    if (returnFocus) trigger?.focus();
  }

  function toggleMenu() {
    if (open) closeMenu();
    else void openMenu();
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      void openMenu();
    }
  }

  function focusItem(index: number) {
    const count = items.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    itemRefs[next]?.focus();
  }

  function handleItemKeydown(event: KeyboardEvent, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        break;
      case 'Tab':
        closeMenu();
        break;
    }
  }

  function selectItem(id: string) {
    closeMenu(true);
    onSelect(id);
  }

  function handlePointerDown(event: PointerEvent) {
    const target = event.target as Node | null;
    if (target && (menu?.contains(target) || trigger?.contains(target))) return;
    closeMenu();
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  });
</script>

<div class="book-menu" class:always-visible={alwaysVisible} class:visible>
  <button
    bind:this={trigger}
    type="button"
    class="btn btn-icon book-menu-trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={label}
    onclick={toggleMenu}
    onkeydown={handleTriggerKeydown}
  >
    <span aria-hidden="true">···</span>
  </button>

  {#if open}
    <div bind:this={menu} class="book-menu-list" role="menu">
      {#each items as item, index (item.id)}
        <button
          bind:this={itemRefs[index]}
          type="button"
          role="menuitem"
          class="book-menu-item"
          class:danger={item.danger}
          onclick={() => selectItem(item.id)}
          onkeydown={event => handleItemKeydown(event, index)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .book-menu {
    position: relative;
    display: inline-block;
  }

  .book-menu-trigger {
    opacity: 0;
    pointer-events: none;
  }

  .book-menu-trigger:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .book-menu.always-visible .book-menu-trigger,
  .book-menu.visible .book-menu-trigger {
    opacity: 1;
    pointer-events: auto;
  }

  .book-menu-list {
    position: absolute;
    inset-inline-end: 0;
    inset-block-start: 100%;
    inline-size: 160px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    padding: var(--space-1);
    background-color: var(--color-surface-elevated);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
  }

  .book-menu-item {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius-xs);
    background: none;
    color: var(--color-text-primary);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .book-menu-item:hover,
  .book-menu-item:focus-visible {
    outline: none;
    background-color: var(--color-bg-secondary);
  }

  .book-menu-item.danger {
    color: var(--color-error-text);
    border-block-start: 1px solid var(--color-border-subtle);
    margin-block-start: var(--space-1);
  }
</style>
