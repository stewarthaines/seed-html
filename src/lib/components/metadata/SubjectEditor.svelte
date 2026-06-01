<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import { toSubject, type EPUBMetadata, type SubjectEntry } from '../../epub/opf-utils';

  interface Props {
    subjects?: (string | SubjectEntry)[];
    saving?: boolean;
    getFieldError?: (name: string) => string;
    onfieldSave?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
  }

  let {
    subjects = [],
    saving = false,
    getFieldError = () => '',
    onfieldSave,
    onfieldFocus,
  }: Props = $props();

  // Common subject-scheme names offered as suggestions (the actual code lists,
  // e.g. BISAC/Thema, are not bundled — `term` is free text).
  const AUTHORITY_SUGGESTIONS = ['BISAC', 'thema', 'LCSH', 'MSC', 'BIC'];

  // Normalised view; legacy plain-string subjects become { value }.
  const entries = $derived(subjects.map(toSubject));

  const save = (next: SubjectEntry[]) =>
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field: 'subject', value: next } }));
  const updateEntry = (index: number, patch: Partial<SubjectEntry>) =>
    save(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => save([...entries, { value: '' }]);
  const removeEntry = (index: number) => save(entries.filter((_, i) => i !== index));
  const focus = () => onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field: 'subject' } }));
</script>

<datalist id="subject-authorities">
  {#each AUTHORITY_SUGGESTIONS as name}
    <option value={name}></option>
  {/each}
</datalist>

<div class="subject-list">
  {#each entries as entry, index (index)}
    <div class="subject-entry">
      <div class="subject-value-row">
        <TextMetadataField
          id="subject-{index}"
          value={entry.value}
          placeholder={$t('Subject or keyword')}
          error={getFieldError(`subject[${index}]`)}
          onblur={e => updateEntry(index, { value: e.value })}
          onfocus={focus}
        />
        <button
          type="button"
          class="remove-button"
          onclick={() => removeEntry(index)}
          disabled={saving}
          aria-label={$t('Remove subject')}
        >
          ×
        </button>
      </div>

      <div class="subject-scheme-row">
        <input
          type="text"
          class="scheme-input"
          list="subject-authorities"
          value={entry.authority ?? ''}
          placeholder={$t('Authority (e.g. BISAC)')}
          aria-label={$t('Subject authority')}
          onblur={e => updateEntry(index, { authority: e.currentTarget.value })}
        />
        <input
          type="text"
          class="scheme-input"
          value={entry.term ?? ''}
          placeholder={$t('Term (e.g. FIC028000)')}
          aria-label={$t('Subject term')}
          onblur={e => updateEntry(index, { term: e.currentTarget.value })}
        />
      </div>
    </div>
  {/each}

  <button type="button" class="add-button" onclick={addEntry} disabled={saving}>
    {$t('Add Another Subject')}
  </button>
</div>

<style>
  .subject-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .subject-entry {
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
    overflow: hidden;
  }

  .subject-value-row {
    display: flex;
    gap: 0;
    align-items: flex-start;
  }

  .subject-value-row :global(.metadata-field) {
    flex: 1;
    margin-block-end: 0;
  }

  .subject-value-row :global(.field-input) {
    border: none;
    background-color: transparent;
    border-radius: 0;
  }

  .remove-button {
    width: 2.5rem;
    align-self: stretch;
    border: none;
    border-inline-start: 1px solid var(--color-border-default);
    border-radius: 0;
    background-color: var(--color-bg-secondary);
    color: var(--color-error);
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
  }

  .remove-button:hover:not(:disabled) {
    background-color: var(--color-error-bg);
  }

  .subject-scheme-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    border-block-start: 1px solid var(--color-border-default);
    background-color: var(--color-bg-secondary);
  }

  .scheme-input {
    flex: 1;
    min-width: 0;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .scheme-input:focus {
    outline: none;
    border-color: var(--color-focus);
  }

  .add-button {
    align-self: flex-start;
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
