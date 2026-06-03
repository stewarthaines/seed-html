<!--
  Chapter Validation Panel

  Read-only reference panel that surfaces the latest epubcheck report (dropped into
  localStorage by the publish plugin) inside the spine editor. Shows the current
  chapter's issues, lets the author tick them off as they fix, and offers one-click
  jumps to the other chapters that still have issues — so the fix-many-errors loop
  no longer round-trips through the Publish view.
-->

<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import {
    readValidationReport,
    chapterIdOf,
    chaptersWithIssues,
    VALIDATION_REPORT_STORAGE_KEY,
    type ValidationReport,
    type ValidationMessage,
  } from '$lib/plugins/validation-report';

  let { chapterId = null }: { chapterId?: string | null } = $props();

  let report = $state<ValidationReport | null>(readValidationReport());
  let open = $state(true);
  // Author's self-tracked progress. Keyed by `${timestamp}:${index}` so a
  // re-validation (new timestamp) naturally invalidates every tick.
  const checked = new SvelteSet<string>();

  // Re-read when the plugin re-validates while this view is still mounted, and drop
  // any stale ticks (their keys can't match a fresh report's timestamp anyway).
  $effect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== VALIDATION_REPORT_STORAGE_KEY) return;
      report = readValidationReport();
      checked.clear();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  });

  // Messages for the current chapter, paired with their index in the full report so
  // each row gets a stable tick key.
  const thisChapter = $derived(
    (report?.messages ?? [])
      .map((msg, index) => ({ msg, index }))
      .filter(({ msg }) => msg.location != null && chapterIdOf(msg.location.path) === chapterId)
  );
  const others = $derived(chaptersWithIssues(report).filter(c => c.chapterId !== chapterId));
  const keyOf = (index: number) => `${report?.timestamp ?? 0}:${index}`;
  const addressed = $derived(thisChapter.filter(({ index }) => checked.has(keyOf(index))).length);

  function toggle(index: number): void {
    const key = keyOf(index);
    if (checked.has(key)) checked.delete(key);
    else checked.add(key);
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

{#if report}
  <div class="vpanel" class:collapsed={!open}>
    <button
      type="button"
      class="vpanel-toggle"
      onclick={() => (open = !open)}
      aria-expanded={open}
      title="Validation report"
    >
      <span class="vpanel-chip" class:has-issues={thisChapter.length > 0}>
        {thisChapter.length === 0 ? '✓' : thisChapter.length}
      </span>
      <span class="vpanel-toggle-label">Validation</span>
      <span class="vpanel-caret">{open ? '▾' : '▸'}</span>
    </button>

    {#if open}
      <div class="vpanel-body" role="region" aria-label="Validation issues for this chapter">
        <div class="vpanel-meta">
          <span class="vpanel-file" title={report.filename}>{report.filename}</span>
          <span class="vpanel-time">validated {validatedAgo(report.timestamp)}</span>
        </div>

        <div class="vpanel-section-head">
          <strong>This chapter</strong>
          {#if thisChapter.length > 0}
            <span class="vpanel-progress">{addressed}/{thisChapter.length} addressed</span>
          {/if}
        </div>

        {#if thisChapter.length === 0}
          <p class="vpanel-empty">No validation issues in this chapter.</p>
        {:else}
          <ul class="vpanel-list">
            {#each thisChapter as { msg, index } (index)}
              {@const done = checked.has(keyOf(index))}
              <li class="vpanel-item" class:done>
                <label class="vpanel-check">
                  <input type="checkbox" checked={done} onchange={() => toggle(index)} />
                </label>
                <div class="vpanel-detail">
                  <div class="vpanel-detail-head">
                    <span class="vpanel-level" data-level={msg.level}>{msg.level}</span>
                    {#if msg.id}<span class="vpanel-id">{msg.id}</span>{/if}
                    {#if msg.location}
                      <span class="vpanel-loc">{formatLocation(msg.location)}</span>
                    {/if}
                  </div>
                  <span class="vpanel-text">{msg.message}</span>
                  {#if msg.suggestion}<span class="vpanel-suggestion">💡 {msg.suggestion}</span
                    >{/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}

        {#if others.length > 0}
          <div class="vpanel-section-head">
            <strong>Other chapters with issues</strong>
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
    {/if}
  </div>
{/if}

<style>
  .vpanel {
    position: absolute;
    right: var(--space-3);
    bottom: var(--space-3);
    z-index: 20;
    width: 320px;
    max-width: calc(100% - var(--space-6));
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
    font-size: var(--text-sm);
    overflow: hidden;
  }

  .vpanel.collapsed {
    width: auto;
  }

  .vpanel-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: none;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--text-sm);
  }

  .vpanel-chip {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--color-success-text, #2e7d32);
    color: #fff;
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .vpanel-chip.has-issues {
    background: var(--color-error-text, #c62828);
  }

  .vpanel-toggle-label {
    font-weight: 600;
  }

  .vpanel-caret {
    margin-left: auto;
    color: var(--color-text-secondary);
  }

  .vpanel-body {
    max-height: 50vh;
    overflow-y: auto;
    border-top: 1px solid var(--color-border-default);
  }

  .vpanel-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
    border-bottom: 1px solid var(--color-border-default);
  }

  .vpanel-file {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
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
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
  }

  .vpanel-item.done .vpanel-detail {
    opacity: 0.5;
    text-decoration: line-through;
  }

  .vpanel-check {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .vpanel-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .vpanel-detail-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
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
    color: var(--color-text-primary);
  }

  .vpanel-suggestion {
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

  .vpanel-jump:hover {
    background: var(--color-bg-tertiary);
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
