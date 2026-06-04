<script lang="ts">
  import { t } from '../../i18n';

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

  const MIT_LICENSE_TEXT = `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
</script>

<div class="thirdparty-view">
  <div class="thirdparty-content">
    <header class="thirdparty-header">
      <h2>{$t('about.thirdparty.title')}</h2>
      <p class="thirdparty-intro">{$t('about.thirdparty.intro')}</p>
    </header>

    <section class="libraries-section">
      <div class="library-list">
        {#each THIRD_PARTY_LIBRARIES as library}
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

      <div class="mit-license-section">
        <h3>{$t('about.thirdparty.license')}: MIT</h3>
        <pre class="license-text">{MIT_LICENSE_TEXT}</pre>
      </div>
    </section>
  </div>
</div>

<style>
  .thirdparty-view {
    height: 100%;
    overflow: auto;
    padding: var(--space-4);
    background: var(--color-bg-primary);
  }

  .thirdparty-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .thirdparty-header {
    text-align: center;
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border-default);
  }

  .thirdparty-header h2 {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3) 0;
  }

  .thirdparty-intro {
    font-size: var(--text-base);
    line-height: 1.6;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .libraries-section {
    margin-bottom: var(--space-6);
  }

  .external-link {
    color: var(--color-text-link);
    text-decoration: underline;
  }

  .external-link:hover {
    color: var(--color-text-link-hover);
  }

  .license-text {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-text-primary);
    white-space: pre-wrap;
    overflow-x: auto;
    overflow-y: auto;
  }

  .library-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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
    font-size: var(--text-sm);
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
    color: var(--color-text-secondary);
    margin: var(--space-1) 0 0 0;
    font-family: var(--font-mono);
  }

  .mit-license-section {
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
  }

  .mit-license-section h3 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3) 0;
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .thirdparty-view {
      padding: var(--space-3);
    }

    .thirdparty-header h2 {
      font-size: var(--text-xl);
    }

    .library-name {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .license-text,
    .library-item {
      border-width: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .thirdparty-view {
      scroll-behavior: auto;
    }
  }
</style>
