<!--
  BottomTabs — the phone's tab bar inside a book: Write, Preview, Book, Share.
  Preview is a tab only here, because the editor and the preview cannot sit
  side by side on a phone (process/APP_MAKEOVER_LIBRARY.md, phase 5).
-->
<script lang="ts">
  import { t } from '../../i18n';
  import { PencilSimple, Eye, Book, ShareNetwork } from 'phosphor-svelte';

  export type PhoneTab = 'write' | 'preview' | 'book' | 'share';

  let {
    active,
    onSelect,
  }: {
    active: PhoneTab | null;
    onSelect: (tab: PhoneTab) => void;
  } = $props();

  const tabs = $derived<{ id: PhoneTab; label: string }[]>([
    { id: 'write', label: $t('Write') },
    { id: 'preview', label: $t('Preview') },
    { id: 'book', label: $t('Book') },
    { id: 'share', label: $t('Share') },
  ]);
</script>

<nav class="bottom-tabs" aria-label={$t('Book')}>
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      class="tab"
      class:active={active === tab.id}
      aria-current={active === tab.id ? 'page' : undefined}
      onclick={() => onSelect(tab.id)}
      data-testid={`phone-tab-${tab.id}`}
    >
      <!-- icons-weights: fill,regular -->
      {#if tab.id === 'write'}
        <PencilSimple
          size={22}
          weight={active === tab.id ? 'fill' : 'regular'}
          aria-hidden="true"
        />
      {:else if tab.id === 'preview'}
        <Eye size={22} weight={active === tab.id ? 'fill' : 'regular'} aria-hidden="true" />
      {:else if tab.id === 'book'}
        <Book size={22} weight={active === tab.id ? 'fill' : 'regular'} aria-hidden="true" />
      {:else}
        <ShareNetwork
          size={22}
          weight={active === tab.id ? 'fill' : 'regular'}
          aria-hidden="true"
        />
      {/if}
      <span class="label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom-tabs {
    flex-shrink: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    block-size: calc(56px + env(safe-area-inset-bottom, 0px));
    padding-block-end: env(safe-area-inset-bottom, 0px);
    background: var(--color-bg-primary);
    border-block-start: 1px solid var(--color-border-default);
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 0;
    background: transparent;
    padding: 0;
    color: var(--color-text-secondary);
    font: inherit;
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .tab.active {
    color: var(--color-text-primary);
    font-weight: var(--font-bold);
  }

  .tab:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: calc(-1 * var(--focus-ring-width));
  }
</style>
