<!--
  AboutDialog — what the app is, in a small dialog off the brand bar: name and
  version, the licence, the app download and the third-party libraries
  (process/APP_MAKEOVER_LIBRARY.md, phase 4).
-->
<script module lang="ts">
  // Version injected at build time from package.json
  declare const __VERSION__: string;
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { t } from '../../i18n';
  import ReaditInaBookMark from '../icons/ReaditInaBookMark.svelte';
  import { X } from 'phosphor-svelte';
  import {
    canFetchSelfHtml,
    fetchSelfHtml,
    localizedSeedHtml,
    SEED_HTML_NAME,
  } from '$lib/epub/seed-html.js';
  import { FileStorageAPI } from '$lib/storage/index.js';
  import LICENSE_TEXT from '../../../../LICENSE.txt?raw';

  let { onClose }: { onClose: () => void } = $props();

  const VERSION = __VERSION__;

  // Download the running app as a single file, with the user's cached locale
  // catalogs spliced in (the same transformation as embedding SEED.html into
  // an EPUB) — a plain <a download> would save the hosted English base build.
  let downloading = $state(false);
  let downloadError = $state(false);
  async function downloadApp() {
    if (downloading) return;
    downloading = true;
    downloadError = false;
    try {
      const bytes = await localizedSeedHtml(await fetchSelfHtml(), FileStorageAPI.getInstance());
      const url = URL.createObjectURL(new Blob([bytes], { type: 'text/html' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = SEED_HTML_NAME;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      downloadError = true;
    } finally {
      downloading = false;
    }
  }

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
    /** Full licence text served with the library, where the licence asks for it. */
    noticeUrl?: string;
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
  // online-only features and the libraries bundled in the plugins (each a
  // separate, http-loaded iframe build). Versions are kept by hand: check them
  // against the plugins' package.json at each release.
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
      name: '@guidepup/virtual-screen-reader',
      version: '0.32.1',
      license: 'MIT',
      url: 'https://github.com/guidepup/virtual-screen-reader',
      description: 'Screen reader announcement preview in the EPUB preview',
      copyright: 'Copyright (c) 2023 Craig Morten',
    },
    {
      name: 'Chromium DocumentXMLTreeViewer',
      version: 'N/A',
      license: 'BSD-3-Clause',
      url: 'https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/xml/DocumentXMLTreeViewer.js',
      description: 'Collapsible XML tree in the Source view (adapted)',
      copyright: 'Copyright 2014 The Chromium Authors',
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
    {
      name: 'wavesurfer.js',
      version: '7.12.8',
      license: 'BSD-3-Clause',
      url: 'https://github.com/katspaugh/wavesurfer.js',
      description: 'Waveform and clip regions — Audio Clip Editor plugin',
      copyright: 'Copyright (c) 2012-2023, katspaugh and contributors',
    },
    {
      name: 'wasm-media-encoders',
      version: '0.7.0',
      license: 'MIT',
      url: 'https://github.com/arseneyr/wasm-media-encoders',
      description: 'Runs the mp3 encoder in the browser — Audio Clip Editor plugin',
      copyright: 'Copyright (c) 2020-2024 arseneyr',
    },
    {
      name: 'LAME',
      version: '3.100',
      license: 'LGPL-2.0-or-later',
      url: 'https://lame.sourceforge.io/',
      description:
        'mp3 encoding for recorded clips — Audio Clip Editor plugin (a separate file the plugin loads)',
      copyright: 'Copyright (c) 1999 Mark Taylor and the LAME developers',
      noticeUrl: 'plugins/audio-clip-editor/THIRD_PARTY_NOTICES.txt',
    },
  ];
  // --- Dialog behaviour: focus on open, Tab trap, Escape closes ---------------
  let dialogEl = $state<HTMLElement | null>(null);
  let closeButton = $state<HTMLButtonElement | null>(null);

  onMount(() => {
    tick().then(() => closeButton?.focus());
  });

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogEl) return;
    const items = [...dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      el => el.getClientRects().length > 0
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogEl.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onClose();
  }
</script>

<div class="about-backdrop" onclick={onClose} onkeydown={handleBackdropKeydown} role="presentation">
  <div
    bind:this={dialogEl}
    class="about-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="about-dialog-title"
    tabindex="-1"
    onclick={event => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <button
      bind:this={closeButton}
      type="button"
      class="btn btn-icon about-close"
      onclick={onClose}
      aria-label={$t('Close')}
      data-testid="about-close"
    >
      <X size={18} aria-hidden="true" />
    </button>

    <div class="about-body">
      <div class="about-head">
        <span class="about-mark" aria-hidden="true"><ReaditInaBookMark size={40} /></span>
        <div>
          <h2 id="about-dialog-title" class="about-title">SEED.html</h2>
          <p class="about-meta">{$t('Simple EPUB Editor')} · {$t('Version')}: {VERSION}</p>
        </div>
      </div>

      <p class="about-tagline">
        {$t('Make ebooks anyone can read — right now in your browser.')}
      </p>
      <p class="about-text">
        {$t(
          'A SEED EPUB is a living document rather than a publishing dead-end, suited to distribution, contribution and long-term preservation.'
        )}
      </p>

      <p class="about-links">
        <a href="https://readitinabook.com" target="_blank" rel="noopener noreferrer">
          readitinabook.com
        </a>
        <a
          href="https://github.com/stewarthaines/seed-html"
          target="_blank"
          rel="noopener noreferrer"
        >
          {$t('Source on GitHub')}
        </a>
        {#if canFetchSelfHtml()}
          <a
            href="SEED.html"
            download="SEED.html"
            aria-busy={downloading}
            onclick={event => {
              // Intercept: fetch + localize + save as a blob. The plain href
              // stays as the no-JS / mid-failure fallback.
              event.preventDefault();
              void downloadApp();
            }}
          >
            {downloading ? $t('Preparing…') : $t('Download SEED.html')}
          </a>
        {/if}
      </p>
      {#if canFetchSelfHtml()}
        <p class="about-text">
          {$t(
            'SEED.html is a single file, and this page is the whole app. Keep your own copy and it will keep working even if this website goes away — a fully offline editor.'
          )}
        </p>
        {#if downloadError}
          <p class="about-text download-error" role="alert">{$t('Download failed — try again')}</p>
        {/if}
      {/if}

      <section class="about-section">
        <h3>{$t('License')}</h3>
        <p class="about-text">
          {$t(
            "Simple EPUB Editor (distributed as SEED.html) is free and open-source software, released under the MIT License. You're welcome to use it, modify it, and redistribute it — including embedding it inside the EPUBs you create."
          )}
        </p>
        <p class="about-text">{$t('Developed by Stewart Haines.')}</p>
        <p class="about-text">
          {$t(
            "Much of this software was written with AI coding agents, primarily Anthropic's Claude Code."
          )}
        </p>
        <details class="disclosure">
          <summary class="disclosure-summary">{$t('Show the full license text')}</summary>
          <pre class="license-text">{LICENSE_TEXT}</pre>
        </details>
      </section>

      {#snippet libraryItem(library: Library)}
        <div class="library-item">
          <h4 class="library-name">
            <a href={library.url} target="_blank" rel="noopener noreferrer">{library.name}</a>
            {#if library.version !== 'N/A'}
              <span class="library-version">v{library.version}</span>
            {/if}
            <span class="library-license" title={$t('License')}>{library.license}</span>
          </h4>
          <p class="library-description">{library.description}</p>
          <p class="library-copyright">{library.copyright}</p>
          {#if library.noticeUrl}
            <p class="library-copyright">
              <a href={library.noticeUrl} target="_blank" rel="noopener noreferrer">
                {$t('License text')}
              </a>
            </p>
          {/if}
        </div>
      {/snippet}

      <section class="about-section">
        <details class="disclosure">
          <summary class="disclosure-summary">{$t('Third-Party Libraries')}</summary>
          <div class="library-list">
            {#each BUNDLED_LIBRARIES as library (library.name)}
              {@render libraryItem(library)}
            {/each}
          </div>
          {#if isHttp}
            <h4 class="thirdparty-subheading">{$t('Available when running online')}</h4>
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
</div>

<style>
  .about-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.28);
  }

  .about-dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(560px, 100vw - 32px);
    max-block-size: min(720px, 100dvh - 32px);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    box-shadow: var(--shadow-lg);
    color: var(--color-text-primary);
  }

  .about-close {
    position: absolute;
    inset-inline-end: var(--space-3);
    inset-block-start: var(--space-3);
  }

  .about-body {
    min-block-size: 0;
    overflow-y: auto;
    padding: var(--space-6) var(--space-6) var(--space-5);
  }

  .about-head {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-block-end: var(--space-4);
  }

  .about-mark {
    display: inline-flex;
    color: var(--color-text-primary);
  }

  .about-title {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
  }

  .about-meta {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .about-tagline {
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
  }

  .about-text {
    margin: 0 0 var(--space-3);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    line-height: 1.6;
  }

  .download-error {
    color: var(--color-error-text);
  }

  .about-links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0 0 var(--space-3);
  }

  .about-section {
    margin-block-start: var(--space-5);
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-border-default);
  }

  .about-section h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
  }

  .disclosure-summary {
    cursor: pointer;
    color: var(--color-text-link);
    font-size: var(--text-sm);
  }

  .license-text {
    margin: var(--space-3) 0 0;
    padding: var(--space-3);
    white-space: pre-wrap;
    font-size: var(--text-xs);
    line-height: 1.5;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-default);
  }

  .library-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-block-start: var(--space-3);
  }

  .thirdparty-subheading {
    margin: var(--space-4) 0 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }

  .library-name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }

  .library-version,
  .library-license {
    font-weight: var(--font-normal);
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .library-description,
  .library-copyright {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }
</style>
