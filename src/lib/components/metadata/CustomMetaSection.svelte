<script lang="ts">
  import { t } from '../../i18n';
  import SettingsSection from '../settings/SettingsSection.svelte';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import {
    customMetaCatalog,
    catalogEntryLabel,
  } from '../../metadata/custom-meta-catalog.svelte.js';
  import { getCustomMetaValue, setCustomMetaValue } from '../../epub/opf-utils';
  import type { EPUBMetadata, CustomMetaEntry, CustomMetaSyntax } from '../../epub/opf-utils';
  import type { CatalogEntry } from '../../metadata/custom-meta-catalog.svelte.js';

  interface Props {
    metadata?: EPUBMetadata;
    /** id of the cover-image manifest item — the cover row's derived default. */
    coverImageId?: string;
    saving?: boolean;
    /** Value edits are disabled on read-only books; adoption stays available
        (it writes app settings, never the book). */
    readOnly?: boolean;
    onfieldSave?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
  }

  let {
    metadata = { title: '', language: [], identifier: '' },
    coverImageId = undefined,
    saving = false,
    readOnly = false,
    onfieldSave,
    onfieldFocus,
  }: Props = $props();

  // Enabled catalog entries render as editable rows whether or not the book
  // has a value yet — that is the "offered fields" behavior.
  let recognized = $derived(customMetaCatalog.entries.filter(e => e.enabled));

  // Book metas with no catalog entry, plus duplicates beyond the first of a
  // recognized key (the row edits only the first; the rest surface read-only).
  let discovered = $derived.by(() => {
    const seenRecognized = new Set<string>();
    return (metadata.customMeta ?? []).filter(entry => {
      if (!customMetaCatalog.find(entry.key, entry.syntax)) return true;
      const id = `${entry.syntax}:${entry.key}`;
      if (seenRecognized.has(id)) return true;
      seenRecognized.add(id);
      return false;
    });
  });

  const save = (next: CustomMetaEntry[]) =>
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field: 'customMeta', value: next } }));
  const focus = () =>
    onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field: 'customMeta' } }));

  const valueOf = (entry: CatalogEntry) =>
    getCustomMetaValue(metadata.customMeta, entry.key, entry.syntax) ?? '';
  const setValue = (entry: CatalogEntry, value: string) =>
    save(setCustomMetaValue(metadata.customMeta, entry.key, entry.syntax, value));

  const label = (entry: CatalogEntry): string => catalogEntryLabel(entry, $t);

  const syntaxLabel = (syntax: CustomMetaSyntax) =>
    syntax === 'property' ? $t('EPUB 3 property') : $t('EPUB 2 name');

  // Enum entries render as a select; the empty option removes the meta.
  const enumOptions = (entry: CatalogEntry) => [
    { value: '', label: $t('Not set') },
    ...(entry.options ?? []).map(option => ({ value: option, label: option })),
  ];

  // Colons are legal in ids but hostile to selectors; keep field ids plain.
  const fieldId = (entry: CatalogEntry) =>
    `custom-meta-${entry.syntax}-${entry.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const placeholder = (entry: CatalogEntry): string => {
    if (entry.key === 'cover' && entry.syntax === 'name' && coverImageId) {
      return $t('Automatic: {id}', { id: coverImageId });
    }
    return '';
  };

  const adopt = (entry: CustomMetaEntry) => {
    const prefix =
      entry.syntax === 'property' && entry.key.includes(':') ? entry.key.split(':')[0] : null;
    customMetaCatalog.adopt({
      key: entry.key,
      syntax: entry.syntax,
      sampleValue: entry.value,
      prefixUri: prefix ? metadata.customMetaPrefixes?.[prefix] : undefined,
    });
  };
</script>

<SettingsSection title={$t('Custom metadata')} name="meta-custom" open>
  {#each recognized as entry (`${entry.syntax}:${entry.key}`)}
    {#if entry.valueType === 'boolean'}
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={valueOf(entry) === 'true'}
          disabled={saving || readOnly}
          onchange={e => setValue(entry, e.currentTarget.checked ? 'true' : '')}
          onfocus={focus}
        />
        <span>{label(entry)}</span>
      </label>
    {:else if entry.valueType === 'enum'}
      <SelectMetadataField
        id={fieldId(entry)}
        label={label(entry)}
        value={valueOf(entry)}
        options={enumOptions(entry)}
        disabled={saving || readOnly}
        onblur={e => setValue(entry, e.value)}
        onfocus={focus}
      />
    {:else}
      <TextMetadataField
        id={fieldId(entry)}
        label={label(entry)}
        value={valueOf(entry)}
        placeholder={placeholder(entry)}
        disabled={saving || readOnly}
        onblur={e => setValue(entry, e.value)}
        onfocus={focus}
      />
    {/if}
  {/each}

  {#if discovered.length > 0}
    <p class="discovered-heading">{$t('Discovered in this book')}</p>
    {#each discovered as entry, index (index)}
      <div class="discovered-row">
        <div class="discovered-info">
          <span class="discovered-line">
            <code class="discovered-key">{entry.key}</code>
            <span class="syntax-badge">{syntaxLabel(entry.syntax)}</span>
          </span>
          <span class="discovered-value" title={entry.value}>{entry.value}</span>
        </div>
        {#if !customMetaCatalog.find(entry.key, entry.syntax)}
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => adopt(entry)}
            disabled={saving}
          >
            {$t('Add to catalog')}
          </button>
        {/if}
      </div>
    {/each}
  {/if}

  {#if recognized.length === 0 && discovered.length === 0}
    <p class="empty-hint">{$t('No custom metadata found in this book')}</p>
  {/if}
</SettingsSection>

<style>
  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    cursor: pointer;
    margin-block-end: 0.625rem;
  }

  .checkbox-row input {
    flex: none;
    cursor: pointer;
  }

  .checkbox-row:has(input:disabled) {
    cursor: not-allowed;
  }

  .discovered-heading {
    margin: 0.75rem 0 0.25rem;
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-text-secondary);
  }

  .discovered-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: var(--space-2);
    margin-block-end: 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
  }

  .discovered-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .discovered-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .discovered-key {
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }

  .syntax-badge {
    flex: none;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: 0 0.375rem;
    white-space: nowrap;
  }

  .discovered-value {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .discovered-row .btn {
    flex: none;
  }

  .empty-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-tertiary);
  }
</style>
