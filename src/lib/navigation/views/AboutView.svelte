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
      <h2>{$t('about.seed.title')}</h2>
      <p>{$t('about.seed.p1')}</p>

      <!-- SEED.html publishes three outputs: PDF and a plain EPUB are one-way
           destinations; the EPUB that embeds SEED.zip has a dashed return arrow —
           only it can be re-imported, edited and republished. Decorative; the
           aria-label and caption carry the meaning for screen readers. -->
      <figure class="reach-figure">
        <svg
          class="reach-graphic seed-graphic"
          viewBox="0 0 420 244"
          role="img"
          aria-label={$t('about.seed.graphic.alt')}
        >
          <defs>
            <marker
              id="seed-arrowhead"
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

          <!-- The app: a two-pane editor with a sidebar -->
          <g class="g-app">
            <rect x="28" y="24" width="108" height="112" rx="8" />
            <line x1="28" y1="42" x2="136" y2="42" />
            <text x="35" y="37" class="lbl small">SEED.html</text>
            <!-- sidebar + two-pane dividers -->
            <line x1="50" y1="42" x2="50" y2="136" />
            <line x1="94" y1="42" x2="94" y2="136" />
            <!-- sidebar nav items -->
            <line x1="34" y1="56" x2="44" y2="56" />
            <line x1="34" y1="68" x2="44" y2="68" />
            <line x1="34" y1="80" x2="44" y2="80" />
            <!-- pane 1 (editor) + pane 2 (preview) content -->
            <line x1="58" y1="58" x2="86" y2="58" />
            <line x1="58" y1="72" x2="86" y2="72" />
            <line x1="58" y1="86" x2="80" y2="86" />
            <line x1="100" y1="58" x2="128" y2="58" />
            <line x1="100" y1="72" x2="122" y2="72" />
          </g>

          <!-- Publish to the two one-way destinations (grouped at right) -->
          <g class="g-arrows">
            <path d="M138 58 C 210 58, 224 57, 298 57" marker-end="url(#seed-arrowhead)" />
            <path d="M138 104 C 212 104, 224 129, 294 129" marker-end="url(#seed-arrowhead)" />
          </g>

          <!-- Round-trip with the editable SEED.zip EPUB: publish out, edit back -->
          <g class="g-arrows">
            <path d="M96 138 C 136 150, 136 168, 100 180" marker-end="url(#seed-arrowhead)" />
            <path
              class="return"
              d="M66 180 C 30 168, 30 150, 70 138"
              marker-end="url(#seed-arrowhead)"
            />
          </g>

          <!-- Destination 1: PDF — a portrait page (folded corner) -->
          <g class="g-dest">
            <path d="M300 30 L328 30 L340 42 L340 84 L300 84 Z" />
            <path d="M328 30 L328 42 L340 42" />
            <text x="350" y="61" class="lbl">PDF</text>
          </g>

          <!-- Destination 2: a plain EPUB -->
          <g class="g-book">
            <rect x="296" y="104" width="72" height="50" rx="5" />
            <line x1="308" y1="104" x2="308" y2="154" />
            <line x1="316" y1="120" x2="356" y2="120" />
            <line x1="316" y1="134" x2="348" y2="134" />
            <text x="378" y="132" class="lbl">EPUB</text>
          </g>

          <!-- The editable output: an EPUB embedding SEED.zip, near the app -->
          <g class="g-book">
            <rect x="46" y="182" width="72" height="52" rx="5" />
            <line x1="58" y1="182" x2="58" y2="234" />
            <rect class="inner" x="68" y="196" width="42" height="24" rx="3" />
            <text x="89" y="212" class="lbl center zip">SEED.zip</text>
            <text x="128" y="210" class="lbl">EPUB</text>
          </g>
        </svg>
        <figcaption class="reach-caption">{$t('about.seed.graphic.caption')}</figcaption>
      </figure>

      <p>{$t('about.seed.p2')}</p>
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

  /* The SEED-EPUB diagram carries a few proper-noun labels (no stroke, sans). */
  .reach-graphic text {
    fill: var(--color-text-secondary);
    stroke: none;
    font-family: var(--font-sans);
    font-size: 11px;
  }

  .reach-graphic text.center {
    text-anchor: middle;
  }

  .seed-graphic .inner {
    fill: var(--color-bg-secondary);
  }

  /* The re-import/edit arrow is dashed to read as a return, not a publish. */
  .seed-graphic .return {
    stroke-dasharray: 5 4;
  }

  .seed-graphic .zip,
  .seed-graphic .small {
    font-size: 9px;
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
