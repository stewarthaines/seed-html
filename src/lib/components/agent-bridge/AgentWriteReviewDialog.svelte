<script lang="ts">
  /**
   * Consent review for an agent write to executable content — a transform
   * script, a preview head fragment, or a script that ships inside the packaged
   * EPUB and runs on a reader's device.
   *
   * The author approves what will run, having seen it. There is no session
   * grant for code, so this dialog is raised for every such write, and the
   * answer is whole-payload: accept the proposal or refuse it.
   *
   * Dev-only, mounted imperatively by the agent bridge context in App.svelte —
   * never statically imported, so it stays out of production bundles.
   *
   * Untranslated, like the rest of the bridge UI: a dev tool's strings do not
   * belong in the app's catalogs, where every one of them costs a translation
   * in seven languages.
   */
  import { onMount } from 'svelte';
  import InlineTextDiff from '../import/InlineTextDiff.svelte';

  let {
    path,
    current,
    incoming,
    bytes,
    onDecision,
  }: {
    path: string;
    current: string | null;
    incoming: string | null;
    bytes: number;
    onDecision: (choice: 'accept' | 'deny') => void;
  } = $props();

  let dialogEl = $state<HTMLDivElement>();
  let denyEl = $state<HTMLButtonElement>();

  // A binary payload has no diff to show; say so rather than render an empty
  // one, and let the author refuse on that basis.
  const hasDiff = $derived(typeof current === 'string' && typeof incoming === 'string');

  onMount(() => {
    // Focus the refusing action: the safe answer should be the reachable one,
    // and Escape denies for the same reason.
    denyEl?.focus();
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onDecision('deny');
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="scrim">
  <div
    class="dialog"
    bind:this={dialogEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="agent-write-review-title"
  >
    <header>
      <h2 id="agent-write-review-title">agent wants to change a script</h2>
      <p class="path">{path}</p>
      <p class="meta">{bytes} bytes — this code will run</p>
    </header>

    <div class="body">
      {#if hasDiff}
        <InlineTextDiff current={current ?? ''} incoming={incoming ?? ''} />
      {:else}
        <p class="no-diff">binary content — no diff to show</p>
      {/if}
    </div>

    <footer>
      <button type="button" class="deny" bind:this={denyEl} onclick={() => onDecision('deny')}>
        Deny
      </button>
      <button type="button" class="accept" onclick={() => onDecision('accept')}> Accept </button>
    </footer>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    background: rgba(0, 0, 0, 0.5);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    inline-size: min(70rem, 100%);
    max-block-size: 85vh;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  header {
    padding: var(--space-3) var(--space-4);
    border-block-end: 1px solid var(--color-border-primary);
  }

  h2 {
    margin: 0;
    font-size: var(--text-base);
  }

  .path {
    margin: var(--space-1) 0 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .meta {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .body {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow: auto;
  }

  .no-diff {
    margin: 0;
    padding: var(--space-4);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-block-start: 1px solid var(--color-border-primary);
  }

  button {
    padding: var(--space-1) var(--space-3);
    font: inherit;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .deny {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .accept {
    background: var(--color-bg-accent);
    color: var(--color-interactive-primary);
  }
</style>
