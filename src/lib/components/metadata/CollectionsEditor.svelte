<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import type { EPUBMetadata, CollectionEntry } from '../../epub/opf-utils';

  interface Props {
    collections?: CollectionEntry[];
    saving?: boolean;
    getFieldError?: (name: string) => string;
    onfieldSave?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
  }

  let {
    collections = [],
    saving = false,
    getFieldError = () => '',
    onfieldSave,
    onfieldFocus,
  }: Props = $props();

  const typeOptions = [
    { value: 'series', label: $t('Series') },
    { value: 'set', label: $t('Set') },
  ];

  const save = (next: CollectionEntry[]) =>
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field: 'collections', value: next } }));
  const updateEntry = (index: number, patch: Partial<CollectionEntry>) =>
    save(collections.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => save([...collections, { name: '', type: 'series' }]);
  const removeEntry = (index: number) => save(collections.filter((_, i) => i !== index));
  const focus = () =>
    onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field: 'collections' } }));
</script>

{#each collections as entry, index (index)}
  <div class="collection-entry">
    <div class="collection-entry-header">
      <span class="collection-entry-label">{$t('Collection')}</span>
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
      id="collection-name-{index}"
      label={$t('Collection name')}
      value={entry.name}
      placeholder={$t('e.g. The Chronicles of Narnia')}
      error={getFieldError(`collections[${index}]`)}
      onblur={e => updateEntry(index, { name: e.value })}
      onfocus={focus}
    />
    <div class="collection-meta">
      <SelectMetadataField
        id="collection-type-{index}"
        label={$t('Type')}
        value={entry.type ?? 'series'}
        options={typeOptions}
        onblur={e => updateEntry(index, { type: e.value })}
        onfocus={focus}
      />
      <TextMetadataField
        id="collection-position-{index}"
        label={$t('Position')}
        value={entry.position ?? ''}
        placeholder={$t('e.g. 2')}
        onblur={e => updateEntry(index, { position: e.value })}
        onfocus={focus}
      />
    </div>
  </div>
{/each}

<button type="button" class="add-button" onclick={addEntry} disabled={saving}>
  {$t('Add a collection')}
</button>

<style>
  .collection-entry {
    margin-block-end: 1rem;
    padding: var(--space-3, 0.75rem);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
  }

  .collection-entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block-end: 0.5rem;
  }

  .collection-entry-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .collection-meta {
    display: flex;
    gap: 0.75rem;
  }

  .collection-meta :global(.metadata-field) {
    flex: 1;
    margin-block-end: 0;
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
