<script lang="ts">
  import { t } from '../../i18n';
  import PaneHeader from '$lib/components/layout/PaneHeader.svelte';
</script>

<div class="about-pane">
  <PaneHeader>
    <span class="pane-title">{$t('Welcome')}</span>
  </PaneHeader>
  <div class="about-pane-body">
    <p class="about-tagline">{$t('Make ebooks anyone can read — right now in your browser.')}</p>

    <!-- One EPUB, made here, opening across many Reading Systems. Decorative
         line-art; the caption below carries the meaning for screen readers. -->
    <figure class="reach-figure">
      <svg
        class="reach-graphic"
        viewBox="0 0 460 210"
        role="img"
        aria-label={$t('One EPUB made with the editor, opening on phones, tablets, and e-readers.')}
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
      <figcaption class="reach-caption">
        {$t('Make it once — read it anywhere: phones, tablets, e-readers, and apps.')}
      </figcaption>
    </figure>

    <section class="about-section">
      <h2>{$t('What is an EPUB?')}</h2>
      <p>
        {$t(
          "EPUB is the open standard for digital books: a self-contained file of text, styles, and images that any Reading System app can open. Because the format is open, your book can be read anywhere. It reflows to fit any screen and adapts to each reader's chosen size, font, and contrast."
        )}
      </p>
      <p>
        {$t(
          "This editor turns plain text into a valid EPUB. You write in simple, readable source; it's packaged into a standards-compliant book."
        )}
      </p>
    </section>

    <section class="about-section">
      <h2>{$t('What is different about a SEED EPUB?')}</h2>
      <p>
        {$t(
          'The book you build here is a valid, self-contained EPUB that also carries its own editable source (bundled as SEED.zip) inside it.'
        )}
      </p>

      <!-- SEED.html publishes four outputs: PDF, a plain EPUB, and a READ.html web
           book are one-way destinations; the EPUB that embeds SEED.zip has a dashed
           return arrow — only it can be re-imported, edited and republished.
           Decorative; the aria-label and caption carry the meaning for screen
           readers. -->
      <figure class="reach-figure">
        <svg
          class="reach-graphic seed-graphic"
          viewBox="0 0 420 280"
          role="img"
          aria-label={$t(
            'SEED.html exports an EPUB that embeds its own SEED.zip source, a PDF, and a READ.html web book; only the EPUB can return to the app for further editing.'
          )}
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

          <!-- EPUB round-trip: publish out (solid, horizontal), return to edit (dashed, flat parabola) -->
          <g class="g-arrows">
            <path d="M136 72 L288 72" marker-end="url(#seed-arrowhead)" />
            <path
              class="return"
              d="M288 92 C 237 108, 187 108, 136 92"
              marker-end="url(#seed-arrowhead)"
            />
          </g>

          <!-- PDF: one-way destination, set a little further from the app -->
          <g class="g-arrows">
            <path d="M136 112 C 214 112, 250 178, 302 178" marker-end="url(#seed-arrowhead)" />
          </g>

          <!-- READ.html web book: one-way destination below the PDF -->
          <g class="g-arrows">
            <path d="M136 126 C 214 126, 240 240, 296 240" marker-end="url(#seed-arrowhead)" />
          </g>

          <!-- Output 1: an EPUB that embeds its own SEED.zip source (the round-trip output) -->
          <g class="g-book">
            <rect x="288" y="55" width="76" height="50" rx="5" />
            <line x1="300" y1="55" x2="300" y2="105" />
            <rect class="inner" x="322" y="68" width="30" height="20" rx="3" />
            <text x="326" y="124" class="lbl center">EPUB+SEED.zip</text>
          </g>

          <!-- Output 2: PDF — a portrait page with a folded corner, one-way -->
          <g class="g-dest">
            <path d="M304 148 L334 148 L346 160 L346 206 L304 206 Z" />
            <path d="M334 148 L334 160 L346 160" />
            <text x="356" y="181" class="lbl">PDF</text>
          </g>

          <!-- Output 3: READ.html — a browser window carrying the book, one-way -->
          <g class="g-dest">
            <rect x="304" y="222" width="52" height="38" rx="4" />
            <line x1="304" y1="232" x2="356" y2="232" />
            <line x1="309" y1="227" x2="313" y2="227" />
            <line x1="314" y1="242" x2="346" y2="242" />
            <line x1="314" y1="250" x2="340" y2="250" />
            <text x="364" y="245" class="lbl small">READ.html</text>
          </g>
        </svg>
        <figcaption class="reach-caption">
          {$t('Only the EPUB — with SEED.zip inside — can be reopened, edited, and republished.')}
        </figcaption>
      </figure>

      <p>
        {$t(
          'A SEED EPUB is a living document rather than a publishing dead-end, suited to distribution, contribution and long-term preservation.'
        )}
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
</style>
