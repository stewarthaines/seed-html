<script lang="ts">
  import type { SpineItemWithSource } from '../spine/types';
  import { t } from '$lib/i18n';
  import {
    DotsSixVertical,
    PencilSimple,
    Trash,
    ArrowUp,
    ArrowDown,
    Warning,
  } from 'phosphor-svelte';

  interface Props {
    item: SpineItemWithSource;
    index?: number;
    isSelected?: boolean;
    isExpanded?: boolean;
    compact?: boolean;
    /** Read-only EPUB: no editing controls, and a missing source is expected (no warning). */
    readOnly?: boolean;
    dragHandleProps?: Record<string, any>;
    isFirstItem?: boolean;
    isLastItem?: boolean;
    /** The only chapter in the book — deletion is disabled (a book needs one). */
    isOnlyItem?: boolean;
    onSelect: () => void;
    onMoveUp: () => Promise<void>;
    onMoveDown: () => Promise<void>;
    onRenameId: () => Promise<void>;
    onDelete: () => Promise<void>;
  }

  let {
    item,
    index: _index = 0, // External reference only
    isSelected = false,
    isExpanded = true,
    compact = false,
    readOnly = false,
    dragHandleProps = {},
    isFirstItem = false,
    isLastItem = false,
    isOnlyItem = false,
    onSelect,
    onMoveUp,
    onMoveDown,
    onRenameId,
    onDelete,
  }: Props = $props();

  // Focus management for move buttons
  async function handleMoveUpKeyboard(
    event: KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      await onMoveUp(); // Wait for operation to complete
      // Focus restoration happens immediately after Promise resolves
      const newUpButton = document.querySelector(
        `[aria-label="Move ${item.id} up"]`
      ) as HTMLButtonElement;
      if (newUpButton) {
        newUpButton.focus();
      }
    }
  }

  async function handleMoveDownKeyboard(
    event: KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      await onMoveDown(); // Wait for operation to complete
      // Focus restoration with fallback logic
      const newDownButton = document.querySelector(
        `[aria-label="Move ${item.id} down"]`
      ) as HTMLButtonElement;
      if (newDownButton && !newDownButton.disabled) {
        newDownButton.focus();
      } else {
        // Fallback: focus the move up button if down button is disabled (item is now last)
        const newUpButton = document.querySelector(
          `[aria-label="Move ${item.id} up"]`
        ) as HTMLButtonElement;
        if (newUpButton) {
          newUpButton.focus();
        }
      }
    }
  }

  // Determine if we should show move buttons (only when selected, not compact,
  // and the project is editable).
  const showMoveButtons = $derived(isSelected && !compact && !readOnly);

  // A missing source file is a real problem in an editable project, but expected
  // in a read-only EPUB — so don't flag it there.
  const hasWarning = $derived(!readOnly && (item.hasSourceFile === false || !item.linear));

  // Generate compact label for collapsed sidebar
  function generateCompactLabel(itemId: string): string {
    // Handle numbered patterns like "chapter1", "chapter-1", "chapter_1"
    const numberedMatch = itemId.match(/^(\w+)[-_]?(\d+)$/i);
    if (numberedMatch) {
      const [, prefix, number] = numberedMatch;
      return prefix.charAt(0).toUpperCase() + number;
    }

    // Handle multiple words separated by spaces, hyphens, or underscores
    const words = itemId.split(/[\s\-_]+/).filter(word => word.length > 0);
    if (words.length > 1) {
      return words.map(word => word.charAt(0).toUpperCase()).join('');
    }

    // Single word - take first 2-3 characters
    const singleWord = itemId.trim();
    if (singleWord.length <= 3) {
      return singleWord.toUpperCase();
    } else if (singleWord.length <= 6) {
      return singleWord.slice(0, 3);
    } else {
      return singleWord.slice(0, 2);
    }
  }

  // In a read-only EPUB a chapter has no editable id/title, so prefer the title
  // resolved from its stored XHTML; otherwise show the id as before.
  const displayLabel = $derived(compact ? generateCompactLabel(item.id) : (item.title ?? item.id));
</script>

<div class="spine-item" class:compact class:selected={isSelected} class:has-error={hasWarning}>
  {#if !compact && isExpanded}
    <div class="drag-handle" {...dragHandleProps} tabindex="-1" aria-hidden="true">
      <DotsSixVertical size={16} aria-hidden="true" />
    </div>
  {/if}

  <button
    type="button"
    class="spine-select"
    onclick={onSelect}
    aria-pressed={isSelected}
    aria-label={`${displayLabel}${hasWarning ? ', has validation error' : ''}`}
  >
    <span class="chapter-id">{displayLabel}</span>
  </button>

  {#if showMoveButtons}
    <div class="move-buttons" aria-label={$t('Item controls')}>
      <button
        class="btn btn-icon btn-icon-sm"
        onclick={e => {
          e.stopPropagation();
          onRenameId();
        }}
        aria-label={$t('Rename {item}', { item: item.id })}
        title={$t('Rename {item}', { item: item.id })}
      >
        <PencilSimple size={14} aria-hidden="true" />
      </button>
      <button
        class="btn btn-icon btn-icon-sm delete-button"
        onclick={e => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={isOnlyItem}
        aria-label={isOnlyItem
          ? $t('A book needs at least one chapter')
          : $t('Delete chapter {name}', { name: item.id })}
        title={isOnlyItem
          ? $t('A book needs at least one chapter')
          : $t('Delete chapter {name}', { name: item.id })}
      >
        <Trash size={14} aria-hidden="true" />
      </button>
      <button
        class="btn btn-icon btn-icon-sm"
        onclick={e => {
          e.stopPropagation();
          onMoveUp();
        }}
        onkeydown={e => {
          e.stopPropagation();
          handleMoveUpKeyboard(e);
        }}
        disabled={isFirstItem}
        aria-label={$t('Move {id} up', { id: item.id })}
        title={$t('Move {id} up', { id: item.id })}
      >
        <ArrowUp size={14} aria-hidden="true" />
      </button>
      <button
        class="btn btn-icon btn-icon-sm"
        onclick={e => {
          e.stopPropagation();
          onMoveDown();
        }}
        onkeydown={e => {
          e.stopPropagation();
          handleMoveDownKeyboard(e);
        }}
        disabled={isLastItem}
        aria-label={$t('Move {id} down', { id: item.id })}
        title={$t('Move {id} down', { id: item.id })}
      >
        <ArrowDown size={14} aria-hidden="true" />
      </button>
    </div>
  {/if}

  {#if !compact && hasWarning}
    <span class="error-indicator" aria-label={$t('Validation error')}>
      <Warning size={14} aria-hidden="true" />
    </span>
  {/if}
</div>

<style>
  .spine-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    border-top: 1px solid transparent;
    border-bottom: 1px solid transparent;
    padding-block: var(--space-2);
    padding-inline-start: var(--space-2);
    padding-inline-end: var(--space-2); /* Add right padding for non-selected items */
    border-radius: 0; /* Remove border radius for cleaner lines */
    cursor: pointer;
    transition: background-color var(--duration-fast) ease;
    min-block-size: var(--touch-target-min); /* 44px - meets WCAG AA touch target requirements */
    position: relative;
    background: transparent; /* Default transparent background */
  }

  /* Solid azure hover, unified with the buttons and the other list rows. */
  .spine-item:hover:not(.selected) {
    background: var(--color-hover-accent);
  }

  .spine-item:hover:not(.selected) .chapter-id,
  .spine-item:hover:not(.selected) .drag-handle {
    color: var(--color-on-accent);
  }

  /* Selection is a real button so the row isn't an interactive control wrapping the
     move/delete buttons (which would nest interactive controls). It fills the row and
     resets button chrome so the appearance is unchanged. */
  .spine-select {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  /* Stretch the select button's hit area over the whole row so a click anywhere
     (not just the title) selects the chapter. The drag handle and move/delete
     buttons are lifted above this overlay so they stay independently clickable. */
  .spine-select::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .spine-item.compact .spine-select {
    justify-content: center;
  }

  .spine-select:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    /* Inset the ring so it sits inside the row rather than bleeding into the
       rows above/below. */
    outline-offset: calc(-1 * var(--focus-ring-offset));
    position: relative;
    z-index: 1; /* Ensure focus ring appears above other elements */
  }

  .spine-item.selected {
    background: var(--color-bg-primary); /* White background */
    border-top: 1px solid var(--color-border-default);
    border-bottom: 1px solid var(--color-border-default);
    margin-inline-start: calc(var(--space-2) * -1); /* Extend to left edge */
    margin-inline-end: 0; /* Extend to right edge */
    padding-inline-start: calc(var(--space-2) * 2); /* Compensate for left negative margin */
    padding-inline-end: var(--space-2); /* Normal right padding */
  }

  .spine-item.compact {
    padding-block: 2px; /* Ultra compact */
    padding-inline: var(--space-1);
    justify-content: center;
    min-block-size: var(
      --touch-target-min
    ); /* 44px - maintain accessibility even in compact mode */
  }

  .spine-item.compact.selected {
    margin-inline: 0; /* Don't extend in compact mode */
    padding-inline: var(--space-1); /* Keep original padding */
  }

  .spine-item.compact .chapter-id {
    font-size: var(--text-xs);
    text-align: center;
    font-weight: var(--font-medium);
  }

  .drag-handle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 20px;
    block-size: 20px;
    color: var(--color-text-tertiary);
    cursor: grab;
    position: relative; /* sit above the select button's full-row overlay */
    z-index: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .chapter-id {
    flex: 1;
    font-size: var(--text-sm); /* Smaller text for compact look */
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-indicator {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    color: var(--color-status-warning);
  }

  .move-buttons {
    display: flex;
    gap: var(--space-1);
    margin-inline-start: auto;
    position: relative; /* sit above the select button's full-row overlay */
    z-index: 1;
  }

  /* Destructive delete keeps a red hover instead of the shared azure
     (component-scoped, so it overrides .btn-icon:hover). */
  .delete-button:hover:not(:disabled) {
    background: var(--color-button-danger-bg);
    border-color: var(--color-button-danger-bg);
    color: var(--color-on-accent);
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .spine-item.selected {
      border: 2px solid var(--color-forced-active);
    }

    .error-indicator {
      font-weight: bold;
    }
  }
</style>
