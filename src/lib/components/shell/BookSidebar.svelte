<!--
  BookSidebar — the column beside the Book tab's screens, in the place the
  chapter column takes in Write: Cover, Contents, Details and Files, each with
  a line saying where that part of the book stands. It shares Write's collapse
  state: collapsed, it is a 48px rail of the toggle and one icon per section.
-->
<script lang="ts">
  import { t } from '../../i18n';
  import type { BookSection } from '../../stores/book-section.js';
  import type { Component } from 'svelte';
  import { CaretLeft, CaretRight, Image, ListNumbers, Info, Files } from 'phosphor-svelte';

  let {
    currentView,
    summaries = {},
    isExpanded = true,
    onToggle,
    onNavigate,
  }: {
    currentView: string;
    isExpanded?: boolean;
    onToggle: () => void;
    /** One line under each section; a section without one shows its name alone. */
    summaries?: Partial<Record<BookSection, string>>;
    onNavigate: (section: BookSection) => void;
  } = $props();

  const sections = $derived<{ id: BookSection; label: string; icon: Component }[]>([
    { id: 'cover', label: $t('Cover'), icon: Image },
    { id: 'chapters', label: $t('Contents'), icon: ListNumbers },
    { id: 'metadata', label: $t('Details'), icon: Info },
    { id: 'manifest', label: $t('Files'), icon: Files },
  ]);
</script>

<aside class="book-sidebar" class:collapsed={!isExpanded}>
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
      <span class="heading">{$t('This book')}</span>
    {/if}
  </div>
  <nav class="list" aria-label={$t('Book sections')}>
    {#each sections as section (section.id)}
      <button
        type="button"
        class="section"
        class:active={currentView === section.id}
        aria-current={currentView === section.id ? 'page' : undefined}
        onclick={() => onNavigate(section.id)}
        aria-label={isExpanded ? undefined : section.label}
        title={isExpanded ? undefined : section.label}
        data-testid={`nav-${section.id}`}
      >
        {#if isExpanded}
          <span class="name">{section.label}</span>
          {#if summaries[section.id]}
            <span class="summary">{summaries[section.id]}</span>
          {/if}
        {:else}
          <section.icon size={18} aria-hidden="true" />
        {/if}
      </button>
    {/each}
  </nav>
</aside>

<style>
  .book-sidebar {
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

  .header .btn {
    border-radius: 0;
    inline-size: var(--touch-target-min);
    min-block-size: var(--touch-target-min);
  }

  .heading {
    padding-inline: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .list {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    background: var(--color-bg-secondary);
  }

  .section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-0-5);
    inline-size: 100%;
    min-block-size: var(--touch-target-min);
    padding-block: var(--space-2);
    padding-inline: var(--space-3);
    border: 0;
    border-inline-start: 3px solid transparent;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .section:hover:not(.active) {
    background: var(--color-hover-accent);
    color: var(--color-on-accent);
  }

  .section.active {
    background: var(--color-bg-primary);
    border-inline-start-color: var(--color-accent);
    font-weight: var(--font-bold);
  }

  .section:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: calc(-1 * var(--focus-ring-offset));
  }

  .summary {
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
  }

  .section:hover:not(.active) .summary {
    color: inherit;
  }

  .collapsed .section {
    align-items: center;
    padding-inline: 0;
  }
</style>
