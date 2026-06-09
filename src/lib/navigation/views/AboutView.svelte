<script lang="ts">
  import { t } from '../../i18n';
  import PaneHeader from '$lib/components/layout/PaneHeader.svelte';
</script>

<div class="about-pane">
  <PaneHeader>
    <span class="pane-title">{$t('Welcome')}</span>
  </PaneHeader>
  <div class="about-pane-body">
    <p class="about-tagline">{$t('about.tagline')}</p>

    <!-- One EPUB, made here, opening across many Reading Systems. Decorative
         line-art; the caption below carries the meaning for screen readers. -->
    <figure class="reach-figure">
      <svg
        class="reach-graphic"
        viewBox="0 0 460 210"
        role="img"
        aria-label={$t('about.graphic.alt')}
      >
        <defs>
          <marker
            id="about-arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path class="arrowhead" d="M0 0 L10 5 L0 10 z" />
          </marker>
        </defs>

        <!-- Source: an EPUB made with this editor -->
        <g class="g-source">
          <rect x="26" y="64" width="86" height="104" rx="8" />
          <line x1="45" y1="64" x2="45" y2="168" />
          <line x1="60" y1="92" x2="96" y2="92" />
          <line x1="60" y1="108" x2="96" y2="108" />
          <line x1="60" y1="124" x2="84" y2="124" />
        </g>

        <!-- Fan-out arrows from the source to each device -->
        <g class="g-arrows">
          <path d="M120 116 C 220 116, 250 46, 332 46" marker-end="url(#about-arrowhead)" />
          <path d="M120 116 C 230 116, 250 118, 330 118" marker-end="url(#about-arrowhead)" />
          <path d="M120 116 C 220 116, 250 177, 326 177" marker-end="url(#about-arrowhead)" />
        </g>

        <!-- Reading Systems: phone, tablet, laptop, stacked with even gaps. -->
        <g class="g-devices">
          <!-- phone: y 11–81 -->
          <rect x="340" y="11" width="44" height="70" rx="8" />
          <line x1="356" y1="19" x2="368" y2="19" />
          <!-- tablet: y 95–141 (14px gap above) -->
          <rect x="338" y="95" width="66" height="46" rx="6" />
          <!-- laptop: y 155–199 (14px gap above) -->
          <rect x="334" y="155" width="72" height="44" rx="3" />
          <path d="M326 201 L414 201" />
        </g>
      </svg>
      <figcaption class="reach-caption">{$t('about.graphic.caption')}</figcaption>
    </figure>

    <section class="about-section">
      <h2>{$t('about.epub.title')}</h2>
      <p>{$t('about.epub.format')}</p>
      <p>{$t('about.epub.editor')}</p>
    </section>

    <section class="about-section">
      <h2>{$t('about.cta.title')}</h2>
      <p>{$t('about.cta.intro')}</p>
      <ol class="about-steps">
        <li>{$t('about.cta.step1')}</li>
        <li>{$t('about.cta.step2')}</li>
        <li>{$t('about.cta.step3')}</li>
        <li>{$t('about.cta.step4')}</li>
        <li>{$t('about.cta.step5')}</li>
      </ol>
      <p>{$t('about.cta.closing')}</p>
    </section>

    <section class="about-section">
      <p>{$t('about.website.intro')}</p>
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
    </section>
  </div>
</div>

<style>
  /* Fixed header over a scrolling body, matching the other split-pane views. */
  .about-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    background: var(--color-bg-primary);
  }

  .pane-title {
    font-weight: var(--font-semibold);
  }

  .about-pane-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-5);
  }

  /* Keep a comfortable reading measure even when the pane is wide. */
  .about-pane-body > * {
    max-width: 42rem;
  }

  .about-tagline {
    font-size: var(--text-lg);
    line-height: 1.5;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-4) 0;
  }

  .reach-figure {
    margin: 0 0 var(--space-5) 0;
  }

  .reach-graphic {
    display: block;
    width: 100%;
    max-width: 24rem;
    height: auto;
    margin: 0 auto var(--space-2);
    color: var(--color-text-tertiary);
  }

  .reach-graphic rect,
  .reach-graphic line,
  .reach-graphic path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .reach-graphic .g-source rect {
    fill: var(--color-bg-secondary);
  }

  .reach-graphic .g-arrows path {
    stroke: var(--color-accent);
  }

  .reach-graphic .arrowhead {
    fill: var(--color-accent);
    stroke: none;
  }

  .reach-caption {
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .about-section {
    margin-bottom: var(--space-5);
  }

  .about-section h2 {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .about-section p {
    font-size: var(--text-base);
    line-height: 1.6;
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-3) 0;
  }

  .about-steps {
    margin: 0 0 var(--space-3) 0;
    padding-left: var(--space-5);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .about-steps li {
    margin-bottom: var(--space-2);
  }

  .external-link {
    color: var(--color-text-link);
    text-decoration: underline;
  }

  .external-link:hover {
    color: var(--color-text-link-hover);
  }
</style>
