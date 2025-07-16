<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../i18n';
  import { layoutStore as _layoutStore } from '../stores/layout';
  import SpineItem from './SpineItem.svelte';
  import type { SpineItemManager } from '../spine/spine-item-manager';
  import type { SpineItemWithSource } from '../spine/types';
  import type { WorkspaceManager } from '../workspace';

  // Props
  export let workspaceId: string;
  export let workspaceManager: WorkspaceManager;
  export let spineManager: SpineItemManager;
  export let selectedItemId: string | null = null;
  export let isExpanded = true;

  // State
  let spineItems: SpineItemWithSource[] = [];
  let isLoading = true;
  let error: string | null = null;
  let isReordering = false;

  // Reactive state - use prop instead of store
  $: sidebarExpanded = isExpanded;

  // Initialize event listeners
  onMount(() => {
    // Listen for append item events from Sidebar
    const handleAppendEvent = () => {
      handleAppendChapter();
    };
    window.addEventListener('append-spine-item', handleAppendEvent);

    // Cleanup
    return () => {
      window.removeEventListener('append-spine-item', handleAppendEvent);
    };
  });

  // Reactive: Load spine items when workspaceId changes
  $: if (workspaceId && spineManager) {
    loadSpineItems();
  }

  // Load spine items
  async function loadSpineItems() {
    isLoading = true;
    error = null;

    try {
      spineItems = await spineManager.loadSpineItems(workspaceId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load spine items';
      // Failed to load spine items
    } finally {
      isLoading = false;
    }
  }

  // Handle item selection
  function handleSelectItem(itemId: string) {
    selectedItemId = itemId;
    // Dispatch custom event for parent to handle main view navigation
    const event = new CustomEvent('select-spine-item', {
      detail: { itemId },
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  // Handle append new chapter
  async function handleAppendChapter() {
    try {
      const newChapter = await spineManager.addChapter(workspaceId, {
        title: 'New Chapter',
        linear: true,
        createSourceFile: true,
      });

      // Reload spine items
      await loadSpineItems();

      // Select the new chapter
      handleSelectItem(newChapter.id);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create chapter';
      // Failed to create chapter
    }
  }

  // Handle move up
  async function handleMoveUp(index: number) {
    if (isReordering || index === 0) return;

    isReordering = true;
    try {
      spineItems = await spineManager.moveChapterUp(workspaceId, index);

      // Announce move for screen readers
      announceMove(spineItems[index - 1].id, index, index - 1);
    } catch (_err) {
      // Failed to move chapter up
      // Reload to restore correct order
      await loadSpineItems();
    } finally {
      isReordering = false;
    }
  }

  // Handle move down
  async function handleMoveDown(index: number) {
    if (isReordering || index === spineItems.length - 1) return;

    isReordering = true;
    try {
      spineItems = await spineManager.moveChapterDown(workspaceId, index);

      // Announce move for screen readers
      announceMove(spineItems[index + 1].id, index, index + 1);
    } catch (_err) {
      // Failed to move chapter down
      // Reload to restore correct order
      await loadSpineItems();
    } finally {
      isReordering = false;
    }
  }

  // Screen reader announcement
  function announceMove(itemId: string, fromIndex: number, toIndex: number) {
    const message = `${itemId} moved from position ${fromIndex + 1} to position ${toIndex + 1}`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }

  // Handle drag start
  function handleDragStart(
    event: DragEvent & { currentTarget: EventTarget & HTMLDivElement },
    index: number
  ) {
    if (!sidebarExpanded) return;

    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/plain', index.toString());
  }

  // Handle drag over
  function handleDragOver(event: DragEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    if (!sidebarExpanded) return;

    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  // Handle drop
  async function handleDrop(
    event: DragEvent & { currentTarget: EventTarget & HTMLDivElement },
    dropIndex: number
  ) {
    if (!sidebarExpanded || isReordering) return;

    event.preventDefault();
    const dragIndex = parseInt(event.dataTransfer!.getData('text/plain'), 10);

    if (dragIndex === dropIndex) return;

    isReordering = true;
    try {
      spineItems = await spineManager.reorderItems(workspaceId, dragIndex, dropIndex);

      // Announce move for screen readers
      announceMove(spineItems[dropIndex].id, dragIndex, dropIndex);
    } catch (_err) {
      // Failed to reorder items
      // Reload to restore correct order
      await loadSpineItems();
    } finally {
      isReordering = false;
    }
  }
</script>

<div class="spine-sidebar">
  {#if isLoading}
    <div class="loading">
      <p>{$t('Loading spine items...')}</p>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button class="retry-button" on:click={loadSpineItems}>
        {$t('Retry')}
      </button>
    </div>
  {:else}
    <div class="spine-list" role="list">
      {#each spineItems as item, index (item.id)}
        <div
          class="spine-item-wrapper"
          draggable={sidebarExpanded}
          on:dragstart={e => handleDragStart(e, index)}
          on:dragover={handleDragOver}
          on:drop={e => handleDrop(e, index)}
          role="listitem"
        >
          <SpineItem
            {item}
            {index}
            isSelected={selectedItemId === item.id}
            isExpanded={sidebarExpanded}
            compact={!isExpanded}
            isFirstItem={index === 0}
            isLastItem={index === spineItems.length - 1}
            onSelect={() => handleSelectItem(item.id)}
            onMoveUp={async () => await handleMoveUp(index)}
            onMoveDown={async () => await handleMoveDown(index)}
            dragHandleProps={{
              draggable: true,
              'data-drag-handle': true,
            }}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .spine-sidebar {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    gap: var(--space-2); /* More compact spacing */
    background: var(--color-bg-secondary); /* Light grey background */
    padding: 0; /* var(--space-2); */
    padding-inline-end: 0; /* Remove right padding to allow items to extend to edge */
  }

  .loading,
  .error {
    padding: var(--space-2); /* More compact */
    text-align: center;
    color: var(--color-text-secondary);
    font-size: var(--text-sm); /* Smaller text */
  }

  .error {
    color: var(--color-status-error);
  }

  .retry-button {
    margin-block-start: var(--space-2);
    padding-block: var(--space-2);
    padding-inline: var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .retry-button:hover {
    background: var(--color-interactive-secondary-hover);
    border-color: var(--color-border-strong);
  }

  .retry-button:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  .spine-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: visible; /* Allow horizontal overflow for focus rings */
    display: flex;
    flex-direction: column;
    gap: 0; /* No gap between items */
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .spine-list > :global(*) {
    border: none;
  }

  .spine-item-wrapper {
    transition: transform var(--duration-fast) ease;
    border: none;
    outline: none;
  }

  .spine-item-wrapper[draggable='true']:active {
    opacity: 0.8;
    transform: scale(0.98);
  }

  /* Scrollbar styling */
  .spine-list::-webkit-scrollbar {
    inline-size: 6px;
  }

  .spine-list::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
  }

  .spine-list::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: var(--radius-xs);
  }

  .spine-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary);
  }
</style>
