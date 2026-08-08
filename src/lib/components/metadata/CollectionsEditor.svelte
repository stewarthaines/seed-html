<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import type { EPUBMetadata, CollectionEntry } from '../../epub/opf-utils';
  import { X } from 'phosphor-svelte';

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
        class="btn btn-icon btn-icon-danger"
        onclick={() => removeEntry(index)}
        disabled={saving}
        aria-label={$t('Remove')}
      >
        <X size={14} aria-hidden="true" />
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
    <TextMetadataField
      id="collection-identifier-{index}"
      label={$t('Collection identifier')}
      value={entry.identifier ?? ''}
      placeholder={$t('e.g. urn:issn:2346-7614')}
      onblur={e => updateEntry(index, { identifier: e.value })}
      onfocus={focus}
    />
  </div>
{/each}

<button type="button" class="btn btn-secondary" onclick={addEntry} disabled={saving}>
  {$t('Add a collection')}
</button>

<style>
  .collection-entry {
    margin-block-end: 0.5rem;
    padding: var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
  }

  .collection-entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block-end: 0.25rem;
  }

  .collection-entry-label {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-text-secondary);
  }

  .collection-meta {
    display: flex;
    gap: 0.5rem;
  }

  .collection-meta :global(.metadata-field) {
    flex: 1;
    margin-block-end: 0;
  }
</style>
