<script lang="ts">
  import { layoutStore, type SidebarSection } from './stores/layout';
  import { t } from '../lib/i18n';

  // Props
  export let isExpanded = true;
  export let activeSection: SidebarSection = 'workspace';

  // Main navigation sections (clickable)
  const MAIN_SECTIONS: Array<{
    id: Exclude<SidebarSection, 'spine' | 'settings'>;
    icon: string;
    label: string;
  }> = [
    { id: 'workspace', icon: '🏠', label: $t('Workspace') },
    { id: 'metadata', icon: '📄', label: $t('Metadata') },
    { id: 'manifest', icon: '📋', label: $t('Manifest') },
    { id: 'navigation', icon: '📖', label: $t('Navigation') },
  ] as const;

  // Settings section (separate for footer)
  const SETTINGS_SECTION = { id: 'settings' as const, icon: '⚙️', label: $t('Settings') };

  function toggleSidebar() {
    layoutStore.toggleSidebar();
  }

  function setSidebarSection(section: SidebarSection) {
    layoutStore.setSidebarSection(section);
  }

  function handleAppendItem() {
    // Dispatch event for SpineSidebar to handle
    const event = new CustomEvent('append-spine-item', {
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  function generateCompactLabel(label: string): string {
    // Take first 2 letters of the label
    return label.slice(0, 2).toUpperCase();
  }
</script>

<aside class="sidebar" class:collapsed={!isExpanded}>
  <div class="sidebar-header">
    <button
      class="sidebar-toggle"
      on:click={toggleSidebar}
      aria-expanded={isExpanded}
      aria-label={$t('Toggle sidebar')}
    >
      {isExpanded ? '◀️' : '▶️'}
    </button>

    {#if isExpanded}
      <h2 class="sidebar-title">EDITME.html</h2>
    {/if}
  </div>

  <div class="sidebar-main">
    <nav class="sidebar-nav" aria-label={$t('Main navigation')}>
      {#each MAIN_SECTIONS as section}
        <button
          class="sidebar-section"
          class:active={activeSection === section.id}
          on:click={() => setSidebarSection(section.id)}
          aria-current={activeSection === section.id ? 'page' : undefined}
          title={$t(section.label)}
        >
          <span class="section-label">
            {#if isExpanded}
              {$t(section.label)}
            {:else}
              {generateCompactLabel($t(section.label))}
            {/if}
          </span>
        </button>
      {/each}

      <!-- Spine Items section header (non-clickable) -->
      {#if isExpanded}
        <div class="spine-section-header">
          <span class="section-label">{$t('Spine Items')}</span>
          <button
            class="append-button-nav"
            on:click={handleAppendItem}
            aria-label={$t('Append Item')}
            title={$t('Append Item')}
          >
            <span class="append-icon">+</span>
          </button>
        </div>
      {:else}
        <div class="spine-section-header compact">
          <span class="section-label">{generateCompactLabel($t('Spine Items'))}</span>
          <button
            class="append-button-nav compact"
            on:click={handleAppendItem}
            aria-label={$t('Append Item')}
            title={$t('Append Item')}
          >
            <span class="append-icon">+</span>
          </button>
        </div>
      {/if}
    </nav>

    <!-- Always visible spine items -->
    <div class="spine-items-container">
      <slot name="sidebar-spine" />
    </div>

    <!-- Content slots for different sections -->
    <div class="section-content">
      <slot name="sidebar-workspace" />
      <slot name="sidebar-metadata" />
      <slot name="sidebar-manifest" />
      <slot name="sidebar-navigation" />
      <slot name="sidebar-settings" />
    </div>
  </div>

  <div class="sidebar-footer">
    <button
      class="sidebar-section"
      class:active={activeSection === SETTINGS_SECTION.id}
      on:click={() => setSidebarSection(SETTINGS_SECTION.id)}
      aria-current={activeSection === SETTINGS_SECTION.id ? 'page' : undefined}
      title={$t(SETTINGS_SECTION.label)}
    >
      <span class="section-label">
        {#if isExpanded}
          {$t(SETTINGS_SECTION.label)}
        {:else}
          {generateCompactLabel($t(SETTINGS_SECTION.label))}
        {/if}
      </span>
    </button>
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
    block-size: 100vh; /* Using logical properties */
    position: relative; /* For absolute positioning of settings content */
  }

  .sidebar.collapsed {
    inline-size: 100%; /* Using logical properties */
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    padding-block: var(--space-1); /* More compact */
    padding-inline: var(--space-2);
    border-block-end: 1px solid var(--color-border-default); /* Using logical properties and tokens */
    background: var(--color-bg-primary); /* Using design tokens */
    flex-shrink: 0;
    min-block-size: var(--touch-target-min); /* 44px - meets WCAG AA requirements even for header */
  }

  .sidebar-toggle {
    background: none;
    border: none;
    font-size: var(--text-lg); /* Using typography tokens */
    cursor: pointer;
    padding-block: var(--space-2); /* Using logical properties and spacing tokens */
    padding-inline: var(--space-2);
    border-radius: var(--radius-sm); /* Using border radius tokens */
    transition: background-color var(--duration-fast) ease; /* Using motion tokens */
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 32px; /* Using logical properties */
    block-size: 32px;
    min-inline-size: var(--touch-target-min); /* Using accessibility tokens */
    min-block-size: var(--touch-target-min);
  }

  .sidebar-toggle:hover {
    background: var(--color-interactive-secondary-hover); /* Using design tokens */
  }

  .sidebar-toggle:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus); /* Using accessibility tokens */
    outline-offset: var(--focus-ring-offset);
  }

  .sidebar-title {
    margin: 0; /* Simple reset */
    margin-inline-start: var(--space-2);
    font-size: var(--text-sm); /* Even smaller for compact look */
    font-weight: var(--font-normal);
    color: var(--color-text-secondary); /* Subdued like Craigslist */
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

  .sidebar-section:hover {
    text-decoration: underline; /* Craigslist style hover */
  }

  .sidebar-section:hover:not(.active) {
    background: var(--color-bg-tertiary); /* Light grey hover */
  }

  .sidebar-section:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus); /* Use standard focus ring */
    outline-offset: var(--focus-ring-offset);
    z-index: 1; /* Ensure focus ring appears above */
  }

  /* High specificity for Craigslist-style visual connection */
  :global(.sidebar .sidebar-section.active) {
    background: var(--color-bg-primary) !important; /* White background like main content */
    color: var(--color-text-primary) !important;
    font-weight: var(--font-normal) !important;
    border-top: 1px solid var(--color-border-default) !important;
    border-bottom: 1px solid var(--color-border-default) !important;
    border-right: 1px solid var(--color-bg-primary) !important; /* Hide the right border to connect */
    margin-inline-end: -1px !important; /* Extend past the sidebar border */
    position: relative !important;
    z-index: 1 !important; /* Ensure it appears above the sidebar border */
  }

  :global(.sidebar .sidebar-section.active .section-label) {
    text-decoration: none !important; /* Remove underline for active state */
  }

  .spine-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-block: var(--space-2);
    padding-inline: var(--space-2);
    min-block-size: var(--touch-target-min); /* 44px - meets WCAG AA touch target requirements */
    color: var(--color-text-primary);
    background: transparent;
  }

  .spine-section-header .section-label {
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
  }

  .spine-section-header.compact {
    justify-content: center;
    flex-direction: column;
    gap: var(--space-1);
    padding-block: var(--space-1);
  }

  .spine-section-header.compact .section-label {
    font-size: var(--text-xs);
    text-align: center;
  }

  .append-button-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--touch-target-min);
    block-size: var(--touch-target-min);
    border: none;
    background: var(--color-bg-primary);
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    transition: all var(--duration-fast) ease;
  }

  .append-button-nav:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .append-button-nav:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
    z-index: 1;
  }

  .append-button-nav.compact {
    inline-size: var(--touch-target-min);
    block-size: var(--touch-target-min);
    font-size: var(--text-xs);
  }

  .append-icon {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }

  .spine-items-container {
    flex: 1;
    /* Remove overflow - let parent handle scrolling */
  }

  .section-label {
    font-size: var(--text-base); /* Using typography tokens */
    font-weight: var(--font-normal);
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
</style>
