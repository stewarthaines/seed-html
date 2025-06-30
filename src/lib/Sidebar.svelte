<script lang="ts">
  import { layoutStore, type SidebarSection } from './stores/layout';

  // Props
  export let isExpanded = true;
  export let activeSection: SidebarSection = 'workspace';

  // Sidebar sections configuration
  const SIDEBAR_SECTIONS: Array<{ id: SidebarSection; icon: string; label: string }> = [
    { id: 'workspace', icon: '🏠', label: 'Workspace' },
    { id: 'metadata', icon: '📄', label: 'Metadata' },
    { id: 'manifest', icon: '📋', label: 'Manifest' },
    { id: 'nav', icon: '📖', label: 'Navigation' },
    { id: 'spine', icon: '📖', label: 'Spine Items' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ] as const;

  function toggleSidebar() {
    layoutStore.toggleSidebar();
  }

  function setSidebarSection(section: SidebarSection) {
    layoutStore.setSidebarSection(section);
  }
</script>

<aside class="sidebar" class:collapsed={!isExpanded}>
  <div class="sidebar-header">
    <button
      class="sidebar-toggle"
      on:click={toggleSidebar}
      aria-expanded={isExpanded}
      aria-controls="sidebar-content"
      aria-label="Toggle sidebar"
    >
      {isExpanded ? '◀️' : '▶️'}
    </button>

    {#if isExpanded}
      <h2 class="sidebar-title">EDITME.html</h2>
    {/if}
  </div>

  <nav class="sidebar-nav" aria-label="Main navigation">
    {#each SIDEBAR_SECTIONS as section}
      <button
        class="sidebar-section"
        class:active={activeSection === section.id}
        on:click={() => setSidebarSection(section.id)}
        aria-current={activeSection === section.id ? 'page' : undefined}
        title={section.label}
      >
        <span class="section-icon">{section.icon}</span>
        {#if isExpanded}
          <span class="section-label">{section.label}</span>
        {/if}
      </button>
    {/each}
  </nav>

  {#if isExpanded}
    <div class="sidebar-content" id="sidebar-content">
      {#if activeSection === 'workspace'}
        <slot name="sidebar-workspace" />
      {:else if activeSection === 'metadata'}
        <slot name="sidebar-metadata" />
      {:else if activeSection === 'manifest'}
        <slot name="sidebar-manifest" />
      {:else if activeSection === 'nav'}
        <slot name="sidebar-nav" />
      {:else if activeSection === 'spine'}
        <slot name="sidebar-spine" />
      {:else if activeSection === 'settings'}
        <slot name="sidebar-settings" />
      {/if}
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    --sidebar-width: 250px;
    --sidebar-collapsed-width: 48px;

    inline-size: 100%; /* Using logical properties */
    background: var(--color-bg-secondary); /* Using design tokens */
    border-inline-end: 1px solid var(--color-border-default); /* Using logical properties and tokens */
    display: flex;
    flex-direction: column;
    overflow: hidden;
    block-size: 100vh; /* Using logical properties */
  }

  .sidebar.collapsed {
    inline-size: 100%; /* Using logical properties */
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    padding-block: var(--space-3); /* Using logical properties and spacing tokens */
    padding-inline: var(--space-3);
    border-block-end: 1px solid var(--color-border-default); /* Using logical properties and tokens */
    background: var(--color-bg-primary); /* Using design tokens */
    flex-shrink: 0;
    min-block-size: 60px; /* Using logical properties */
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
    margin-block: 0; /* Using logical properties */
    margin-inline: 0 0 0 var(--space-3); /* Using logical properties and spacing tokens */
    font-size: var(--text-lg); /* Using typography tokens */
    font-weight: var(--font-semibold);
    color: var(--color-text-primary); /* Using design tokens */
  }

  .sidebar-nav {
    padding-block: var(--space-2) 0; /* Using logical properties and spacing tokens */
    padding-inline: 0;
    flex-shrink: 0;
  }

  .sidebar-section {
    inline-size: 100%; /* Using logical properties */
    background: none;
    border: none;
    display: flex;
    align-items: center;
    padding-block: var(--space-3); /* Using logical properties and spacing tokens */
    padding-inline: var(--space-3);
    cursor: pointer;
    transition: background-color var(--duration-fast) ease; /* Using motion tokens */
    text-align: start; /* Using logical properties */
    color: var(--color-text-secondary); /* Using design tokens */
    min-block-size: var(--touch-target-min); /* Using accessibility tokens */
  }

  .sidebar-section:hover {
    background: var(--color-interactive-secondary-hover); /* Using design tokens */
    color: var(--color-text-primary);
  }

  .sidebar-section:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus); /* Using accessibility tokens */
    outline-offset: calc(-1 * var(--focus-ring-offset));
  }

  .sidebar-section.active {
    background: var(--color-bg-accent); /* Using design tokens */
    color: var(--color-text-accent);
    border-inline-end: 3px solid var(--color-border-accent); /* Using logical properties and tokens */
  }

  .section-icon {
    font-size: var(--text-lg); /* Using typography tokens */
    inline-size: 24px; /* Using logical properties */
    block-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .section-label {
    margin-inline-start: var(--space-3); /* Using logical properties and spacing tokens */
    font-size: var(--text-sm); /* Using typography tokens */
    font-weight: var(--font-medium);
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding-block: var(--space-4); /* Using logical properties and spacing tokens */
    padding-inline: var(--space-4);
    background: var(--color-bg-primary); /* Using design tokens */
  }

  /* Scrollbar styling using design tokens */
  .sidebar-content::-webkit-scrollbar {
    inline-size: 6px; /* Using logical properties */
  }

  .sidebar-content::-webkit-scrollbar-track {
    background: var(--color-bg-secondary); /* Using design tokens */
  }

  .sidebar-content::-webkit-scrollbar-thumb {
    background: var(--color-border-strong); /* Using design tokens */
    border-radius: var(--radius-xs); /* Using border radius tokens */
  }

  .sidebar-content::-webkit-scrollbar-thumb:hover {
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
  [dir="rtl"] .sidebar-toggle {
    transform: scaleX(-1);
  }
</style>
