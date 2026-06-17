<!--
  Generator Panel

  Reveals in the spine editor (like the audio-clip inserter) so the user can run a
  Generator and insert its produced source text at the caret. Picks a generator,
  renders its `options` as a small form, runs it, and calls `onInsert` with the
  result. Decoupled from storage/the engine via the GeneratorRunner contract.
-->
<script lang="ts">
  import { t } from '$lib/i18n';
  import type { GeneratorRunner, InstalledGenerator } from '$lib/generators/generator-store.js';
  import type { GeneratorOption } from '$lib/extensions/extension-catalog.js';

  let {
    runner,
    onInsert,
  }: {
    runner: GeneratorRunner;
    onInsert: (text: string) => void;
  } = $props();

  // Empty until the user picks; `selected` falls back to the first generator, so the
  // panel works before any explicit choice (and across generator-list changes).
  let selectedId = $state('');
  const selected = $derived(
    runner.generators.find(g => g.manifest.id === selectedId) ?? runner.generators[0] ?? null
  );

  // Current option values for the selected generator (defaults overlaid with the
  // last-used values, loaded lazily when the selection changes).
  let values = $state<Record<string, unknown>>({});
  let busy = $state(false);
  let error = $state<string | null>(null);

  function fallbackFor(opt: GeneratorOption): unknown {
    if (opt.type === 'boolean') return false;
    if (opt.type === 'select') return opt.options?.[0]?.value ?? '';
    return '';
  }

  // Seed defaults then overlay the saved values whenever the selected generator changes.
  $effect(() => {
    const gen = selected;
    if (!gen) return;
    let cancelled = false;
    error = null;
    void runner.loadValues(gen.manifest.id).then(saved => {
      if (cancelled) return;
      const seeded: Record<string, unknown> = {};
      for (const opt of gen.manifest.options) {
        seeded[opt.name] = opt.default ?? fallbackFor(opt);
      }
      values = { ...seeded, ...saved };
    });
    return () => {
      cancelled = true;
    };
  });

  function setValue(name: string, value: unknown): void {
    values = { ...values, [name]: value };
  }

  async function generate(): Promise<void> {
    const gen = selected;
    if (!gen || busy) return;
    busy = true;
    error = null;
    try {
      const text = await runner.run(gen, values);
      await runner.saveValues(gen.manifest.id, values);
      onInsert(text);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="generator-panel">
  <div class="gp-head">
    <span class="gp-title">{$t('Generators')}</span>
    {#if runner.generators.length > 1}
      <select
        class="gp-select"
        value={selected?.manifest.id ?? ''}
        onchange={e => (selectedId = e.currentTarget.value)}
        aria-label={$t('Choose a generator')}
      >
        {#each runner.generators as g (g.manifest.id)}
          <option value={g.manifest.id}>{g.manifest.name}</option>
        {/each}
      </select>
    {:else if selected}
      <span class="gp-name">{selected.manifest.name}</span>
    {/if}
  </div>

  {#if selected}
    {#if selected.manifest.description}
      <p class="gp-desc">{selected.manifest.description}</p>
    {/if}

    {#if selected.manifest.options.length > 0}
      <div class="gp-options">
        {#each selected.manifest.options as opt (opt.name)}
          <div class="gp-field" class:inline={opt.type === 'boolean'}>
            {#if opt.type === 'boolean'}
              <label class="gp-check">
                <input
                  type="checkbox"
                  checked={Boolean(values[opt.name])}
                  onchange={e => setValue(opt.name, e.currentTarget.checked)}
                />
                <span>{opt.label}</span>
              </label>
            {:else}
              <label class="gp-label" for={`gp-opt-${opt.name}`}>{opt.label}</label>
              {#if opt.type === 'select'}
                <select
                  id={`gp-opt-${opt.name}`}
                  class="gp-input"
                  value={String(values[opt.name] ?? '')}
                  onchange={e => setValue(opt.name, e.currentTarget.value)}
                >
                  {#each opt.options ?? [] as choice (choice.value)}
                    <option value={choice.value}>{choice.label}</option>
                  {/each}
                </select>
              {:else}
                <input
                  id={`gp-opt-${opt.name}`}
                  class="gp-input"
                  type={opt.type === 'number' ? 'number' : 'text'}
                  value={String(values[opt.name] ?? '')}
                  placeholder={opt.placeholder ?? ''}
                  oninput={e =>
                    setValue(
                      opt.name,
                      opt.type === 'number'
                        ? e.currentTarget.value === ''
                          ? ''
                          : Number(e.currentTarget.value)
                        : e.currentTarget.value
                    )}
                />
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if error}
      <p class="gp-error" role="alert">{error}</p>
    {/if}

    <div class="gp-actions">
      <button type="button" class="btn btn-primary" onclick={generate} disabled={busy}>
        {busy ? $t('Generating…') : $t('Insert at cursor')}
      </button>
    </div>
  {/if}
</div>

<style>
  .generator-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .gp-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .gp-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
  }

  .gp-name {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .gp-desc {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .gp-options {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .gp-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .gp-field.inline {
    flex-direction: row;
    align-items: center;
  }

  .gp-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
  }

  .gp-input,
  .gp-select {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
  }

  .gp-input:focus,
  .gp-select:focus {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px var(--color-focus-ring);
  }

  .gp-check {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .gp-error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-status-error);
  }

  .gp-actions {
    display: flex;
    justify-content: flex-end;
  }

</style>
