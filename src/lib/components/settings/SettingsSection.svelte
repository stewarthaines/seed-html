<!--
  SettingsSection — a settings group rendered as a native <details> disclosure whose
  header shows a compact summary of the section's current values. Sections sharing a
  `name` form an exclusive accordion (one open at a time), enforced in JS by the
  toggle handler.

  We deliberately avoid the native <details name> grouping: browsers track a group's
  open member per-document keyed by name, and that state goes stale when the pane
  unmounts and remounts during in-app navigation (the section then fails to restore
  its remembered open/closed state — yet a full reload, starting a fresh document,
  works). Grouping via a data-* attribute the JS reads instead is remount-safe and
  behaves identically across browsers.
-->
<script module lang="ts">
  // Open/closed state for every section, remembered across reloads under one key
  // (keyed by each section's persist key). try/catch so private-mode/disabled
  // storage is non-fatal.
  const SECTION_STATE_KEY = 'editme_section_open';

  function readSectionState(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(SECTION_STATE_KEY) || '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  }

  function persistSectionOpen(key: string, open: boolean): void {
    try {
      const state = readSectionState();
      state[key] = open;
      localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore unavailable storage.
    }
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';

  interface Props {
    title: string;
    /** Compact summary of the section's current values, shown when collapsed. */
    summary?: string;
    /** Accordion group name; sections with the same name open one-at-a-time. */
    name: string;
    /** Start expanded (the first section of a pane), unless a remembered state
        overrides it. One-time initial, not reactive. */
    open?: boolean;
    /** Stable key under which this section's open/closed state is remembered.
        Defaults to `name`; pass an explicit unique key where sections share a
        `name` (accordion groups, e.g. the settings panes). */
    persistKey?: string;
    children: Snippet;
  }

  const { title, summary, name, open = false, persistKey, children }: Props = $props();

  // These props are constant for a section's lifetime; untrack expresses the
  // intentional one-time capture (the open state is owned by the DOM thereafter).
  const storeKey = untrack(() => persistKey ?? name);
  // One-time initial open: the remembered state if present, else the `open` prop.
  const initialOpen = untrack(() => readSectionState()[storeKey] ?? open);

  // Remember the new state, then enforce single-open exclusivity across the group
  // (sections sharing a `name`, matched via the remount-safe data-accordion
  // attribute). Closing a sibling fires its own toggle (open=false), which persists
  // it closed and then returns — no recursion.
  function handleToggle(event: Event): void {
    const el = event.currentTarget as HTMLDetailsElement;
    persistSectionOpen(storeKey, el.open);
    if (!el.open) return;
    for (const other of document.querySelectorAll<HTMLDetailsElement>(
      `details[data-accordion="${CSS.escape(name)}"]`
    )) {
      if (other !== el && other.open) other.open = false;
    }
  }
</script>

<details class="settings-section" data-accordion={name} open={initialOpen} ontoggle={handleToggle}>
  <summary class="settings-section__summary">
    <h3 class="settings-section__title">{title}</h3>
    {#if summary}
      <span class="settings-section__hint">{summary}</span>
    {/if}
    <span class="settings-section__caret" aria-hidden="true"></span>
  </summary>
  <div class="settings-section__body">
    {@render children()}
  </div>
</details>

<style>
  .settings-section {
    border: 1px solid var(--color-border-default);
    border-radius: 0.5rem;
    background: var(--color-bg-tertiary);
  }

  .settings-section__summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    cursor: pointer;
    list-style: none;
    border-radius: 0.5rem;
  }
  /* Hide the default disclosure triangle (we draw our own caret). */
  .settings-section__summary::-webkit-details-marker {
    display: none;
  }

  .settings-section__title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  .settings-section__hint {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }
  /* Open: the controls below show the values, so drop the redundant header echo. */
  .settings-section[open] .settings-section__hint {
    display: none;
  }

  .settings-section__caret {
    margin-left: auto;
    flex-shrink: 0;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-right: 2px solid var(--color-text-secondary);
    border-bottom: 2px solid var(--color-text-secondary);
    transform: translateY(-0.15em) rotate(45deg);
    transition: transform 0.15s ease;
  }
  .settings-section[open] .settings-section__caret {
    transform: translateY(0.1em) rotate(225deg);
  }

  .settings-section__summary:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }

  .settings-section__body {
    padding: 0 1.5rem 1.5rem 1.5rem;
  }
</style>
