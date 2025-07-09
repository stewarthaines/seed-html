<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { navigationStore } from '../navigation-store';
  import type { MetadataViewData } from '../types';
  import { t } from '../../i18n';

  // Component implements ViewComponent interface
  let viewData: MetadataViewData = {
    title: '',
    author: '',
    language: 'en',
    identifier: '',
    hasUnsavedChanges: false,
  };

  let guardId: string;

  // ViewComponent interface implementation
  export function onViewEnter(data?: any): void {
    if (data) {
      viewData = { ...viewData, ...data };
    }

    // Restore saved data
    const saved = navigationStore.getViewData<MetadataViewData>('metadata');
    if (saved) {
      viewData = saved;
    }
  }

  export function onViewLeave(): void {
    // Save current state
    navigationStore.setViewData('metadata', viewData);
  }

  export function getViewData(): MetadataViewData {
    return viewData;
  }

  export function setViewData(data: any): void {
    viewData = { ...viewData, ...data };
  }

  export async function canLeave(): Promise<boolean> {
    if (viewData.hasUnsavedChanges) {
      return window.confirm($t('You have unsaved metadata changes. Continue?'));
    }
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

  // Form handlers
  function handleInputChange() {
    viewData.hasUnsavedChanges = true;
    navigationStore.setViewData('metadata', viewData);
  }

  function handleSave() {
    // Simulate save operation
    console.log('Saving metadata:', viewData);
    viewData.hasUnsavedChanges = false;
    navigationStore.setViewData('metadata', viewData);

    // Navigate to next logical step
    navigationStore.navigateTo('manifest');
  }

  function handleReset() {
    if (window.confirm($t('Reset all metadata to defaults?'))) {
      viewData = {
        title: '',
        author: '',
        language: 'en',
        identifier: '',
        hasUnsavedChanges: false,
      };
      navigationStore.setViewData('metadata', viewData);
    }
  }

  // Validation
  $: isValid = viewData.title.trim() && viewData.author.trim() && viewData.identifier.trim();
</script>

<div class="metadata-view">
  <header class="view-header">
    <h2>{$t('EPUB Metadata')}</h2>
    <p>{$t('Configure basic information about your EPUB publication')}</p>
  </header>

  <div class="view-content">
    <form class="metadata-form" on:submit|preventDefault={handleSave}>
      <div class="form-section">
        <h3>{$t('Basic Information')}</h3>

        <div class="form-group">
          <label for="title">{$t('Title')} *</label>
          <input
            id="title"
            type="text"
            bind:value={viewData.title}
            on:input={handleInputChange}
            placeholder={$t('Enter EPUB title')}
            required
          />
        </div>

        <div class="form-group">
          <label for="author">{$t('Author')} *</label>
          <input
            id="author"
            type="text"
            bind:value={viewData.author}
            on:input={handleInputChange}
            placeholder={$t('Enter author name')}
            required
          />
        </div>

        <div class="form-group">
          <label for="language">{$t('Language')}</label>
          <select id="language" bind:value={viewData.language} on:change={handleInputChange}>
            <option value="en">{$t('English')}</option>
            <option value="es">{$t('Spanish')}</option>
            <option value="fr">{$t('French')}</option>
            <option value="de">{$t('German')}</option>
            <option value="it">{$t('Italian')}</option>
            <option value="pt">{$t('Portuguese')}</option>
            <option value="zh">{$t('Chinese')}</option>
            <option value="ja">{$t('Japanese')}</option>
            <option value="ko">{$t('Korean')}</option>
          </select>
        </div>

        <div class="form-group">
          <label for="identifier">{$t('Identifier')} *</label>
          <input
            id="identifier"
            type="text"
            bind:value={viewData.identifier}
            on:input={handleInputChange}
            placeholder={$t('ISBN, URI, or unique identifier')}
            required
          />
          <small class="form-help">
            {$t('A unique identifier for this EPUB (ISBN, URI, UUID, etc.)')}
          </small>
        </div>
      </div>

      <div class="form-section">
        <h3>{$t('Publication Details')}</h3>
        <div class="placeholder-fields">
          <p class="placeholder-text">
            {$t(
              'Additional metadata fields (publisher, date, description, etc.) will be implemented in Phase 3.'
            )}
          </p>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" on:click={handleReset}>{$t('Reset')}</button
        >

        <button type="submit" class="btn btn-primary" disabled={!isValid}>
          <span class="btn-icon">💾</span>
          {$t('Save & Continue')}
        </button>
      </div>

      {#if viewData.hasUnsavedChanges}
        <div class="unsaved-indicator">
          <span class="indicator-icon">⚠️</span>
          <span>{$t('You have unsaved changes')}</span>
        </div>
      {/if}
    </form>
  </div>
</div>

<style>
  .metadata-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .view-header {
    padding: var(--space-6);
    border-bottom: 1px solid var(--color-border-default);
    background-color: var(--color-bg-secondary);
  }

  .view-header h2 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .view-header p {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .view-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
  }

  .metadata-form {
    max-width: 600px;
  }

  .form-section {
    margin-bottom: var(--space-8);
  }

  .form-section h3 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .form-group {
    margin-bottom: var(--space-4);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--space-1);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    transition: border-color var(--duration-fast) ease;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-alpha, rgba(59, 130, 246, 0.1));
  }

  .form-group input:invalid {
    border-color: var(--color-error, #ef4444);
  }

  .form-help {
    display: block;
    margin-top: var(--space-1);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .placeholder-fields {
    padding: var(--space-4);
    background-color: var(--color-bg-secondary);
    border: 1px dashed var(--color-border-default);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .placeholder-text {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .form-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    margin-top: var(--space-6);
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

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: var(--color-accent);
  }

  .btn-primary:hover:not(:disabled) {
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

  .btn-icon {
    font-size: var(--text-base);
  }

  .unsaved-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    margin-top: var(--space-4);
    background-color: var(--color-warning-bg, #fef3cd);
    color: var(--color-warning-text, #856404);
    border: 1px solid var(--color-warning-border, #ffeaa7);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .indicator-icon {
    font-size: var(--text-base);
  }
</style>
