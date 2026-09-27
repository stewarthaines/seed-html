<!--
  WriteSidebar — the chapter column beside the editor: a header with the
  collapse toggle, the Chapters (or Pages) heading that opens the Contents
  view, and the append button; then the chapter list the app passes in.
  Collapsed, it is a 48px rail with the toggle and the append button.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../../i18n';
  import { CaretLeft, CaretRight, Plus } from 'phosphor-svelte';

  let {
    isExpanded = true,
    readOnly = false,
    label,
    count = 0,
    onToggle,
    onOpenContents,
    onAppend,
    children,
  }: {
    isExpanded?: boolean;
    readOnly?: boolean;
    /** "Chapters" for reflowable books, "Pages" for fixed layout. */
    label: string;
    count?: number;
    onToggle: () => void;
    onOpenContents: () => void;
    onAppend: () => void;
    children?: Snippet;
  } = $props();
</script>

<aside class="write-sidebar" class:collapsed={!isExpanded} aria-label={label}>
  <div class="header">
    <button
      type="button"
      class="btn btn-icon btn-icon-lg toggle"
      onclick={onToggle}
      aria-expanded={isExpanded}
      aria-label={$t('Toggle sidebar')}
    >
      {#if isExpanded}<CaretLeft size={16} aria-hidden="true" />{:else}<CaretRight
          size={16}
          aria-hidden="true"
        />{/if}
    </button>
    {#if isExpanded}
      <button
        type="button"
        class="heading"
        onclick={onOpenContents}
        title={$t('Manage chapter order')}
        data-testid="nav-chapters"
      >
        {label}
        <span class="count">[ {count} ]</span>
      </button>
    {/if}
    {#if !readOnly}
      <button
        type="button"
        class="btn btn-icon btn-icon-lg append"
        onclick={onAppend}
        aria-label={$t('Append Item')}
        title={$t('Append Item')}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    {/if}
  </div>
  <div class="list">
    {@render children?.()}
  </div>
</aside>

<style>
  .write-sidebar {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-block-size: 0;
    background: var(--color-sidebar-bg);
    border-inline-end: 1px solid var(--color-border-default);
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-block-size: var(--touch-target-min);
    background: var(--color-bg-tertiary);
  }

  .collapsed .header {
    flex-direction: column;
  }

  .header .btn {
    border-radius: 0;
    inline-size: var(--touch-target-min);
    min-block-size: var(--touch-target-min);
  }

  .heading {
    flex: 1;
    min-inline-size: 0;
    border: 0;
    background: transparent;
    padding-inline: var(--space-2);
    min-block-size: var(--touch-target-min);
    text-align: start;
    font: inherit;
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    white-space: nowrap;
    cursor: pointer;
  }

  .heading:hover {
    background: var(--color-hover-accent);
    color: var(--color-on-accent);
  }

  .heading:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: calc(-1 * var(--focus-ring-width));
  }

  .count {
    margin-inline-start: var(--space-2);
    color: var(--color-text-secondary);
  }

  .heading:hover .count {
    color: inherit;
  }

  .list {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--color-bg-secondary);
  }
</style>
