<script lang="ts">
  import type { Snippet } from 'svelte';
  import { layoutStore, type SidebarSection } from './stores/layout';
  import { t } from '../lib/i18n';
  import ThemeToggle from './ThemeToggle.svelte';
  import ReaditInaBookMark from './components/icons/ReaditInaBookMark.svelte';
  import {
    House,
    Export,
    Gear,
    Article,
    ListBullets,
    BookOpen,
    Plus,
    FileArrowUp,
    CaretLeft,
    CaretRight,
    CaretDown,
    Lock,
    ToggleRight,
  } from 'phosphor-svelte';

  // Props
  interface Props {
    isExpanded?: boolean;
    activeSection?: SidebarSection;
    hasWorkspace?: boolean;
    /** Read-only EPUB: hide the add/import-chapter actions. */
    readOnly?: boolean;
    /** Track-changes review mode: structure + metadata locked. Drives the padlock
        affordances on the affected sections (distinct from a read-only EPUB). */
    reviewMode?: boolean;
    /** Whether any packaged EPUBs exist — the Publish tab hides when there are
        none (and no publish plugin is enabled), to declutter the first run. */
    hasPackagedEpubs?: boolean;
    enabledPluginIds?: string[];
    currentWorkspace?: any;
    workspaceTitle?: string;
    extensionManager?: any;
    // Per-section content (snippets replace the former named slots).
    sidebarSpine?: Snippet;
    sidebarAbout?: Snippet;
    sidebarWorkspace?: Snippet;
    sidebarMetadata?: Snippet;
    sidebarManifest?: Snippet;
    sidebarNavigation?: Snippet;
    sidebarSettings?: Snippet;
    sidebarFooter?: Snippet;
  }

  let {
    isExpanded = true,
    activeSection = 'workspace',
    hasWorkspace = false,
    readOnly = false,
    reviewMode = false,
    hasPackagedEpubs = false,
    enabledPluginIds = [],
    currentWorkspace = null,
    workspaceTitle = undefined,
    extensionManager = null,
    sidebarSpine,
    sidebarAbout,
    sidebarWorkspace,
    sidebarMetadata,
    sidebarManifest,
    sidebarNavigation,
    sidebarSettings,
    sidebarFooter,
  }: Props = $props();

  // Extension state
  let extensions = $state<any[]>([]);
  let extensionsLoading = $state(false);

  // Load extensions when workspace changes
  $effect(() => {
    if (currentWorkspace?.id && extensionManager) {
      extensionsLoading = true;
      extensionManager
        .listWorkspaceExtensions(currentWorkspace.id)
        .then((exts: any[]) => {
          extensions = exts;
          extensionsLoading = false;
        })
        .catch(() => {
          extensions = [];
          extensionsLoading = false;
        });
    } else {
      extensions = [];
      extensionsLoading = false;
    }
  });

  // Show the platform brand name only when served from the readitinabook.com domain
  // (or a subdomain). Everywhere else — localhost, *.pages.dev, standalone HTML, inside
  // an EPUB (file://) — keep the descriptive "Simple EPUB Editor" heading.
  const isBrandHost =
    typeof window !== 'undefined' &&
    /(^|\.)readitinabook\.com$/i.test(window.location.hostname);

  // Main navigation sections (clickable)
  const MAIN_SECTIONS: Array<{
    id: Exclude<SidebarSection, 'spine'>;
    icon: typeof House;
    label: string;
    requiresWorkspace?: boolean;
  }> = [
    { id: 'about', icon: ReaditInaBookMark, label: $t('About SEED.html') },
    { id: 'workspace', icon: House, label: $t('Projects') },
    { id: 'publish', icon: Export, label: $t('Publish') },
    { id: 'settings', icon: Gear, label: $t('Settings') },
    { id: 'metadata', icon: Article, label: $t('Metadata'), requiresWorkspace: true },
    { id: 'manifest', icon: ListBullets, label: $t('Manifest'), requiresWorkspace: true },
    { id: 'navigation', icon: BookOpen, label: $t('Navigation'), requiresWorkspace: true },
  ];

  // Fixed-layout (pre-paginated) EPUBs are organized as pages, not chapters —
  // relabel the spine section accordingly. Visible label only.
  const spineSectionLabel = $derived(
    currentWorkspace?.opf?.metadata?.renditionLayout === 'pre-paginated'
      ? $t('Pages')
      : $t('Chapters')
  );
  // Spine item count, shown beside the heading e.g. "Chapters (12)".
  const chapterCount = $derived(currentWorkspace?.opf?.spine?.length ?? 0);

  // When the publish-to-remote plugin is enabled, annotate the Publish item so
  // the user can see which plugin is driving it.
  const PUBLISH_PLUGIN_ID = 'publish-to-remote';
  const sectionLabel = (section: { id: SidebarSection; label: string }) => $t(section.label);
  // The plugin driving an item is shown as a small second line below the label
  // (like the project's text-format subtitle), not appended in parens — otherwise
  // it wraps awkwardly in longer locales (e.g. de "Veröffentlichen (publish-to-remote)").
  const sectionSubLabel = (section: { id: SidebarSection }) =>
    section.id === 'publish' && enabledPluginIds.includes(PUBLISH_PLUGIN_ID)
      ? PUBLISH_PLUGIN_ID
      : '';

  // The Publish tab is only useful once there's something to publish — a packaged
  // EPUB, or the publish-to-remote plugin enabled. Otherwise it's an empty page,
  // so hide it (notably on first run, before any EPUB has been packaged).
  const publishVisible = $derived(hasPackagedEpubs || enabledPluginIds.includes(PUBLISH_PLUGIN_ID));

  // The book title hosts a disclosure that collapses the project nav group.
  const PROJECT_NAV_IDS: SidebarSection[] = ['settings', 'metadata', 'manifest', 'navigation'];
  const isProjectNav = (id: SidebarSection) => PROJECT_NAV_IDS.includes(id);
  const projectNavExpanded = $derived($layoutStore.sidebar.projectNavExpanded);
  // Only hide the group when there's a workspace (the disclosure lives on the book title).
  const hideProjectNav = $derived(hasWorkspace && !projectNavExpanded);

  function toggleProjectNav() {
    layoutStore.toggleProjectNav();
  }

  function toggleSidebar() {
    layoutStore.toggleSidebar();
  }

  function setSidebarSection(section: SidebarSection) {
    layoutStore.setSidebarSection(section);
  }

  function shouldShowSection(section: { requiresWorkspace?: boolean }): boolean {
    return !section.requiresWorkspace || hasWorkspace;
  }

  function handleAppendItem() {
    // Dispatch event for SpineSidebar to handle
    const event = new CustomEvent('append-spine-item', {
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  // Import plain-text files as chapters (one chapter per file). The hidden input
  // is triggered by the file-arrow-up button; SpineSidebar handles the creation.
  let textFileInput = $state<HTMLInputElement | null>(null);

  function handleImportTextClick() {
    textFileInput?.click();
  }

  function handleTextFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      window.dispatchEvent(
        new CustomEvent('import-text-chapters', {
          detail: { files: Array.from(input.files) },
          bubbles: true,
        })
      );
      input.value = '';
    }
  }
</script>

<!-- Padlock affordance for sections affected by track-changes review mode. -->
{#snippet lockMark(kind: 'lock' | 'control', corner = false)}
  <span
    class="section-lock"
    class:corner
    class:control={kind === 'control'}
    title={kind === 'control'
      ? $t('Track changes is on — manage it in Settings')
      : $t('Locked while track changes is on')}
  >
    {#if kind === 'control'}
      <ToggleRight size={corner ? 13 : 16} weight="fill" aria-hidden="true" />
    {:else}
      <Lock size={corner ? 11 : 14} weight="fill" aria-hidden="true" />
    {/if}
  </span>
{/snippet}

<aside class="sidebar" class:collapsed={!isExpanded}>
  <div class="sidebar-header">
    <button
      class="btn btn-icon btn-icon-lg sidebar-toggle"
      onclick={toggleSidebar}
      aria-expanded={isExpanded}
      aria-label={$t('Toggle sidebar')}
    >
      {#if isExpanded}<CaretLeft size={16} aria-hidden="true" />{:else}<CaretRight
          size={16}
          aria-hidden="true"
        />{/if}
    </button>

    {#if isExpanded}
      <h2 class="sidebar-title">{isBrandHost ? 'ReaditInaBook.com' : $t('Simple EPUB Editor')}</h2>
      <div class="header-actions">
        <ThemeToggle size="small" showLabel={false} />
      </div>
    {/if}
  </div>

  <div class="sidebar-main">
    <nav class="sidebar-nav" aria-label={$t('Main navigation')}>
      <!-- Non-workspace sections first -->
      {#each MAIN_SECTIONS.filter(section => !section.requiresWorkspace) as section}
        {@const Icon = section.icon}
        {#if section.id === 'settings'}
          <!-- Workspace title section before Settings -->
          {#if hasWorkspace && currentWorkspace}
            <div class="workspace-title-section">
              {#if isExpanded}
                <!-- The whole title row is the disclosure control. -->
                <button
                  type="button"
                  class="workspace-title-header"
                  onclick={toggleProjectNav}
                  aria-expanded={projectNavExpanded}
                  aria-label={projectNavExpanded
                    ? $t('Hide project sections')
                    : $t('Show project sections')}
                  title={projectNavExpanded
                    ? $t('Hide project sections')
                    : $t('Show project sections')}
                >
                  <span class="workspace-title-info">
                    <span class="workspace-title" title={workspaceTitle || $t('Untitled Project')}>
                      {workspaceTitle || $t('Untitled Project')}
                    </span>
                    {#if extensions.length > 0 || extensionsLoading}
                      <span class="workspace-extensions">
                        {#if extensionsLoading}
                          {$t('Loading...')}
                        {:else}
                          {extensions.map(ext => ext.name).join(', ')}
                        {/if}
                      </span>
                    {/if}
                  </span>
                  <span class="disclose-caret" aria-hidden="true">
                    {#if projectNavExpanded}
                      <CaretDown size={14} />
                    {:else}
                      <CaretRight size={14} />
                    {/if}
                  </span>
                </button>
              {:else}
                <!-- Collapsed: just the disclose button — the badge/extension
                     count convey nothing useful at this width. Single 44px row. -->
                <div class="workspace-title-header compact">
                  <button
                    class="append-button-nav"
                    onclick={toggleProjectNav}
                    aria-expanded={projectNavExpanded}
                    aria-label={projectNavExpanded
                      ? $t('Hide project sections')
                      : $t('Show project sections')}
                    title={projectNavExpanded
                      ? $t('Hide project sections')
                      : $t('Show project sections')}
                  >
                    {#if projectNavExpanded}
                      <CaretDown size={14} aria-hidden="true" />
                    {:else}
                      <CaretRight size={14} aria-hidden="true" />
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        {/if}

        {#if (!isProjectNav(section.id) || !hideProjectNav) && (section.id !== 'publish' || publishVisible)}
          {@const subLabel = sectionSubLabel(section)}
          <button
            class="sidebar-section"
            class:active={activeSection === section.id}
            onclick={() => setSidebarSection(section.id)}
            aria-current={activeSection === section.id ? 'page' : undefined}
            title={subLabel ? `${sectionLabel(section)} (${subLabel})` : sectionLabel(section)}
          >
            <span class="section-icon">
              <Icon
                size={18}
                weight={activeSection === section.id ? 'fill' : 'regular'}
                aria-hidden="true"
              />
            </span>
            {#if isExpanded}
              <span class="section-label" class:section-label--stacked={subLabel}>
                <span class="section-label-main">{sectionLabel(section)}</span>
                {#if subLabel}
                  <span class="section-label-sub">{subLabel}</span>
                {/if}
              </span>
            {/if}
            {#if reviewMode && section.id === 'settings'}
              {@render lockMark('control', !isExpanded)}
            {/if}
          </button>
        {/if}
      {/each}

      <!-- Workspace-specific sections (only show if workspace exists) -->
      {#each MAIN_SECTIONS.filter(section => section.requiresWorkspace) as section}
        {@const Icon = section.icon}
        {#if shouldShowSection(section) && (!isProjectNav(section.id) || !hideProjectNav)}
          <button
            class="sidebar-section"
            class:active={activeSection === section.id}
            onclick={() => setSidebarSection(section.id)}
            aria-current={activeSection === section.id ? 'page' : undefined}
            title={$t(section.label)}
          >
            <span class="section-icon">
              <Icon
                size={18}
                weight={activeSection === section.id ? 'fill' : 'regular'}
                aria-hidden="true"
              />
            </span>
            {#if isExpanded}
              <span class="section-label">{$t(section.label)}</span>
            {/if}
            {#if reviewMode && (section.id === 'metadata' || section.id === 'manifest')}
              {@render lockMark('lock', !isExpanded)}
            {/if}
          </button>
        {/if}
      {/each}

      <!-- Chapters section header (non-clickable) -->
      {#if hasWorkspace}
        <input
          bind:this={textFileInput}
          type="file"
          multiple
          accept=".txt,.md,.markdown,text/plain"
          class="visually-hidden-input"
          onchange={handleTextFilesSelected}
        />
        {#if isExpanded}
          <div class="spine-section-header workspace-title-section">
            <span class="section-label">{spineSectionLabel}&nbsp;&nbsp;[ {chapterCount} ]</span>
            {#if !readOnly}
              <div class="spine-header-actions">
                <button
                  class="append-button-nav"
                  onclick={handleImportTextClick}
                  aria-label={$t('Import text files as chapters')}
                  title={$t('Import text files as chapters')}
                >
                  <FileArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  class="append-button-nav"
                  onclick={handleAppendItem}
                  aria-label={$t('Append Item')}
                  title={$t('Append Item')}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>
            {/if}
          </div>
        {:else if !readOnly}
          <!-- Collapsed: just the append button — a single uniform-height row.
               The title/aria identify the action; the import button is
               expanded-only. -->
          <div class="spine-section-header compact">
            <button
              class="append-button-nav"
              onclick={handleAppendItem}
              aria-label={$t('Append Item')}
              title={$t('Append Item')}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
        {/if}
      {/if}
    </nav>

    <!-- Always visible spine items -->
    <div class="spine-items-container">
      {@render sidebarSpine?.()}
    </div>

    <!-- Content snippets for different sections -->
    <div class="section-content">
      {@render sidebarAbout?.()}
      {@render sidebarWorkspace?.()}
      {@render sidebarMetadata?.()}
      {@render sidebarManifest?.()}
      {@render sidebarNavigation?.()}
      {@render sidebarSettings?.()}
    </div>
  </div>

  <div class="sidebar-footer">
    {@render sidebarFooter?.()}
  </div>
</aside>

<style>
  .sidebar {
    --sidebar-width: 250px;
    --sidebar-collapsed-width: 48px;

    inline-size: 100%; /* Using logical properties */
    background: var(--color-sidebar-bg); /* Use semantic sidebar background */
    display: flex;
    flex-direction: column;
    overflow-x: visible; /* Allow active items to extend past border */
    overflow-y: hidden;
    block-size: 100vh;
    block-size: 100dvh; /* dynamic viewport: excludes mobile browser UI chrome */
    position: relative; /* For absolute positioning of settings content */
  }

  .sidebar.collapsed {
    inline-size: 100%; /* Using logical properties */
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    background: var(--color-bg-tertiary); /* Match .workspace-title-section */
    flex-shrink: 0;
    min-block-size: var(--touch-target-min); /* 44px - meets WCAG AA requirements even for header */
  }

  /* Flat icon button — matches the Chapters .append-button-nav reference. */

  .sidebar-title {
    margin: 0; /* Simple reset */
    margin-inline-start: var(--space-2);
    font-size: var(--text-sm); /* Even smaller for compact look */
    color: var(--color-text-primary);
    flex: 1; /* Take remaining space */
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-inline-start: var(--space-2);
  }

  /* Collapsed: the header holds only the expand toggle — centre it. */
  .sidebar.collapsed .sidebar-header {
    justify-content: center;
    padding-inline: 0;
  }

  .sidebar-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: visible; /* Allow active items to extend and focus rings to show */
    display: flex;
    flex-direction: column;
    background: var(--color-bg-secondary); /* Grey background for scrollable area */
  }

  .sidebar-nav {
    padding-block: 0; /* No extra padding for ultra-compact */
    padding-inline: 0;
    flex-shrink: 0;
  }

  .sidebar-footer {
    flex-shrink: 0;
    background: var(--color-bg-secondary); /* Grey background to match nav */
    border-top: 1px solid var(--color-border-default); /* Subtle separation */
  }

  .sidebar-section {
    inline-size: 100%; /* Using logical properties */
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-block: var(--space-2); /* Match spine item padding */
    padding-inline: var(--space-2);
    cursor: pointer;
    transition: background-color 0.1s ease; /* Faster transition */
    text-align: start; /* Using logical properties */
    color: var(--color-text-link); /* Blue link color */
    min-block-size: var(--touch-target-min); /* 44px - meets WCAG AA touch target requirements */
    font-size: var(--text-sm); /* Smaller font */
    outline: none;
    position: relative;
  }

  /* Solid azure hover, unified with the buttons and the other list rows. */
  .sidebar-section:hover:not(.active) {
    background: var(--color-hover-accent);
    color: var(--color-on-accent);
  }

  .sidebar-section:hover:not(.active) .section-label-sub {
    color: var(--color-on-accent);
  }

  .sidebar-section:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus); /* Use standard focus ring */
    /* Inset the ring so it sits inside the item rather than bleeding into
       adjacent sidebar sections. */
    outline-offset: calc(-1 * var(--focus-ring-offset));
    z-index: 1; /* Ensure focus ring appears above */
  }

  /* Active item: the shared azure left-bar + tint convention. High specificity
     to override the base .sidebar-section link styling. */
  :global(.sidebar .sidebar-section.active) {
    color: var(--color-text-primary) !important;
    font-weight: var(--font-normal) !important;
    background: var(--color-bg-primary) !important;
    box-shadow: inset 3px 0 0 var(--color-accent) !important;
  }

  :global(.sidebar .sidebar-section.active .section-label) {
    text-decoration: none !important; /* Remove underline for active state */
  }

  .spine-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block: 0 var(--space-2) 0;
    padding-inline: var(--space-2) 0;
    min-block-size: var(--touch-target-min); /* 44px - meets WCAG AA touch target requirements */
    color: var(--color-text-primary);
    background: transparent;
  }

  .spine-section-header .section-label {
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
  }

  /* Import + append buttons sit together on the right (stacked when compact). */
  .spine-header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .visually-hidden-input {
    display: none;
  }

  /* Collapsed: a single centred append button, same height as every other row.
     Reset the base's asymmetric left inline padding so it centres true. */
  .spine-section-header.compact {
    justify-content: center;
    padding-block: 0;
    padding-inline: 0;
    position: relative;
  }

  /* Track-changes padlock affordance on locked sections. */
  .section-lock {
    display: inline-flex;
    align-items: center;
    margin-inline-start: auto;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  /* Collapsed sidebar: sit in the icon's corner instead of trailing the label. */
  .section-lock.corner {
    position: absolute;
    inset-block-start: 4px;
    inset-inline-end: 4px;
    margin: 0;
  }

  /* The Settings mark is the control, not a lock — accent it so it reads as
     active/actionable and is unmistakable next to the muted padlocks. */
  .section-lock.control {
    color: var(--color-interactive-primary, var(--color-text-link));
  }

  .append-button-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--touch-target-min);
    block-size: var(--touch-target-min);
    border: none;
    background: transparent;
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    transition: all var(--duration-fast) ease;
  }

  .append-button-nav:hover {
    background: var(--color-hover-accent);
    color: var(--color-on-accent);
  }

  .append-button-nav:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
    z-index: 1;
  }

  .section-icon {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .spine-items-container {
    flex: 1;
    /* Remove overflow - let parent handle scrolling */
  }

  .section-label {
    font-size: var(--text-base); /* Using typography tokens */
    font-weight: var(--font-normal);
  }

  /* Two-line nav label: the main label plus a smaller grey subtitle (the plugin
     driving the item), mirroring the project title/subtitle just below it. */
  .section-label--stacked {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1px;
    min-width: 0;
  }

  .section-label-main {
    line-height: 1.2;
  }

  .section-label-sub {
    font-size: var(--text-xs);
    line-height: 1.2;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Compact sidebar styling */
  .sidebar.collapsed .section-label {
    font-size: var(--text-xs);
    text-align: center;
    font-weight: var(--font-medium);
  }

  .sidebar.collapsed .sidebar-section {
    justify-content: center;
    padding-inline: var(--space-1);
  }

  /* Scrollbar styling for main scrollable area */
  .sidebar-main::-webkit-scrollbar {
    inline-size: 6px; /* Using logical properties */
  }

  .sidebar-main::-webkit-scrollbar-track {
    background: var(--color-bg-secondary); /* Using design tokens */
  }

  .sidebar-main::-webkit-scrollbar-thumb {
    background: var(--color-border-strong); /* Using design tokens */
    border-radius: var(--radius-xs); /* Using border radius tokens */
  }

  .sidebar-main::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary); /* Using design tokens */
  }

  /* Update CSS custom property for grid layout */
  .sidebar {
    --sidebar-width: 250px;
  }

  .sidebar.collapsed {
    --sidebar-width: 48px;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .sidebar {
      border-inline-end: 2px solid var(--color-forced-border);
    }

    .sidebar-header {
      border-block-end: 2px solid var(--color-forced-border);
    }

    .sidebar-section.active {
      border-inline-end: 4px solid var(--color-forced-active);
    }
  }

  /* RTL support - icons that need direction flipping */
  :global([dir='rtl']) .sidebar-toggle {
    transform: scaleX(-1);
  }

  /* Disabled state styling */
  .sidebar-section:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: var(--color-text-disabled, var(--color-text-tertiary));
  }

  .sidebar-section:disabled:hover {
    text-decoration: none;
    background: transparent;
  }

  .append-button-nav:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: transparent;
    color: var(--color-text-disabled, var(--color-text-tertiary));
  }

  .append-button-nav:disabled:hover {
    background: transparent;
    color: var(--color-text-disabled, var(--color-text-tertiary));
  }

  /* Workspace title section */
  .workspace-title-section {
    border-top: 1px solid var(--color-border-default);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
    margin-block: 0 var(--space-2) 0;
  }

  .workspace-title-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    padding-block: var(--space-1);
    padding-inline: var(--space-2);
    min-block-size: var(--touch-target-min);
  }

  /* The expanded title row is a full-width disclosure button. */
  button.workspace-title-header {
    inline-size: 100%;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
    transition: background var(--duration-fast) ease;
  }

  button.workspace-title-header:hover {
    background: var(--color-bg-hover);
  }

  button.workspace-title-header:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: calc(-1 * var(--focus-ring-width));
  }

  .disclose-caret {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  /* Title + extensions stack as two tight lines that fit within the 44px row. */
  .workspace-title-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* Collapsed: a single centred disclose button, same height as every other row. */
  .workspace-title-header.compact {
    justify-content: center;
    padding-block: 0;
    padding-inline: 0;
  }

  .workspace-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    line-height: 1.2;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .workspace-extensions {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.2;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }
</style>
