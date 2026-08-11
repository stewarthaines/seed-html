<script lang="ts">
  import { t } from '../../i18n';
  import SettingsSection from '../settings/SettingsSection.svelte';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import TextareaMetadataField from './fields/TextareaMetadataField.svelte';
  import ViewportField from './fields/ViewportField.svelte';
  import CreatorRoleEditor from './CreatorRoleEditor.svelte';
  import LanguageEditor from './LanguageEditor.svelte';
  import TitleEditor from './TitleEditor.svelte';
  import IdentifierEditor from './IdentifierEditor.svelte';
  import type { EPUBMetadata } from '../../epub';
  import type { ValidationResult } from '../../metadata/MetadataValidator';
  import { type EditableArrayField } from '../../epub/opf-utils';

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
      <SettingsSection title={$t('Essential Information')} name="meta-essential" open>
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
      </SettingsSection>

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
      <SettingsSection title={$t('Description')} name="meta-description" open>
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
      </SettingsSection>

      <SettingsSection title={$t('Rendition Properties')} name="meta-rendition" open>
        <SelectMetadataField
          id="renditionLayout"
          label={$t('Layout')}
          value={metadata.renditionLayout || 'reflowable'}
          options={layoutOptions}
          error={getFieldError('renditionLayout')}
          onblur={e => handleFieldSave('renditionLayout', e.value)}
          onfocus={() => handleFieldFocus('renditionLayout')}
        />

        <SelectMetadataField
          id="pageProgressionDirection"
          label={$t('Page Progression')}
          value={metadata.pageProgressionDirection || 'default'}
          options={progressionOptions}
          error={getFieldError('pageProgressionDirection')}
          onblur={e => handleFieldSave('pageProgressionDirection', e.value)}
          onfocus={() => handleFieldFocus('pageProgressionDirection')}
        />

        <SelectMetadataField
          id="renditionOrientation"
          label={$t('Orientation')}
          value={metadata.renditionOrientation || 'auto'}
          options={orientationOptions}
          error={getFieldError('renditionOrientation')}
          onblur={e => handleFieldSave('renditionOrientation', e.value)}
          onfocus={() => handleFieldFocus('renditionOrientation')}
        />

        <SelectMetadataField
          id="renditionSpread"
          label={$t('Spread')}
          value={metadata.renditionSpread || 'auto'}
          options={spreadOptions}
          error={getFieldError('renditionSpread')}
          onblur={e => handleFieldSave('renditionSpread', e.value)}
          onfocus={() => handleFieldFocus('renditionSpread')}
        />

        <!-- Reading systems must ignore rendition:flow for pre-paginated content
             (EPUB RS 3.3 §8.2.1); the value is kept, only the control is inert. -->
        <SelectMetadataField
          id="renditionFlow"
          label={$t('Flow')}
          value={metadata.renditionFlow || 'auto'}
          options={flowOptions}
          disabled={(metadata.renditionLayout || 'reflowable') === 'pre-paginated'}
          error={getFieldError('renditionFlow')}
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
      </SettingsSection>
    </div>
  </div>
</div>

<style>
  .basic-info-fields {
    padding: 1.5rem;
    /* Query the pane width, not the viewport: this form sits in a split pane,
       so it must collapse to one column on the pane's width. */
    container-type: inline-size;
  }

  .form-columns {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @container (min-width: 640px) {
    .form-columns {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Each column stacks its SettingsSection groups with consistent spacing. */
  .column {
    min-width: 0; /* Allow flex item to shrink */
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
</style>
