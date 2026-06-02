<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import { t } from '../../i18n';

  let {
    viewType = 'Unknown',
    title = 'View',
    description = 'This view will be implemented in Phase 3.',
    icon = '📄',
    comingSoon = true,
  }: {
    viewType?: string;
    title?: string;
    description?: string;
    icon?: string;
    comingSoon?: boolean;
  } = $props();

  let guardId: string;
  let viewData = $state<any>({});

  // ViewComponent interface implementation
  export function onViewEnter(data?: any): void {
    if (data) {
      viewData = { ...viewData, ...data };
    }

    // Restore saved data
    const saved = navigationStore.getViewData(viewType as any);
    if (saved) {
      viewData = saved;
    }
  }

  export function onViewLeave(): void {
    // Save current state
    navigationStore.setViewData(viewType as any, viewData);
  }

  export function getViewData(): any {
    return viewData;
  }

  export function setViewData(data: any): void {
    viewData = { ...viewData, ...data };
  }

  export async function canLeave(): Promise<boolean> {
    // Placeholder views don't block navigation
    return true;
  }

  // Component lifecycle
  onMount(() => {
    // Register navigation guard
    guardId = navigationStore.addNavigationGuard(canLeave);

    // Call onViewEnter
    onViewEnter();
  });

  onDestroy(() => {
    // Clean up guard
    if (guardId) {
      navigationStore.removeNavigationGuard(guardId);
    }

    // Call onViewLeave
    onViewLeave();
  });

  // Example actions for demonstration
  function handleAction(action: string) {
    console.log(`${viewType} action:`, action);
    viewData.lastAction = action;
    viewData.actionTime = new Date().toISOString();
    navigationStore.setViewData(viewType as any, viewData);
  }
</script>

<div class="placeholder-view">
  <header class="view-header">
    <div class="header-content">
      <span class="view-icon">{icon}</span>
      <div class="header-text">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>

    {#if comingSoon}
      <div class="coming-soon-badge">
        <span class="badge-text">Phase 3</span>
      </div>
    {/if}
  </header>

  <main class="view-content">
    <div class="placeholder-content">
      <div class="placeholder-icon">
        <span class="large-icon">{icon}</span>
      </div>

      <h3>{$t('Coming Soon')}</h3>
      <p class="placeholder-description">
        {$t(
          'The {title} interface will be implemented in Phase 3 of the EDITME development. This will include full content management capabilities.',
          { title: title.toLowerCase() }
        )}
      </p>

      <div class="feature-preview">
        <h4>{$t('Planned Features')}:</h4>
        <ul class="feature-list">
          {#if viewType === 'manifest'}
            <li>📋 {$t('File listing and management')}</li>
            <li>🔍 {$t('Search and filter files')}</li>
            <li>📁 {$t('Add/remove manifest items')}</li>
            <li>👁️ {$t('Preview file contents')}</li>
          {:else if viewType === 'navigation'}
            <li>📖 {$t('Table of contents editing')}</li>
            <li>🔗 {$t('Navigation link management')}</li>
            <li>📝 {$t('TOC structure editing')}</li>
            <li>🎯 {$t('Auto-generation from spine')}</li>
          {:else if viewType === 'spine'}
            <li>📚 {$t('Chapter ordering interface')}</li>
            <li>🔄 {$t('Drag-and-drop reordering')}</li>
            <li>📄 {$t('Spine item management')}</li>
            <li>🔗 {$t('Link to source files')}</li>
          {:else if viewType === 'settings'}
            <li>⚙️ {$t('Application preferences')}</li>
            <li>🎨 {$t('Theme and UI settings')}</li>
            <li>💾 {$t('Export/import settings')}</li>
            <li>🔧 {$t('Advanced configurations')}</li>
          {:else}
            <li>🚀 {$t('Enhanced functionality')}</li>
            <li>📊 {$t('Improved user interface')}</li>
            <li>🔄 {$t('Seamless integration')}</li>
            <li>💡 {$t('New capabilities')}</li>
          {/if}
        </ul>
      </div>

      <div class="demo-actions">
        <h4>{$t('Navigation Demo')}:</h4>
        <div class="action-buttons">
          <button class="btn btn-primary" onclick={() => handleAction('demo_action_1')}>
            {$t('Demo Action 1')}
          </button>
          <button class="btn btn-secondary" onclick={() => handleAction('demo_action_2')}>
            {$t('Demo Action 2')}
          </button>
          <button class="btn btn-secondary" onclick={() => navigationStore.navigateTo('workspace')}>
            {$t('Back to Projects')}
          </button>
        </div>
      </div>

      {#if viewData.lastAction}
        <div class="last-action">
          <span class="action-icon">✨</span>
          <span
            >{$t('Last action')}: {viewData.lastAction}
            {$t('at')}
            {new Date(viewData.actionTime).toLocaleTimeString()}</span
          >
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .placeholder-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .view-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-6);
    border-bottom: 1px solid var(--color-border-default);
    background-color: var(--color-bg-secondary);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .view-icon {
    font-size: var(--text-2xl);
  }

  .header-text h2 {
    margin: 0 0 var(--space-1) 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .header-text p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .coming-soon-badge {
    padding: var(--space-1) var(--space-2);
    background-color: var(--color-accent);
    color: white;
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }

  .view-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .placeholder-content {
    max-width: 600px;
    text-align: center;
  }

  .placeholder-icon {
    margin-bottom: var(--space-6);
  }

  .large-icon {
    font-size: 4rem;
    opacity: 0.6;
  }

  .placeholder-content h3 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .placeholder-description {
    margin: 0 0 var(--space-8) 0;
    font-size: var(--text-base);
    color: var(--color-text-secondary);
    line-height: var(--leading-relaxed);
  }

  .feature-preview {
    margin-bottom: var(--space-8);
    text-align: left;
  }

  .feature-preview h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
    text-align: center;
  }

  .feature-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-2);
  }

  .feature-list li {
    padding: var(--space-2);
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .demo-actions {
    margin-bottom: var(--space-6);
  }

  .demo-actions h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .action-buttons {
    display: flex;
    gap: var(--space-3);
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-decoration: none;
  }

  .btn-primary {
    /* background-color: var(--color-accent-dark); */
    color: var(--color-text-inverse);
  }

  .btn-primary:hover {
    background-color: var(--color-accent-dark, var(--color-accent));
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .btn-secondary {
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-default);
  }

  .btn-secondary:hover {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
  }

  .last-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background-color: var(--color-success-bg, #d4edda);
    color: var(--color-success-text, #155724);
    border: 1px solid var(--color-success-border, #c3e6cb);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .action-icon {
    font-size: var(--text-base);
  }
</style>
