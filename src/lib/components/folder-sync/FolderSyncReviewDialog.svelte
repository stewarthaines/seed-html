<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../../i18n';
  import { X } from 'phosphor-svelte';
  import InlineTextDiff from '../import/InlineTextDiff.svelte';
  import { folderSyncRowKey } from '../../folder-sync/scan.js';
  import type { FolderSyncPlan, FolderSyncRow, SkipReason } from '../../folder-sync/scan.js';

  /** Per-row decision: apply the row's action, keep both (updates only), or skip. */
  export type FolderSyncResolution = 'apply' | 'keep-both' | 'skip';
  export interface FolderSyncDecision {
    key: string;
    resolution: FolderSyncResolution;
  }

  let {
    plan,
    folderName,
    lastSyncedAt = undefined,
    onConfirm,
    onCancel,
    onChangeFolder,
    onUnlink,
  }: {
    plan: FolderSyncPlan;
    folderName: string;
    /** ISO timestamp of the previous sync, when known. */
    lastSyncedAt?: string;
    /** Commit the chosen resolutions. The parent closes the dialog on success. */
    onConfirm: (decisions: FolderSyncDecision[]) => Promise<void> | void;
    onCancel: () => void;
    /** Pick a different folder; the parent rescans and replaces the plan. */
    onChangeFolder: () => Promise<void> | void;
    /** Drop the link (chapters untouched); the parent closes the dialog. */
    onUnlink: () => Promise<void> | void;
  } = $props();

  const actionable = $derived(
    plan.rows.filter(row => row.kind !== 'skipped') as Exclude<FolderSyncRow, { kind: 'skipped' }>[]
  );
  const skipped = $derived(
    plan.rows.filter(row => row.kind === 'skipped') as Extract<FolderSyncRow, { kind: 'skipped' }>[]
  );

  // Per-row decisions, seeded once: removes default to skip (sync never
  // deletes silently), everything else to apply.
  let decisions = $state<Record<string, FolderSyncResolution>>(
    untrack(() =>
      Object.fromEntries(
        plan.rows
          .filter(row => row.kind !== 'skipped')
          .map(row => [folderSyncRowKey(row), row.kind === 'remove' ? 'skip' : 'apply'])
      )
    )
  );
  let selectedKey = $state(
    untrack(() => {
      const first = plan.rows.find(row => row.kind !== 'skipped');
      return first ? folderSyncRowKey(first) : '';
    })
  );
  let saving = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const selected = $derived(actionable.find(row => folderSyncRowKey(row) === selectedKey));

  function setResolution(key: string, resolution: FolderSyncResolution) {
    decisions = { ...decisions, [key]: resolution };
  }

  const badgeLabel = (row: FolderSyncRow): string => {
    const resolution = decisions[folderSyncRowKey(row)];
    if (resolution === 'skip') return $t('Skip');
    if (resolution === 'keep-both') return $t('Keep both');
    if (row.kind === 'add') return $t('Add');
    if (row.kind === 'remove') return $t('Remove');
    return $t('Overwrite');
  };

  const skipReasonLabel = (reason: SkipReason): string => {
    if (reason === 'extension') return $t('not a text file');
    if (reason === 'hidden') return $t('hidden file');
    if (reason === 'sidecar') return $t('macOS sidecar file');
    return $t('folder');
  };

  async function confirm() {
    if (saving) return;
    saving = true;
    error = null;
    try {
      await onConfirm(
        actionable.map(row => {
          const key = folderSyncRowKey(row);
          return { key, resolution: decisions[key] };
        })
      );
      // On success the parent applies the sync and unmounts this dialog.
    } catch (e) {
      error = e instanceof Error ? e.message : $t('Failed to sync the folder');
      saving = false;
    }
  }

  async function run(action: () => Promise<void> | void) {
    if (busy || saving) return;
    busy = true;
    error = null;
    try {
      await action();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function formatSynced(iso: string): string {
    const time = new Date(iso);
    return isNaN(time.getTime()) ? iso : time.toLocaleString();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onCancel();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="sync-backdrop" onclick={onCancel} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="sync-dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="folder-sync-title"
    onclick={event => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <header class="sync-header">
      <div>
        <h2 id="folder-sync-title">{$t('Sync folder')}</h2>
        <p class="sync-subtitle">
          {$t('Linked folder: {name}', { name: folderName })}
          {#if lastSyncedAt}
            · {$t('Last synced: {time}', { time: formatSynced(lastSyncedAt) })}
          {/if}
        </p>
      </div>
      <button type="button" class="btn btn-icon" onclick={onCancel} aria-label={$t('Close')}
        ><X size={16} aria-hidden="true" /></button
      >
    </header>

    {#if actionable.length === 0}
      <div class="sync-empty">
        <p>{$t('Everything up to date.')}</p>
        {#if plan.unchangedCount > 0}
          <p class="sync-fineprint">
            {$t('{n} file(s) unchanged', { n: plan.unchangedCount })}
          </p>
        {/if}
      </div>
    {:else}
      <div class="sync-body">
        <!-- Left: change list -->
        <ul class="sync-list" aria-label={$t('Changes')}>
          {#each actionable as row (folderSyncRowKey(row))}
            <li>
              <button
                type="button"
                class="sync-list-item"
                class:selected={folderSyncRowKey(row) === selectedKey}
                onclick={() => (selectedKey = folderSyncRowKey(row))}
              >
                <span class="sync-list-name">{row.name}</span>
                <span
                  class="sync-list-badge"
                  class:skip={decisions[folderSyncRowKey(row)] === 'skip'}
                >
                  {badgeLabel(row)}
                </span>
              </button>
            </li>
          {/each}
        </ul>

        <!-- Right: preview + per-row choice -->
        <div class="sync-preview">
          {#if selected}
            {@const key = folderSyncRowKey(selected)}
            <fieldset class="sync-choice">
              <legend class="sync-choice-legend">
                {#if selected.kind === 'update'}
                  {$t('Conflicts with {label}', { label: selected.targetId })}
                {:else if selected.kind === 'add'}
                  {$t('New chapter')}
                {:else}
                  {$t('No matching file in the folder')}
                {/if}
              </legend>
              {#if selected.kind === 'update'}
                <label class="sync-radio">
                  <input
                    type="radio"
                    name="resolution-{key}"
                    checked={decisions[key] === 'apply'}
                    onchange={() => setResolution(key, 'apply')}
                    disabled={saving}
                  />
                  <span>{$t('Overwrite the chapter')}</span>
                </label>
                <label class="sync-radio">
                  <input
                    type="radio"
                    name="resolution-{key}"
                    checked={decisions[key] === 'keep-both'}
                    onchange={() => setResolution(key, 'keep-both')}
                    disabled={saving}
                  />
                  <span>{$t('Keep both (add as a new chapter)')}</span>
                </label>
              {:else if selected.kind === 'add'}
                <label class="sync-radio">
                  <input
                    type="radio"
                    name="resolution-{key}"
                    checked={decisions[key] === 'apply'}
                    onchange={() => setResolution(key, 'apply')}
                    disabled={saving}
                  />
                  <span>{$t('Add as a new chapter')}</span>
                </label>
                {#if selected.collision}
                  <p class="sync-fineprint">
                    {$t('The chapter id collides with {label}; it will be added under a new id.', {
                      label: selected.collision,
                    })}
                  </p>
                {/if}
              {:else}
                <label class="sync-radio">
                  <input
                    type="radio"
                    name="resolution-{key}"
                    checked={decisions[key] === 'apply'}
                    onchange={() => setResolution(key, 'apply')}
                    disabled={saving}
                  />
                  <span>{$t('Remove the chapter')}</span>
                </label>
              {/if}
              <label class="sync-radio">
                <input
                  type="radio"
                  name="resolution-{key}"
                  checked={decisions[key] === 'skip'}
                  onchange={() => setResolution(key, 'skip')}
                  disabled={saving}
                />
                <span
                  >{selected.kind === 'remove'
                    ? $t('Keep the chapter')
                    : $t('Ignore changes')}</span
                >
              </label>
            </fieldset>

            <div class="sync-preview-body">
              {#if selected.kind === 'update'}
                <InlineTextDiff current={selected.current} incoming={selected.incoming} />
              {:else if selected.kind === 'add'}
                <InlineTextDiff current="" incoming={selected.incoming} />
              {:else}
                <InlineTextDiff current={selected.current ?? ''} incoming="" />
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if skipped.length > 0}
      <details class="sync-skipped">
        <summary>{$t('Skipped files')} ({skipped.length})</summary>
        <ul>
          {#each skipped as entry (entry.name)}
            <li><code>{entry.name}</code> — {skipReasonLabel(entry.reason)}</li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if error}
      <p class="sync-error" role="alert">{error}</p>
    {/if}

    <footer class="sync-footer">
      <div class="sync-footer-secondary">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => run(onChangeFolder)}
          disabled={saving || busy}
        >
          {$t('Change folder…')}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => run(onUnlink)}
          disabled={saving || busy}
        >
          {$t('Unlink folder')}
        </button>
      </div>
      <div class="sync-footer-primary">
        {#if actionable.length === 0}
          <button type="button" class="btn btn-primary" onclick={onCancel}>
            {$t('Close')}
          </button>
        {:else}
          <button type="button" class="btn btn-secondary" onclick={onCancel} disabled={saving}>
            {$t('Cancel')}
          </button>
          <button type="button" class="btn btn-primary" onclick={confirm} disabled={saving || busy}>
            {saving ? $t('Applying…') : $t('Apply')}
          </button>
        {/if}
      </div>
    </footer>
  </div>
</div>

<style>
  .sync-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background-color: rgb(0 0 0 / 0.5);
  }

  .sync-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    inline-size: min(56rem, 100%);
    max-block-size: min(40rem, 90vh);
    padding: var(--space-5);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background-color: var(--color-surface-primary);
    color: var(--color-text-primary);
    box-shadow: var(--shadow-lg);
  }

  .sync-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .sync-header h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .sync-subtitle {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .sync-empty {
    padding: var(--space-5) 0;
    text-align: center;
  }

  .sync-empty p {
    margin: 0;
  }

  .sync-fineprint {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .sync-body {
    display: flex;
    gap: var(--space-4);
    flex: 1;
    min-block-size: 12rem;
  }

  .sync-list {
    list-style: none;
    margin: 0;
    padding: 0;
    inline-size: 16rem;
    flex-shrink: 0;
    overflow: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .sync-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    inline-size: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
    font-size: var(--text-sm);
    border-block-end: 1px solid var(--color-border-subtle, var(--color-border-default));
  }

  .sync-list-item.selected {
    background-color: var(--color-bg-accent, var(--color-surface-secondary));
  }

  .sync-list-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sync-list-badge {
    flex-shrink: 0;
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    background-color: var(--color-surface-secondary);
  }

  .sync-list-badge.skip {
    opacity: 0.7;
  }

  .sync-preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
    min-inline-size: 0;
  }

  .sync-choice {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .sync-choice-legend {
    padding: 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-secondary);
  }

  .sync-radio {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .sync-preview-body {
    flex: 1;
    min-block-size: 0;
    overflow: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }

  .sync-skipped {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .sync-skipped summary {
    cursor: pointer;
  }

  .sync-skipped ul {
    margin: var(--space-2) 0 0;
    padding-inline-start: var(--space-5);
  }

  .sync-error {
    margin: 0;
    color: var(--color-error-text, var(--color-text-primary));
    font-size: var(--text-sm);
  }

  .sync-footer {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .sync-footer-secondary,
  .sync-footer-primary {
    display: flex;
    gap: var(--space-2);
  }
</style>
