<script lang="ts">
  // Review dialog for manifest file moves (plan → review → commit; the
  // FolderSyncReviewDialog skeleton, simplified: a move plan is confirmed or
  // cancelled whole — blocked rows are shown but carry no per-row choices).
  import { t } from '../../i18n';
  import { X } from 'phosphor-svelte';
  import type { MovePlan } from '../../manifest/move-plan.js';

  let {
    plan,
    onConfirm,
    onCancel,
  }: {
    plan: MovePlan;
    onConfirm: () => Promise<void> | void;
    onCancel: () => void;
  } = $props();

  let saving = $state(false);
  let error = $state<string | null>(null);

  const actionable = $derived(plan.rows.filter(row => !row.blocked));
  const blocked = $derived(plan.rows.filter(row => row.blocked));

  const refCount = $derived(
    plan.fileChanges.reduce(
      (total, change) => total + change.rewrites.reduce((n, r) => n + r.count, 0),
      0
    )
  );
  const sourceFileCount = $derived(plan.fileChanges.filter(c => c.kind === 'source').length);
  const cssFileCount = $derived(plan.fileChanges.filter(c => c.kind === 'css').length);

  async function confirm() {
    if (saving || actionable.length === 0) return;
    saving = true;
    error = null;
    try {
      await onConfirm();
      // On success the parent applies the move and unmounts this dialog.
    } catch (e) {
      error = e instanceof Error ? e.message : $t('Failed to move files');
      saving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onCancel();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="move-backdrop" onclick={onCancel} role="presentation">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="move-dialog"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="move-review-title"
    onclick={event => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <header class="move-header">
      <div>
        <h2 id="move-review-title">{$t('Move files')}</h2>
        <p class="move-subtitle">
          {$t('{count} files', { count: actionable.length })}
          {#if refCount > 0}
            · {$t('{count} references updated', { count: refCount })}
          {/if}
        </p>
      </div>
      <button type="button" class="btn btn-icon" onclick={onCancel} aria-label={$t('Close')}
        ><X size={16} aria-hidden="true" /></button
      >
    </header>

    <div class="move-body">
      <ul class="move-list" aria-label={$t('Moves')}>
        {#each actionable as row (row.id)}
          <li class="move-row">
            <span class="move-old" dir="ltr">{row.oldHref}</span>
            <span class="move-arrow" aria-hidden="true">→</span>
            <span class="move-new" dir="ltr">{row.newHref}</span>
          </li>
        {/each}
      </ul>

      {#if plan.fileChanges.length > 0}
        <details class="move-refs">
          <summary>
            {#if cssFileCount > 0 && sourceFileCount > 0}
              {$t('References in {sources} text sources and {sheets} stylesheets', {
                sources: sourceFileCount,
                sheets: cssFileCount,
              })}
            {:else if cssFileCount > 0}
              {$t('References in {sheets} stylesheets', { sheets: cssFileCount })}
            {:else}
              {$t('References in {sources} text sources', { sources: sourceFileCount })}
            {/if}
          </summary>
          <ul class="move-ref-list">
            {#each plan.fileChanges as change (change.path)}
              <li>
                <span dir="ltr">{change.path}</span>
                <span class="move-ref-count"
                  >{change.rewrites.reduce((n, r) => n + r.count, 0)}</span
                >
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      {#if blocked.length > 0}
        <details class="move-blocked" open>
          <summary>{$t('{count} files cannot move', { count: blocked.length })}</summary>
          <ul class="move-ref-list">
            {#each blocked as row (row.id)}
              <li>
                <span dir="ltr">{row.oldHref}</span>
                <span class="move-blocked-reason">{row.blocked}</span>
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      {#if error}
        <p class="move-error" role="alert">{error}</p>
      {/if}
    </div>

    <footer class="move-footer">
      <button type="button" class="btn" onclick={onCancel} disabled={saving}>
        {$t('Cancel')}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        onclick={confirm}
        disabled={saving || actionable.length === 0}
      >
        {$t('Move')}
      </button>
    </footer>
  </div>
</div>

<style>
  .move-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 40%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal, 1000);
  }

  .move-dialog {
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    inline-size: min(560px, calc(100vw - 2 * var(--space-4)));
    max-block-size: min(80vh, 640px);
    display: flex;
    flex-direction: column;
  }

  .move-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-4) var(--space-2);
  }
  .move-header h2 {
    margin: 0;
    font-size: var(--text-lg);
  }
  .move-subtitle {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .move-body {
    flex: 1;
    min-block-size: 0;
    overflow-y: auto;
    padding: var(--space-2) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .move-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }
  .move-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .move-old {
    color: var(--color-text-tertiary);
    text-decoration: line-through;
  }
  .move-new {
    font-weight: var(--font-medium);
  }
  .move-arrow {
    color: var(--color-text-tertiary);
  }

  .move-refs summary,
  .move-blocked summary {
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .move-ref-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    font-size: var(--text-sm);
  }
  .move-ref-list li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    padding-block: 2px;
  }
  .move-ref-count {
    color: var(--color-text-tertiary);
  }
  .move-blocked-reason {
    color: var(--color-error-600, var(--color-text-secondary));
  }

  .move-error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-error-600, var(--color-text-primary));
  }

  .move-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-4);
  }
</style>
