<!--
  BookMenu — an accessible menu button. The trigger is the three-dot glyph by
  default, or a text label when `triggerText` is given (the editor's files
  menu). Items may be grouped under headings; the current item can be marked
  checked; a danger item is set apart. Arrow keys move between the actionable
  items, Home/End jump, Escape closes and returns focus to the trigger.
-->
<script lang="ts">
  import { tick } from 'svelte';

  export interface MenuItem {
    id: string;
    label: string;
    /** A second, quieter line (a filename, a size). */
    detail?: string;
    /** A non-interactive group heading; `id` must still be unique. */
    heading?: boolean;
    /** The item that is current (shown with a check mark). */
    checked?: boolean;
    /** A destructive item: set apart with a rule above and coloured as such. */
    danger?: boolean;
    disabled?: boolean;
  }

  let {
    label,
    items,
    onSelect,
    alwaysVisible = false,
    visible = false,
    triggerText,
    menuWidth = '160px',
    align = 'end',
  }: {
    /** Trigger's aria-label — already translated by the parent (e.g. "More actions for {title}"). */
    label: string;
    items: MenuItem[];
    onSelect: (id: string) => void;
    /** When true, the trigger is always shown (never hidden until hover/focus). */
    alwaysVisible?: boolean;
    /** Parent-controlled override to keep the trigger visible (e.g. the current book). */
    visible?: boolean;
    /** A text trigger instead of the three-dot icon; always visible. */
    triggerText?: string;
    menuWidth?: string;
    /** Which edge of the trigger the list aligns to. */
    align?: 'start' | 'end';
  } = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);
  let menu = $state<HTMLDivElement | null>(null);
  let itemRefs = $state<(HTMLButtonElement | null)[]>([]);

  // Only actionable items take part in keyboard movement.
  const actionable = $derived(items.filter(item => !item.heading && !item.disabled));
  const textTrigger = $derived(typeof triggerText === 'string');

  // The list stays on screen: it drops below the trigger when there is room,
  // opens upward when there is more room above, and scrolls within whichever
  // space it has.
  let above = $state(false);
  let maxBlockSize = $state<string | null>(null);

  function fitToViewport(): void {
    if (!trigger || !menu) return;
    const anchor = trigger.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - anchor.bottom - margin;
    const aboveSpace = anchor.top - margin;
    const needed = menu.scrollHeight;
    above = needed > below && aboveSpace > below;
    maxBlockSize = `${Math.max(120, Math.floor(above ? aboveSpace : below))}px`;
  }

  async function openMenu() {
    open = true;
    above = false;
    maxBlockSize = null;
    await tick();
    fitToViewport();
    const current = actionable.findIndex(item => item.checked);
    itemRefs[current >= 0 ? current : 0]?.focus();
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
    const count = actionable.length;
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
        focusItem(actionable.length - 1);
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

  // Index of an actionable item within the actionable list, for focus movement.
  function actionIndex(item: MenuItem): number {
    return actionable.indexOf(item);
  }
</script>

<div
  class="book-menu"
  class:always-visible={alwaysVisible || textTrigger}
  class:visible
  class:align-start={align === 'start'}
>
  <button
    bind:this={trigger}
    type="button"
    class={textTrigger
      ? 'book-menu-trigger book-menu-trigger-text'
      : 'btn btn-icon book-menu-trigger'}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={textTrigger ? undefined : label}
    onclick={toggleMenu}
    onkeydown={handleTriggerKeydown}
  >
    {#if textTrigger}
      {triggerText}<span class="caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
    {:else}
      <span aria-hidden="true">···</span>
    {/if}
  </button>

  {#if open}
    <div
      bind:this={menu}
      class="book-menu-list"
      class:above
      role="menu"
      aria-label={textTrigger ? label : undefined}
      style="inline-size: {menuWidth}; {maxBlockSize ? `max-block-size: ${maxBlockSize};` : ''}"
    >
      {#each items as item (item.id)}
        {#if item.heading}
          <div class="book-menu-heading" role="presentation">{item.label}</div>
        {:else}
          <button
            bind:this={itemRefs[actionIndex(item)]}
            type="button"
            role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
            aria-checked={item.checked !== undefined ? item.checked : undefined}
            class="book-menu-item"
            class:danger={item.danger}
            class:checked={item.checked}
            disabled={item.disabled}
            onclick={() => selectItem(item.id)}
            onkeydown={event => handleItemKeydown(event, actionIndex(item))}
          >
            <span class="check" aria-hidden="true">{item.checked ? '✓' : ''}</span>
            <span class="text">
              <span class="item-label">{item.label}</span>
              {#if item.detail}<span class="item-detail">{item.detail}</span>{/if}
            </span>
          </button>
        {/if}
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

  .book-menu-trigger-text {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border: 0;
    background: transparent;
    padding-block: var(--space-1);
    padding-inline: var(--space-1);
    min-block-size: 32px;
    font: inherit;
    font-size: var(--text-sm);
    /* The trigger sits on pane headers (tertiary background), where the
       dark link colour falls short of AA; the text reads as text, the caret
       and hover say it is a menu. */
    color: var(--color-text-primary);
    cursor: pointer;
    white-space: nowrap;
  }

  .book-menu-trigger-text:hover {
    color: var(--color-text-link-hover);
  }

  .book-menu-trigger-text:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .caret {
    font-size: var(--text-xs);
  }

  .book-menu-list {
    position: absolute;
    inset-inline-end: 0;
    inset-block-start: 100%;
    z-index: 10;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: var(--space-1);
    background-color: var(--color-surface-elevated);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
  }

  .book-menu-list.above {
    inset-block-start: auto;
    inset-block-end: 100%;
  }

  .book-menu.align-start .book-menu-list {
    inset-inline-end: auto;
    inset-inline-start: 0;
  }

  .book-menu-heading {
    padding-block: var(--space-2) var(--space-1);
    padding-inline: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .book-menu-heading:not(:first-child) {
    margin-block-start: var(--space-1);
    border-block-start: 1px solid var(--color-border-subtle);
  }

  .book-menu-item {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
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

  .book-menu-item:disabled {
    color: var(--color-text-tertiary);
    cursor: default;
  }

  .book-menu-item:hover:not(:disabled),
  .book-menu-item:focus-visible {
    outline: none;
    background-color: var(--color-bg-secondary);
  }

  .book-menu-item.checked .item-label {
    font-weight: var(--font-bold);
  }

  .check {
    inline-size: 1em;
    flex-shrink: 0;
  }

  .text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    min-inline-size: 0;
  }

  .item-detail {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .book-menu-item.danger {
    color: var(--color-error-text);
    border-block-start: 1px solid var(--color-border-subtle);
    margin-block-start: var(--space-1);
  }
</style>
