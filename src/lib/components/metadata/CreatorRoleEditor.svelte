<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import type { Creator, EPUBMetadata, CreatorMetadataFields } from '../../epub/opf-utils';
  import { marcLabel, marcSelectOptions } from '../../epub/marc-relators';

  interface Props {
    field: CreatorMetadataFields;
    creators?: Creator[];
    saving?: boolean;
    advancedMode?: boolean;
    legend: string;
    addLabel: string;
    namePlaceholder: string;
    getFieldError?: (name: string) => string;
    onfieldSave?: (event: CustomEvent<{ field: string; value: Creator[] }>) => void;
    onarrayAdd?: (event: CustomEvent<{ field: CreatorMetadataFields }>) => void;
    onarrayRemove?: (event: CustomEvent<{ field: CreatorMetadataFields; index: number }>) => void;
    onfieldFocus?: (event: CustomEvent<{ field: keyof EPUBMetadata | null }>) => void;
  }

  let {
    field,
    creators = [],
    saving = false,
    advancedMode = false,
    legend,
    addLabel,
    namePlaceholder,
    getFieldError = () => '',
    onfieldSave,
    onarrayAdd,
    onarrayRemove,
    onfieldFocus,
  }: Props = $props();

  const roleOptions = marcSelectOptions();

  // All name/role edits funnel through a single whole-array save (blur-to-save,
  // mirroring the existing creator pattern to avoid reactive flicker).
  const save = (next: Creator[]) => {
    onfieldSave?.(new CustomEvent('fieldSave', { detail: { field, value: next } }));
  };

  const updateName = (index: number, name: string) => {
    save(creators.map((c, i) => (i === index ? { ...c, name } : c)));
  };

  const updateFileAs = (index: number, fileAs: string) => {
    save(creators.map((c, i) => (i === index ? { ...c, fileAs } : c)));
  };

  const addRole = (index: number, role: string) => {
    if (!role) return;
    save(
      creators.map((c, i) =>
        i === index && !c.roles.includes(role) ? { ...c, roles: [...c.roles, role] } : c
      )
    );
  };

  const removeRole = (index: number, role: string) => {
    save(creators.map((c, i) => (i === index ? { ...c, roles: c.roles.filter(r => r !== role) } : c)));
  };

  const addPerson = () => onarrayAdd?.(new CustomEvent('arrayAdd', { detail: { field } }));
  const removePerson = (index: number) =>
    onarrayRemove?.(new CustomEvent('arrayRemove', { detail: { field, index } }));
  const focus = () => onfieldFocus?.(new CustomEvent('fieldFocus', { detail: { field } }));
</script>

<fieldset class="field-group">
  <legend class="group-title" tabindex="-1">{legend}</legend>

  <div class="creator-list">
    {#each creators as creator, index (index)}
      <div class="creator-item">
        <div class="creator-name-row">
          <TextMetadataField
            id="{field}-{index}"
            value={creator.name}
            placeholder={namePlaceholder}
            error={getFieldError(`${field}[${index}]`)}
            onblur={e => updateName(index, e.value)}
            onfocus={focus}
          />
          <select
            class="add-role-select"
            aria-label={$t('Add role')}
            title={$t('Add role')}
            disabled={saving}
            onchange={e => {
              addRole(index, e.currentTarget.value);
              e.currentTarget.value = '';
            }}
          >
            <option value="">+</option>
            {#each roleOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
          <button
            type="button"
            class="remove-button"
            onclick={() => removePerson(index)}
            disabled={saving}
            aria-label={$t('Remove')}
          >
            ×
          </button>
        </div>

        {#if creator.roles.length > 0}
          <div class="roles-row">
            {#each creator.roles as role (role)}
              <span class="role-chip">
                {marcLabel(role)}
                <button
                  type="button"
                  class="chip-remove"
                  onclick={() => removeRole(index, role)}
                  disabled={saving}
                  aria-label={$t('Remove role')}
                >
                  ×
                </button>
              </span>
            {/each}
          </div>
        {/if}

        {#if advancedMode || creator.fileAs?.trim()}
          <div class="file-as-row">
            <TextMetadataField
              id="{field}-fileas-{index}"
              label={$t('Sort as')}
              value={creator.fileAs ?? ''}
              placeholder={$t('e.g. Tolkien, J. R. R.')}
              onblur={e => updateFileAs(index, e.value)}
              onfocus={focus}
            />
          </div>
        {/if}
      </div>
    {/each}

    <button type="button" class="add-button" onclick={addPerson} disabled={saving}>
      {addLabel}
    </button>
  </div>
</fieldset>

<style>
  /* Mirror the canonical metadata fieldset styling (see AdvancedFields.svelte
     "Subjects") so Creators/Contributors match the rest of the editor. */
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

  .creator-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .creator-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* Seamless input + controls in a single bordered box, matching .array-item. */
  .creator-name-row {
    display: flex;
    align-items: flex-start;
    gap: 0;
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .creator-name-row :global(.metadata-field) {
    flex: 1;
    margin-block-end: 0;
  }

  .creator-name-row :global(.field-input) {
    border: none;
    background-color: transparent;
    border-radius: 0;
  }

  .creator-name-row :global(.field-input:focus) {
    border: none;
    box-shadow: inset 0 0 0 2px var(--color-focus);
  }

  .creator-name-row :global(.field-input.error:focus) {
    box-shadow: inset 0 0 0 2px var(--color-error);
  }

  /* Match the input's total height: line-height + padding + border. */
  .remove-button,
  .add-role-select {
    width: 2.5rem;
    height: calc(1rem * 1.5 + 0.75rem * 2 - 1px);
    flex-shrink: 0;
    border: none;
    border-inline-start: 1px solid var(--color-border-default);
    border-radius: 0;
    background-color: var(--color-bg-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-button {
    color: var(--color-error);
    font-weight: 700;
  }

  .remove-button:hover:not(:disabled) {
    background-color: var(--color-error-bg);
    border-inline-start-color: var(--color-error-600);
  }

  /* Compact "add role" control, sized to match the remove (×) button so the two
     sit as an even pair to the right of the name. Shows a centered "+". */
  .add-role-select {
    appearance: none;
    -webkit-appearance: none;
    color: var(--color-text-secondary);
    line-height: 1;
    text-align: center;
    text-align-last: center;
  }

  .add-role-select:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .remove-button:disabled,
  .add-role-select:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .roles-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .role-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.25rem 0.125rem 0.5rem;
    border-radius: var(--radius-pill, 9999px);
    background-color: var(--color-bg-accent, var(--color-bg-secondary));
    color: var(--color-text-primary);
    font-size: var(--text-sm, 0.875rem);
    white-space: nowrap;
  }

  .chip-remove {
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.125rem;
  }

  .chip-remove:hover:not(:disabled) {
    color: var(--color-error);
  }

  .add-button {
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
