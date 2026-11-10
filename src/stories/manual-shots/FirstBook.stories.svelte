<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { waitFor } from 'storybook/test';
  import App from '../../App.svelte';
  import { advancedMode } from '../../lib/stores/advanced-mode';
  import { seedProject } from '../utils/seed-project';

  // Screenshot recipes for the Your First Book tutorial
  // (docs/user/seed.html-first-book/). Each story drives the real app to the
  // state one illustration shows and ends there; scripts/capture-manual-shots.js
  // photographs the element named in scripts/manual-shots.json. The tutorial
  // documents Basic Mode only.
  //
  // The seeded stories install the djot extension, so the book matches what
  // New book makes: djot chapters and the djot text transform.
  const { Story } = defineMeta({
    title: 'Manual Shots/First Book',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            "State recipes for Your First Book's screenshots. Regenerate the images with `npm run manual-shots -- first-book` (Storybook running), then review the docs diff.",
        },
      },
    },
    // Seeding with an extension fetches the dev-served /extensions/ catalog,
    // which the isolated test:stories Storybook doesn't serve (see STORYBOOK.md).
    tags: ['manual-shot', '!test'],
  });

  const TITLE = 'The Lighthouse Keeper';
  const AUTHOR = 'Alex Morgan';

  const STORM = [
    '# The Storm',
    '',
    'The wind rose after dark, and by midnight the waves were breaking over the rocks.',
    '',
    'Anna climbed the stairs to light the lamp.',
  ].join('\n');

  const MORNING = ['# Morning', '', 'By morning the sea was calm again.'].join('\n');

  /** Basic Mode, set through the store so it overrides an earlier advanced story. */
  async function basicMode() {
    advancedMode.current = false;
    return {};
  }

  /** The tutorial's book with one or both chapters written, opened on Write. */
  function seedTutorialBook(chapterCount) {
    return async () => {
      advancedMode.current = false;
      // Start from the default preview (Fill, no theme or text size): a device
      // or setting chosen in an earlier story persists in this browser.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('seedhtml_preview_') || key === 'seedhtml_spine_preview_collapsed') {
          localStorage.removeItem(key);
        }
      }
      const chapters = [{ title: 'chapter01', sourceText: STORM }];
      if (chapterCount > 1) chapters.push({ title: 'chapter02', sourceText: MORNING });
      const seeded = await seedProject({
        title: TITLE,
        author: AUTHOR,
        chapters,
        view: 'spine',
        extensions: ['djot'],
      });
      return { seeded };
    };
  }

  /** Wait for the seeded book to open and its first chapter to reach the preview. */
  async function openFirstChapter(canvas, userEvent) {
    const chapter = await canvas.findByTestId('spine-item-chapter01', {}, { timeout: 60000 });
    await userEvent.click(chapter);
    await waitFor(
      () => {
        const frame = document.querySelector('iframe.preview-iframe, .preview-pane iframe');
        const heading = frame?.contentDocument?.querySelector('h1');
        if (heading?.textContent?.trim() !== 'The Storm') throw new Error('preview not ready');
      },
      { timeout: 30000 }
    );
    unfocus();
  }

  /** Drop the focus ring a scripted click leaves behind; it isn't part of the picture. */
  function unfocus() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
</script>

<Story
  name="Books Screen"
  loaders={[basicMode]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-first-book/Images/screen-books.png: the Books screen a first-time user sees, with New book in the Start row.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    const books = await canvas.findByTestId('nav-workspace', {}, { timeout: 30000 });
    await userEvent.click(books);
    const createNew = await canvas.findByTestId('create-project', {}, { timeout: 20000 });
    await waitFor(
      () => {
        if (createNew.disabled) throw new Error('book list still loading');
      },
      { timeout: 20000 }
    );
    unfocus();
  }}
>
  <App />
</Story>

<Story
  name="New Book Dialog"
  loaders={[basicMode]}
  parameters={{
    docs: {
      description: {
        story:
          "Produces docs/user/seed.html-first-book/Images/screen-new-book.png: the New book window filled in with the tutorial's example title.",
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    const books = await canvas.findByTestId('nav-workspace', {}, { timeout: 30000 });
    await userEvent.click(books);
    const createNew = await canvas.findByTestId('create-project', {}, { timeout: 20000 });
    await waitFor(
      () => {
        if (createNew.disabled) throw new Error('book list still loading');
      },
      { timeout: 20000 }
    );
    await userEvent.click(createNew);

    // The title also drives the derived cover hue, keeping the shot stable.
    await canvas.findByRole('dialog', {}, { timeout: 20000 });
    const title = await canvas.findByLabelText(/Title/, {}, { timeout: 20000 });
    await userEvent.clear(title);
    await userEvent.type(title, TITLE);
    const author = await canvas.findByLabelText(/Author/, {}, { timeout: 20000 });
    await userEvent.clear(author);
    await userEvent.type(author, AUTHOR);
    unfocus();
  }}
>
  <App />
</Story>

<Story
  name="Write and Preview"
  loaders={[seedTutorialBook(1)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-first-book/Images/screen-write.png: the first chapter rewritten, with the editor on the left and the preview on the right.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openFirstChapter(canvas, userEvent);
  }}
>
  <App />
</Story>

<Story
  name="Two Chapters"
  loaders={[seedTutorialBook(2)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-first-book/Images/screen-chapters.png: the chapter list with two chapters and the Append Item button.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openFirstChapter(canvas, userEvent);
    await canvas.findByTestId('spine-item-chapter02', {}, { timeout: 20000 });
  }}
>
  <App />
</Story>

<Story
  name="Phone View"
  loaders={[seedTutorialBook(2)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-first-book/Images/screen-phone.png: the preview in the Phone view.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openFirstChapter(canvas, userEvent);
    const phone = await canvas.findByRole('button', { name: 'Phone' }, { timeout: 20000 });
    await userEvent.click(phone);
    unfocus();
  }}
>
  <App />
</Story>

<Story
  name="Packaged"
  loaders={[seedTutorialBook(2)]}
  parameters={{
    docs: {
      description: {
        story:
          'Produces docs/user/seed.html-first-book/Images/screen-download.png: the Share tab\'s "Download the EPUB" card after Package EPUB.',
      },
    },
  }}
  play={async ({ canvas, userEvent }) => {
    await openFirstChapter(canvas, userEvent);
    const packageButton = await canvas.findByTestId('package-epub', {}, { timeout: 15000 });
    await userEvent.click(packageButton);
    await canvas.findByRole('button', { name: 'Download' }, { timeout: 60000 });
    unfocus();
  }}
>
  <App />
</Story>
