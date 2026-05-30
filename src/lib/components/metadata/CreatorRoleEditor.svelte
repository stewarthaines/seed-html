<script lang="ts">
  import { t } from '../../i18n';
  import TextMetadataField from './fields/TextMetadataField.svelte';
  import SelectMetadataField from './fields/SelectMetadataField.svelte';
  import type { Creator, EPUBMetadata, CreatorMetadataFields } from '../../epub/opf-utils';
  import { marcLabel, marcSelectOptions } from '../../epub/marc-relators';

  interface Props {
    field: CreatorMetadataFields;
    creators?: Creator[];
    saving?: boolean;
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

          <div class="add-role">
            <SelectMetadataField
              id="{field}-{index}-role"
              value=""
              options={roleOptions}
              placeholder={$t('Add role…')}
              disabled={saving}
              onblur={e => addRole(index, e.value)}
            />
          </div>
        </div>
      </div>
    {/each}

    <button type="button" class="add-button" onclick={addPerson} disabled={saving}>
      {addLabel}
    </button>
  </div>
</fieldset>

<style>
  .creator-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .creator-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg-primary);
  }

  .creator-name-row {
    display: flex;
    align-items: flex-start;
    gap: 0;
  }

  .creator-name-row :global(.metadata-field) {
    flex: 1;
    margin-block-end: 0;
  }

  .remove-button {
    width: 2.5rem;
    align-self: stretch;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
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

  .add-role {
    min-width: 12rem;
  }

  .add-role :global(.metadata-field) {
    margin-block-end: 0;
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
