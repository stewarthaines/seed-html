<!--
  Generator Settings

  Project Settings → Generators. Lets the user define a generator by hand: a name,
  optional description, a list of options, and a script file (exporting
  generateText(ctx, options)). Mirrors the "Import JavaScript Extension" flow and is
  advanced-mode gated. Persists via the generator-store (SOURCE/generators/<id>/).
-->
<script lang="ts">
  import { t } from '$lib/i18n';
  import { FileStorageAPI } from '$lib/storage/index.js';
  import { normalizeExtensionName } from '$lib/extensions/utils.js';
  import {
    listGenerators,
    writeGenerator,
    readGeneratorScript,
    deleteGenerator,
    type InstalledGenerator,
  } from '$lib/generators/generator-store.js';
  import type { GeneratorManifest, GeneratorOption } from '$lib/extensions/extension-catalog.js';
  import SettingsSection from './SettingsSection.svelte';
  import { X } from 'phosphor-svelte';

  let {
    workspaceId,
    isAdvancedMode = false,
    group = 'project-settings',
    open = false,
    onChanged,
  }: {
    workspaceId: string;
    isAdvancedMode?: boolean;
    /** Accordion group this section belongs to (SettingsSection `name`). */
    group?: string;
    /** Start expanded. */
    open?: boolean;
    onChanged?: () => void;
  } = $props();

  const fileStorage = FileStorageAPI.getInstance();

  let generators = $state<InstalledGenerator[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // --- Create form -----------------------------------------------------------
  type OptionRow = {
    type: GeneratorOption['type'];
    name: string;
    label: string;
    placeholder: string;
    textDefault: string;
    boolDefault: boolean;
    choices: string; // "value:label, value:label" or bare "value"
  };

  let name = $state('');
  let description = $state('');
  let optionRows = $state<OptionRow[]>([]);
  let saving = $state(false);
  // Non-null while editing an existing generator (its id); null = creating a new one.
  let editingId = $state<string | null>(null);

  const optionTypeLabels: { value: GeneratorOption['type']; label: string }[] = [
    { value: 'string', label: $t('Text') },
    { value: 'number', label: $t('Number') },
    { value: 'boolean', label: $t('Checkbox') },
    { value: 'select', label: $t('Dropdown') },
  ];

  // Collapsed-header summary: how many generators are defined.
  const genSummary = $derived(
    generators.length === 0
      ? $t('No generators')
      : generators.length === 1
        ? $t('{n} generator', { n: generators.length })
        : $t('{n} generators', { n: generators.length })
  );

  async function refresh(): Promise<void> {
    loading = true;
    try {
      generators = await listGenerators(fileStorage, workspaceId);
    } catch {
      generators = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (workspaceId) void refresh();
  });

  function addOption(): void {
    optionRows = [
      ...optionRows,
      {
        type: 'string',
        name: '',
        label: '',
        placeholder: '',
        textDefault: '',
        boolDefault: false,
        choices: '',
      },
    ];
  }

  function removeOption(index: number): void {
    optionRows = optionRows.filter((_, i) => i !== index);
  }

  function patchOption(index: number, patch: Partial<OptionRow>): void {
    optionRows = optionRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
  }

  function parseChoices(raw: string): { value: string; label: string }[] {
    return raw
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [value, label] = part.split(':').map(s => s.trim());
        return { value, label: label || value };
      });
  }

  function buildOptions(): GeneratorOption[] {
    const out: GeneratorOption[] = [];
    for (const row of optionRows) {
      const optName = row.name.trim();
      if (!optName) continue; // skip rows with no key
      const opt: GeneratorOption = {
        type: row.type,
        name: optName,
        label: row.label.trim() || optName,
      };
      if (row.placeholder.trim()) opt.placeholder = row.placeholder.trim();
      if (row.type === 'boolean') {
        opt.default = row.boolDefault;
      } else if (row.type === 'number') {
        if (row.textDefault.trim()) opt.default = Number(row.textDefault);
      } else if (row.textDefault.trim()) {
        opt.default = row.textDefault;
      }
      if (row.type === 'select') opt.options = parseChoices(row.choices);
      out.push(opt);
    }
    return out;
  }

  /** Reconstruct editable option rows from a saved generator's options. */
  function toOptionRows(options: GeneratorOption[]): OptionRow[] {
    return options.map(o => ({
      type: o.type,
      name: o.name,
      label: o.label,
      placeholder: o.placeholder ?? '',
      textDefault: o.type === 'boolean' || o.default == null ? '' : String(o.default),
      boolDefault: o.type === 'boolean' ? Boolean(o.default) : false,
      choices:
        o.type === 'select'
          ? (o.options ?? [])
              .map(c => (c.value === c.label ? c.value : `${c.value}:${c.label}`))
              .join(', ')
          : '',
    }));
  }

  /** Load an existing generator into the form for editing (id stays fixed). */
  function startEdit(gen: InstalledGenerator): void {
    error = null;
    editingId = gen.manifest.id;
    name = gen.manifest.name;
    description = gen.manifest.description ?? '';
    optionRows = toOptionRows(gen.manifest.options);
  }

  /** JSDoc type for an option, from its form type. */
  function jsdocType(type: GeneratorOption['type']): string {
    if (type === 'boolean') return 'boolean';
    if (type === 'number') return 'number';
    return 'string';
  }

  /**
   * Scaffold a starter generator script: the generateText signature, a comment
   * describing ctx and the options the user defined, and a placeholder return. The
   * author then edits it from the chapter editor's file dropdown.
   */
  function buildBoilerplate(
    genName: string,
    genDescription: string,
    options: GeneratorOption[]
  ): string {
    const optionDocs = options.length
      ? options.map(o => ` *   options.${o.name} (${jsdocType(o.type)}) — ${o.label}`).join('\n')
      : ' *   (this generator has no options)';
    const descBlock = genDescription ? ` * ${genDescription}\n *\n` : ' *\n';
    return `/**
 * Generator: ${genName}
${descBlock} * Produces source text that is inserted at the editor caret. Return a string in
 * your project's source format — it is run through the text transform afterwards.
 *
 * @param {object} ctx - read-only project context:
 *   ctx.idref                       - id of the chapter this was invoked in
 *   ctx.manifest                    - OPF manifest items: { id, href, mediaType, ... }
 *   ctx.readManifestText(href)      - read a manifest item as text (async)
 *   ctx.readSourceText(path)        - read a SOURCE/ file as text (async)
 *   ctx.writeSourceText(path, text) - write a file under SOURCE/data/ (async)
 * @param {object} options - values entered in the generator's form:
${optionDocs}
 * @returns {string} the text to insert
 */
function generateText(ctx, options) {
  // Build and return the text to insert. This placeholder returns a greeting.
  return 'Hello, world!';
}
`;
  }

  function resetForm(): void {
    name = '';
    description = '';
    optionRows = [];
    editingId = null;
  }

  async function handleSave(): Promise<void> {
    if (!isAdvancedMode || saving) return;
    error = null;
    const trimmedName = name.trim();
    if (!trimmedName) {
      error = $t('A name is required.');
      return;
    }
    const description_ = description.trim();
    const options = buildOptions();
    saving = true;
    try {
      if (editingId) {
        // Editing: update the manifest (name/description/options) but keep the
        // existing script + id, so a hand-edited generateText isn't clobbered.
        const existing = generators.find(g => g.manifest.id === editingId);
        if (!existing) {
          error = $t('A name is required.');
          return;
        }
        const script = await readGeneratorScript(fileStorage, workspaceId, existing);
        const manifest: GeneratorManifest = {
          id: editingId,
          name: trimmedName,
          description: description_ || undefined,
          script: existing.manifest.script,
          options,
        };
        const buffer = new TextEncoder().encode(script).buffer as ArrayBuffer;
        await writeGenerator(fileStorage, workspaceId, manifest, buffer);
      } else {
        // Creating: scaffold a fresh script — refuse to clobber an existing one.
        const id = normalizeExtensionName(trimmedName);
        if (!id) {
          error = $t('A name is required.');
          return;
        }
        if (generators.some(g => g.manifest.id === id)) {
          error = $t('A generator with that name already exists.');
          return;
        }
        const manifest: GeneratorManifest = {
          id,
          name: trimmedName,
          description: description_ || undefined,
          script: `${id}.js`,
          options,
        };
        const boilerplate = buildBoilerplate(trimmedName, description_, options);
        const buffer = new TextEncoder().encode(boilerplate).buffer as ArrayBuffer;
        await writeGenerator(fileStorage, workspaceId, manifest, buffer);
      }
      resetForm();
      await refresh();
      onChanged?.();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  async function handleRemove(id: string): Promise<void> {
    if (!isAdvancedMode) return;
    error = null;
    try {
      await deleteGenerator(fileStorage, workspaceId, id);
      await refresh();
      onChanged?.();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<SettingsSection title={$t('Generators')} summary={genSummary} name={group} {open}>
  <div class="generator-settings">
    <p class="gs-intro">
      {$t(
        'A generator is a script (exporting generateText(ctx, options)) that produces source text to insert at the editor caret.'
      )}
    </p>

    <!-- Existing generators -->
    {#if loading}
      <p>{$t('Loading…')}</p>
    {:else if generators.length === 0}
      <p class="gs-empty">{$t('No generators defined.')}</p>
    {:else}
      <ul class="gs-list">
        {#each generators as g (g.manifest.id)}
          <li class="gs-item">
            <div class="gs-item-text">
              <span class="gs-item-name">{g.manifest.name}</span>
              {#if g.manifest.description}
                <span class="gs-item-desc">{g.manifest.description}</span>
              {/if}
            </div>
            <div class="gs-item-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onclick={() => startEdit(g)}
                disabled={!isAdvancedMode}
              >
                {$t('Edit')}
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                onclick={() => handleRemove(g.manifest.id)}
                disabled={!isAdvancedMode}
              >
                {$t('Remove')}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Create / overwrite -->
    <div class="gs-create" class:disabled={!isAdvancedMode}>
      <h4>{editingId ? $t('Edit generator') : $t('Add a generator')}</h4>
      {#if !editingId}
        <p class="gs-help">
          {$t(
            'Create scaffolds a starter generateText script (with your options documented) that you can edit from the chapter editor’s file menu.'
          )}
        </p>
      {/if}
      {#if !isAdvancedMode}
        <p class="advanced-mode-note">{$t('Advanced Mode required for extension management')}</p>
      {/if}

      <div class="gs-field">
        <label class="gs-label" for="gs-name">{$t('Name')}</label>
        <input id="gs-name" class="gs-input" bind:value={name} disabled={!isAdvancedMode} />
      </div>

      <div class="gs-field">
        <label class="gs-label" for="gs-desc">{$t('Description')}</label>
        <input id="gs-desc" class="gs-input" bind:value={description} disabled={!isAdvancedMode} />
      </div>

      <div class="gs-options">
        <div class="gs-options-head">
          <span class="gs-label">{$t('Options')}</span>
          <button type="button" class="btn btn-secondary btn-sm" onclick={addOption} disabled={!isAdvancedMode}>
            {$t('Add option')}
          </button>
        </div>

        {#each optionRows as row, i (i)}
          <div class="gs-option-row">
            <select
              class="gs-input gs-type"
              value={row.type}
              onchange={e =>
                patchOption(i, { type: e.currentTarget.value as GeneratorOption['type'] })}
              aria-label={$t('Option type')}
              disabled={!isAdvancedMode}
            >
              {#each optionTypeLabels as ot (ot.value)}
                <option value={ot.value}>{ot.label}</option>
              {/each}
            </select>
            <input
              class="gs-input"
              placeholder={$t('Key')}
              value={row.name}
              oninput={e => patchOption(i, { name: e.currentTarget.value })}
              aria-label={$t('Option key')}
              disabled={!isAdvancedMode}
            />
            <input
              class="gs-input"
              placeholder={$t('Label')}
              value={row.label}
              oninput={e => patchOption(i, { label: e.currentTarget.value })}
              aria-label={$t('Option label')}
              disabled={!isAdvancedMode}
            />
            {#if row.type === 'boolean'}
              <label class="gs-check">
                <input
                  type="checkbox"
                  checked={row.boolDefault}
                  onchange={e => patchOption(i, { boolDefault: e.currentTarget.checked })}
                  disabled={!isAdvancedMode}
                />
                <span>{$t('Default on')}</span>
              </label>
            {:else if row.type === 'select'}
              <input
                class="gs-input"
                placeholder={$t('value:Label, value:Label')}
                value={row.choices}
                oninput={e => patchOption(i, { choices: e.currentTarget.value })}
                aria-label={$t('Choices')}
                disabled={!isAdvancedMode}
              />
            {:else}
              <input
                class="gs-input"
                placeholder={$t('Default')}
                value={row.textDefault}
                oninput={e => patchOption(i, { textDefault: e.currentTarget.value })}
                aria-label={$t('Default value')}
                disabled={!isAdvancedMode}
              />
            {/if}
            <button
              type="button"
              class="btn btn-danger btn-sm"
              onclick={() => removeOption(i)}
              aria-label={$t('Remove option')}
              disabled={!isAdvancedMode}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        {/each}
      </div>

      {#if error}
        <p class="gs-error" role="alert">{error}</p>
      {/if}

      <div class="gs-actions">
        {#if editingId}
          <button type="button" class="btn btn-secondary btn-sm" onclick={resetForm} disabled={saving}>
            {$t('Cancel')}
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={handleSave}
          disabled={!isAdvancedMode || saving}
        >
          {saving ? $t('Saving…') : editingId ? $t('Save changes') : $t('Create generator')}
        </button>
      </div>
    </div>
  </div>
</SettingsSection>

<style>
  .generator-settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .gs-intro,
  .gs-empty,
  .gs-help {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .gs-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .gs-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
  }

  .gs-item-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .gs-item-name {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-primary);
  }

  .gs-item-desc {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  /* No nested box/border — the SettingsSection card is the container, so the create
     form flows in the section body like every other section's controls. */
  .gs-create {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .gs-create.disabled {
    opacity: 0.7;
  }

  .gs-create h4 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .gs-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .gs-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .gs-input {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
  }

  .gs-input:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px var(--color-focus-ring);
  }

  .gs-options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .gs-options-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Wrappable row so the fields stay inside the form container at any width. */
  .gs-option-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .gs-option-row .gs-input {
    flex: 1 1 8rem;
    min-width: 0;
  }

  .gs-type {
    flex: 0 0 7rem;
  }

  .gs-option-row .gs-check {
    flex: 1 1 8rem;
  }

  .gs-check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }

  .gs-item-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .gs-error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-status-error);
  }

  .gs-actions {
    display: flex;
    justify-content: flex-end;
  }

  .advanced-mode-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    font-style: italic;
  }

</style>
