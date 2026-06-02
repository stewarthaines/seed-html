<script lang="ts">
  import type { SpineItemWithSource } from '../spine/types';
  import { t } from '$lib/i18n';

  interface Props {
    item: SpineItemWithSource;
    index?: number;
    isSelected?: boolean;
    isExpanded?: boolean;
    compact?: boolean;
    dragHandleProps?: Record<string, any>;
    isFirstItem?: boolean;
    isLastItem?: boolean;
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
    dragHandleProps = {},
    isFirstItem = false,
    isLastItem = false,
    onSelect,
    onMoveUp,
    onMoveDown,
    onRenameId,
    onDelete,
  }: Props = $props();

  function handleKeyDown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  }

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

  // Determine if we should show move buttons (only when selected and not compact)
  const showMoveButtons = $derived(isSelected && !compact);

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

  const displayLabel = $derived(compact ? generateCompactLabel(item.id) : item.id);
</script>

<div
  class="spine-item"
  class:compact
  class:selected={isSelected}
  class:has-error={item.hasSourceFile === false || !item.linear}
  onclick={onSelect}
  onkeydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-pressed={isSelected}
  aria-label={`${item.id}${!item.hasSourceFile ? ', has validation error' : ''}`}
>
  {#if !compact && isExpanded}
    <div class="drag-handle" {...dragHandleProps} tabindex="-1" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2 5h12v1H2zm0 5h12v1H2z" />
      </svg>
    </div>
  {/if}

  <span class="chapter-id">{displayLabel}</span>

  {#if showMoveButtons}
    <div class="move-buttons" aria-label="Item controls">
      <button
        class="move-button"
        onclick={e => {
          e.stopPropagation();
          onRenameId();
        }}
        aria-label={$t('Rename {item}', { item: item.id })}
        title={$t('Rename {item}', { item: item.id })}
      >
        ✎
      </button>
      <button
        class="move-button delete-button"
        onclick={e => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={$t('Delete chapter {name}', { name: item.id })}
        title={$t('Delete chapter {name}', { name: item.id })}
      >
        ✕
      </button>
      <button
        class="move-button"
        onclick={e => {
          e.stopPropagation();
          onMoveUp();
        }}
        onkeydown={e => {
          e.stopPropagation();
          handleMoveUpKeyboard(e);
        }}
        disabled={isFirstItem}
        aria-label={`Move ${item.id} up`}
        title={`Move ${item.id} up`}
      >
        ↑
      </button>
      <button
        class="move-button"
        onclick={e => {
          e.stopPropagation();
          onMoveDown();
        }}
        onkeydown={e => {
          e.stopPropagation();
          handleMoveDownKeyboard(e);
        }}
        disabled={isLastItem}
        aria-label={`Move ${item.id} down`}
        title={`Move ${item.id} down`}
      >
        ↓
      </button>
    </div>
  {/if}

  {#if !compact && (!item.hasSourceFile || !item.linear)}
    <span class="error-indicator" aria-label="Validation error">⚠️</span>
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

  .spine-item:hover:not(.selected) {
    background: var(--color-bg-tertiary);
  }

  .spine-item:focus-visible {
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
    font-size: var(--text-sm);
    color: var(--color-status-warning);
  }

  .move-buttons {
    display: flex;
    gap: var(--space-1);
    margin-inline-start: auto;
  }

  .move-button {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 28px;
    block-size: 28px;
    border: none;
    background: var(--color-bg-primary);
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    transition: all var(--duration-fast) ease;
  }

  .move-button:hover:not(:disabled) {
    background: var(--color-interactive-secondary-hover);
    color: var(--color-text-primary);
  }

  .move-button:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .move-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: var(--color-text-tertiary);
  }

  .delete-button:hover:not(:disabled) {
    background: var(--color-danger);
    color: var(--color-bg-primary);
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
