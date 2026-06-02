<script lang="ts">
  import { t, currentLocale } from '../../i18n';
  import { COMMON_LANGUAGES, languageDisplayName } from '../../epub/bcp47';
  import type { EPUBMetadata } from '../../epub/opf-utils';

  interface Props {
    languages?: string[];
    saving?: boolean;
    getFieldError?: (name: string) => string;
    onfieldSave?: (event: CustomEvent<{ field: string; value: string[] }>) => void;
    onarrayAdd?: (event: CustomEvent<{ field: 'language' }>) => void;
    onarrayRemove?: (event: CustomEvent<{ field: 'language'; index: number }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
  }

  let {
    languages = [],
    saving = false,
    getFieldError = () => '',
    onfieldSave,
    onarrayAdd,
    onarrayRemove,
    onfieldFocus,
  }: Props = $props();

  const datalistId = 'bcp47-common-languages';

  const save = (next: string[]) =>
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field: 'language', value: next } }));
  const updateTag = (index: number, value: string) =>
    save(languages.map((l, i) => (i === index ? value.trim() : l)));
  const addLanguage = () =>
    onarrayAdd?.(new CustomEvent('arrayAdd', { detail: { field: 'language' } }));
  const removeLanguage = (index: number) =>
    onarrayRemove?.(new CustomEvent('arrayRemove', { detail: { field: 'language', index } }));
  const focus = () =>
    onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field: 'language' } }));
</script>

<div class="language-editor">
  <div class="field-sublabel">{$t('Languages')}</div>

  <datalist id={datalistId}>
    {#each COMMON_LANGUAGES as code}
      <option value={code}>{languageDisplayName(code, $currentLocale)}</option>
    {/each}
  </datalist>

  <div class="lang-list">
    {#each languages as lang, index (index)}
      <div class="lang-item">
        <div class="lang-input-row">
          <input
            class="lang-input"
            class:error={!!getFieldError(`language[${index}]`)}
            list={datalistId}
            value={lang}
            placeholder={$t('e.g. en, en-US, zh-Hant, gsw')}
            aria-label={$t('Language tag')}
            disabled={saving}
            onblur={e => updateTag(index, e.currentTarget.value)}
            onfocus={focus}
          />
          <button
            type="button"
            class="remove-button"
            onclick={() => removeLanguage(index)}
            disabled={saving}
            aria-label={$t('Remove language')}
          >
            ×
          </button>
        </div>
        {#if getFieldError(`language[${index}]`)}
          <div class="lang-error" role="alert">{getFieldError(`language[${index}]`)}</div>
        {:else if lang.trim()}
          <div class="lang-name">{languageDisplayName(lang, $currentLocale)}</div>
        {/if}
      </div>
    {/each}

    <button type="button" class="add-button" onclick={addLanguage} disabled={saving}>
      {$t('Add Language')}
    </button>
  </div>
</div>

<style>
  .language-editor {
    margin-block-end: 1rem;
  }

  .field-sublabel {
    display: block;
    font-weight: 500;
    margin-block-end: 0.5rem;
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .lang-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .lang-input-row {
    display: flex;
    align-items: stretch;
    gap: 0;
  }

  .lang-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
    font-size: 1rem;
    background-color: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .lang-input:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .lang-input.error {
    border-color: var(--color-error);
  }

  .remove-button {
    width: 2.5rem;
    border: 1px solid var(--color-border-default);
    border-inline-start: none;
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background-color: var(--color-bg-secondary);
    color: var(--color-error);
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .remove-button:hover:not(:disabled) {
    background-color: var(--color-error);
    color: white;
  }

  .lang-name {
    margin-block-start: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .lang-error {
    margin-block-start: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-error);
  }

  .add-button {
    align-self: flex-start;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px dashed var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--color-interactive-primary, var(--color-text-primary));
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
  }

  .add-button:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
  }
</style>
