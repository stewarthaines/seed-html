<script lang="ts">
  import { t } from '../../i18n';
  import { randomUUID } from '../../utils/uuid.js';
  import { persisted, asBoolean } from '../../state/persisted.svelte.js';
  import { getTabFields } from './metadata-tabs.js';
  import BasicInfoFields from './BasicInfoFields.svelte';
  import AdvancedFields from './AdvancedFields.svelte';
  import AccessibilityFields from './AccessibilityFields.svelte';
  import { customMetaCatalog } from '../../metadata/custom-meta-catalog.svelte.js';
  import { RESERVED_PREFIXES } from '../../epub/opf-utils.js';
  import type { EPUBMetadata } from '../../epub';
  import type { CustomMetaEntry } from '../../epub/opf-utils.js';

  // Service layer imports
  import { MetadataService } from '../../services/metadata/metadata.service.js';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';

  interface Props {
    workspace?: WorkspaceState | null;
    metadataService: MetadataService;
    advancedMode?: boolean;
    /** Read-only EPUB: fields are shown but disabled (tabs still switch). */
    readOnly?: boolean;
    onMetadataChanged?: (detail: { field: string; value: any }) => void;
    onFieldFocus?: (detail: { field: keyof EPUBMetadata | null }) => void;
    onTabFieldsChange?: (detail: { fields: string[] }) => void;
  }

  let {
    workspace = $bindable(null),
    metadataService,
    advancedMode = false,
    readOnly = false,
    onMetadataChanged,
    onFieldFocus,
    onTabFieldsChange,
  }: Props = $props();

  // Reactive state using Svelte 5 runes
  let metadata = $derived(workspace?.opf.metadata ?? { title: '', language: [], identifier: '' });
  let validationErrors = $derived(metadataService.validateMetadata(metadata));
  let loading = $derived(!workspace);
  // The cover-image manifest item id — the Custom metadata cover row's derived default.
  let coverImageId = $derived(
    workspace?.opf.manifest.find(item => item.properties?.includes('cover-image'))?.id
  );

  // Details is one page: the basic fields, then, in Advanced mode, a disclosure
  // holding the advanced and accessibility fields. Its open state is remembered.
  const advancedOpen = persisted('seedhtml_metadata_advanced_open', false, asBoolean);
  const showAdvanced = $derived(advancedMode && advancedOpen.current);
  let saving = $state(false);
  let error = $state<string | null>(null);

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
      if (field === 'customMeta') {
        // Writing a catalog field into a book that never declared its prefix:
        // carry the declaration the catalog captured at adoption time.
        const currentPrefixes = workspace.opf.metadata.customMetaPrefixes;
        const additions: Record<string, string> = {};
        for (const entry of (value as CustomMetaEntry[]) ?? []) {
          if (entry.syntax !== 'property' || !entry.key.includes(':')) continue;
          const prefix = entry.key.split(':')[0];
          if (RESERVED_PREFIXES.has(prefix) || currentPrefixes?.[prefix] || additions[prefix]) {
            continue;
          }
          const uri = customMetaCatalog.find(entry.key, entry.syntax)?.prefixUri;
          if (uri) additions[prefix] = uri;
        }
        const updates: Partial<EPUBMetadata> =
          Object.keys(additions).length > 0
            ? { customMeta: value, customMetaPrefixes: { ...currentPrefixes, ...additions } }
            : { customMeta: value };
        workspace = await metadataService.updateMetadata(workspace, updates);
      } else {
        // Only save valid data to workspace
        workspace = await metadataService.updateField(workspace, field, value);
      }

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
    const newIdentifier = `urn:uuid:${randomUUID()}`;
    handleFieldChange({ detail: { field: 'identifier', value: newIdentifier } });
    await handleFieldSave({ detail: { field: 'identifier', value: newIdentifier } });
  };

  // Tell the preview which fields are on show, so it can softly highlight
  // them in the content.opf.
  $effect(() => {
    const fields = showAdvanced
      ? [...getTabFields('basic'), ...getTabFields('advanced'), ...getTabFields('accessibility')]
      : getTabFields('basic');
    onTabFieldsChange?.({ fields });
  });
</script>

<div class="metadata-editor">
  <div class="pane-content" tabindex="-1">
    <h2 class="details-title">{$t('Details')}</h2>
    {#if loading}
      <div class="loading-state">
        <p>{$t('Loading metadata…')}</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p class="error-message">{error}</p>
        <button type="button" class="btn btn-primary" onclick={() => (error = null)}>
          {$t('Retry')}
        </button>
      </div>
    {:else}
      <!-- Read-only EPUB: a disabled fieldset greys out every field/control in
           one shot, while the tab bar (outside it) stays switchable. The
           Advanced tab gates per-column instead (see AdvancedFields) so the
           Custom metadata section's adopt buttons — which write app settings,
           not the book — stay usable on read-only books. -->
      <fieldset
        class="fields-fieldset"
        class:is-readonly={readOnly}
        disabled={readOnly}
        id="metadata-panel-basic"
        tabindex="-1"
      >
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
      </fieldset>

      {#if advancedMode}
        <div class="details-advanced">
          <button
            type="button"
            class="btn btn-link details-advanced-toggle"
            aria-expanded={advancedOpen.current}
            aria-controls="metadata-panel-advanced"
            onclick={() => (advancedOpen.current = !advancedOpen.current)}
          >
            {$t('Advanced details')}
          </button>
          <span class="details-advanced-hint">
            {$t('Publisher, rights, subjects, accessibility')}
          </span>
        </div>
        {#if advancedOpen.current}
          <!-- The Advanced fields gate per column (see AdvancedFields), so the
               Custom metadata section's adopt buttons — which write app settings,
               not the book — stay usable on read-only books. -->
          <fieldset
            class="fields-fieldset"
            class:is-readonly={readOnly}
            id="metadata-panel-advanced"
            tabindex="-1"
          >
            <h3 class="details-section">{$t('Advanced')}</h3>
            <AdvancedFields
              {metadata}
              {validationErrors}
              {saving}
              {advancedMode}
              {readOnly}
              {coverImageId}
              onfieldChange={handleFieldChange}
              onfieldSave={handleFieldSave}
              onfieldFocus={handleFieldFocus}
              onarrayAdd={handleArrayAdd}
              onarrayRemove={handleArrayRemove}
            />
          </fieldset>
          <fieldset
            class="fields-fieldset"
            class:is-readonly={readOnly}
            disabled={readOnly}
            id="metadata-panel-accessibility"
            tabindex="-1"
          >
            <h3 class="details-section">{$t('Accessibility')}</h3>
            <AccessibilityFields
              {metadata}
              {validationErrors}
              {saving}
              onfieldChange={handleFieldChange}
              onfieldSave={handleFieldSave}
              onfieldFocus={handleFieldFocus}
            />
          </fieldset>
        {/if}
      {/if}
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

  .pane-content {
    flex: 1;
    overflow-y: auto;
    background-color: var(--color-bg-primary);
  }

  /* Fieldset used only to disable the whole field group in read-only mode;
     reset its native chrome so it lays out like the plain panel it replaced. */
  .details-title {
    margin: var(--space-5) var(--space-6) var(--space-2);
    font-size: var(--text-3xl);
    font-weight: var(--font-bold);
  }

  .details-advanced {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin: var(--space-4) var(--space-6);
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-border-subtle);
  }

  .details-advanced-hint {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .details-section {
    margin: var(--space-4) var(--space-6) 0;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .fields-fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }

  .fields-fieldset.is-readonly {
    opacity: 0.85;
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
</style>
