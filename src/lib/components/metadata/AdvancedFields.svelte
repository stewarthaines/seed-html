<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import DateMetadataField from './fields/DateMetadataField.svelte';
  import CreatorRoleEditor from './CreatorRoleEditor.svelte';
  import SubjectEditor from './SubjectEditor.svelte';
  import type { ValidationResult } from '../../metadata/MetadataValidator';
  import type { EPUBMetadata } from '../../epub';
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
    onarrayRemove
  }: Props = $props();

  const getFieldError = (fieldName: string) => {
    const error = validationErrors.find(err => err.field === fieldName);
    return error ? error.message : '';
  };

  const handleFieldChange = (field: string, value: any) => {
    onfieldChange?.(new CustomEvent('fieldChange', { detail: { field, value } }));
  };

  const handleFieldSave = (field: string, value: any) => {
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field, value } }));
  };

  const handleFieldFocus = (field: keyof EPUBMetadata | null) => {
    onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field } }));
  };
</script>

<div class="advanced-fields">
  <div class="form-columns">
    <div class="column">
      <fieldset class="field-group">
        <legend class="group-title" tabindex="-1">{$t('Publication')}</legend>

        <TextMetadataField
          id="publisher"
          label={$t('Publisher')}
          value={metadata.publisher || ''}
          placeholder={$t('Enter publisher name')}
          error={getFieldError('publisher')}
          onchange={e => handleFieldChange('publisher', e.value)}
          onblur={e => handleFieldSave('publisher', e.value)}
          onfocus={() => handleFieldFocus('publisher')}
        />

        <DateMetadataField
          id="date"
          label={$t('Publication Date')}
          value={metadata.date || ''}
          error={getFieldError('date')}
          onchange={e => handleFieldChange('date', e.value)}
          onblur={e => handleFieldSave('date', e.value)}
          onfocus={() => handleFieldFocus('date')}
        />

        <TextMetadataField
          id="rights"
          label={$t('Rights')}
          value={metadata.rights || ''}
          placeholder={$t('Enter copyright information')}
          error={getFieldError('rights')}
          onchange={e => handleFieldChange('rights', e.value)}
          onblur={e => handleFieldSave('rights', e.value)}
          onfocus={() => handleFieldFocus('rights')}
        />

        <TextMetadataField
          id="type"
          label={$t('Content Type')}
          value={metadata.type || ''}
          placeholder={$t('e.g. fiction, dictionary, textbook')}
          error={getFieldError('type')}
          onchange={e => handleFieldChange('type', e.value)}
          onblur={e => handleFieldSave('type', e.value)}
          onfocus={() => handleFieldFocus('type')}
        />
      </fieldset>

      <fieldset class="field-group">
        <legend class="group-title" tabindex="-1">{$t('Additional Information')}</legend>

        <TextMetadataField
          id="source"
          label={$t('Source')}
          value={metadata.source || ''}
          placeholder={$t('Enter source information')}
          error={getFieldError('source')}
          onchange={e => handleFieldChange('source', e.value)}
          onblur={e => handleFieldSave('source', e.value)}
          onfocus={() => handleFieldFocus('source')}
        />

        <TextMetadataField
          id="relation"
          label={$t('Relation')}
          value={metadata.relation || ''}
          placeholder={$t('Enter related work information')}
          error={getFieldError('relation')}
          onchange={e => handleFieldChange('relation', e.value)}
          onblur={e => handleFieldSave('relation', e.value)}
          onfocus={() => handleFieldFocus('relation')}
        />

        <TextMetadataField
          id="coverage"
          label={$t('Coverage')}
          value={metadata.coverage || ''}
          placeholder={$t('Enter spatial or temporal coverage')}
          error={getFieldError('coverage')}
          onchange={e => handleFieldChange('coverage', e.value)}
          onblur={e => handleFieldSave('coverage', e.value)}
          onfocus={() => handleFieldFocus('coverage')}
        />

        <TextMetadataField
          id="format"
          label={$t('Format')}
          value={metadata.format || ''}
          placeholder={$t('Enter format information')}
          error={getFieldError('format')}
          onchange={e => handleFieldChange('format', e.value)}
          onblur={e => handleFieldSave('format', e.value)}
          onfocus={() => handleFieldFocus('format')}
        />
      </fieldset>
    </div>

    <div class="column">
      <fieldset class="field-group">
        <legend class="group-title" tabindex="-1">{$t('Subjects')}</legend>

        <SubjectEditor
          subjects={metadata.subject}
          {saving}
          {advancedMode}
          {getFieldError}
          {onfieldSave}
          {onfieldFocus}
        />
      </fieldset>

      <CreatorRoleEditor
        field="contributor"
        creators={metadata.contributor ?? []}
        {saving}
        {advancedMode}
        legend={$t('Contributors')}
        addLabel={$t('Add Another Contributor')}
        namePlaceholder={$t('Contributor name')}
        {getFieldError}
        {onfieldSave}
        {onarrayAdd}
        {onarrayRemove}
        {onfieldFocus}
      />
    </div>
  </div>
</div>

<style>
  .advanced-fields {
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

</style>
