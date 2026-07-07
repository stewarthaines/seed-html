<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../../i18n';
  import SettingsSection from './SettingsSection.svelte';
  import { FileStorageAPI } from '../../storage/index.js';
  import { setReviewMode, deleteBase } from '../../track-changes/base-snapshot.js';
  import { generatePatchset } from '../../track-changes/patchset-generate.js';
  import {
    listPatchsets,
    savePatchset,
    deletePatchset,
  } from '../../track-changes/changes-store.js';
  import PatchsetReviewDialog from '../track-changes/PatchsetReviewDialog.svelte';
  import type { Patchset, ResolvedChange } from '../../track-changes/types.js';
  import type { SettingsService } from '../../services/settings/settings.service.js';
  import type { WorkspaceState } from '../../services/workspace/workspace.service.js';

  let {
    workspaceId,
    workspace,
    settingsService,
    enabled: initialEnabled,
    onChanged,
    onApply,
  }: {
    workspaceId: string | null;
    /** Current workspace — needed to derive a patchset (identifier, manifest, content). */
    workspace: WorkspaceState | null;
    settingsService: SettingsService;
    /** Current track_changes value from the loaded EPUB settings. */
    enabled: boolean;
    /** Called after the setting is persisted so the app reloads EPUB settings
        (which re-syncs review mode and the structural lock-down). */
    onChanged?: () => void;
    /** Apply resolved changes to the current project (orchestrated by App, which
        holds the spine/workspace services). */
    onApply?: (resolved: ResolvedChange[]) => Promise<void>;
  } = $props();

  const currentIdentifier = $derived(workspace?.opf.metadata.identifier ?? '');

  let patchsets = $state<Patchset[]>([]);
  let reviewing = $state<Patchset | null>(null);
  let applyMsg = $state<string | null>(null);

  async function loadList() {
    const all = await listPatchsets();
    // Patchsets matching the current project's identifier come first.
    patchsets = all.sort((a, b) => {
      const am = a.projectIdentifier === currentIdentifier ? 0 : 1;
      const bm = b.projectIdentifier === currentIdentifier ? 0 : 1;
      return am - bm || b.createdAt - a.createdAt;
    });
  }

  $effect(() => {
    void currentIdentifier;
    void loadList();
  });

  async function remove(id: string) {
    await deletePatchset(id);
    await loadList();
  }

  async function confirmApply(resolved: ResolvedChange[]) {
    if (!onApply) return;
    await onApply(resolved);
    reviewing = null;
    applyMsg = $t('Applied {n} change(s).', { n: resolved.length });
  }

  function formatDate(ms: number): string {
    try {
      return new Date(ms).toLocaleString();
    } catch {
      return '';
    }
  }

  // The panel owns the toggle's visual state once mounted; seeded from the prop.
  let on = $state(untrack(() => initialEnabled));
  let busy = $state(false);
  let confirmingOff = $state(false);
  let error = $state<string | null>(null);
  let generating = $state(false);
  let generateMsg = $state<string | null>(null);

  async function generate() {
    if (!workspace || generating) return;
    generating = true;
    generateMsg = null;
    try {
      const patchset = await generatePatchset(workspace);
      if (patchset.changes.length === 0) {
        generateMsg = $t('No changes to capture yet.');
        return;
      }
      await savePatchset(patchset);
      generateMsg = $t('Captured {n} changed file(s).', { n: patchset.changes.length });
      await loadList();
    } catch (e) {
      generateMsg = e instanceof Error ? e.message : $t('Failed to generate patchset');
    } finally {
      generating = false;
    }
  }

  async function persist(next: boolean) {
    if (!workspaceId) return;
    busy = true;
    error = null;
    const previous = on;
    on = next; // optimistic
    try {
      const current = await settingsService.loadEPUBSettings(workspaceId);
      await settingsService.saveEPUBSettings(workspaceId, { ...current, track_changes: next });
      setReviewMode(workspaceId, next);
      // Turning off discards the base snapshot.
      if (!next) await deleteBase(FileStorageAPI.getInstance(), workspaceId);
      onChanged?.();
    } catch (e) {
      on = previous; // revert
      error = e instanceof Error ? e.message : $t('Failed to update settings');
    } finally {
      busy = false;
      confirmingOff = false;
    }
  }

  function handleToggle(event: Event) {
    const checkbox = event.currentTarget as HTMLInputElement;
    if (!checkbox.checked) {
      // Turning off loses the base — confirm first; keep the box checked meanwhile.
      checkbox.checked = true;
      confirmingOff = true;
      return;
    }
    void persist(true);
  }
</script>

<SettingsSection
  title={$t('Track changes')}
  summary={on ? $t('On — review mode') : $t('Off')}
  name="project-settings"
  persistKey="settings-project-track-changes"
>
  <div class="setting-group">
    <label class="setting-label">
      <input type="checkbox" checked={on} onchange={handleToggle} disabled={busy} />
      <span class="setting-text">{$t('Lock package structure and track content changes')}</span>
    </label>
    <p class="setting-description">
      {$t(
        'While locked, you can edit existing chapters, styles and scripts; structural changes are disabled.'
      )}
    </p>

    {#if confirmingOff}
      <div class="confirm-off" role="alert">
        <p>{$t('Turning off track changes deletes the saved base version. Continue?')}</p>
        <div class="confirm-actions">
          <button
            type="button"
            class="btn btn-secondary"
            onclick={() => (confirmingOff = false)}
            disabled={busy}
          >
            {$t('Cancel')}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onclick={() => persist(false)}
            disabled={busy}
          >
            {$t('Turn off and discard base')}
          </button>
        </div>
      </div>
    {/if}

    {#if error}
      <p class="track-error" role="alert">{error}</p>
    {/if}
  </div>

  {#if on}
    <div class="setting-group">
      <span class="setting-label-text">{$t('Generate patchset')}</span>
      <p class="setting-description">
        {$t('Capture your changes as a patchset to review and apply to the matching project.')}
      </p>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={generate}
        disabled={generating || !workspace}
      >
        {generating ? $t('Generating…') : $t('Generate patchset')}
      </button>
      {#if generateMsg}
        <p class="track-status" role="status">{generateMsg}</p>
      {/if}
    </div>
  {/if}

  <div class="setting-group">
    <span class="setting-label-text">{$t('Patchsets')}</span>
    <p class="setting-description">
      {$t('Captured change sets. Those matching this project are listed first.')}
    </p>
    {#if patchsets.length === 0}
      <p class="track-status">{$t('No patchsets yet.')}</p>
    {:else}
      <ul class="patchset-list">
        {#each patchsets as patchset (patchset.id)}
          <li class="patchset-row">
            <div class="patchset-info">
              <span class="patchset-title">{patchset.projectTitle || $t('Untitled')}</span>
              <span class="patchset-meta">
                {$t('{n} change(s)', { n: patchset.changes.length })} · {formatDate(
                  patchset.createdAt
                )}
                {#if patchset.projectIdentifier === currentIdentifier}
                  · <span class="patchset-match">{$t('matches this project')}</span>
                {/if}
              </span>
            </div>
            <div class="patchset-actions">
              <button
                type="button"
                class="btn btn-secondary"
                onclick={() => (reviewing = patchset)}
                disabled={!onApply}
              >
                {$t('Review & apply')}
              </button>
              <button type="button" class="btn btn-danger" onclick={() => remove(patchset.id)}>
                {$t('Delete')}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
    {#if applyMsg}
      <p class="track-status" role="status">{applyMsg}</p>
    {/if}
  </div>
</SettingsSection>

{#if reviewing && workspaceId}
  <PatchsetReviewDialog
    {workspaceId}
    changes={reviewing.changes}
    onConfirm={confirmApply}
    onCancel={() => (reviewing = null)}
  />
{/if}

<style>
  .confirm-off {
    margin-block-start: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-secondary);
  }

  .confirm-off p {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .track-error {
    margin: var(--space-2) 0 0;
    color: var(--color-error-text, var(--color-text-primary));
    font-size: var(--text-sm);
  }

  .track-status {
    margin: var(--space-2) 0 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .patchset-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .patchset-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .patchset-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-inline-size: 0;
  }

  .patchset-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }

  .patchset-meta {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .patchset-match {
    color: var(--color-interactive-primary, var(--color-text-primary));
  }

  .patchset-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }
</style>
