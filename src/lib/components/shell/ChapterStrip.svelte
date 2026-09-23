<!--
  ChapterStrip — the phone's chapter line above the editor and the preview:
  the chapter's name, its place in the book, and a way to move between
  chapters (a menu in Write, previous/next in Preview). Replaces the chapter
  column, which has no room on a phone (process/APP_MAKEOVER_LIBRARY.md, phase 5).
-->
<script lang="ts">
  import { t } from '../../i18n';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';
  import type { SpineService, SpineItemWithSource } from '../../services/spine/spine.service.js';
  import { CaretLeft, CaretRight } from 'phosphor-svelte';
  import BookMenu from '../books/BookMenu.svelte';

  let {
    workspace,
    spineService,
    selectedItemId,
    mode,
    readOnly = false,
    onSelect,
    onAppend,
  }: {
    workspace: WorkspaceState;
    spineService: SpineService;
    selectedItemId: string | null;
    mode: 'write' | 'preview';
    readOnly?: boolean;
    onSelect: (itemId: string) => void;
    onAppend?: () => void;
  } = $props();

  let items = $state<SpineItemWithSource[]>([]);

  // Reload the chapter list whenever the book's spine changes.
  $effect(() => {
    const ws = workspace;
    void ws.opf?.spine;
    let cancelled = false;
    spineService
      .loadSpineItems(ws)
      .then(list => {
        if (!cancelled) items = list;
      })
      .catch(() => {
        if (!cancelled) items = [];
      });
    return () => {
      cancelled = true;
    };
  });

  const index = $derived(items.findIndex(item => item.id === selectedItemId));
  const current = $derived(index >= 0 ? items[index] : null);
  const label = $derived(current ? (current.title ?? current.id) : '');

  const menuItems = $derived([
    ...items.map(item => ({
      id: item.id,
      label: item.title ?? item.id,
      checked: item.id === selectedItemId,
    })),
    ...(onAppend && !readOnly
      ? [{ id: '__append', label: $t('Add chapter'), heading: false }]
      : []),
  ]);

  function handleMenu(id: string): void {
    if (id === '__append') onAppend?.();
    else onSelect(id);
  }

  function step(delta: -1 | 1): void {
    const next = items[index + delta];
    if (next) onSelect(next.id);
  }
</script>

<div class="chapter-strip">
  <span class="name" title={label}>{label}</span>
  {#if items.length > 0}
    <span class="place">{$t('{n} of {total}', { n: index + 1, total: items.length })}</span>
  {/if}
  <span class="spacer"></span>
  {#if mode === 'write'}
    <BookMenu
      label={$t('Chapters')}
      triggerText={$t('Chapters')}
      items={menuItems}
      onSelect={handleMenu}
      alwaysVisible
      menuWidth="240px"
    />
  {:else}
    <button
      type="button"
      class="btn btn-icon"
      onclick={() => step(-1)}
      disabled={index <= 0}
      aria-label={$t('Previous chapter')}
    >
      <CaretLeft size={18} aria-hidden="true" />
    </button>
    <button
      type="button"
      class="btn btn-icon"
      onclick={() => step(1)}
      disabled={index < 0 || index >= items.length - 1}
      aria-label={$t('Next chapter')}
    >
      <CaretRight size={18} aria-hidden="true" />
    </button>
  {/if}
</div>

<style>
  .chapter-strip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: 44px;
    padding-inline: var(--space-4);
    background: var(--color-bg-tertiary);
    border-block-end: 1px solid var(--color-border-default);
  }

  .name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .place {
    flex-shrink: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .spacer {
    flex: 1;
  }
</style>
