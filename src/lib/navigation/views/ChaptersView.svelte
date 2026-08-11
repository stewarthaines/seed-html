<script lang="ts">
  // Chapters view — dedicated surface for reordering spine items and bulk
  // operations (plan: velvety-yawning-sky). Flow: select a range in one gesture,
  // choose an insertion point as a separate action, review the abstract
  // before/after schematic, then Apply (immediate commit). The moved block stays
  // selected afterward, so reversing a move is just re-picking the old spot and
  // Applying again — no undo stack.
  import { tick, untrack } from 'svelte';
  import { t } from '../../i18n';
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
  import PaneHeader from '$lib/components/layout/PaneHeader.svelte';
  import type {
    WorkspaceService,
    WorkspaceState,
  } from '../../services/workspace/workspace.service.js';
  import type { SpineService } from '../../services/spine/spine.service.js';
  import type { SpineItemWithSource } from '../../spine/types';
  import SpineDiagram from '../../components/chapters/SpineDiagram.svelte';
  import { computeMovedOrder, isNoOpMove, rangeIds } from '../../spine/chapters-reorder.js';
  import { isFolderSyncSupported } from '../../folder-sync/capability.js';
  import { getFolderSyncStatus, type FolderSyncStatus } from '../../folder-sync/handle-store.js';

  interface Props {
    workspace: WorkspaceState;
    workspaceService: WorkspaceService;
    spineService: SpineService;
    selectedItemId?: string | null;
    readOnly?: boolean;
    onWorkspaceUpdate?: ((workspace: WorkspaceState) => void) | null;
  }

  let {
    workspace,
    workspaceService,
    spineService,
    selectedItemId = null,
    readOnly = false,
    onWorkspaceUpdate = null,
  }: Props = $props();

  // --- state ---------------------------------------------------------------
  let items = $state<SpineItemWithSource[]>([]);
  let selectedIds = $state<Set<string>>(new Set());
  let anchorIndex = $state(-1);
  let focusIndex = $state(0);
  /** Committed insertion gap (0..N) chosen for a move, or null. */
  let destination = $state<number | null>(null);
  /** Transient mouse-hover gap, previews without committing. */
  let hoverGap = $state<number | null>(null);
  /** Keyboard placement mode: arrow keys drive a caret between gaps. */
  let placing = $state(false);
  let caretGap = $state(0);
  let pending = $state(false);
  let confirmingDelete = $state(false);

  // Element refs (roving tabindex + focus restoration + live regions).
  let rowEls: HTMLElement[] = [];
  let politeEl: HTMLElement;
  let assertiveEl: HTMLElement;
  let applyBtn = $state<HTMLButtonElement | undefined>(undefined);

  // --- derived -------------------------------------------------------------
  // Fixed-layout projects can import page images as chapters, so the file
  // picker also offers the EPUB core image types there.
  const isFixedLayout = $derived(workspace.opf.metadata.renditionLayout === 'pre-paginated');
  const importAccept = $derived(
    isFixedLayout
      ? '.txt,.md,.markdown,text/plain,.png,.jpg,.jpeg,.gif,.webp,.svg,image/png,image/jpeg,image/gif,image/webp,image/svg+xml'
      : '.txt,.md,.markdown,text/plain'
  );
  const orderIds = $derived(items.map(i => i.id));
  const selectedCount = $derived(selectedIds.size);
  const hasSelection = $derived(selectedCount > 0);
  const anySelectedLinear = $derived(items.some(i => selectedIds.has(i.id) && i.linear));

  // The gap the schematic should preview: caret while placing, else the chosen
  // destination, else the hovered gap.
  const proposedGap = $derived(placing ? caretGap : (destination ?? hoverGap));
  const proposedOrder = $derived.by(() => {
    if (proposedGap == null || !hasSelection) return null;
    return computeMovedOrder(orderIds, selectedIds, proposedGap);
  });
  const canApply = $derived(
    !readOnly &&
      hasSelection &&
      destination != null &&
      !isNoOpMove(orderIds, selectedIds, destination)
  );

  // Reload whenever spine membership/order/linearity changes (not on every save).
  const signature = $derived(
    workspace.opf.spine.map(s => s.idref + (s.linear === false ? '-' : '+')).join(',')
  );
  $effect(() => {
    void signature;
    untrack(() => {
      void reload(workspace);
    });
  });

  async function reload(ws: WorkspaceState): Promise<void> {
    try {
      const loaded = await spineService.loadSpineItems(ws);
      items = loaded;
      const present = new Set(loaded.map(i => i.id));
      if (selectedIds.size) {
        const kept = [...selectedIds].filter(id => present.has(id));
        if (kept.length !== selectedIds.size) selectedIds = new Set(kept);
      }
      if (focusIndex >= loaded.length) focusIndex = Math.max(0, loaded.length - 1);
      // Seed focus/selection from the app's currently selected chapter on first load.
      if (anchorIndex < 0 && selectedItemId) {
        const i = loaded.findIndex(it => it.id === selectedItemId);
        if (i >= 0) focusIndex = i;
      }
    } catch (error) {
      console.warn('Chapters: failed to load spine items', error);
    }
  }

  function label(item: SpineItemWithSource): string {
    return item.title ?? item.id;
  }

  // --- announcements -------------------------------------------------------
  function announce(el: HTMLElement | undefined, message: string, clearMs = 3000): void {
    if (!el) return;
    el.textContent = '';
    // Re-set on the next frame so repeated identical messages are re-announced.
    requestAnimationFrame(() => {
      el.textContent = message;
      setTimeout(() => {
        el.textContent = '';
      }, clearMs);
    });
  }
  const announcePolite = (m: string) => announce(politeEl, m);
  const announceAssertive = (m: string) => announce(assertiveEl, m, 5000);

  function announceSelection(): void {
    announcePolite(
      selectedCount === 0
        ? $t('Selection cleared')
        : $t('{count} selected', { count: selectedCount })
    );
  }

  function gapLabel(gap: number): string {
    return gap >= items.length ? $t('the end') : label(items[gap]);
  }

  // --- selection -----------------------------------------------------------
  function resetDestination(): void {
    destination = null;
    hoverGap = null;
    placing = false;
    confirmingDelete = false;
  }

  function selectOnly(index: number): void {
    selectedIds = new Set([orderIds[index]]);
    anchorIndex = index;
    focusIndex = index;
    resetDestination();
    announceSelection();
  }

  function toggleAt(index: number): void {
    const id = orderIds[index];
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
    anchorIndex = index;
    focusIndex = index;
    resetDestination();
    announceSelection();
  }

  function extendTo(index: number): void {
    if (anchorIndex < 0) anchorIndex = index;
    selectedIds = new Set(rangeIds(orderIds, anchorIndex, index));
    focusIndex = index;
    rowEls[index]?.focus();
    resetDestination();
    announceSelection();
  }

  function moveFocus(index: number): void {
    focusIndex = index;
    rowEls[index]?.focus();
  }

  function onRowClick(index: number, event: MouseEvent): void {
    if (event.shiftKey) extendTo(index);
    else if (event.metaKey || event.ctrlKey) toggleAt(index);
    else selectOnly(index);
    rowEls[index]?.focus();
  }

  // --- keyboard ------------------------------------------------------------
  function handleKeydown(event: KeyboardEvent): void {
    const n = items.length;
    if (n === 0) return;

    if (placing) {
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          caretGap = Math.max(0, caretGap - 1);
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          caretGap = Math.min(n, caretGap + 1);
          break;
        case 'Home':
          event.preventDefault();
          caretGap = 0;
          break;
        case 'End':
          event.preventDefault();
          caretGap = n;
          break;
        case 'Enter':
          event.preventDefault();
          confirmPlacement();
          break;
        case 'Escape':
          event.preventDefault();
          cancelPlacement();
          break;
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (event.shiftKey) extendTo(Math.min(n - 1, focusIndex + 1));
        else moveFocus(Math.min(n - 1, focusIndex + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (event.shiftKey) extendTo(Math.max(0, focusIndex - 1));
        else moveFocus(Math.max(0, focusIndex - 1));
        break;
      case 'Home':
        event.preventDefault();
        if (event.shiftKey) extendTo(0);
        else moveFocus(0);
        break;
      case 'End':
        event.preventDefault();
        if (event.shiftKey) extendTo(n - 1);
        else moveFocus(n - 1);
        break;
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        toggleAt(focusIndex);
        break;
      case 'Enter':
        event.preventDefault();
        if (hasSelection && !readOnly) startPlacement();
        break;
    }
  }

  // --- placement mode ------------------------------------------------------
  function startPlacement(): void {
    // Start the caret just after the selected block.
    const indices = orderIds.map((id, i) => (selectedIds.has(id) ? i : -1)).filter(i => i >= 0);
    caretGap = indices.length ? indices[indices.length - 1] + 1 : 0;
    destination = null;
    hoverGap = null;
    placing = true;
    announcePolite(
      $t('Placing {count} chapters. Arrow keys to choose, Enter to confirm, Escape to cancel.', {
        count: selectedCount,
      })
    );
  }

  function confirmPlacement(): void {
    placing = false;
    destination = caretGap;
    announcePolite(
      $t('Move {count} chapters before {name}. Apply to commit.', {
        count: selectedCount,
        name: gapLabel(caretGap),
      })
    );
    applyBtn?.focus();
  }

  function cancelPlacement(): void {
    placing = false;
    announcePolite($t('Placement cancelled'));
  }

  // --- destination via mouse ----------------------------------------------
  function setDestination(gap: number): void {
    if (readOnly || !hasSelection) return;
    placing = false;
    hoverGap = null;
    destination = gap;
    announcePolite(
      gap >= items.length
        ? $t('Move {count} chapters to the end. Apply to commit.', { count: selectedCount })
        : $t('Move {count} chapters before {name}. Apply to commit.', {
            count: selectedCount,
            name: gapLabel(gap),
          })
    );
  }

  // --- commit --------------------------------------------------------------
  async function applyMove(): Promise<void> {
    if (!canApply || pending) return;
    const gap = destination!;
    const movedCount = selectedCount;
    const newOrder = computeMovedOrder(orderIds, selectedIds, gap);
    pending = true;
    try {
      const updated = await workspaceService.updateSpineOrder(workspace, newOrder);
      onWorkspaceUpdate?.(updated);
      await reload(updated); // selection (moved ids) survives the prune
      destination = null;
      hoverGap = null;
      placing = false;
      await tick();
      const firstIdx = items.findIndex(it => selectedIds.has(it.id));
      if (firstIdx >= 0) {
        focusIndex = firstIdx;
        anchorIndex = firstIdx;
        rowEls[firstIdx]?.focus();
      }
      announcePolite($t('Moved {count} chapters', { count: movedCount }));
    } catch (error) {
      announceAssertive(
        $t('Move failed: {message}', {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      pending = false;
    }
  }

  async function toggleAside(): Promise<void> {
    if (!hasSelection || pending || readOnly) return;
    const target = !anySelectedLinear; // any linear → set aside (false); else restore (true)
    const ids = [...selectedIds];
    pending = true;
    try {
      let ws = workspace;
      for (const id of ids) {
        const result = await spineService.setChapterLinear(ws, id, target);
        ws = result.updatedWorkspace;
      }
      onWorkspaceUpdate?.(ws);
      await reload(ws);
      selectedIds = new Set(ids);
      announcePolite(
        target
          ? $t('Restored {count} chapters', { count: ids.length })
          : $t('Set aside {count} chapters', { count: ids.length })
      );
    } catch (error) {
      announceAssertive(
        $t('Failed: {message}', {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      pending = false;
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!hasSelection || pending || readOnly) return;
    const ids = [...selectedIds];
    pending = true;
    try {
      let ws = workspace;
      for (const id of ids) {
        const result = await spineService.deleteChapter(ws, id);
        ws = result.updatedWorkspace;
      }
      onWorkspaceUpdate?.(ws);
      await reload(ws);
      selectedIds = new Set();
      anchorIndex = -1;
      resetDestination();
      focusIndex = Math.min(focusIndex, Math.max(0, items.length - 1));
      announcePolite($t('Deleted {count} chapters', { count: ids.length }));
    } catch (error) {
      announceAssertive(
        $t('Delete failed: {message}', {
          message: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      pending = false;
      confirmingDelete = false;
    }
  }

  // --- import & folder-sync (relocated from the sidebar) -------------------
  // These buttons only dispatch the same bubbling window events the sidebar
  // used; the always-mounted SpineSidebar orchestrates the actual work.
  let textFileInput = $state<HTMLInputElement | null>(null);
  const folderSyncSupported = isFolderSyncSupported();
  let folderSyncStatus = $state<FolderSyncStatus>('not-linked');
  $effect(() => {
    const workspaceId = workspace?.id;
    if (!folderSyncSupported || !workspaceId) return;
    const refresh = () => {
      void getFolderSyncStatus(workspaceId).then(status => (folderSyncStatus = status));
    };
    refresh();
    window.addEventListener('seed:folder-sync-changed', refresh);
    return () => window.removeEventListener('seed:folder-sync-changed', refresh);
  });
  const folderSyncLabel = $derived(
    !folderSyncSupported
      ? $t('Link folder…')
      : folderSyncStatus === 'not-linked'
        ? $t('Link folder…')
        : folderSyncStatus === 'connected'
          ? $t('Sync folder')
          : $t('Reconnect folder')
  );
  const folderSyncTitle = $derived(
    folderSyncSupported
      ? folderSyncLabel
      : $t(
          'Not available in this browser — linking a folder needs the File System Access API (Chrome, Edge)'
        )
  );

  function handleImportTextClick(): void {
    textFileInput?.click();
  }

  function handleTextFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      // One selection may mix text and images (fixed layout only); each kind
      // goes to its own import pipeline in SpineSidebar.
      const files = Array.from(input.files);
      const isImage = (f: File) =>
        f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
      const images = files.filter(isImage);
      const texts = files.filter(f => !isImage(f));
      if (texts.length > 0) {
        window.dispatchEvent(
          new CustomEvent('import-text-chapters', { detail: { files: texts }, bubbles: true })
        );
      }
      if (images.length > 0) {
        window.dispatchEvent(
          new CustomEvent('import-image-chapters', { detail: { files: images }, bubbles: true })
        );
      }
      input.value = '';
    }
  }

  function handleFolderSyncClick(): void {
    if (!folderSyncSupported) return;
    window.dispatchEvent(new CustomEvent('folder-sync-open'));
  }
</script>

<div class="chapters-view">
  <PaneGroup direction="horizontal" autoSaveId="seedhtml-chapters-panes">
    <!-- Left: the labelled list — identify + select. -->
    <Pane defaultSize={55} minSize={30}>
      <div class="chapters-pane">
        <PaneHeader>
          {#snippet children()}
            <span class="pane-title">{$t('Chapters')}</span>
            {#if hasSelection}
              <span class="pane-sub">{$t('{count} selected', { count: selectedCount })}</span>
            {/if}
          {/snippet}
          {#snippet actions()}
            {#if !readOnly}
              <button class="action" type="button" onclick={handleImportTextClick}>
                {$t('Import from files')}
              </button>
              <!-- aria-disabled (not disabled) keeps the button hoverable so the
                   tooltip explaining WHY is reachable where the API is missing. -->
              <button
                class="action"
                class:unavailable={!folderSyncSupported}
                type="button"
                aria-disabled={!folderSyncSupported}
                onclick={handleFolderSyncClick}
                title={folderSyncTitle}
              >
                {$t('Link a folder')}
              </button>
            {/if}
          {/snippet}
        </PaneHeader>
        <input
          bind:this={textFileInput}
          type="file"
          multiple
          accept={importAccept}
          class="hidden-file-input"
          onchange={handleTextFilesSelected}
        />
        <div class="list-scroll">
          {#if items.length === 0}
            <div class="chapters-empty">{$t('No chapters yet')}</div>
          {:else}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
              class="chapter-list"
              role="listbox"
              aria-multiselectable="true"
              aria-label={$t('Chapters')}
              tabindex="-1"
              onkeydown={handleKeydown}
            >
              <button
                class="gap"
                class:chosen={!placing && destination === 0}
                class:caret={placing && caretGap === 0}
                class:hovering={!placing && destination == null && hoverGap === 0}
                type="button"
                tabindex="-1"
                aria-hidden="true"
                disabled={readOnly || !hasSelection}
                onclick={() => setDestination(0)}
                onmouseenter={() => (hasSelection && !placing ? (hoverGap = 0) : null)}
                onmouseleave={() => (hoverGap === 0 ? (hoverGap = null) : null)}
              ></button>

              {#each items as item, i (item.id)}
                <!-- Keyboard for the option rows is handled on the listbox (APG roving
                 tabindex + arrow keys), not per-row. -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  class="chapter-row"
                  class:selected={selectedIds.has(item.id)}
                  class:aside={!item.linear}
                  id={`chapter-row-${i}`}
                  role="option"
                  aria-selected={selectedIds.has(item.id)}
                  tabindex={focusIndex === i ? 0 : -1}
                  bind:this={rowEls[i]}
                  onclick={event => onRowClick(i, event)}
                  onfocus={() => (focusIndex = i)}
                >
                  <span class="chapter-title">{label(item)}</span>
                  {#if !item.linear}
                    <span class="aside-badge">{$t('Set aside')}</span>
                  {/if}
                </div>

                <button
                  class="gap"
                  class:chosen={!placing && destination === i + 1}
                  class:caret={placing && caretGap === i + 1}
                  class:hovering={!placing && destination == null && hoverGap === i + 1}
                  type="button"
                  tabindex="-1"
                  aria-hidden="true"
                  disabled={readOnly || !hasSelection}
                  onclick={() => setDestination(i + 1)}
                  onmouseenter={() => (hasSelection && !placing ? (hoverGap = i + 1) : null)}
                  onmouseleave={() => (hoverGap === i + 1 ? (hoverGap = null) : null)}
                ></button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </Pane>

    <PaneResizer />

    <!-- Right: the abstract schematic; this pane's header carries the actions,
         matching the toolbar convention of the other views' preview panes. -->
    <Pane defaultSize={45} minSize={25}>
      <div class="chapters-pane">
        <PaneHeader>
          {#snippet children()}
            {#if confirmingDelete}
              <span class="action-status"
                >{$t('Delete {count} chapters?', { count: selectedCount })}</span
              >
            {:else}
              <div class="header-ops">
                <button
                  class="action"
                  type="button"
                  onclick={toggleAside}
                  disabled={!hasSelection || pending || readOnly}
                >
                  {anySelectedLinear ? $t('Set aside') : $t('Restore')}
                </button>
                <button
                  class="action danger"
                  type="button"
                  onclick={() => (confirmingDelete = true)}
                  disabled={!hasSelection || pending || readOnly}
                >
                  {$t('Delete')}
                </button>
              </div>
            {/if}
          {/snippet}
          {#snippet actions()}
            {#if confirmingDelete}
              <button
                class="action danger"
                type="button"
                onclick={confirmDelete}
                disabled={pending}
              >
                {$t('Delete')}
              </button>
              <button class="action" type="button" onclick={() => (confirmingDelete = false)}>
                {$t('Cancel')}
              </button>
            {:else}
              <button
                class="action primary"
                type="button"
                bind:this={applyBtn}
                onclick={applyMove}
                disabled={!canApply || pending}
              >
                {$t('Apply')}
              </button>
              {#if destination != null || placing}
                <button class="action" type="button" onclick={resetDestination} disabled={pending}>
                  {$t('Cancel')}
                </button>
              {/if}
            {/if}
          {/snippet}
        </PaneHeader>
        <div class="diagram-frame">
          <SpineDiagram {items} {selectedIds} {proposedOrder} />
        </div>
      </div>
    </Pane>
  </PaneGroup>

  <!-- Screen reader announcements -->
  <div bind:this={politeEl} aria-live="polite" aria-atomic="true" class="sr-only"></div>
  <div bind:this={assertiveEl} aria-live="assertive" aria-atomic="true" class="sr-only"></div>
</div>

<style>
  .chapters-view {
    height: 100%;
    min-height: 0;
  }
  .chapters-pane {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary);
  }
  .pane-title {
    font-weight: var(--font-semibold);
  }
  .pane-sub {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
  }
  .hidden-file-input {
    display: none;
  }

  .list-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-3);
  }

  .chapter-list {
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .chapter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    user-select: none;
  }
  .chapter-row:hover {
    background: var(--color-bg-tertiary);
  }
  .chapter-row.selected {
    background: var(--color-bg-active);
    border-color: var(--color-accent);
  }
  .chapter-row:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
  }
  .chapter-row.aside .chapter-title {
    color: var(--color-text-tertiary);
    font-style: italic;
  }
  .chapter-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .aside-badge {
    flex: none;
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Insertion gaps — mouse-only affordances (keyboard uses the placement caret),
     hidden from assistive tech so the listbox exposes only its option rows. */
  .gap {
    height: 6px;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    position: relative;
  }
  .gap:disabled {
    cursor: default;
  }
  .gap::after {
    content: '';
    position: absolute;
    inset-inline: var(--space-2);
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    border-radius: var(--radius-full);
    background: transparent;
  }
  .gap:not(:disabled):hover::after,
  .gap.hovering::after {
    background: var(--color-border-strong);
  }
  .gap.caret::after,
  .gap.chosen::after {
    background: var(--color-accent);
    height: 3px;
  }

  .diagram-frame {
    flex: 1;
    min-height: 0;
    display: flex;
    justify-content: center;
    padding: var(--space-4);
  }

  /* Operation buttons fill the header's left; a cramped pane scrolls them
     horizontally rather than overflowing the toolbar. */
  .header-ops {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow-x: auto;
  }
  .action-status {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-sm);
    white-space: nowrap;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
  }
  .action:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
  }
  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .action:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
  }
  .action.primary {
    background: var(--color-interactive-primary);
    border-color: var(--color-interactive-primary);
    color: var(--color-on-accent);
  }
  .action.primary:hover:not(:disabled) {
    background: var(--color-interactive-primary-hover);
  }
  .action.danger {
    color: var(--color-error-600, var(--color-text-primary));
  }
  /* Folder sync where the File System Access API is missing (e.g. Firefox):
     dimmed but still hoverable so the tooltip can explain why. */
  .action.unavailable {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chapters-empty {
    padding: var(--space-6);
    color: var(--color-text-tertiary);
    text-align: center;
  }
</style>
