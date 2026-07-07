<script context="module" lang="ts">
  // Version injected at build time from package.json
  declare const __VERSION__: string;
</script>

<script lang="ts">
  import { t } from '../../i18n';
  import PaneHeader from '$lib/components/layout/PaneHeader.svelte';
  import LICENSE_TEXT from '../../../../LICENSE.txt?raw';

  const VERSION = __VERSION__;

  // Online-only libraries are fetched at runtime (vendored polyfills + the
  // publish plugin) and aren't present in the offline file:// build.
  const isHttp = typeof location !== 'undefined' && location.protocol !== 'file:';

  interface Library {
    name: string;
    version: string;
    license: string;
    url: string;
    description: string;
    copyright: string;
  }

  // Always bundled into the app (present under file:// too). All permissive
  // (MIT, except jsdiff which is BSD-3-Clause).
  const BUNDLED_LIBRARIES: Library[] = [
    {
      name: 'Svelte',
      version: '5.56.1',
      license: 'MIT',
      url: 'https://github.com/sveltejs/svelte',
      description: 'Cybernetically enhanced web apps',
      copyright: 'Copyright (c) 2016-present, sveltejs',
    },
    {
      name: 'paneforge',
      version: '1.0.0',
      license: 'MIT',
      url: 'https://github.com/svecosystem/paneforge',
      description: 'Headless pane management for Svelte',
      copyright:
        'Copyright (c) 2024 Hunter Johnston <https://github.com/huntabyte> Copyright (c) 2023 Brian Vaughn <https://github.com/bvaughn>',
    },
    {
      name: 'phosphor-svelte',
      version: '3.1.0',
      license: 'MIT',
      url: 'https://www.npmjs.com/package/phosphor-svelte',
      description: 'Phosphor icon set as Svelte components',
      copyright: 'Copyright (c) 2020 Phosphor Icons',
    },
    {
      name: 'ndesmic/zip',
      version: 'N/A',
      license: 'MIT',
      url: 'https://github.com/ndesmic/zip',
      description: 'Browser-native ZIP implementation (substantial portions used)',
      copyright: 'Copyright (c) 2021 ndesmic',
    },
    {
      name: 'jsdiff',
      version: '9.0.0',
      license: 'BSD-3-Clause',
      url: 'https://github.com/kpdecker/jsdiff',
      description: 'Text diffing for the import conflict review',
      copyright: 'Copyright (c) 2009-2015 Kevin Decker',
    },
  ];

  // Loaded only when the editor runs online — the vendored polyfills behind
  // online-only features and the libraries bundled in the publish plugin (which
  // is a separate, http-loaded iframe build).
  const HTTP_LIBRARIES: Library[] = [
    {
      name: 'axe-core',
      version: '4.10.2',
      license: 'MPL-2.0',
      url: 'https://github.com/dequelabs/axe-core',
      description: 'Accessibility checks in the EPUB preview',
      copyright: 'Copyright (c) 2015-2024 Deque Systems, Inc.',
    },
    {
      name: 'Paged.js',
      version: '0.4.3',
      license: 'MIT',
      url: 'https://gitlab.coko.foundation/pagedjs/pagedjs',
      description: 'CSS Paged Media pagination for PDF export',
      copyright: 'Copyright (c) pagedjs contributors (Coko Foundation)',
    },
    {
      name: 'aws4fetch',
      version: '1.0.20',
      license: 'MIT',
      url: 'https://github.com/mhart/aws4fetch',
      description: 'AWS SigV4 request signing — publish plugin (S3/R2)',
      copyright: 'Copyright (c) 2018 Michael Hart',
    },
    {
      name: '@likecoin/epubcheck-ts',
      version: '0.3.9',
      license: 'GPL-3.0-only',
      url: 'https://github.com/likecoin/epubcheck-ts',
      description: 'EPUB validation — publish plugin (bundles W3C EPUBCheck)',
      copyright: 'Copyright (c) LikeCoin Foundation; bundles W3C EPUBCheck',
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
      <p class="disclaimer-summary">
        {$t(
          "Much of this software was written with AI coding agents, primarily Anthropic's Claude Code."
        )}
      </p>
    </section>
    <!-- The app's own license — primary. -->
    <section class="license-section">
      <h2>{$t('License')}</h2>
      <p class="license-summary">
        {$t(
          "Simple EPUB Editor (distributed as SEED.html) is free and open-source software, released under the MIT License. You're welcome to use it, modify it, and redistribute it — including embedding it inside the EPUBs you create."
        )}
      </p>
      <p class="license-meta">
        {$t('Developed by Stewart Haines.')} · {$t('Version')}: {VERSION} ·
        <a
          href="https://github.com/stewarthaines/editme-svelte"
          target="_blank"
          rel="noopener noreferrer"
          class="external-link"
        >
          {$t('Source on GitHub')}
        </a>
      </p>
      <details class="disclosure">
        <summary class="disclosure-summary">{$t('Show the full license text')}</summary>
        <pre class="license-text">{LICENSE_TEXT}</pre>
      </details>
    </section>

    {#snippet libraryItem(library: Library)}
      <div class="library-item">
        <h3 class="library-name">
          <a href={library.url} target="_blank" rel="noopener noreferrer" class="external-link">
            {library.name}
          </a>
          {#if library.version !== 'N/A'}
            <span class="library-version">v{library.version}</span>
          {/if}
          <span class="library-license" title={$t('License')}>{library.license}</span>
        </h3>
        <p class="library-description">{library.description}</p>
        <p class="library-copyright">{library.copyright}</p>
      </div>
    {/snippet}

    <!-- Third-party libraries, collapsed by default so the licence data doesn't
         dominate the first impression. -->
    <section class="thirdparty-section">
      <details class="disclosure">
        <summary class="disclosure-summary">
          {$t('Third-Party Libraries')}
        </summary>
        <p class="thirdparty-intro">
          {$t('This application is built with the following open source libraries:')}
        </p>

        <div class="library-list">
          {#each BUNDLED_LIBRARIES as library (library.name)}
            {@render libraryItem(library)}
          {/each}
        </div>

        {#if isHttp}
          <h3 class="thirdparty-subheading">{$t('Available when running online')}</h3>
          <p class="thirdparty-intro">
            {$t('Additional libraries used when the editor runs online.')}
          </p>
          <div class="library-list">
            {#each HTTP_LIBRARIES as library (library.name)}
              {@render libraryItem(library)}
            {/each}
          </div>
        {/if}
      </details>
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

  /* Collapsible disclosures keep the verbose licence text out of the first
     impression while leaving it one click away. */
  .disclosure {
    margin-top: var(--space-2);
  }

  /* Both summaries share one treatment: a clickable pill that fills azure with
     white text on hover/focus (the app's interactive convention). The caret uses
     currentColor, so it turns white along with the label. */
  .disclosure-summary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    list-style: none;
    padding: var(--space-1) var(--space-2);
    margin-inline-start: calc(-1 * var(--space-2));
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-link);
    transition:
      background-color var(--duration-fast) ease,
      color var(--duration-fast) ease;
  }

  .disclosure-summary::-webkit-details-marker {
    display: none;
  }

  .disclosure-summary:hover,
  .disclosure-summary:focus-visible {
    background: var(--color-accent);
    color: var(--color-on-accent);
    outline: none;
  }

  /* Hand-drawn caret: points right when collapsed, down when open. */
  .disclosure-summary::before {
    content: '';
    inline-size: 0.45rem;
    block-size: 0.45rem;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.15s ease;
  }

  .disclosure[open] > .disclosure-summary::before {
    transform: rotate(45deg);
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

  .library-version,
  .library-license {
    font-size: var(--text-xs);
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
    background: var(--color-bg-tertiary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-xs);
  }

  /* The SPDX licence reads as a label; the font-mono hints "identifier". */
  .library-license {
    font-family: var(--font-mono);
  }

  .thirdparty-subheading {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin: var(--space-4) 0 var(--space-1) 0;
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
