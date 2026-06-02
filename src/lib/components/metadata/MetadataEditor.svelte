<script lang="ts">
  import { t } from '../../i18n';
  import MetadataTabBar from './MetadataTabBar.svelte';
  import BasicInfoFields from './BasicInfoFields.svelte';
  import AdvancedFields from './AdvancedFields.svelte';
  import AccessibilityFields from './AccessibilityFields.svelte';
  import type { EPUBMetadata } from '../../epub';

  // Service layer imports
  import { MetadataService } from '../../services/metadata/metadata.service.js';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';

  interface Props {
    workspace?: WorkspaceState | null;
    metadataService: MetadataService;
    advancedMode?: boolean;
    onMetadataChanged?: (detail: { field: string; value: any }) => void;
    onFieldFocus?: (detail: { field: keyof EPUBMetadata | null }) => void;
    onTabFieldsChange?: (detail: { fields: string[] }) => void;
  }

  let {
    workspace = $bindable(null),
    metadataService,
    advancedMode = false,
    onMetadataChanged,
    onFieldFocus,
    onTabFieldsChange,
  }: Props = $props();

  // Reactive state using Svelte 5 runes
  let metadata = $derived(workspace?.opf.metadata ?? { title: '', language: [], identifier: '' });
  let validationErrors = $derived(metadataService.validateMetadata(metadata));
  let loading = $derived(!workspace);

  let activeTab = $state('basic');
  let saving = $state(false);
  let error = $state<string | null>(null);

  // Tab definitions with labels
  let tabs = $derived([
    { id: 'basic', label: $t('Basic Info') },
    { id: 'advanced', label: $t('Advanced') },
    { id: 'accessibility', label: $t('Accessibility') },
  ]);

  const getTabFields = (tabId: string) => {
    switch (tabId) {
      case 'basic':
        return ['title', 'language', 'identifier', 'creator'];
      case 'advanced':
        return [
          'publisher',
          'date',
          'description',
          'subject',
          'rights',
          'source',
          'relation',
          'coverage',
          'type',
          'format',
          'contributor',
          'collections',
          'ibooksSpecifiedFonts',
        ];
      case 'accessibility':
        return [
          'accessMode',
          'accessModeSufficient',
          'accessibilityFeature',
          'accessibilityHazard',
          'accessibilityControl',
          'accessibilityAPI',
          'accessibilitySummary',
          'accessibilityConformance',
          'accessibilityCertifiedBy',
          'accessibilityCertifierCredential',
          'accessibilityCertifierReport',
        ];
      default:
        return [];
    }
  };

  const handleFieldChange = (_event: { detail: any }) => {
    // Field changes are handled by the input component's internal state
    // No action needed here since we only persist on blur/save
  };

  const handleFieldFocus = (event: { detail: { field: keyof EPUBMetadata | null } }) => {
    onFieldFocus?.(event.detail);
  };

  const handleFieldSave = async (event: { detail: any }) => {
    const { field, value } = event.detail;

    if (!workspace) return;

    // Validate field update before saving to workspace
    const updates = { [field]: value };
    const validationResults = metadataService.validateMetadataUpdates(updates);
    const fieldErrors = validationResults.filter(result => result.type === 'error');

    if (fieldErrors.length > 0) {
      // Don't save invalid data - let inline error display show the issue
      // The validation errors will be displayed via the existing getFieldError system
      return;
    }

    try {
      // Only save valid data to workspace
      workspace = await metadataService.updateField(workspace, field, value);

      // Notify that metadata has changed
      onMetadataChanged?.({ field, value });

      error = null;
    } catch (err: any) {
      console.error(`Failed to save field ${field}:`, err);
      error = $t('Failed to save metadata field');
    }
  };

  const handleArrayAdd = async (event: { detail: { field: any } }) => {
    const { field } = event.detail;

    if (!workspace) return;

    try {
      saving = true;

      if (
        field === 'creator' ||
        field === 'subject' ||
        field === 'contributor' ||
        field === 'language'
      ) {
        // Add new item using service
        workspace = await metadataService.addArrayItem(workspace, field);

        // Notify that metadata has changed
        onMetadataChanged?.({ field, value: workspace.opf.metadata[field as keyof EPUBMetadata] });
      }
      error = null;
    } catch (err: any) {
      console.error(`Failed to add ${field}:`, err);
      error = $t('Failed to add metadata item');
    } finally {
      saving = false;
    }
  };

  const handleArrayRemove = async (event: { detail: { field: any; index: any } }) => {
    const { field, index } = event.detail;

    if (!workspace) return;

    try {
      saving = true;

      if (
        field === 'creator' ||
        field === 'subject' ||
        field === 'contributor' ||
        field === 'language'
      ) {
        // Remove item using service
        workspace = await metadataService.removeArrayItem(workspace, field, index);

        // Notify that metadata has changed
        onMetadataChanged?.({ field, value: workspace.opf.metadata[field as keyof EPUBMetadata] });
      }
      error = null;
    } catch (err: any) {
      console.error(`Failed to remove ${field}:`, err);
      error = $t('Failed to remove metadata item');
    } finally {
      saving = false;
    }
  };

  const handleGenerateIdentifier = async () => {
    // Generate a new UUID for the identifier
    const newIdentifier = `urn:uuid:${crypto.randomUUID()}`;
    handleFieldChange({ detail: { field: 'identifier', value: newIdentifier } });
    await handleFieldSave({ detail: { field: 'identifier', value: newIdentifier } });
  };

  const handleTabSwitch = async (detail: { tabId: any }) => {
    const newTabId = detail.tabId;

    // Allow tab switching - validation errors will be shown inline
    // No need to block navigation, users should be able to access all tabs
    activeTab = newTabId;
  };

  // Tell the preview which fields the active tab owns, so it can softly
  // highlight that group in the content.opf.
  $effect(() => {
    onTabFieldsChange?.({ fields: getTabFields(activeTab) });
  });
</script>

<div class="metadata-editor">
  <div class="pane-header" tabindex="-1">
    <MetadataTabBar {activeTab} {validationErrors} {tabs} onTabClick={handleTabSwitch} />
  </div>

  <div class="pane-content" tabindex="-1">
    {#if loading}
      <div class="loading-state">
        <p>{$t('Loading metadata…')}</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p class="error-message">{error}</p>
        <button type="button" class="retry-button" onclick={() => (error = null)}>
          {$t('Retry')}
        </button>
      </div>
    {:else}
      <div
        class="tab-panel"
        id="metadata-panel-{activeTab}"
        aria-labelledby="metadata-tab-{activeTab}"
        tabindex="-1"
      >
        {#if activeTab === 'basic'}
          <BasicInfoFields
            {metadata}
            {validationErrors}
            {saving}
            {advancedMode}
            onfieldChange={handleFieldChange}
            onfieldSave={handleFieldSave}
            onfieldFocus={handleFieldFocus}
            onarrayAdd={handleArrayAdd}
            onarrayRemove={handleArrayRemove}
            ongenerateIdentifier={handleGenerateIdentifier}
          />
        {:else if activeTab === 'advanced'}
          <AdvancedFields
            {metadata}
            {validationErrors}
            {saving}
            {advancedMode}
            onfieldChange={handleFieldChange}
            onfieldSave={handleFieldSave}
            onfieldFocus={handleFieldFocus}
            onarrayAdd={handleArrayAdd}
            onarrayRemove={handleArrayRemove}
          />
        {:else if activeTab === 'accessibility'}
          <AccessibilityFields
            {metadata}
            {validationErrors}
            {saving}
            {advancedMode}
            onfieldChange={handleFieldChange}
            onfieldSave={handleFieldSave}
            onfieldFocus={handleFieldFocus}
          />
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .metadata-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--color-surface-primary);
  }

  .pane-header {
    flex-shrink: 0;
    border-block-end: 1px solid var(--color-border-default);
  }

  .pane-content {
    flex: 1;
    overflow-y: auto;
    background-color: var(--color-bg-primary);
  }

  .tab-panel {
    height: 100%;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }

  .error-message {
    color: var(--color-error);
    margin-block-end: 1rem;
  }

  .retry-button {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background-color: var(--color-primary);
    color: var(--color-surface);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background-color: var(--color-interactive-primary-hover);
    border-color: var(--color-interactive-primary-hover);
  }

  .retry-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-focus-ring);
  }
</style>
