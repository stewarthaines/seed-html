<script context="module" lang="ts">
  // Version injected at build time from package.json
  declare const __VERSION__: string;
</script>

<script lang="ts">
  import { t } from '../../i18n';
  import LICENSE_TEXT from '../../../../LICENSE.txt?raw';

  const VERSION = __VERSION__;
</script>

<div class="about-view">
  <div class="about-content">
    <header class="about-header">
      <h1 class="app-title">{$t('about.subtitle')}</h1>
      <p class="app-version">{$t('about.version')}: {VERSION}</p>
    </header>

    <section class="about-section">
      <h2>{$t('about.description.title')}</h2>
      <p>{$t('about.description.content')}</p>
      <p>
        <a
          href="https://stewarthaines.com/epub"
          target="_blank"
          rel="noopener noreferrer"
          class="external-link"
        >
          {$t('about.website.link')}
        </a>
      </p>
      <p>{$t('about.attribution.content')}</p>
    </section>

    <section class="about-section">
      <h2>{$t('about.license.title')}</h2>
      <pre class="license-text">{LICENSE_TEXT}</pre>
    </section>
  </div>
</div>

<style>
  .about-view {
    height: 100%;
    overflow: auto;
    padding: var(--space-4);
    background: var(--color-bg-primary);
  }

  .about-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .about-header {
    text-align: center;
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border-default);
  }

  .app-title {
    font-size: var(--text-3xl);
    font-weight: var(--font-bold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .app-version {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .about-section {
    margin-bottom: var(--space-6);
  }

  .about-section h2 {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3) 0;
    border-bottom: 1px solid var(--color-border-subtle);
    padding-bottom: var(--space-1);
  }

  .about-section p {
    font-size: var(--text-base);
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

  /* Responsive design */
  @media (max-width: 640px) {
    .about-view {
      padding: var(--space-3);
    }

    .app-title {
      font-size: var(--text-2xl);
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .license-text {
      border-width: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .about-view {
      scroll-behavior: auto;
    }
  }
</style>
