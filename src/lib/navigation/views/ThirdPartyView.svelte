<script context="module" lang="ts">
  // Version injected at build time from package.json
  declare const __VERSION__: string;
</script>

<script lang="ts">
  import { t } from '../../i18n';
  import PaneHeader from '$lib/components/layout/PaneHeader.svelte';
  import LICENSE_TEXT from '../../../../LICENSE.txt?raw';

  const VERSION = __VERSION__;

  // Third-party library information
  const THIRD_PARTY_LIBRARIES = [
    {
      name: 'Svelte',
      version: '^5.28.1',
      license: 'MIT',
      url: 'https://github.com/sveltejs/svelte',
      description: 'Cybernetically enhanced web apps',
      copyright: 'Copyright (c) 2016-present, sveltejs',
    },
    {
      name: 'paneforge',
      version: '^1.0.0',
      license: 'MIT',
      url: 'https://github.com/svecosystem/paneforge',
      description: 'Headless pane management for Svelte',
      copyright:
        'Copyright (c) 2024 Hunter Johnston <https://github.com/huntabyte> Copyright (c) 2023 Brian Vaughn <https://github.com/bvaughn>',
    },
    {
      name: 'ndesmic/zip',
      version: 'N/A',
      license: 'MIT',
      url: 'https://github.com/ndesmic/zip',
      description: 'Browser-native ZIP implementation (substantial portions used)',
      copyright: 'Copyright (c) 2021 ndesmic',
    },
  ];
</script>

<div class="license-pane">
  <PaneHeader>
    <span class="pane-title">{$t('Technical Info')}</span>
  </PaneHeader>
  <div class="license-pane-body">
    <section class="disclaimer-section">
      <h2>{$t('AI Disclaimer')}</h2>
      <p class="disclaimer-summary">{$t('about.disclaimer.summary')}</p>
    </section>
    <!-- The app's own license — primary. -->
    <section class="license-section">
      <h2>{$t('about.license.title')}</h2>
      <p class="license-summary">{$t('about.license.summary')}</p>
      <p class="license-meta">
        {$t('about.attribution.content')} · {$t('about.version')}: {VERSION}
      </p>
      <pre class="license-text">{LICENSE_TEXT}</pre>
    </section>

    <!-- Third-party libraries folded in below the main license. -->
    <section class="thirdparty-section">
      <h2>{$t('about.thirdparty.title')}</h2>
      <p class="thirdparty-intro">{$t('about.thirdparty.intro')}</p>

      <div class="library-list">
        {#each THIRD_PARTY_LIBRARIES as library (library.name)}
          <div class="library-item">
            <h3 class="library-name">
              <a href={library.url} target="_blank" rel="noopener noreferrer" class="external-link">
                {library.name}
              </a>
              {#if library.version !== 'N/A'}
                <span class="library-version">v{library.version}</span>
              {/if}
            </h3>
            <p class="library-description">{library.description}</p>
            <p class="library-copyright">{library.copyright}</p>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .license-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    background: var(--color-bg-primary);
  }

  .pane-title {
    font-weight: var(--font-semibold);
  }

  .license-pane-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-5);
  }

  .license-pane-body > * {
    max-width: 42rem;
  }

  .license-section {
    margin-bottom: var(--space-5);
  }

  .disclaimer-summary,
  .license-summary {
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-2) 0;
  }

  .license-meta {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
    margin: 0 0 var(--space-3) 0;
  }

  /* License blocks are de-emphasized: small, muted, monospace. */
  .license-text {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.5;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    overflow: auto;
  }

  .thirdparty-section {
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-default);
  }

  .thirdparty-section h2 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .thirdparty-intro {
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3) 0;
  }

  .external-link {
    color: var(--color-text-link);
    text-decoration: underline;
  }

  .external-link:hover {
    color: var(--color-text-link-hover);
  }

  .library-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .library-item {
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    background: var(--color-bg-secondary);
  }

  .library-name {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-1) 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .library-version {
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
    background: var(--color-bg-tertiary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-xs);
  }

  .library-description {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: var(--space-1) 0;
  }

  .library-copyright {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
    margin: var(--space-1) 0 0 0;
    font-family: var(--font-mono);
  }

  @media (prefers-contrast: high) {
    .license-text,
    .library-item {
      border-width: 2px;
    }
  }
</style>
