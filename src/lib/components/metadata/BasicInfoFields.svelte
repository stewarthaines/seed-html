<script lang="ts">
  import { t } from '../../i18n';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import TextareaMetadataField from './fields/TextareaMetadataField.svelte';
  import ViewportField from './fields/ViewportField.svelte';
  import CreatorRoleEditor from './CreatorRoleEditor.svelte';
  import LanguageEditor from './LanguageEditor.svelte';
  import TitleEditor from './TitleEditor.svelte';
  import IdentifierEditor from './IdentifierEditor.svelte';
  import type { EPUBMetadata } from '../../epub';
  import type { ValidationResult } from '../../metadata/MetadataValidator';
  import { MetadataUtils, type EditableArrayField } from '../../epub/opf-utils';

  interface Props {
    metadata?: EPUBMetadata;
    validationErrors?: ValidationResult[];
    saving?: boolean;
    advancedMode?: boolean;
    onfieldChange?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldSave?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
    onarrayAdd?: (event: CustomEvent<{ field: EditableArrayField }>) => void;
    onarrayRemove?: (event: CustomEvent<{ field: EditableArrayField; index: number }>) => void;
    ongenerateIdentifier?: (event: CustomEvent<void>) => void;
  }

  let {
    metadata = { title: '', language: [], identifier: '' },
    validationErrors = [],
    saving = false,
    advancedMode = false,
    onfieldChange,
    onfieldSave,
    onfieldFocus,
    onarrayAdd,
    onarrayRemove,
    ongenerateIdentifier,
  }: Props = $props();

  // Removed reactive state tracking - work directly with metadata props

  // Rendition options
  const layoutOptions = [
    { value: 'reflowable', label: $t('Reflowable') },
    { value: 'pre-paginated', label: $t('Pre-paginated') },
  ];

  const progressionOptions = [
    { value: 'default', label: $t('Default') },
    { value: 'ltr', label: $t('Left to Right') },
    { value: 'rtl', label: $t('Right to Left') },
  ];

  const orientationOptions = [
    { value: 'auto', label: $t('Auto') },
    { value: 'landscape', label: $t('Landscape') },
    { value: 'portrait', label: $t('Portrait') },
  ];

  const spreadOptions = [
    { value: 'auto', label: $t('Auto') },
    { value: 'none', label: $t('None') },
    { value: 'landscape', label: $t('Landscape') },
    { value: 'both', label: $t('Both') },
  ];

  const flowOptions = [
    { value: 'auto', label: $t('Auto') },
    { value: 'paginated', label: $t('Paginated') },
    { value: 'scrolled-continuous', label: $t('Scrolled (continuous)') },
    { value: 'scrolled-doc', label: $t('Scrolled (per document)') },
  ];

  const getFieldError = (fieldName: string) => {
    const error = validationErrors.find(err => err.field === fieldName);
    return error ? error.message : '';
  };

  const handleFieldChange = (field: string, value: any) => {
    onfieldChange?.(new CustomEvent('fieldChange', { detail: { field, value } }));
  };

  const handleFieldSave = (field: string, value: string) => {
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field, value } }));
  };

  const handleFieldFocus = (field: keyof EPUBMetadata | null) => {
    onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field } }));
  };
</script>

<div class="basic-info-fields" tabindex="-1">
  <div class="form-columns" tabindex="-1">
    <div class="column" tabindex="-1">
      <fieldset class="field-group" tabindex="-1">
        <legend class="group-title" tabindex="-1">{$t('Essential Information')}</legend>

        <TitleEditor
          title={metadata.title || ''}
          titleFileAs={metadata.titleFileAs}
          additionalTitles={metadata.additionalTitles}
          {saving}
          {advancedMode}
          {getFieldError}
          {onfieldChange}
          {onfieldSave}
          {onfieldFocus}
        />

        <LanguageEditor
          languages={metadata.language ?? []}
          {saving}
          {getFieldError}
          {onfieldSave}
          {onarrayAdd}
          {onarrayRemove}
          {onfieldFocus}
        />

        <IdentifierEditor
          identifier={metadata.identifier || ''}
          identifierType={metadata.identifierType}
          additionalIdentifiers={metadata.additionalIdentifiers}
          {saving}
          {advancedMode}
          {getFieldError}
          {onfieldChange}
          {onfieldSave}
          {onfieldFocus}
          {ongenerateIdentifier}
        />
      </fieldset>

      <CreatorRoleEditor
        field="creator"
        creators={metadata.creator ?? []}
        {saving}
        {advancedMode}
        legend={$t('Creators')}
        addLabel={$t('Add Another Creator')}
        namePlaceholder={$t('Creator name')}
        {getFieldError}
        {onfieldSave}
        {onarrayAdd}
        {onarrayRemove}
        {onfieldFocus}
      />
    </div>

    <div class="column">
      <fieldset class="field-group">
        <legend class="group-title" tabindex="-1">{$t('Description')}</legend>

        <TextareaMetadataField
          id="description"
          label={undefined}
          value={metadata.description || ''}
          placeholder={$t('Enter book description')}
          error={getFieldError('description')}
          rows={3}
          onchange={e => handleFieldChange('description', e.value)}
          onblur={e => handleFieldSave('description', e.value)}
          onfocus={() => handleFieldFocus('description')}
        />
      </fieldset>

      <fieldset class="field-group">
        <legend class="group-title" tabindex="-1">{$t('Rendition Properties')}</legend>

        <SelectMetadataField
          id="renditionLayout"
          label={$t('Layout')}
          value={metadata.renditionLayout || 'reflowable'}
          options={layoutOptions}
          error={getFieldError('renditionLayout')}
          onchange={e => handleFieldChange('renditionLayout', e.value)}
          onblur={e => handleFieldSave('renditionLayout', e.value)}
          onfocus={() => handleFieldFocus('renditionLayout')}
        />

        <SelectMetadataField
          id="pageProgressionDirection"
          label={$t('Page Progression')}
          value={metadata.pageProgressionDirection || 'default'}
          options={progressionOptions}
          error={getFieldError('pageProgressionDirection')}
          onchange={e => handleFieldChange('pageProgressionDirection', e.value)}
          onblur={e => handleFieldSave('pageProgressionDirection', e.value)}
          onfocus={() => handleFieldFocus('pageProgressionDirection')}
        />

        <SelectMetadataField
          id="renditionOrientation"
          label={$t('Orientation')}
          value={metadata.renditionOrientation || 'auto'}
          options={orientationOptions}
          error={getFieldError('renditionOrientation')}
          onchange={e => handleFieldChange('renditionOrientation', e.value)}
          onblur={e => handleFieldSave('renditionOrientation', e.value)}
          onfocus={() => handleFieldFocus('renditionOrientation')}
        />

        <SelectMetadataField
          id="renditionSpread"
          label={$t('Spread')}
          value={metadata.renditionSpread || 'auto'}
          options={spreadOptions}
          error={getFieldError('renditionSpread')}
          onchange={e => handleFieldChange('renditionSpread', e.value)}
          onblur={e => handleFieldSave('renditionSpread', e.value)}
          onfocus={() => handleFieldFocus('renditionSpread')}
        />

        <SelectMetadataField
          id="renditionFlow"
          label={$t('Flow')}
          value={metadata.renditionFlow || 'auto'}
          options={flowOptions}
          error={getFieldError('renditionFlow')}
          onchange={e => handleFieldChange('renditionFlow', e.value)}
          onblur={e => handleFieldSave('renditionFlow', e.value)}
          onfocus={() => handleFieldFocus('renditionFlow')}
        />

        <!-- Viewport only applies to fixed-layout publications (rendition:viewport). -->
        {#if (metadata.renditionLayout || 'reflowable') === 'pre-paginated'}
          <ViewportField
            id="renditionViewport"
            label={$t('Viewport')}
            value={metadata.renditionViewport || ''}
            error={getFieldError('renditionViewport')}
            onchange={e => handleFieldChange('renditionViewport', e.value)}
            onblur={e => handleFieldSave('renditionViewport', e.value)}
            onfocus={() => handleFieldFocus('renditionViewport')}
          />
        {/if}
      </fieldset>
    </div>
  </div>
</div>

<style>
  .basic-info-fields {
    padding: 1.5rem;
  }

  .form-columns {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @media (min-width: 768px) {
    .form-columns {
      grid-template-columns: 1fr 1fr;
    }
  }

  .column {
    min-width: 0; /* Allow flex item to shrink */
  }

  .field-group {
    margin-block-end: 2rem;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: 1.5rem;
  }

  .field-group:last-child {
    margin-block-end: 0;
  }

  .group-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .array-field {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .array-item {
    display: flex;
    gap: 0;
    align-items: flex-start;
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: 0;
    overflow: hidden;
    position: relative;
  }

  .array-item :global(.metadata-field) {
    flex: 1;
    margin-block-end: 0;
  }

  .array-item :global(.field-input) {
    border: none;
    background-color: transparent;
    border-radius: 0;
  }

  .array-item :global(.field-input:focus) {
    border: none;
    box-shadow: inset 0 0 0 2px var(--color-focus);
  }

  .array-item :global(.field-input.error:focus) {
    box-shadow: inset 0 0 0 2px var(--color-error);
  }

  .array-item :global(.field-input.needs-attention:focus) {
    box-shadow: inset 0 0 0 2px var(--color-success-600);
  }

  .remove-button {
    width: 2.5rem;
    height: calc(
      1rem * 1.5 + 0.75rem * 2 - 1px
    ); /* Match input total height: line-height + padding + border */
    border: none;
    border-inline-start: 1px solid var(--color-border-default);
    border-radius: 0;
    background-color: var(--color-bg-secondary);
    color: var(--color-error);
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-block-start: 0;
    flex-shrink: 0;
  }

  .remove-button:hover:not(:disabled) {
    background-color: var(--color-error-bg);
    border-inline-start-color: var(--color-error-600);
  }

  .remove-button:focus {
    outline: none;
    background-color: var(--color-error-bg);
    border-inline-start-color: var(--color-error-600);
    box-shadow:
      inset 0 0 0 2px var(--color-focus-ring),
      inset 0 0 0 1px var(--color-error-600);
  }

  .remove-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .add-button {
    padding: 0.75rem 1rem;
    border: 1px dashed var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--color-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .add-button:hover:not(:disabled) {
    background-color: var(--color-primary-surface);
    border-color: var(--color-primary);
    border-style: solid;
  }

  .add-button:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
    border-style: solid;
  }

  .add-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
