<script lang="ts">
  import { t, currentLocale } from '../../i18n';
  import SettingsSection from './SettingsSection.svelte';
  import { FileStorageAPI } from '../../storage/index.js';
  import { COMMON_LANGUAGES, isWellFormedLanguageTag, languageDisplayName } from '../../epub/bcp47';
  import { primaryLanguage } from '../../epub/opf-utils.js';
  import { listTranslations } from '../../translations/editions.js';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';

  type TranslationAction = 'add' | 'switch' | 'remove';

  let {
    workspaceId,
    workspace,
    reviewMode = false,
    onAction,
  }: {
    workspaceId: string | null;
    workspace: WorkspaceState | null;
    /** Track changes locks metadata, so language operations are unavailable. */
    reviewMode?: boolean;
    /** Owned by App: file mechanics, OPF update, full re-render. */
    onAction?: (action: TranslationAction, tag: string) => Promise<void>;
  } = $props();

  const datalistId = 'translations-common-languages';

  const activeTag = $derived(primaryLanguage(workspace?.opf?.metadata));

  let translations = $state<string[]>([]);
  let newTag = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let confirming = $state<{ action: TranslationAction; tag: string } | null>(null);

  async function loadList() {
    if (!workspaceId) {
      translations = [];
      return;
    }
    try {
      const tags = await listTranslations(FileStorageAPI.getInstance(), workspaceId);
      // A stored edition for the active tag can only be debris from an
      // interrupted add — never offer it.
      translations = tags.filter(tag => tag.toLowerCase() !== activeTag.toLowerCase());
    } catch {
      translations = [];
    }
  }

  $effect(() => {
    void workspaceId;
    void activeTag;
    void loadList();
  });

  const controlsDisabled = $derived(reviewMode || busy || !workspaceId || !onAction);
  const trimmedTag = $derived(newTag.trim());
  const newTagValid = $derived(
    isWellFormedLanguageTag(trimmedTag) &&
      trimmedTag.toLowerCase() !== activeTag.toLowerCase() &&
      !translations.some(tag => tag.toLowerCase() === trimmedTag.toLowerCase())
  );

  async function run(action: TranslationAction, tag: string) {
    if (!onAction) return;
    busy = true;
    error = null;
    try {
      await onAction(action, tag);
      if (action === 'add') newTag = '';
    } catch (e) {
      error = e instanceof Error ? e.message : $t('Operation failed');
    } finally {
      busy = false;
      confirming = null;
      await loadList();
    }
  }

  const summary = $derived.by(() => {
    const name = activeTag ? languageDisplayName(activeTag, $currentLocale) : '';
    return translations.length > 0
      ? `${name} · ${$t('{n} stored', { n: translations.length })}`
      : name;
  });
</script>

<SettingsSection
  title={$t('Translations')}
  {summary}
  name="project-settings"
  persistKey="settings-project-translations"
>
  {#if reviewMode}
    <p class="setting-description">{$t('Unavailable while track changes is on.')}</p>
  {/if}

  <div class="setting-group">
    <span class="setting-label-text">{$t('Book language')}</span>
    <p class="active-language">
      {languageDisplayName(activeTag, $currentLocale)} ({activeTag})
    </p>
  </div>

  {#if translations.length > 0}
    <div class="setting-group">
      <span class="setting-label-text">{$t('Stored translations')}</span>
      <ul class="translation-list">
        {#each translations as tag (tag)}
          <li class="translation-row">
            <span class="translation-name">
              {languageDisplayName(tag, $currentLocale)} <span class="translation-tag">{tag}</span>
            </span>
            <div class="translation-actions">
              <button
                type="button"
                class="btn btn-secondary"
                onclick={() => (confirming = { action: 'switch', tag })}
                disabled={controlsDisabled}
              >
                {$t('Switch to')}
              </button>
              <button
                type="button"
                class="btn btn-danger"
                onclick={() => (confirming = { action: 'remove', tag })}
                disabled={controlsDisabled}
              >
                {$t('Delete')}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="setting-group">
    <span class="setting-label-text">{$t('Add translation')}</span>
    <div class="add-row">
      <input
        type="text"
        list={datalistId}
        bind:value={newTag}
        placeholder={$t('Language tag')}
        disabled={controlsDisabled}
      />
      <datalist id={datalistId}>
        {#each COMMON_LANGUAGES.filter(code => code !== activeTag && !translations.includes(code)) as code (code)}
          <option value={code}>{languageDisplayName(code, $currentLocale)}</option>
        {/each}
      </datalist>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={() => (confirming = { action: 'add', tag: trimmedTag })}
        disabled={controlsDisabled || !newTagValid}
      >
        {$t('Add')}
      </button>
    </div>
  </div>

  {#if confirming}
    {@const name = `${languageDisplayName(confirming.tag, $currentLocale)} (${confirming.tag})`}
    <div class="confirm-box" role="alert">
      {#if confirming.action === 'add'}
        <p>
          {$t(
            'Keep a stored copy of the {from} text and switch the book to {to}? All chapters re-render.',
            {
              from: `${languageDisplayName(activeTag, $currentLocale)} (${activeTag})`,
              to: name,
            }
          )}
        </p>
      {:else if confirming.action === 'switch'}
        <p>
          {$t(
            'Store the current {from} text and make {to} the active language? All chapters re-render. Edits made after switching can leave other editions out of date.',
            {
              from: `${languageDisplayName(activeTag, $currentLocale)} (${activeTag})`,
              to: name,
            }
          )}
        </p>
      {:else}
        <p>{$t('Delete the stored {tag} translation? This cannot be undone.', { tag: name })}</p>
      {/if}
      <div class="confirm-actions">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => (confirming = null)}
          disabled={busy}
        >
          {$t('Cancel')}
        </button>
        <button
          type="button"
          class={confirming.action === 'remove' ? 'btn btn-danger' : 'btn btn-primary'}
          onclick={() => confirming && run(confirming.action, confirming.tag)}
          disabled={busy}
        >
          {busy ? $t('Working…') : $t('Continue')}
        </button>
      </div>
    </div>
  {/if}

  {#if busy && !confirming}
    <p class="translation-status" role="status">{$t('Re-rendering chapters…')}</p>
  {/if}
  {#if error}
    <p class="translation-error" role="alert">{error}</p>
  {/if}
</SettingsSection>

<style>
  .active-language {
    margin: 0;
    font-size: var(--text-sm);
  }

  .translation-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .translation-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .translation-name {
    font-size: var(--text-sm);
    min-inline-size: 0;
  }

  .translation-tag {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .translation-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .add-row {
    display: flex;
    gap: var(--space-2);
    margin-block-start: var(--space-2);
  }

  .add-row input {
    inline-size: 12rem;
  }

  .confirm-box {
    margin-block-start: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-secondary);
  }

  .confirm-box p {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .translation-error {
    margin: var(--space-2) 0 0;
    color: var(--color-error-text, var(--color-text-primary));
    font-size: var(--text-sm);
  }

  .translation-status {
    margin: var(--space-2) 0 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }
</style>
