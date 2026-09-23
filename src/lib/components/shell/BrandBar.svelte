<!--
  BrandBar — the bar above the Books screen and the About page: the mark and
  the app name, then About and the theme toggle. Inside a book the TopBar
  takes its place.
-->
<script lang="ts">
  import { t } from '../../i18n';
  import type { ViewType } from '../../navigation/types';
  import ThemeToggle from '../../ThemeToggle.svelte';
  import ReaditInaBookMark from '../icons/ReaditInaBookMark.svelte';

  let {
    currentView,
    settingsOpen = false,
    onNavigate,
  }: {
    currentView: ViewType;
    /** The Settings sheet is open over this view. */
    settingsOpen?: boolean;
    onNavigate: (view: ViewType) => void;
  } = $props();

  // The hosted site shows the platform brand; every other copy (localhost,
  // preview deploys, the standalone file, inside an EPUB) shows the app name.
  const isBrandHost =
    typeof window !== 'undefined' && /(^|\.)readitinabook\.com$/i.test(window.location.hostname);
</script>

<header class="brand-bar">
  <button
    type="button"
    class="brand"
    onclick={() => onNavigate('workspace')}
    aria-current={currentView === 'workspace' ? 'page' : undefined}
    data-testid="nav-workspace"
  >
    <span class="mark"><ReaditInaBookMark size={22} /></span>
    <span class="name">{isBrandHost ? 'ReaditInaBook.com' : 'SEED.html'}</span>
  </button>
  <nav class="links" aria-label={$t('Main navigation')}>
    <button
      type="button"
      class="link"
      class:active={currentView === 'about'}
      aria-current={currentView === 'about' ? 'page' : undefined}
      onclick={() => onNavigate('about')}
      data-testid="nav-about"
    >
      {$t('About SEED.html')}
    </button>
    <button
      type="button"
      class="link"
      class:active={settingsOpen}
      aria-expanded={settingsOpen}
      onclick={() => onNavigate('settings')}
      data-testid="nav-settings"
    >
      {$t('Settings')}
    </button>
    <ThemeToggle size="small" showLabel={false} />
  </nav>
</header>

<style>
  .brand-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-5);
    block-size: var(--bar-height);
    padding-inline: var(--space-6);
    background: var(--color-bg-primary);
    border-block-end: 1px solid var(--color-border-default);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border: 0;
    background: transparent;
    padding: 0;
    min-block-size: var(--touch-target-min);
    font: inherit;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .mark {
    display: inline-flex;
    color: var(--color-text-primary);
  }

  .links {
    margin-inline-start: auto;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .link {
    border: 0;
    background: transparent;
    padding: 0;
    min-block-size: var(--touch-target-min);
    font: inherit;
    font-size: var(--text-base);
    color: var(--color-text-link);
    cursor: pointer;
  }

  .link:hover {
    color: var(--color-text-link-hover);
    text-decoration: underline;
  }

  .link.active {
    color: var(--color-text-primary);
    font-weight: var(--font-bold);
  }

  .brand:focus-visible,
  .link:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
    outline-offset: var(--focus-ring-offset);
  }
</style>
