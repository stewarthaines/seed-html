<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { waitFor } from 'storybook/test';
  import App from '../../App.svelte';
  import { advancedMode } from '../../lib/stores/advanced-mode';
  import { seedProject } from '../utils/seed-project';
  import { familyHistoryBook, photoMarkup, MARGARET_RECORD } from './family-history-book';

  // Screenshot recipes for Book Recipes › Family history books
  // (docs/user/seed.html-recipes/Text/family-history-books.dj). Each story
  // seeds the invented McInnes family (family-history-book.ts), opens
  // one chapter whose source is the markup the shot illustrates, and waits
  // for the preview to render it; scripts/capture-manual-shots.js then
  // photographs the editor and preview side by side (.main-content).
  const { Story } = defineMeta({
    title: 'Manual Shots/Family History',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            "State recipes for the family history page's screenshots. Regenerate the images with `npm run manual-shots -- seed.html-recipes` (Storybook running), then review the docs diff.",
        },
      },
    },
    // Seeding with extensions fetches the dev-served /extensions/ catalog,
    // which the isolated test:stories Storybook doesn't serve (see STORYBOOK.md).
    tags: ['manual-shot', '!test'],
  });

  // PaneForge's saved layout for the editor/preview split, keyed by the two
  // panes' constraints (LayoutManager.svelte): editor 58%, preview 42%.
  const PANE_LAYOUT = JSON.stringify({
    '{"defaultSize":50,"minSize":20},{"defaultSize":50,"minSize":25}': {
      expandToSizes: {},
      layout: [58, 42],
    },
  });

  /**
   * Seed the family with `demo` as the chapter to open. `plugins` lists the
   * plugin ids to switch on; every other story runs with none. `advanced`
   * turns on Advanced Mode, for shots of the settings it reveals.
   */
  function seedWith(id, title, sourceText, { plugins = [], advanced = false } = {}) {
    return async () => {
      advancedMode.current = advanced;
      // Start from the default preview: a device or setting chosen in an
      // earlier story persists in this browser.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('seedhtml_preview_') || key === 'seedhtml_spine_preview_collapsed') {
          localStorage.removeItem(key);
        }
      }
      delete document.body.dataset.shotReady;
      // The phone preview at its own width, and an editor wide enough that
      // record lines don't wrap: the shots run at a 1300px viewport.
      localStorage.setItem('seedhtml_preview_device', 'iphone');
      localStorage.setItem('paneforge:seedhtml-content-panes', PANE_LAYOUT);
      const global = JSON.parse(localStorage.getItem('seedhtml_global_settings') ?? '{}');
      localStorage.setItem(
        'seedhtml_global_settings',
        JSON.stringify({ ...global, enabled_plugins: plugins })
      );
      const seeded = await seedProject(
        familyHistoryBook(id ? { id, title, sourceText } : undefined)
      );
      return { seeded };
    };
  }

  /** Every iframe under `root`, including those inside shadow roots. */
  function framesIn(root) {
    const frames = [...root.querySelectorAll('iframe')];
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) frames.push(...framesIn(el.shadowRoot));
    }
    return frames;
  }

  /** The document, at any depth of nested frames, where `selector` matches. */
  function findDocument(doc, selector) {
    if (!doc) return null;
    if (doc.querySelector(selector)) return doc;
    for (const inner of framesIn(doc)) {
      try {
        const found = findDocument(inner.contentDocument, selector);
        if (found) return found;
      } catch {
        // a frame from another origin: not the chapter
      }
    }
    return null;
  }

  /** Wait until `selector` matches in any frame of the page, at any depth. */
  async function waitInFrames(selector) {
    await waitFor(
      () => {
        if (!findDocument(document, selector)) throw new Error(`${selector} not shown`);
      },
      { timeout: 30000 }
    );
  }

  /**
   * Open a chapter and wait until `selector` matches in the preview, and every
   * image there has loaded.
   */
  async function openChapter(canvas, userEvent, id, selector) {
    const chapter = await canvas.findByTestId(`spine-item-${id}`, {}, { timeout: 60000 });
    await userEvent.click(chapter);
    await waitFor(
      () => {
        const frame = document.querySelector('iframe.preview-iframe, .preview-pane iframe');
        // The phone preview lays the chapter out in the reader's own frames.
        const doc = findDocument(frame?.contentDocument, selector);
        if (!doc) throw new Error('preview not ready');
        const images = [...doc.images];
        if (images.some(img => !img.complete || img.naturalWidth === 0)) {
          throw new Error('images still loading');
        }
      },
      { timeout: 30000 }
    );
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // The capture script waits for this (scripts/manual-shots.json `ready`).
    document.body.dataset.shotReady = 'true';
  }

  const PANEL = `${MARGARET_RECORD}

# Margaret McInnes

:family:`;

  const TREE = `# The McInneses

:tree:{of=ewen_mcinnes depth=2}`;

  const PATH = `# Cousins

:tree:{of=catherine_mcinnes to=ewen_kerr via=ewen_mcinnes}`;

  const LIFELINES = `# Ewen, Isabella and Margaret

:lifeline:{of=ewen_mcinnes as=Ewen}
:lifeline:{of=isabella_ross as=Isabella}
:lifeline:{of=margaret_mcinnes as=Margaret}`;

  const PHOTO = `# Thomas and Margaret

${photoMarkup('margaret_mcinnes')}`;

  const PORTRAITS = `# Thomas

:portraits:{of=thomas_kerr}`;

  const INDEX = `# Index of people

:family-index:`;

  // A married date beside a list of partners: a mistake the panel reports.
  const FINDING = `---
display: Thomas Kerr
birth: 1862~
partner: [margaret_mcinnes]
married: 1890-04-09
---

# Thomas Kerr

:family:`;
</script>

<Story
  name="Finished Chapter"
  loaders={[seedWith()]}
  parameters={{
    docs: {
      description: {
        story:
          "Produces docs/user/seed.html-recipes/Images/screen-family-finished.png: Ewen Kerr's chapter as a reader sees it, with his family panel and the named group photograph.",
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'ewen_kerr', '.fc-overlay');
  }}
>
  <App />
</Story>

<Story
  name="Record and Panel"
  loaders={[seedWith('margaret_mcinnes', 'Margaret McInnes', PANEL)]}
  parameters={{
    docs: {
      description: {
        story:
          "Produces docs/user/seed.html-recipes/Images/screen-family-panel.png: Margaret's record and the family panel drawn from it.",
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'margaret_mcinnes', '.family :is(a, li, dl, table)');
  }}
>
  <App />
</Story>

<Story
  name="Family Tree"
  loaders={[seedWith('trees', 'Trees', TREE)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-recipes/Images/screen-family-tree.png: two generations down from Ewen McInnes.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'trees', '.tree');
  }}
>
  <App />
</Story>

<Story
  name="Path Tree"
  loaders={[seedWith('cousins', 'Cousins', PATH)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-recipes/Images/screen-family-path.png: the path between the cousins Catherine McInnes and Ewen Kerr through their grandfather Ewen McInnes.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'cousins', '.tree');
  }}
>
  <App />
</Story>

<Story
  name="Lifelines"
  loaders={[seedWith('lifelines', 'Lifelines', LIFELINES)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-recipes/Images/screen-family-lifelines.png: Ewen, Isabella and their daughter Margaret on one time scale.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'lifelines', '.lifeline-row');
  }}
>
  <App />
</Story>

<Story
  name="Photograph with Faces"
  loaders={[seedWith('kerrs', 'Thomas and Margaret', PHOTO)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-recipes/Images/screen-family-photo.png: the 1890 portrait with Thomas and Margaret named.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'kerrs', '.fc-overlay');
  }}
>
  <App />
</Story>

<Story
  name="Photo Regions Panel"
  loaders={[seedWith(undefined, undefined, undefined, { plugins: ['photo-regions'] })]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-recipes/Images/screen-family-regions-panel.png: the Photo Regions panel open on the 1910 garden group, with its seven faces boxed and named. Needs the plugin built (plugins/photo-regions/dist).',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    const chapter = await canvas.findByTestId('spine-item-ewen_kerr', {}, { timeout: 60000 });
    await userEvent.click(chapter);
    const insert = await canvas.findByLabelText('Insert panel', {}, { timeout: 30000 });
    await userEvent.selectOptions(insert, 'regions');
    // The panel reopens the photograph with the boxes its library holds.
    await waitInFrames('.regions li:nth-child(7)');
    await waitInFrames('.canvas img');
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.dataset.shotReady = 'true';
  }}
>
  <App />
</Story>

<Story
  name="Portraits"
  loaders={[seedWith('portraits', 'Portraits', PORTRAITS)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-recipes/Images/screen-family-portraits.png: Thomas Kerr cropped from the 1890 and 1910 photographs.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'portraits', '.portrait-strip a.portrait');
  }}
>
  <App />
</Story>

<Story
  name="Index of People"
  loaders={[seedWith('people', 'Index of people', INDEX)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-recipes/Images/screen-family-index.png: everyone in the records, by surname.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'people', 'h3 + ul a');
  }}
>
  <App />
</Story>

<Story
  name="Record Problem"
  loaders={[seedWith('thomas_kerr', 'Thomas Kerr', FINDING)]}
  parameters={{
    docs: {
      description: {
        story:
          "Produces docs/user/seed.html-recipes/Images/screen-family-finding.png: a mistake in Thomas's record, listed at the top of his panel.",
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'thomas_kerr', '.family-findings');
  }}
>
  <App />
</Story>

<Story
  name="Page Transforms"
  loaders={[seedWith(undefined, undefined, undefined, { advanced: true })]}
  parameters={{
    docs: {
      description: {
        story:
          "Produces docs/user/seed.html-recipes/Images/screen-family-transforms.png: Settings › Content transforms, with the book's page transforms in order after adding Figures, Photo Regions and Family History.",
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await canvas.findByTestId('spine-item-about', {}, { timeout: 60000 });
    await userEvent.click(await canvas.findByTestId('nav-settings', {}, { timeout: 20000 }));
    await userEvent.click(await canvas.findByRole('button', { name: /Content transforms/ }));
    await waitInFrames('.dom-transform-list li:nth-child(4)');
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.dataset.shotReady = 'true';
  }}
>
  <App />
</Story>

<Story
  name="Chapter List"
  loaders={[seedWith()]}
  parameters={{
    docs: {
      description: {
        story:
          "Produces docs/user/seed.html-recipes/Images/screen-family-chapters.png: the chapter list, each person's chapter named with their id.",
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openChapter(canvas, userEvent, 'about', 'h1');
  }}
>
  <App />
</Story>
