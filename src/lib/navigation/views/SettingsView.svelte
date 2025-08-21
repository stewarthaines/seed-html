<script lang="ts">
  import type {
    SettingsService,
    WorkspaceSettings,
  } from '../../services/settings/settings.service.js';
  import type { ExtensionInfo } from '../../extensions/types.js';

  import type { ExtensionManager } from '../../extensions/extension-manager.js';
  import type { TransformEngine } from '../../infrastructure/transform-engine.js';
  import ExtensionItem from '../../components/extensions/ExtensionItem.svelte';
  import { t } from '../../i18n';

  interface Props {
    settingsService: SettingsService;
    extensionManager: ExtensionManager;
    transformEngine: TransformEngine;
    workspaceId: string | null;
    onSettingsChanged?: () => void;
  }

  const { settingsService, extensionManager, transformEngine, workspaceId, onSettingsChanged }: Props = $props();

  // State management
  let workspaceSettings = $state<WorkspaceSettings | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Extension management state
  let extensions = $state<ExtensionInfo[]>([]);
  let extensionsLoading = $state(false);

  // Load settings when workspaceId changes
  $effect(() => {
    if (!workspaceId || !settingsService) return;

    const loadSettings = async () => {
      loading = true;
      error = null;

      try {
        workspaceSettings = await settingsService.loadWorkspaceSettings(workspaceId);
      } catch (err) {
        error = err instanceof Error ? err.message : $t('Failed to load settings');
        workspaceSettings = settingsService.getDefaultWorkspaceSettings();
      } finally {
        loading = false;
      }
    };

    loadSettings();
  });

  // Load extensions when workspaceId changes
  $effect(() => {
    if (!workspaceId) return;

    const loadExtensions = async () => {
      extensionsLoading = true;
      try {
        extensions = await extensionManager.listWorkspaceExtensions(workspaceId);
      } catch (err) {
        console.error('Failed to load extensions:', err);
        extensions = [];
      } finally {
        extensionsLoading = false;
      }
    };

    loadExtensions();
  });

  // Handle advanced mode toggle
  async function handleAdvancedModeChange(event: Event): Promise<void> {
    if (!workspaceId || !workspaceSettings) return;

    const target = event.target as HTMLInputElement;
    const newAdvancedMode = target.checked;

    // Optimistic update
    const updatedSettings: WorkspaceSettings = {
      ...workspaceSettings,
      editor: {
        preview_delay_ms: workspaceSettings.editor?.preview_delay_ms ?? 500,
        advanced_mode: newAdvancedMode,
      },
    };

    workspaceSettings = updatedSettings;

    try {
      await settingsService.saveWorkspaceSettings(workspaceId, updatedSettings);
      // Notify parent that settings have changed
      onSettingsChanged?.();
    } catch (err) {
      error = err instanceof Error ? err.message : $t('Failed to save settings');
      // Revert optimistic update
      workspaceSettings = {
        ...workspaceSettings,
        editor: {
          preview_delay_ms: workspaceSettings.editor?.preview_delay_ms ?? 500,
          advanced_mode: !newAdvancedMode,
        },
      };
    }
  }

  // Handle extension import
  async function handleExtensionImport(event: Event): Promise<void> {
    // Check advanced mode first
    if (!isAdvancedMode) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !workspaceId) return;

    try {
      const detectedName = extensionManager.detectExtensionName(file.name);
      await extensionManager.importExtension(workspaceId, file, detectedName);
      
      // Reload extensions list
      extensions = await extensionManager.listWorkspaceExtensions(workspaceId);
      
      // Reload extensions in transform engine
      await transformEngine.setWorkspaceExtensions(workspaceId);
      
      // Clear file input
      input.value = '';
    } catch (err) {
      console.error('Failed to import extension:', err);
      error = err instanceof Error ? err.message : $t('Failed to import extension');
    }
  }

  // Handle extension removal
  async function handleExtensionRemoval(extensionName: string): Promise<void> {
    if (!workspaceId) return;

    try {
      await extensionManager.deleteWorkspaceExtension(workspaceId, extensionName);
      
      // Reload extensions list
      extensions = await extensionManager.listWorkspaceExtensions(workspaceId);
      
      // Reload extensions in transform engine
      await transformEngine.setWorkspaceExtensions(workspaceId);
    } catch (err) {
      console.error('Failed to remove extension:', err);
      error = err instanceof Error ? err.message : $t('Failed to remove extension');
    }
  }

  // Derived states
  const isAdvancedMode = $derived(workspaceSettings?.editor?.advanced_mode ?? false);
  const canEditSettings = $derived(workspaceId !== null && workspaceSettings !== null);
</script>

<div class="settings-view">
  <div class="settings-header">
    <h1>{$t('Settings')}</h1>
    {#if !workspaceId}
      <p class="no-workspace-message">{$t('Please select a workspace to configure settings.')}</p>
    {:else if loading}
      <p class="loading-message">{$t('Loading settings...')}</p>
    {/if}
  </div>

  {#if error}
    <div class="error-message" role="alert">
      <strong>{$t('Error')}:</strong>
      {error}
    </div>
  {/if}

  {#if canEditSettings}
    <div class="settings-content">
      <!-- Full-width settings layout with responsive grid -->
      <section class="workspace-settings">
        <h2>{$t('Project Settings')}</h2>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={isAdvancedMode}
              onchange={handleAdvancedModeChange}
              disabled={loading}
            />
            <span class="setting-text">{$t('Advanced Mode')}</span>
          </label>
          <p class="setting-description">
            {$t('Enable advanced editing features and additional controls for power users.')}
          </p>
        </div>
      </section>

      <!-- Extension Management -->
      <section class="extensions-settings">
        <h2>{$t('Extensions')}</h2>
        
        <!-- Import Extension -->
        <div class="extension-import" class:disabled={!isAdvancedMode}>
          <label for="extension-file">
            {$t('Import JavaScript Extension')}: {$t('Please copy license text into the License field below to comply with open source requirements.')}
          </label>
          <input
            id="extension-file"
            type="file"
            accept=".js"
            onchange={handleExtensionImport}
            disabled={extensionsLoading}
          />
          {#if !isAdvancedMode}
            <p class="advanced-mode-note">{$t('Advanced Mode required for extension management')}</p>
          {/if}
        </div>

        <!-- Extensions List -->
        {#if extensionsLoading}
          <p>{$t('Loading extensions...')}</p>
        {:else if extensions.length === 0}
          <p>{$t('No extensions installed.')}</p>
        {:else}
          <ul class="extensions-list">
            {#each extensions as extension}
              {#if workspaceId}
                <ExtensionItem
                  {extension}
                  workspaceId={workspaceId}
                  {isAdvancedMode}
                  {extensionManager}
                  onRemove={() => handleExtensionRemoval(extension.name)}
                />
              {/if}
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .settings-view {
    padding: 1rem;
    max-width: 100%;
    width: 100%;
    margin: 0;
  }

  .settings-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .no-workspace-message,
  .loading-message {
    color: var(--text-muted, #666);
    font-style: italic;
  }

  .error-message {
    background: var(--error-bg, #fee);
    color: var(--error-text, #c33);
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid var(--error-border, #fcc);
    margin-bottom: 1rem;
  }


  .settings-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (max-width: 1024px) {
    .settings-content {
      grid-template-columns: 1fr;
    }
  }

  section {
    border: 1px solid var(--border-color, #ddd);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  section h2 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-primary, #333);
  }

  .setting-group {
    margin-bottom: 1rem;
  }

  .setting-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
  }

  .setting-label input[type='checkbox'] {
    margin-top: 0.125rem;
    cursor: pointer;
  }

  .setting-text {
    font-weight: 500;
    color: var(--text-primary, #333);
  }

  .setting-description {
    margin: 0.5rem 0 0 1.75rem;
    color: var(--text-muted, #666);
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .extension-import {
    margin-bottom: 1.5rem;
  }

  .extension-import label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #333);
  }

  .extension-import input[type="file"] {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .extension-import input[type="file"]:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .extension-import.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .advanced-mode-note {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
    font-style: italic;
    margin-top: var(--space-2);
    margin-bottom: 0;
  }

  .extensions-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  /* Focus styles for accessibility */
  .setting-label:focus-within .setting-text {
    outline: 2px solid var(--focus-color, #007acc);
    outline-offset: 2px;
  }

  input[type='checkbox']:focus-visible {
    outline: 2px solid var(--focus-color, #007acc);
    outline-offset: 2px;
  }
</style>
