<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import TextareaMetadataField from './fields/TextareaMetadataField.svelte';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import type { EPUBMetadata } from '../../epub';
  import type { ValidationResult } from '../../metadata/MetadataValidator';
  import {
    ACCESS_MODES,
    ACCESSIBILITY_FEATURES,
    ACCESSIBILITY_HAZARDS,
    ACCESSIBILITY_CONTROLS,
    ACCESSIBILITY_APIS,
    CONFORMANCE_OPTIONS,
    type VocabOption,
  } from '../../epub/accessibility-vocab';

  interface Props {
    metadata?: EPUBMetadata;
    validationErrors?: ValidationResult[];
    saving?: boolean;
    advancedMode?: boolean;
    onfieldChange?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldSave?: (event: CustomEvent<{ field: string; value: any }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
  }

  let {
    metadata = { title: '', language: [], identifier: '' },
    validationErrors = [],
    saving = false,
    advancedMode = false,
    onfieldSave,
    onfieldFocus,
  }: Props = $props();

  const getFieldError = (fieldName: string) => {
    const error = validationErrors.find(err => err.field === fieldName);
    return error ? error.message : '';
  };

  const save = (field: string, value: any) =>
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field, value } }));
  const focus = (field: keyof EPUBMetadata) =>
    onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field } }));

  // Hazard exclusivity (per EPUB/DAISY guidance): the blanket values are
  // mutually exclusive with everything, and each positive/negative pair is
  // mutually exclusive (you can't assert a hazard and its absence at once).
  const HAZARD_BLANKET = ['none', 'unknown'];
  const HAZARD_OPPOSITE: Record<string, string> = {
    flashing: 'noFlashingHazard',
    noFlashingHazard: 'flashing',
    sound: 'noSoundHazard',
    noSoundHazard: 'sound',
    motionSimulation: 'noMotionSimulationHazard',
    noMotionSimulationHazard: 'motionSimulation',
  };
  const nextHazards = (current: string[], value: string, on: boolean): string[] => {
    if (!on) return current.filter(v => v !== value);
    if (HAZARD_BLANKET.includes(value)) return [value]; // blanket clears the rest
    const opposite = HAZARD_OPPOSITE[value];
    const kept = current.filter(v => !HAZARD_BLANKET.includes(v) && v !== opposite);
    return [...kept, value];
  };

  // Add/remove a value from a multi-valued field and save the whole array.
  const toggle = (field: string, current: string[] | undefined, value: string, on: boolean) => {
    if (field === 'accessibilityHazard') {
      save(field, nextHazards(current ?? [], value, on));
      return;
    }
    const set = new Set(current ?? []);
    if (on) set.add(value);
    else set.delete(value);
    save(field, Array.from(set));
  };

  // accessModeSufficient is a list of comma-separated mode sets. Build each set
  // from the modes the publication actually declares (falling back to all when
  // none are declared yet), keeping tokens in canonical order.
  const availableModes = $derived(
    metadata.accessMode?.length
      ? ACCESS_MODES.filter(m => metadata.accessMode!.includes(m.value))
      : ACCESS_MODES
  );
  const sufficientSets = $derived(metadata.accessModeSufficient ?? []);
  const setTokens = (set: string) =>
    set
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  const toggleInSet = (index: number, mode: string, on: boolean) => {
    const tokens = new Set(setTokens(sufficientSets[index] ?? ''));
    if (on) tokens.add(mode);
    else tokens.delete(mode);
    // Re-order to the canonical access-mode order.
    const ordered = ACCESS_MODES.filter(m => tokens.has(m.value)).map(m => m.value);
    const next = [...sufficientSets];
    next[index] = ordered.join(',');
    save('accessModeSufficient', next);
  };
  const addSet = () => {
    const initial = availableModes.map(m => m.value).join(',') || 'textual';
    save('accessModeSufficient', [...sufficientSets, initial]);
  };
  const removeSet = (index: number) =>
    save(
      'accessModeSufficient',
      sufficientSets.filter((_, i) => i !== index)
    );

  const conformanceOptions = $derived(
    CONFORMANCE_OPTIONS.map(o => ({ value: o.value, label: $t(o.label) }))
  );

  // Advanced sections: shown in advanced mode or when already populated.
  const showSufficient = $derived(advancedMode || (metadata.accessModeSufficient?.length ?? 0) > 0);
  const showControls = $derived(advancedMode || (metadata.accessibilityControl?.length ?? 0) > 0);
  const showApi = $derived(advancedMode || (metadata.accessibilityAPI?.length ?? 0) > 0);
  const showCertification = $derived(
    advancedMode ||
      !!metadata.accessibilityCertifiedBy ||
      !!metadata.accessibilityCertifierCredential ||
      !!metadata.accessibilityCertifierReport
  );
</script>

{#snippet checkboxGroup(legend: string, options: VocabOption[], selected: string[] | undefined, field: string)}
  <fieldset class="field-group">
    <legend class="group-title" tabindex="-1">{legend}</legend>
    <div class="checkbox-grid">
      {#each options as opt (opt.value)}
        <label class="checkbox-item">
          <input
            type="checkbox"
            checked={(selected ?? []).includes(opt.value)}
            disabled={saving}
            onchange={e => toggle(field, selected, opt.value, e.currentTarget.checked)}
            onfocus={() => focus(field as keyof EPUBMetadata)}
          />
          <span>{opt.label}</span>
        </label>
      {/each}
    </div>
  </fieldset>
{/snippet}

<div class="accessibility-fields">
  <div class="form-columns">
    <!-- Column 1: the priority "ways of reading" + conformance fields the
         W3C/DAISY display guide calls out as most important. -->
    <div class="column">
      {@render checkboxGroup($t('Access modes'), ACCESS_MODES, metadata.accessMode, 'accessMode')}

      {#if showSufficient}
        <fieldset class="field-group">
          <legend class="group-title" tabindex="-1">{$t('Sufficient access modes')}</legend>
          <p class="field-hint">
            {$t('Each row is one combination of modes that is enough on its own to read the whole publication.')}
          </p>

          {#each sufficientSets as set, index (index)}
            <div class="sufficient-row">
              <div class="mode-toggles">
                {#each availableModes as mode (mode.value)}
                  <label class="mode-chip" class:selected={setTokens(set).includes(mode.value)}>
                    <input
                      type="checkbox"
                      checked={setTokens(set).includes(mode.value)}
                      disabled={saving}
                      onchange={e => toggleInSet(index, mode.value, e.currentTarget.checked)}
                      onfocus={() => focus('accessModeSufficient')}
                    />
                    <span>{mode.label}</span>
                  </label>
                {/each}
              </div>
              <button
                type="button"
                class="remove-button"
                onclick={() => removeSet(index)}
                disabled={saving}
                aria-label={$t('Remove')}
              >
                ×
              </button>
            </div>
          {/each}

          <button type="button" class="add-button" onclick={addSet} disabled={saving}>
            {$t('Add a sufficient set')}
          </button>
        </fieldset>
      {/if}

      <fieldset class="field-group">
        <legend class="group-title" tabindex="-1">{$t('Conformance')}</legend>
        <SelectMetadataField
          id="accessibilityConformance"
          label={$t('Conformance level')}
          value={metadata.accessibilityConformance || ''}
          options={conformanceOptions}
          onblur={e => save('accessibilityConformance', e.value)}
          onfocus={() => focus('accessibilityConformance' as keyof EPUBMetadata)}
        />
      </fieldset>

      {#if showCertification}
        <fieldset class="field-group">
          <legend class="group-title" tabindex="-1">{$t('Certification')}</legend>
          <TextMetadataField
            id="accessibilityCertifiedBy"
            label={$t('Certified by')}
            value={metadata.accessibilityCertifiedBy || ''}
            placeholder={$t('Name of the certifying party')}
            onblur={e => save('accessibilityCertifiedBy', e.value)}
            onfocus={() => focus('accessibilityCertifiedBy' as keyof EPUBMetadata)}
          />
          <TextMetadataField
            id="accessibilityCertifierCredential"
            label={$t('Certifier credential')}
            value={metadata.accessibilityCertifierCredential || ''}
            placeholder={$t('Credential of the certifier')}
            onblur={e => save('accessibilityCertifierCredential', e.value)}
            onfocus={() => focus('accessibilityCertifierCredential' as keyof EPUBMetadata)}
          />
          <TextMetadataField
            id="accessibilityCertifierReport"
            label={$t('Certifier report (URL)')}
            value={metadata.accessibilityCertifierReport || ''}
            placeholder={$t('https://example.com/report')}
            onblur={e => save('accessibilityCertifierReport', e.value)}
            onfocus={() => focus('accessibilityCertifierReport' as keyof EPUBMetadata)}
          />
        </fieldset>
      {/if}
    </div>

    <!-- Column 2: supporting detail; the free-text Summary complements the
         structured fields and so comes last. -->
    <div class="column">
      {@render checkboxGroup(
        $t('Accessibility features'),
        ACCESSIBILITY_FEATURES,
        metadata.accessibilityFeature,
        'accessibilityFeature'
      )}
      {@render checkboxGroup(
        $t('Hazards'),
        ACCESSIBILITY_HAZARDS,
        metadata.accessibilityHazard,
        'accessibilityHazard'
      )}

      {#if showControls}
        {@render checkboxGroup(
          $t('Control methods'),
          ACCESSIBILITY_CONTROLS,
          metadata.accessibilityControl,
          'accessibilityControl'
        )}
      {/if}

      {#if showApi}
        {@render checkboxGroup(
          $t('Accessibility API'),
          ACCESSIBILITY_APIS,
          metadata.accessibilityAPI,
          'accessibilityAPI'
        )}
      {/if}

      <fieldset class="field-group">
        <legend class="group-title" tabindex="-1">{$t('Summary')}</legend>
        <TextareaMetadataField
          id="accessibilitySummary"
          value={metadata.accessibilitySummary || ''}
          placeholder={$t('Human-readable summary of the accessibility of this publication')}
          rows={3}
          error={getFieldError('accessibilitySummary')}
          onblur={e => save('accessibilitySummary', e.value)}
          onfocus={() => focus('accessibilitySummary')}
        />
      </fieldset>
    </div>
  </div>
</div>

<style>
  .accessibility-fields {
    padding: 1.5rem;
    /* Query the pane width, not the viewport (this form sits in a split pane). */
    container-type: inline-size;
  }

  .form-columns {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @container (min-width: 640px) {
    .form-columns {
      grid-template-columns: 1fr 1fr;
    }
  }

  .column {
    min-width: 0;
  }

  .field-group {
    margin-block-end: 2rem;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: 1.5rem;
  }

  .field-group:last-child {
    margin-block-end: 0;
  }

  .group-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem 1rem;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .checkbox-item input {
    flex: none;
    cursor: pointer;
  }

  .field-hint {
    margin-block: 0 0.75rem;
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
  }

  .sufficient-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-block-end: 0.5rem;
  }

  .mode-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    flex: 1;
  }

  .mode-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-pill, 9999px);
    background-color: var(--color-bg-primary);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .mode-chip.selected {
    background-color: var(--color-primary-surface, var(--color-bg-accent));
    border-color: var(--color-primary);
  }

  .remove-button {
    flex: none;
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
    padding: 0.5rem 0.875rem;
    border: 1px dashed var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--color-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .add-button:hover:not(:disabled) {
    background-color: var(--color-primary-surface);
    border-color: var(--color-primary);
    border-style: solid;
  }
</style>
