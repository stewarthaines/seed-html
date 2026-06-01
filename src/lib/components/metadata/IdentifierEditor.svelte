<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import type { EPUBMetadata, IdentifierEntry } from '../../epub/opf-utils';
  import { IDENTIFIER_TYPE_OPTIONS } from '../../epub/identifier-types';

  interface Props {
    identifier: string;
    identifierType?: string;
    additionalIdentifiers?: IdentifierEntry[];
    saving?: boolean;
    advancedMode?: boolean;
    getFieldError?: (name: string) => string;
    onfieldChange?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldSave?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
    ongenerateIdentifier?: (event: CustomEvent<void>) => void;
  }

  let {
    identifier,
    identifierType = '',
    additionalIdentifiers = [],
    saving = false,
    advancedMode = false,
    getFieldError = () => '',
    onfieldChange,
    onfieldSave,
    onfieldFocus,
    ongenerateIdentifier,
  }: Props = $props();

  // Advanced refinements show in advanced mode, or when already populated.
  const showType = $derived(advancedMode || !!identifierType?.trim());
  const showAdditional = $derived(advancedMode || additionalIdentifiers.length > 0);

  const typeOptions = $derived(
    IDENTIFIER_TYPE_OPTIONS.map(o => ({ value: o.value, label: $t(o.label) }))
  );

  const save = (field: string, value: any) =>
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field, value } }));
  const change = (field: string, value: any) =>
    onfieldChange?.(new CustomEvent('fieldChange', { detail: { field, value } }));
  const focus = (field: keyof EPUBMetadata) =>
    onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field } }));
  const generate = () => ongenerateIdentifier?.(new CustomEvent('generateIdentifier'));

  // Additional identifiers funnel through a single whole-array save.
  const saveList = (next: IdentifierEntry[]) => save('additionalIdentifiers', next);
  const updateEntry = (index: number, patch: Partial<IdentifierEntry>) =>
    saveList(additionalIdentifiers.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => saveList([...additionalIdentifiers, { value: '', type: '' }]);
  const removeEntry = (index: number) =>
    saveList(additionalIdentifiers.filter((_, i) => i !== index));
</script>

<div class="identifier-primary">
  <div class="identifier-field">
    <TextMetadataField
      id="identifier"
      label={$t('Identifier')}
      value={identifier || ''}
      placeholder={$t('Enter a unique identifier')}
      required={true}
      error={getFieldError('identifier')}
      onchange={e => change('identifier', e.value)}
      onblur={e => save('identifier', e.value)}
      onfocus={() => focus('identifier')}
    />
    <button type="button" class="generate-button" onclick={generate} disabled={saving}>
      {$t('Generate')}
    </button>
  </div>

  {#if showType}
    <SelectMetadataField
      id="identifierType"
      label={$t('Identifier type')}
      value={identifierType ?? ''}
      options={typeOptions}
      onblur={e => save('identifierType', e.value)}
      onfocus={() => focus('identifierType' as keyof EPUBMetadata)}
    />
  {/if}
</div>

{#each additionalIdentifiers as entry, index (index)}
  <div class="identifier-entry">
    <div class="identifier-entry-header">
      <span class="identifier-entry-label">{$t('Additional identifier')}</span>
      <button
        type="button"
        class="remove-button"
        onclick={() => removeEntry(index)}
        disabled={saving}
        aria-label={$t('Remove')}
      >
        ×
      </button>
    </div>

    <TextMetadataField
      id="additional-identifier-{index}"
      value={entry.value}
      placeholder={$t('e.g. urn:isbn:9780000000001')}
      onblur={e => updateEntry(index, { value: e.value })}
    />
    <SelectMetadataField
      id="additional-identifier-type-{index}"
      label={$t('Identifier type')}
      value={entry.type ?? ''}
      options={typeOptions}
      onblur={e => updateEntry(index, { type: e.value })}
    />
  </div>
{/each}

{#if showAdditional}
  <button type="button" class="add-button" onclick={addEntry} disabled={saving}>
    {$t('Add another identifier')}
  </button>
{/if}

<style>
  .identifier-field {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .identifier-field :global(.metadata-field) {
    flex: 1;
    margin-block-end: 0;
  }

  .generate-button {
    flex: none;
    padding: 0.75rem 1rem;
    margin-block-start: 1.75rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .generate-button:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary);
  }

  .identifier-primary {
    margin-block-end: 1rem;
  }

  .identifier-entry {
    margin-block-end: 1rem;
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
  }

  .identifier-entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block-end: 0.5rem;
  }

  .identifier-entry-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .remove-button {
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-secondary);
    color: var(--color-error);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
  }

  .remove-button:hover:not(:disabled) {
    background-color: var(--color-error-bg);
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

  .add-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
