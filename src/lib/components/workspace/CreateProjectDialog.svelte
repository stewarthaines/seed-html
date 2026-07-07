<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { t, currentLocale } from '../../i18n';
  import { COMMON_LANGUAGES, languageDisplayName } from '../../epub/bcp47';
  import { titleHue } from '../../epub/cover-generator';
  import HueSelector from '../HueSelector.svelte';
  import type { ExtensionCatalogEntry } from '../../extensions/extension-catalog';
  import { persisted, asString, asBoolean } from '../../state/persisted.svelte.js';
  import { X } from 'phosphor-svelte';

  // The data the create flow needs; `extension` is the chosen text-format
  // extension, or null for plain text.
  export interface CreateProjectData {
    title: string;
    author: string;
    language: string;
    extension: ExtensionCatalogEntry | null;
    generateCover: boolean;
    /** Chosen cover background hue (0–359); omitted to use the title-derived hue. */
    hue?: number;
  }

  let {
    textFormats,
    defaultLanguage,
    advancedMode = false,
    onCreate,
    onClose,
  }: {
    /** Catalog entries that provide a text transform (markup languages). */
    textFormats: ExtensionCatalogEntry[];
    defaultLanguage: string;
    /** Advanced mode: the text-format picker is hidden in basic mode, which
     *  always creates a Djot project. */
    advancedMode?: boolean;
    onCreate: (data: CreateProjectData) => Promise<void>;
    onClose: () => void;
  } = $props();

  const PLAIN = 'plain';
  const DJOT = 'djot';
  const DEFAULT_TITLE = 'Untitled Book Project';

  // Remembered across sessions: repeat authors don't re-type, and the cover toggle
  // keeps the user's last choice (defaulting ON the first time).
  const author = persisted('editme_new_project_author', '', asString);
  const generateCover = persisted('editme_new_project_generate_cover', true, asBoolean);

  // The dialog is mounted fresh each time it opens, so these seed the form's
  // initial values once; untrack makes that intent explicit (no reactive capture).
  let title = $state(DEFAULT_TITLE);
  let language = $state(untrack(() => defaultLanguage));
  // Djot is the default in both modes — it's the right choice unless the author
  // specifically wants another format. Basic mode hides the picker entirely;
  // advanced mode shows Djot as the recommended pick with the rest in a
  // disclosure. Fall back to the first available format, then plain text.
  let selectedId = $state(
    untrack(() => textFormats.find(e => e.id === DJOT)?.id ?? textFormats[0]?.id ?? PLAIN)
  );
  // The recommended row (Djot) and the disclosed rest. When Djot isn't in the
  // catalog there is nothing to recommend — the flat list renders instead.
  const recommended = $derived(textFormats.find(e => e.id === DJOT) ?? null);
  const otherFormats = $derived(textFormats.filter(e => e.id !== DJOT));
  // Open the disclosure from the start only when the preselected format lives
  // inside it (i.e. Djot is absent); afterwards it keeps the user's state.
  const othersInitiallyOpen = untrack(() => !textFormats.some(e => e.id === DJOT));
  // null = follow the title-derived hue; a number = explicit user choice.
  let coverHue = $state<number | null>(null);
  const effectiveHue = $derived(coverHue ?? titleHue(title.trim() || DEFAULT_TITLE));
  let creating = $state(false);
  let error = $state<string | null>(null);

  let titleInput = $state<HTMLInputElement | null>(null);

  const LANGUAGE_DATALIST_ID = 'create-project-bcp47-languages';

  onMount(() => {
    titleInput?.focus();
    titleInput?.select();
  });

  async function create() {
    if (creating) return;
    creating = true;
    error = null;
    try {
      // Remember these for the next New Project dialog (persist before onCreate,
      // which navigates into the project and unmounts this dialog).
      author.current = author.current.trim();
      await onCreate({
        title: title.trim() || DEFAULT_TITLE,
        author: author.current,
        language,
        extension: textFormats.find(e => e.id === selectedId) ?? null,
        generateCover: generateCover.current,
        hue: coverHue ?? undefined,
      });
      // On success the app navigates into the new project and this dialog
      // unmounts; nothing more to do here.
    } catch (e) {
      error = e instanceof Error ? e.message : $t('Failed to create project.');
      creating = false;
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="create-backdrop"
  onclick={onClose}
  onkeydown={handleBackdropKeydown}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="create-dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="create-dialog-title"
    onclick={event => event.stopPropagation()}
  >
    <header class="create-header">
      <h2 id="create-dialog-title">{$t('New Project')}</h2>
      <button type="button" class="btn btn-icon" onclick={onClose} aria-label={$t('Close')}>
        <X size={16} aria-hidden="true" />
      </button>
    </header>

    <div class="create-body">
      <div class="create-field">
        <label class="create-label" for="create-title">{$t('Title')}</label>
        <input
          bind:this={titleInput}
          bind:value={title}
          id="create-title"
          type="text"
          class="create-input"
          disabled={creating}
        />
      </div>

      <div class="create-field">
        <label class="create-label" for="create-author">{$t('Author')}</label>
        <input
          bind:value={author.current}
          id="create-author"
          type="text"
          class="create-input"
          placeholder={$t('Author name')}
          disabled={creating}
        />
      </div>

      <label class="cover-option">
        <input type="checkbox" bind:checked={generateCover.current} disabled={creating} />
        {$t('Generate cover image')}
      </label>

      {#if generateCover.current}
        <HueSelector value={effectiveHue} disabled={creating} onInput={h => (coverHue = h)} />
      {/if}

      <div class="create-field">
        <label class="create-label" for="create-language">{$t('Language')}</label>
        <datalist id={LANGUAGE_DATALIST_ID}>
          {#each COMMON_LANGUAGES as code (code)}
            <option value={code}>{languageDisplayName(code, $currentLocale)}</option>
          {/each}
        </datalist>
        <input
          bind:value={language}
          id="create-language"
          class="create-input"
          list={LANGUAGE_DATALIST_ID}
          placeholder={$t('e.g. en, en-US, zh-Hant, gsw')}
          disabled={creating}
        />
        {#if language.trim()}
          <span class="create-lang-name">{languageDisplayName(language, $currentLocale)}</span>
        {/if}
      </div>

      {#if advancedMode && textFormats.length > 0}
        <fieldset class="create-formats" disabled={creating}>
          <legend class="create-label">{$t('Text format')}</legend>
          {#if recommended}
            <label class="create-radio">
              <input
                type="radio"
                name="text-format"
                value={recommended.id}
                bind:group={selectedId}
              />
              <span class="create-radio-text">
                <span class="create-radio-name">
                  {recommended.name}
                  <span class="create-radio-badge">{$t('Recommended')}</span>
                </span>
                {#if recommended.description}
                  <span class="create-radio-desc">{recommended.description}</span>
                {/if}
              </span>
            </label>
          {/if}
          <details class="create-formats-other" open={othersInitiallyOpen}>
            <summary class="create-formats-summary">{$t('Other formats')}</summary>
            <div class="create-formats-list">
              {#each otherFormats as ext (ext.id)}
                <label class="create-radio">
                  <input type="radio" name="text-format" value={ext.id} bind:group={selectedId} />
                  <span class="create-radio-text">
                    <span class="create-radio-name">{ext.name}</span>
                    {#if ext.description}
                      <span class="create-radio-desc">{ext.description}</span>
                    {/if}
                  </span>
                </label>
              {/each}
              <label class="create-radio">
                <input type="radio" name="text-format" value={PLAIN} bind:group={selectedId} />
                <span class="create-radio-text"
                  >{$t('Plain text')}
                  <span class="create-radio-desc"
                    >{$t('Bold, emphasis and heading styles only.')}</span
                  >
                </span>
              </label>
            </div>
          </details>
        </fieldset>
      {/if}

      {#if error}
        <p class="create-error" role="alert">{error}</p>
      {/if}
    </div>

    <footer class="create-footer">
      <button type="button" class="btn btn-secondary" onclick={onClose} disabled={creating}>
        {$t('Cancel')}
      </button>
      <button type="button" class="btn btn-primary" onclick={create} disabled={creating}>
        {creating ? $t('Creating…') : $t('Create')}
      </button>
    </footer>
  </div>
</div>

<style>
  .create-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: rgb(0 0 0 / 0.5);
  }

  .create-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    inline-size: min(34rem, 100%);
    max-block-size: 80vh;
    /* The body scrolls internally; the dialog itself does not, so the header and
       footer stay pinned while a long text-format list scrolls. */
    overflow: hidden;
    padding: var(--space-5);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg);
  }

  /* Scrollable region between the fixed header and footer. A little inline
     padding (pulled back out with a negative margin so alignment is unchanged)
     keeps focus rings off the scroll clip edge. */
  .create-body {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-inline: var(--space-2);
    margin-inline: calc(-1 * var(--space-2));
  }

  .create-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .create-header h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .create-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .create-label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
  }

  .create-input {
    inline-size: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--text-sm);
  }

  /* Inset focus (matching the metadata language field) so the ring is never
     clipped by the scrollable body's overflow. */
  .create-input:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .create-lang-name {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .create-formats {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: none;
  }

  .create-radio {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    cursor: pointer;
  }

  .create-radio-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .create-radio-name {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .create-radio-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .create-radio-badge {
    margin-inline-start: var(--space-1);
    padding: 1px var(--space-1-5);
    border-radius: var(--radius-full);
    background-color: var(--color-bg-accent);
    color: var(--color-text-primary);
    font-size: var(--text-xs);
  }

  .create-formats-other {
    margin: 0;
  }

  .create-formats-summary {
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .create-formats-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-block-start: var(--space-2);
    padding-inline-start: var(--space-4);
  }

  .cover-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .cover-option input[type='checkbox'] {
    flex-shrink: 0;
  }

  .create-error {
    margin: 0;
    color: var(--color-error-text, var(--color-text-primary));
    font-size: var(--text-sm);
  }

  .create-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
