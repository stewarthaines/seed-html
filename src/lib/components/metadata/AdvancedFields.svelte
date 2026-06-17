<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import DateMetadataField from './fields/DateMetadataField.svelte';
  import CreatorRoleEditor from './CreatorRoleEditor.svelte';
  import SubjectEditor from './SubjectEditor.svelte';
  import CollectionsEditor from './CollectionsEditor.svelte';
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
    onarrayRemove,
  }: Props = $props();

  // The lesser-used Dublin Core fields are gated like other advanced refinements:
  // each shows in advanced mode or when already populated, and the whole section
  // collapses when none are set and advanced mode is off.
  const showSource = $derived(advancedMode || !!metadata.source?.trim());
  const showRelation = $derived(advancedMode || !!metadata.relation?.trim());
  const showCoverage = $derived(advancedMode || !!metadata.coverage?.trim());
  const showFormat = $derived(advancedMode || !!metadata.format?.trim());
  const showAdditionalInfo = $derived(showSource || showRelation || showCoverage || showFormat);
  const showCollections = $derived(advancedMode || (metadata.collections?.length ?? 0) > 0);
  const showAppleBooks = $derived(advancedMode || !!metadata.ibooksSpecifiedFonts);

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

      {#if showAdditionalInfo}
        <fieldset class="field-group">
          <legend class="group-title" tabindex="-1">{$t('Additional Information')}</legend>

          {#if showSource}
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
          {/if}

          {#if showRelation}
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
          {/if}

          {#if showCoverage}
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
          {/if}

          {#if showFormat}
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
          {/if}
        </fieldset>
      {/if}

      {#if showAppleBooks}
        <fieldset class="field-group">
          <legend class="group-title" tabindex="-1">{$t('Apple Books')}</legend>
          <label class="checkbox-row">
            <input
              type="checkbox"
              checked={metadata.ibooksSpecifiedFonts ?? false}
              disabled={saving}
              onchange={e => handleFieldSave('ibooksSpecifiedFonts', e.currentTarget.checked)}
              onfocus={() => handleFieldFocus('ibooksSpecifiedFonts')}
            />
            <span>{$t('Use the publication’s own fonts (do not re-style)')}</span>
          </label>
        </fieldset>
      {/if}
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

      {#if showCollections}
        <fieldset class="field-group">
          <legend class="group-title" tabindex="-1">{$t('Collections')}</legend>
          <CollectionsEditor
            collections={metadata.collections}
            {saving}
            {getFieldError}
            {onfieldSave}
            {onfieldFocus}
          />
        </fieldset>
      {/if}
    </div>
  </div>
</div>

<style>
  .advanced-fields {
    padding: 1.5rem;
    /* Query the pane width, not the viewport (this form sits in a split pane). */
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

  .column {
    min-width: 0; /* Allow flex item to shrink */
  }

  .field-group {
    margin-block-end: 2rem;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .field-group:last-child {
    margin-block-end: 0;
  }

  .group-title {
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .checkbox-row input {
    flex: none;
    cursor: pointer;
  }
</style>
