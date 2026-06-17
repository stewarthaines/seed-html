<!--
  Chapter Validation Panel

  Read-only panel that surfaces the latest epubcheck report (dropped into localStorage
  by the publish plugin) inside the spine item's preview pane. Opened from a toolbar
  "Validation" button (the host owns the report + open state, mirroring the a11y panel)
  and closeable. Shows the current chapter's issues, lets the author tick them off as
  they fix (persisted, so progress survives chapter hops and reloads), and offers
  one-click jumps to the other chapters that still have issues — so the fix-many-errors
  loop no longer round-trips through the Publish view.
-->

<script lang="ts">
  import { t } from '$lib/i18n';
  import { SvelteSet } from 'svelte/reactivity';
  import {
    readAddressedIndices,
    writeAddressedIndices,
    chapterIdOf,
    chaptersWithIssues,
    type ValidationReport,
    type ValidationMessage,
  } from '$lib/plugins/validation-report';
  import { X } from 'phosphor-svelte';

  let {
    report,
    chapterId = null,
    onClose,
  }: {
    report: ValidationReport;
    chapterId?: string | null;
    onClose?: () => void;
  } = $props();

  // Author's self-tracked progress, keyed by the message's index in the full report.
  // Persisted under the report's timestamp, so a re-validation starts a fresh list.
  const checked = new SvelteSet<number>();

  // Seed ticks from persistence on mount, and reseed if the report itself changes
  // (a re-validation) while we're mounted.
  let seededTimestamp = $state<number | null>(null);
  $effect(() => {
    if (report.timestamp === seededTimestamp) return;
    seededTimestamp = report.timestamp;
    checked.clear();
    for (const i of readAddressedIndices(report.timestamp)) checked.add(i);
  });

  // Messages for the current chapter, paired with their index in the full report so
  // each row has a stable tick key.
  const thisChapter = $derived(
    report.messages
      .map((msg, index) => ({ msg, index }))
      .filter(({ msg }) => msg.location != null && chapterIdOf(msg.location.path) === chapterId)
  );
  const others = $derived(chaptersWithIssues(report).filter(c => c.chapterId !== chapterId));
  const addressed = $derived(thisChapter.filter(({ index }) => checked.has(index)).length);

  function toggle(index: number): void {
    if (checked.has(index)) checked.delete(index);
    else checked.add(index);
    writeAddressedIndices(report.timestamp, [...checked]);
  }

  function jumpTo(itemId: string): void {
    window.dispatchEvent(new CustomEvent('select-spine-item', { detail: { itemId } }));
  }

  function formatLocation(loc: NonNullable<ValidationMessage['location']>): string {
    if (loc.line == null) return '';
    return loc.column == null ? `line ${loc.line}` : `line ${loc.line}, col ${loc.column}`;
  }

  function validatedAgo(timestamp: number): string {
    const mins = Math.round((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }
</script>

<div class="vpanel" role="region" aria-label={$t('Validation issues for this chapter')}>
  <div class="vpanel-header">
    <strong>{$t('Validation')}</strong>
    <span class="vpanel-meta-inline">
      {report.filename}
      {$t('· validated {ago}', { ago: validatedAgo(report.timestamp) })}
    </span>
    <button
      type="button"
      class="vpanel-close"
      onclick={() => onClose?.()}
      aria-label={$t('Close validation panel')}
      title={$t('Close')}
    >
      <X size={16} aria-hidden="true" />
    </button>
  </div>

  <div class="vpanel-body">
    <div class="vpanel-section-head">
      <strong>{$t('This chapter')}</strong>
      {#if thisChapter.length > 0}
        <span class="vpanel-progress"
          >{$t('{done}/{total} addressed', { done: addressed, total: thisChapter.length })}</span
        >
      {/if}
    </div>

    {#if thisChapter.length === 0}
      <p class="vpanel-empty">{$t('No validation issues in this chapter.')}</p>
    {:else}
      <ul class="vpanel-list">
        {#each thisChapter as { msg, index } (index)}
          {@const done = checked.has(index)}
          <li class="vpanel-item" class:done>
            <!-- Whole row is the label, so a click anywhere toggles the tick. -->
            <label class="vpanel-row">
              <input type="checkbox" checked={done} onchange={() => toggle(index)} />
              <span class="vpanel-level" data-level={msg.level}>{msg.level}</span>
              {#if msg.id}<span class="vpanel-id">{msg.id}</span>{/if}
              <span class="vpanel-text">{msg.message}</span>
              {#if msg.location}
                <span class="vpanel-loc">{formatLocation(msg.location)}</span>
              {/if}
              {#if msg.suggestion}
                <span class="vpanel-suggestion">{msg.suggestion}</span>
              {/if}
            </label>
          </li>
        {/each}
      </ul>
    {/if}

    {#if others.length > 0}
      <div class="vpanel-section-head">
        <strong>{$t('Other chapters with issues')}</strong>
      </div>
      <ul class="vpanel-others">
        {#each others as c (c.chapterId)}
          <li>
            <button type="button" class="vpanel-jump" onclick={() => jumpTo(c.chapterId)}>
              <span class="vpanel-jump-id">{c.chapterId}</span>
              <span class="vpanel-jump-counts">
                {#if c.errorCount > 0}<span class="vpanel-c err">{c.errorCount}</span>{/if}
                {#if c.warningCount > 0}<span class="vpanel-c warn">{c.warningCount}</span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  /* A panel band in the preview pane, opened from the toolbar like the a11y panel. */
  .vpanel {
    max-height: 40vh;
    overflow-y: auto;
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-secondary);
    font-size: var(--text-sm);
  }

  .vpanel-header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-default);
  }

  .vpanel-close {
    flex-shrink: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    padding: 0 var(--space-1);
  }

  .vpanel-meta-inline {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .vpanel-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3) var(--space-1);
    color: var(--color-text-primary);
  }

  .vpanel-progress {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .vpanel-empty {
    margin: 0;
    padding: 0 var(--space-3) var(--space-2);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .vpanel-list,
  .vpanel-others {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .vpanel-item {
    border-bottom: 1px solid var(--color-border-default);
  }

  /* One line per issue, wrapping only when it must. The whole row is the label, so
     a click anywhere toggles the tick — no need to hit the checkbox precisely. */
  .vpanel-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
  }

  .vpanel-row:hover {
    background: var(--color-bg-tertiary);
  }

  .vpanel-row input {
    align-self: center;
    flex-shrink: 0;
  }

  .vpanel-item.done .vpanel-text {
    text-decoration: line-through;
  }

  .vpanel-item.done .vpanel-row {
    opacity: 0.55;
  }

  .vpanel-level {
    text-transform: uppercase;
    font-size: 10px;
    font-weight: 700;
    color: var(--color-text-secondary);
  }
  .vpanel-level[data-level='error'] {
    color: var(--color-error-text, #c62828);
  }
  .vpanel-level[data-level='warning'] {
    color: var(--color-warning-text, #f57c00);
  }

  .vpanel-id {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-secondary);
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 4px;
    border-radius: var(--radius-xs);
  }

  .vpanel-loc {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .vpanel-text {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--color-text-primary);
  }

  .vpanel-suggestion {
    flex-basis: 100%;
    color: var(--color-success-text, #2e7d32);
    font-size: var(--text-xs);
  }

  .vpanel-jump {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1) var(--space-3);
    border: none;
    background: none;
    color: var(--color-primary, #0074d9);
    cursor: pointer;
    font-size: var(--text-sm);
    text-align: left;
  }

  /* Solid azure hover, unified with the buttons and the other list rows. The
     err/warn count badges keep their own colour (distinct on azure). */
  .vpanel-jump:hover {
    background: var(--color-hover-accent);
    color: var(--color-on-accent);
  }

  .vpanel-jump-id {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vpanel-jump-counts {
    flex-shrink: 0;
    display: inline-flex;
    gap: var(--space-1);
  }

  .vpanel-c {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    text-align: center;
  }
  .vpanel-c.err {
    background: var(--color-error-text, #c62828);
  }
  .vpanel-c.warn {
    background: var(--color-warning-text, #f57c00);
  }
</style>
