<script lang="ts">
  import { onMount } from 'svelte';
  import WorkspaceActionBar from '../lib/components/workspace/WorkspaceActionBar.svelte';
  import WorkspaceList from '../lib/components/workspace/WorkspaceList.svelte';
  import type { WorkspaceInfo } from '../lib/workspace/types';

  export let showEmptyState = false;
  export let showLoadingState = false;
  export let showErrorStates = false;

  let workspaces: WorkspaceInfo[] = [];
  let currentWorkspaceId: string | null = null;
  let currentWorkspace: WorkspaceInfo | null = null;
  let isLoading = false;

  // Mock workspace data
  const mockWorkspaces: WorkspaceInfo[] = [
    {
      id: 'workspace-1',
      title: 'The Adventures of Tom Sawyer',
      author: 'Mark Twain',
      language: 'en',
      lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      fileCount: 15,
      totalSize: 2400000,
      epubVersion: '3.0',
    },
    {
      id: 'workspace-2',
      title: 'Technical Manual for Advanced Users',
      author: 'John Smith',
      language: 'en',
      lastModified: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      fileCount: 8,
      totalSize: 890000,
      epubVersion: '3.0',
    },
    {
      id: 'workspace-3',
      title: "Alice's Adventures in Wonderland",
      author: 'Lewis Carroll',
      language: 'en',
      lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      fileCount: 12,
      totalSize: 1650000,
      epubVersion: '3.0',
    },
    {
      id: 'workspace-4',
      title: 'Cooking Recipes Collection',
      author: 'Chef Anna',
      language: 'en',
      lastModified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      fileCount: 25,
      totalSize: 3200000,
      epubVersion: '3.0',
    },
    {
      id: 'workspace-5',
      title: 'الأسود يليق بك',
      author: 'أحلام مستغانمي',
      language: 'ar',
      lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      fileCount: 10,
      totalSize: 1100000,
      epubVersion: '3.0',
    },
    {
      id: 'workspace-6',
      title: 'Das Kapital',
      author: 'Karl Marx',
      language: 'de',
      lastModified: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
      fileCount: 45,
      totalSize: 8900000,
      epubVersion: '3.0',
    },
  ];

  const errorWorkspace: WorkspaceInfo = {
    id: 'workspace-error',
    title: 'Corrupted Project',
    author: 'Unknown',
    language: 'en',
    lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    fileCount: 0,
    totalSize: 0,
    epubVersion: 'unknown',
    hasError: true,
  };

  // Initialize data based on props
  const initializeData = () => {
    if (showEmptyState) {
      workspaces = [];
      currentWorkspaceId = null;
      currentWorkspace = null;
    } else if (showLoadingState) {
      workspaces = [];
      currentWorkspaceId = null;
      currentWorkspace = null;
      isLoading = true;
    } else {
      workspaces = showErrorStates ? [errorWorkspace, ...mockWorkspaces] : [...mockWorkspaces];

      // Set first workspace as current (if not empty)
      if (workspaces.length > 0 && !showErrorStates) {
        currentWorkspaceId = workspaces[0].id;
        currentWorkspace = workspaces[0];
      }
    }
  };

  // Handle workspace actions
  const handleCreateNew = () => {
    console.log('Story: Create new workspace requested');

    // Simulate creating a new workspace
    const newWorkspace: WorkspaceInfo = {
      id: `workspace-new-${Date.now()}`,
      title: 'Untitled Book Project',
      author: 'Unknown',
      language: 'en',
      lastModified: new Date(),
      fileCount: 1,
      totalSize: 5000,
      epubVersion: '3.0',
    };

    workspaces = [newWorkspace, ...workspaces];
    currentWorkspaceId = newWorkspace.id;
    currentWorkspace = newWorkspace;
  };

  const handleLoadEpub = () => {
    console.log('Story: Load EPUB requested');
    alert('In the real app, this would open a file picker to select an EPUB file for import.');
  };

  const handleWorkspaceSelect = (event: CustomEvent<{ workspaceId: string }>) => {
    const { workspaceId } = event.detail;
    console.log('Story: Workspace selected:', workspaceId);

    currentWorkspaceId = workspaceId;
    currentWorkspace = workspaces.find(w => w.id === workspaceId) || null;
  };

  const handleWorkspaceDelete = (event: CustomEvent<{ workspaceId: string }>) => {
    const { workspaceId } = event.detail;
    const workspace = workspaces.find(w => w.id === workspaceId);

    if (!workspace) return;

    const confirmed = confirm(`Delete "${workspace.title}"? This cannot be undone.`);
    if (!confirmed) return;

    console.log('Story: Workspace deleted:', workspaceId);

    // Remove from list
    workspaces = workspaces.filter(w => w.id !== workspaceId);

    // Clear current if it was deleted
    if (currentWorkspaceId === workspaceId) {
      currentWorkspaceId = null;
      currentWorkspace = null;
    }
  };

  const handleSwitchWorkspace = () => {
    console.log('Story: Switch workspace requested');
    // In the real app, this would scroll to the workspace list
    const workspaceListElement = document.querySelector('.workspace-list');
    if (workspaceListElement) {
      workspaceListElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCloseWorkspace = () => {
    console.log('Story: Close workspace requested');
    currentWorkspaceId = null;
    currentWorkspace = null;
  };

  onMount(() => {
    initializeData();

    // Simulate loading completion for loading state
    if (showLoadingState) {
      setTimeout(() => {
        isLoading = false;
        workspaces = [...mockWorkspaces];
      }, 2000);
    }
  });

  // Re-initialize when props change
  $: if (showEmptyState || showLoadingState || showErrorStates) {
    initializeData();
  }
</script>

<div class="workspace-demo">
  <div class="demo-header">
    <h2>Workspace Management Components</h2>
    <p>Interactive demonstration of workspace UI components</p>
  </div>

  <div class="demo-content">
    <!-- Current Workspace Bar -->
    <div class="demo-section">
      <h3>Current Workspace Bar</h3>
      <CurrentWorkspaceBar
        {currentWorkspace}
        on:switchRequested={handleSwitchWorkspace}
        on:closeRequested={handleCloseWorkspace}
      />
    </div>

    <!-- Action Bar -->
    <div class="demo-section">
      <h3>Workspace Action Bar</h3>
      <WorkspaceActionBar
        {isLoading}
        on:createNewRequested={handleCreateNew}
        on:loadEpubRequested={handleLoadEpub}
      />
    </div>

    <!-- Workspace List -->
    <div class="demo-section">
      <h3>Workspace List</h3>
      <WorkspaceList
        {workspaces}
        {currentWorkspaceId}
        {isLoading}
        on:workspaceSelected={handleWorkspaceSelect}
        on:workspaceDeleted={handleWorkspaceDelete}
      />
    </div>
  </div>

  <!-- Demo Controls -->
  <div class="demo-controls">
    <h3>Demo Controls</h3>
    <div class="control-buttons">
      <button
        type="button"
        on:click={() => {
          showEmptyState = !showEmptyState;
          initializeData();
        }}
        class:active={showEmptyState}
      >
        Toggle Empty State
      </button>
      <button
        type="button"
        on:click={() => {
          showErrorStates = !showErrorStates;
          initializeData();
        }}
        class:active={showErrorStates}
      >
        Toggle Error States
      </button>
      <button
        type="button"
        on:click={() => {
          isLoading = !isLoading;
        }}
        class:active={isLoading}
      >
        Toggle Loading
      </button>
    </div>
  </div>
</div>

<style>
  .workspace-demo {
    max-width: 800px;
    margin: 0 auto;
    padding: var(--space-6);
    font-family: var(--font-sans);
  }

  .demo-header {
    margin-block-end: var(--space-8);
    text-align: center;
  }

  .demo-header h2 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .demo-header p {
    margin: 0;
    font-size: var(--text-base);
    color: var(--color-text-secondary);
  }

  .demo-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .demo-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .demo-section h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
    padding-block-end: var(--space-2);
    border-block-end: 2px solid var(--color-primary);
  }

  .demo-controls {
    margin-block-start: var(--space-8);
    padding-block-start: var(--space-6);
    border-block-start: 1px solid var(--color-border-default);
  }

  .demo-controls h3 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .control-buttons {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .control-buttons button {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-secondary);
    color: var(--color-text-primary);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .control-buttons button:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  .control-buttons button.active {
    background-color: var(--color-primary);
    color: var(--color-surface);
    border-color: var(--color-primary);
  }

  .control-buttons button:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .workspace-demo {
      padding: var(--space-4);
    }

    .demo-content {
      gap: var(--space-6);
    }

    .demo-section {
      gap: var(--space-3);
    }

    .control-buttons {
      flex-direction: column;
    }

    .control-buttons button {
      width: 100%;
    }
  }
</style>
