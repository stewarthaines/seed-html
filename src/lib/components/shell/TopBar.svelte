<!--
  TopBar — the bar across the top of an open book: back to Books, the book's
  title with its actions, the three tabs (Write, Book, Share), and on the
  trailing side the agent-bridge toggle (localhost only), Settings and
  Package EPUB. When the Book tab is active a second row lists its sections.

  The tabs and sections navigate by the existing view ids; which tab is
  active is derived from the current view, so the navigation store stays the
  single source of truth (process/APP_MAKEOVER_LIBRARY.md, phase 1).
-->
<script lang="ts">
  import { t } from '../../i18n';
  import type { ViewType } from '../../navigation/types';
  import { persisted, asEnum } from '../../state/persisted.svelte.js';
  import { Package, Robot, Lock, ToggleRight } from 'phosphor-svelte';
  import BookMenu from '../books/BookMenu.svelte';

  type Tab = 'write' | 'book' | 'share';
  type BookSection = 'cover' | 'chapters' | 'navigation' | 'metadata' | 'manifest';
  const BOOK_SECTIONS: readonly BookSection[] = [
    'cover',
    'chapters',
    'navigation',
    'metadata',
    'manifest',
  ];

  let {
    title,
    currentView,
    settingsOpen = false,
    readOnly = false,
    reviewMode = false,
    agentBridgeAvailable = false,
    agentStatus = null,
    agentDetail = null,
    onToggleAgent,
    onNavigate,
    onPackage,
    onDuplicate,
    onDelete,
  }: {
    title: string | undefined;
    currentView: ViewType;
    /** The Settings sheet is open over this view. */
    settingsOpen?: boolean;
    /** The whole book is read-only (not a SEED EPUB): packaging and edits are off. */
    readOnly?: boolean;
    /** Track-changes review mode: structure and metadata are locked. */
    reviewMode?: boolean;
    agentBridgeAvailable?: boolean;
    agentStatus?: string | null;
    agentDetail?: string | null;
    onToggleAgent?: () => void;
    onNavigate: (view: ViewType) => void;
    onPackage: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
  } = $props();

  // The Book tab remembers which of its sections was open last.
  const lastBookSection = persisted<BookSection>(
    'seedhtml_book_section',
    'metadata',
    asEnum(BOOK_SECTIONS)
  );

  const activeTab = $derived.by((): Tab | null => {
    if (currentView === 'spine') return 'write';
    if ((BOOK_SECTIONS as readonly string[]).includes(currentView)) return 'book';
    if (currentView === 'publish') return 'share';
    return null;
  });

  $effect(() => {
    if ((BOOK_SECTIONS as readonly string[]).includes(currentView)) {
      lastBookSection.current = currentView as BookSection;
    }
  });

  const tabs = $derived<{ id: Tab; label: string; view: ViewType }[]>([
    { id: 'write', label: $t('Write'), view: 'spine' },
    { id: 'book', label: $t('Book'), view: lastBookSection.current },
    { id: 'share', label: $t('Share'), view: 'publish' },
  ]);

  const sections = $derived<{ id: BookSection; label: string }[]>([
    { id: 'cover', label: $t('Cover') },
    { id: 'chapters', label: $t('Contents') },
    { id: 'metadata', label: $t('Details') },
    { id: 'manifest', label: $t('Files') },
  ]);

  const displayTitle = $derived(title || $t('Untitled Project'));

  const agentActive = $derived(agentStatus === 'connected' || agentStatus === 'connecting');

  function handleMenu(id: string) {
    if (id === 'duplicate') onDuplicate();
    else if (id === 'delete') onDelete();
  }
</script>

<header class="top-bar" class:has-sections={activeTab === 'book'}>
  <div class="bar-row">
    <button
      type="button"
      class="back"
      onclick={() => onNavigate('workspace')}
      data-testid="nav-workspace"
    >
      <span aria-hidden="true">←</span>
      {$t('Books')}
    </button>

    <div class="title-group">
      <h2 class="title" title={displayTitle}>{displayTitle}</h2>
      <BookMenu
        label={$t('Actions for {title}', { title: displayTitle })}
        items={[
          { id: 'duplicate', label: $t('Duplicate') },
          { id: 'delete', label: $t('Delete…'), danger: true },
        ]}
        onSelect={handleMenu}
        alwaysVisible
      />
    </div>

    <nav class="tabs" aria-label={$t('Book')}>
      {#each tabs as tab (tab.id)}
        <button
          type="button"
          class="tab"
          class:active={activeTab === tab.id}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          onclick={() => onNavigate(tab.view)}
          data-testid={tab.id === 'share' ? 'nav-publish' : `nav-${tab.id}`}
        >
          {tab.label}
          {#if tab.id === 'book' && reviewMode}
            <span class="lock" title={$t('Locked while track changes is on')}>
              <Lock size={12} weight="fill" aria-hidden="true" />
            </span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="trailing">
      {#if agentBridgeAvailable}
        <!-- Localhost-only, deliberately untranslated: absent from the hosted
             site and embedded copies. -->
        <!-- i18n-ignore -->
        <button
          type="button"
          class="btn btn-secondary agent-toggle"
          class:active={agentActive}
          onclick={onToggleAgent}
          aria-pressed={agentStatus === 'connected'}
          title={agentDetail || 'Allow agent assistance'}
          aria-label="Allow agent assistance"
        >
          <Robot size={18} aria-hidden="true" />
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-secondary"
        class:active={settingsOpen}
        aria-expanded={settingsOpen}
        onclick={() => onNavigate('settings')}
        data-testid="nav-settings"
      >
        {$t('Settings')}
        {#if reviewMode}
          <span class="lock control" title={$t('Track changes is on — manage it in Settings')}>
            <ToggleRight size={14} weight="fill" aria-hidden="true" />
          </span>
        {/if}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        onclick={onPackage}
        disabled={readOnly}
        title={readOnly
          ? $t("This EPUB wasn't created in the Simple EPUB Editor, so it can't be edited.")
          : $t('Package EPUB')}
        data-testid="package-epub"
      >
        <Package size={18} aria-hidden="true" />
        {$t('Package EPUB')}
      </button>
    </div>
  </div>

  {#if activeTab === 'book'}
    <nav class="sections" aria-label={$t('Book sections')}>
      {#each sections as section (section.id)}
        <button
          type="button"
          class="section"
          class:active={currentView === section.id}
          aria-current={currentView === section.id ? 'page' : undefined}
          onclick={() => onNavigate(section.id)}
          data-testid={`nav-${section.id}`}
        >
          {section.label}
        </button>
      {/each}
    </nav>
  {/if}
</header>

<style>
  .top-bar {
    flex-shrink: 0;
    background: var(--color-bg-primary);
    border-block-end: 1px solid var(--color-border-default);
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    block-size: var(--bar-height);
    padding-inline: var(--space-5);
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border: 0;
    background: transparent;
    padding: 0;
    color: var(--color-text-link);
    font: inherit;
    font-size: var(--text-base);
    cursor: pointer;
    white-space: nowrap;
    min-block-size: var(--touch-target-min);
  }

  .back:hover {
    color: var(--color-text-link-hover);
    text-decoration: underline;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-inline-size: 0;
    max-inline-size: 320px;
  }

  .title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tabs {
    display: flex;
    align-self: stretch;
    gap: var(--space-1);
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border: 0;
    border-block-end: 3px solid transparent;
    background: transparent;
    padding-inline: var(--space-3);
    color: var(--color-text-link);
    font: inherit;
    font-size: var(--text-base);
    cursor: pointer;
  }

  .tab:hover {
    color: var(--color-text-link-hover);
  }

  .tab.active {
    color: var(--color-text-primary);
    font-weight: var(--font-bold);
    border-block-end-color: var(--color-text-primary);
  }

  .trailing {
    margin-inline-start: auto;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .trailing .btn {
    min-block-size: 32px;
    gap: var(--space-2);
  }

  .trailing .btn.active {
    background: var(--color-bg-secondary);
  }

  .agent-toggle.active {
    color: var(--color-on-accent);
    background: var(--color-hover-accent);
    border-color: var(--color-hover-accent);
  }

  .lock {
    display: inline-flex;
    align-items: center;
    color: var(--color-text-tertiary);
  }

  .lock.control {
    color: var(--color-interactive-primary);
  }

  .sections {
    display: flex;
    gap: var(--space-1);
    padding-inline: var(--space-5);
    border-block-start: 1px solid var(--color-border-subtle);
    background: var(--color-bg-tertiary);
  }

  .section {
    border: 0;
    border-block-end: 2px solid transparent;
    background: transparent;
    padding-block: var(--space-2);
    padding-inline: var(--space-3);
    min-block-size: 40px;
    color: var(--color-text-link);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .section:hover {
    color: var(--color-text-link-hover);
  }

  .section.active {
    color: var(--color-text-primary);
    font-weight: var(--font-bold);
    border-block-end-color: var(--color-text-primary);
  }

  .back:focus-visible,
  .tab:focus-visible,
  .section:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }

  @media (max-width: 900px) {
    .bar-row {
      gap: var(--space-3);
      padding-inline: var(--space-3);
    }

    .title-group {
      max-inline-size: 160px;
    }
  }

  /* Narrow screens (the phone layout is phase 5): the bar wraps onto two
     rows instead of pushing Package EPUB out of view. */
  @media (max-width: 720px) {
    .bar-row {
      flex-wrap: wrap;
      block-size: auto;
      min-block-size: var(--bar-height);
      padding-block: var(--space-1);
      row-gap: 0;
    }

    .tabs {
      align-self: auto;
      block-size: var(--touch-target-min);
    }

    .trailing {
      flex-basis: 100%;
      justify-content: flex-end;
      padding-block-end: var(--space-1);
    }
  }
</style>
