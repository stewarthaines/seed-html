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
      <h2 class="sidebar-title">EDITME</h2>
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

    width: 100%;
    background: #f8f9fa;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100vh;
  }

  .sidebar.collapsed {
    width: 100%;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid #e0e0e0;
    background: #ffffff;
    flex-shrink: 0;
    min-height: 60px;
  }

  .sidebar-toggle {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .sidebar-toggle:hover {
    background: #f0f0f0;
  }

  .sidebar-toggle:focus {
    outline: 2px solid #007acc;
    outline-offset: 2px;
  }

  .sidebar-title {
    margin: 0 0 0 0.75rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: #333;
  }

  .sidebar-nav {
    padding: 0.5rem 0;
    flex-shrink: 0;
  }

  .sidebar-section {
    width: 100%;
    background: none;
    border: none;
    display: flex;
    align-items: center;
    padding: 0.75rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    text-align: left;
    color: #666;
  }

  .sidebar-section:hover {
    background: #f0f0f0;
    color: #333;
  }

  .sidebar-section:focus {
    outline: 2px solid #007acc;
    outline-offset: -2px;
  }

  .sidebar-section.active {
    background: #e3f2fd;
    color: #1976d2;
    border-right: 3px solid #1976d2;
  }

  .section-icon {
    font-size: 1.2rem;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .section-label {
    margin-left: 0.75rem;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    background: #ffffff;
  }

  /* Scrollbar styling */
  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-content::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  .sidebar-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }

  .sidebar-content::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  /* Update CSS custom property for grid layout */
  .sidebar {
    --sidebar-width: 250px;
  }

  .sidebar.collapsed {
    --sidebar-width: 48px;
  }
</style>
