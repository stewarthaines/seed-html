<!--
  SettingsSection — a settings group rendered as a native <details> disclosure whose
  header shows a compact summary of the section's current values. Sections sharing a
  `name` form an exclusive accordion (one open at a time): native on Chrome 120+ /
  Safari 17.2+ / Firefox 130+ via the <details name> attribute, with a tiny ontoggle
  fallback to enforce it on older Safari (the app's floor is 16.4).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    /** Compact summary of the section's current values, shown when collapsed. */
    summary?: string;
    /** Accordion group name; sections with the same name open one-at-a-time. */
    name: string;
    /** Start expanded (the first section of a pane). One-time initial, not reactive. */
    open?: boolean;
    children: Snippet;
  }

  const { title, summary, name, open = false, children }: Props = $props();

  // Fallback exclusivity for browsers without <details name> grouping (Safari
  // 16.4–17.1): when this section opens, close any other open section in the same
  // group. Closing a sibling fires its toggle with open=false, which we ignore, so
  // there is no recursion. On browsers with native grouping this is a harmless no-op
  // (they already closed the others before this handler runs).
  function enforceSingleOpen(event: Event): void {
    const el = event.currentTarget as HTMLDetailsElement;
    if (!el.open) return;
    for (const other of document.querySelectorAll<HTMLDetailsElement>(
      `details[name="${CSS.escape(name)}"]`
    )) {
      if (other !== el && other.open) other.open = false;
    }
  }
</script>

<details class="settings-section" {name} {open} ontoggle={enforceSingleOpen}>
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
