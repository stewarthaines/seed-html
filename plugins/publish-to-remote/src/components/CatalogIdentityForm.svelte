<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../i18n.js';
  import {
    DEFAULT_FILE_FOR_FORMAT,
    formatForKey,
    type CatalogFormat,
    type CatalogInfo,
  } from '../catalog.js';
  import type { CatalogIdentity } from '../opds.js';

  // Edit a destination's catalog identity: format, file, title, author name
  // and link. Save writes the feed; a format change nudges the filename's
  // extension unless it was typed by hand.
  let {
    catalog,
    busy = false,
    onSave,
    onCancel,
  }: {
    catalog: CatalogInfo;
    busy?: boolean;
    onSave: (file: string, identity: Required<CatalogIdentity>) => void;
    onCancel: () => void;
  } = $props();

  // The form is seeded from the catalog as it was when opened.
  const initial = untrack(() => ({
    format: catalog.format,
    file: catalog.file,
    ...catalog.identity,
  }));
  let format = $state<CatalogFormat>(initial.format);
  let file = $state(initial.file);
  let title = $state(initial.title);
  let authorName = $state(initial.authorName);
  let authorUri = $state(initial.authorUri);

  function onFormatChange() {
    const oldExt = format === 'opds2' ? /\.xml$/i : /\.json$/i;
    const newExt = format === 'opds2' ? '.json' : '.xml';
    if (oldExt.test(file.trim())) file = file.trim().replace(oldExt, newExt);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const name = file.trim() || DEFAULT_FILE_FOR_FORMAT[format];
    onSave(name, {
      title: title.trim(),
      authorName: authorName.trim(),
      authorUri: authorUri.trim(),
    });
  }

  const formatMismatch = $derived(
    file.trim() !== '' && formatForKey(file.trim()) !== format,
  );
</script>

<form class="identity-form" onsubmit={submit}>
  <div class="fields">
    <label class="field field-format">
      <span class="field-label">{$t('Format')}</span>
      <select class="input" bind:value={format} onchange={onFormatChange}>
        <!-- i18n-ignore -->
        <option value="opds2">OPDS 2.0</option>
        <!-- i18n-ignore -->
        <option value="opds1">OPDS 1.2</option>
      </select>
    </label>
    <label class="field">
      <span class="field-label">{$t('Catalog file')}</span>
      <input
        type="text"
        class="input"
        bind:value={file}
        placeholder={DEFAULT_FILE_FOR_FORMAT[format]}
        spellcheck="false"
        autocomplete="off"
      />
    </label>
    <label class="field field-wide">
      <span class="field-label">{$t('Title')}</span>
      <input type="text" class="input" bind:value={title} />
    </label>
    <label class="field">
      <span class="field-label">{$t('Name')}</span>
      <input type="text" class="input" bind:value={authorName} />
    </label>
    <label class="field">
      <span class="field-label">{$t('URI')}</span>
      <input
        type="text"
        class="input"
        bind:value={authorUri}
        spellcheck="false"
        autocomplete="off"
      />
    </label>
  </div>
  {#if formatMismatch}
    <p class="note">{$t('The file’s extension does not match the format.')}</p>
  {/if}
  <div class="actions">
    <button type="button" class="btn btn-secondary" onclick={onCancel} disabled={busy}>
      {$t('Cancel')}
    </button>
    <button type="submit" class="btn btn-primary" disabled={busy}>
      {busy ? $t('Updating...') : $t('Save')}
    </button>
  </div>
</form>

<style>
  .identity-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px 14px;
    border-block-start: 1px solid var(--color-border-default);
  }

  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1 1 140px;
    min-inline-size: 0;
  }

  .field-wide {
    flex-basis: 100%;
  }

  .field-format {
    flex: 0 1 auto;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .input {
    inline-size: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    font: inherit;
    font-size: 13px;
    color: var(--color-text-primary);
    background: var(--color-surface-primary);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-bg-active);
  }

  .note {
    margin: 0;
    font-size: 12px;
    color: var(--color-warning-text);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
