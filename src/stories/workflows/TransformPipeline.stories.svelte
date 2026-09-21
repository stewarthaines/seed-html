<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { within, waitFor, fireEvent } from 'storybook/test';
  import App from '../../App.svelte';
  import { seedProject } from '../utils/seed-project';
  import { advancedMode } from '../../lib/stores/advanced-mode';
  import transformTextJS from '../../assets/universal/transformText.js?raw';

  // Guards the transform-pipeline invalidation contract: a settings change
  // (removing a DOM transform via the Settings form) must be picked up by the
  // next preview render. Today the pipeline reloads scripts every render, which
  // makes this trivially true; this story pins the behavior so a script-caching
  // rework can't ship a stale-cache regression. Assertions read the persisted
  // chapter XHTML through the seeded storage handle — the same render output
  // the preview shows and the packaged EPUB ships — rather than piercing the
  // preview iframe.
  const { Story } = defineMeta({
    title: 'Workflows/Transform Pipeline',
    component: App,
    parameters: {
      layout: 'fullscreen',
      docs: {
        description: {
          component:
            'Workflow story for the transform pipeline settings: seeds a project whose DOM transform stamps a marker into every render, verifies the marker persists, removes the transform via Settings, and verifies the next render drops it.',
        },
      },
    },
  });

  const MARKER = 'MARKER-DOM-TRANSFORM-APPLIED';
  const MARKER_TRANSFORM_PATH = 'SOURCE/scripts/transformMarker.js';

  // A DOM transform with an unmistakable, greppable effect on the output.
  const MARKER_TRANSFORM = `
function transformDOM(htmlDocument) {
  const marker = htmlDocument.createElement('p');
  marker.setAttribute('data-storybook-marker', 'applied');
  marker.textContent = '${MARKER}';
  htmlDocument.body.appendChild(marker);
  return htmlDocument;
}
`;

  /**
   * Poll a stored text file until its content satisfies the predicate.
   * Renders persist asynchronously (300ms debounce + engine round-trip), so
   * every storage assertion in this story goes through here.
   */
  async function pollFile(seeded, path, predicate, timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    let last = '';
    for (;;) {
      try {
        last = await seeded.fileStorage.readTextFile(seeded.workspaceId, path);
        if (predicate(last)) return last;
      } catch {
        // not written yet
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting on ${path}; last content (truncated):\n${last.slice(0, 500)}`
        );
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  /** Resolve a chapter's persisted XHTML path from the seeded workspace. */
  function chapterPath(seeded, chapterId) {
    const item = seeded.workspace.opf.manifest.find(entry => entry.id === chapterId);
    const basePath = seeded.workspace.pathInfo.basePath;
    if (!item) throw new Error(`chapter '${chapterId}' not in the seeded manifest`);
    return !basePath || item.href.startsWith(`${basePath}/`)
      ? item.href
      : `${basePath}/${item.href}`;
  }

  /**
   * Shared loader: a seeded project whose pipeline runs the universal text
   * transform plus the marker DOM transform. Wired by hand because the
   * seedProject `extensions` option needs the dev-served /extensions/ catalog,
   * which test:stories does not provide. Advanced Mode is forced on (the EPUB
   * Settings section and the editor's transform-file entries need it) — set
   * through the store, not raw localStorage, because the persisted store reads
   * its value at module load, before loaders run.
   */
  async function seedMarkerProject(title) {
    advancedMode.current = true;

    const seeded = await seedProject({ title, author: 'Storybook', view: 'spine' });

    const { fileStorage, workspaceId } = seeded;
    await fileStorage.writeTextFile(
      workspaceId,
      'SOURCE/scripts/transformText.js',
      transformTextJS
    );
    await fileStorage.writeTextFile(workspaceId, MARKER_TRANSFORM_PATH, MARKER_TRANSFORM);
    await fileStorage.writeTextFile(workspaceId, 'SOURCE/preview/head.xml', '');
    await fileStorage.writeTextFile(
      workspaceId,
      'SOURCE/settings.json',
      JSON.stringify(
        {
          version: '1.0.0',
          text_transform: 'SOURCE/scripts/transformText.js',
          dom_transforms: [MARKER_TRANSFORM_PATH],
          preview: {
            autoUpdate: { responsive: true, device: true, pdf: false },
            head: 'preview/head.xml',
            includeHead: { responsive: true, device: false, pdf: false },
          },
        },
        null,
        2
      )
    );

    return seeded;
  }
</script>

<Story
  name="Removing a DOM transform takes effect on the next render"
  loaders={[async () => ({ seeded: await seedMarkerProject('Transform Pipeline Book') })]}
  parameters={{
    docs: {
      description: {
        story:
          'Opens a chapter and waits for the marker transform to stamp the persisted XHTML, removes that transform in Settings → EPUB Settings, then edits the chapter and asserts the freshly persisted XHTML no longer carries the marker — i.e. the render pipeline picked up the settings change.',
      },
    },
  }}
  play={async ({ canvas, userEvent, loaded }) => {
    const { seeded } = loaded;
    const ch1Path = chapterPath(seeded, 'chapter01');
    try {
      // The app boots and restores the seeded workspace — wait for its title.
      await canvas.findByText('Transform Pipeline Book', {}, { timeout: 60000 });

      // Open the first chapter; its render must run BOTH transforms and
      // persist the marker into the chapter's XHTML.
      const chapter = await canvas.findByTestId('spine-item-chapter01', {}, { timeout: 60000 });
      await userEvent.click(chapter);
      await pollFile(seeded, ch1Path, content => content.includes(MARKER));

      // Settings → EPUB Settings (disclosure, collapsed by default) → remove
      // the marker transform from the DOM Transforms list.
      await userEvent.click(await canvas.findByTestId('nav-settings', {}, { timeout: 30000 }));
      await userEvent.click(await canvas.findByText('EPUB Settings', {}, { timeout: 30000 }));
      const row = (await canvas.findByText('transformMarker.js', {}, { timeout: 30000 })).closest(
        'li'
      );
      if (!row) throw new Error('transformMarker.js row not found in the DOM Transforms list');
      await userEvent.click(within(row).getByRole('button', { name: 'Remove' }));

      // The save is optimistic — wait until it actually reaches settings.json
      // before rendering again.
      await pollFile(
        seeded,
        'SOURCE/settings.json',
        content => !JSON.parse(content).dom_transforms.includes(MARKER_TRANSFORM_PATH)
      );

      // Back to the chapter (the chapter column lives under Write); type a
      // sentinel so a fresh render persists.
      await userEvent.click(await canvas.findByTestId('nav-write', {}, { timeout: 30000 }));
      await userEvent.click(
        await canvas.findByTestId('spine-item-chapter01', {}, { timeout: 30000 })
      );
      // Advanced Mode shows a chapter-title textbox too — target the content
      // pane by its accessible name.
      const editor = await canvas.findByRole(
        'textbox',
        { name: 'Pane 1 content' },
        { timeout: 60000 }
      );
      await userEvent.click(editor);
      await userEvent.keyboard('{End}');
      await userEvent.type(editor, '\n\nSentinel line after removing the transform.');

      // The render that persisted the sentinel ran AFTER the settings change,
      // so it must no longer carry the marker.
      const finalXhtml = await pollFile(seeded, ch1Path, content =>
        content.includes('Sentinel line after removing the transform.')
      );
      if (finalXhtml.includes(MARKER)) {
        throw new Error(
          'Stale transform scripts: the render after removing the DOM transform still applied it.'
        );
      }
    } finally {
      // Don't leak Advanced Mode into other stories sharing this browser.
      advancedMode.current = false;
    }
  }}
>
  <App />
</Story>

<Story
  name="Editing a transform script live takes effect on the next render"
  loaders={[async () => ({ seeded: await seedMarkerProject('Transform Live Edit Book') })]}
  parameters={{
    docs: {
      description: {
        story:
          'The iterate-on-a-transform workflow: opens a chapter, switches the editor pane to the DOM transform script via the file picker, rewrites it in place, and asserts the next persisted render carries the new script’s output. The settings list never changes here, so this passes only if saving the script invalidates the pipeline’s script cache.',
      },
    },
  }}
  play={async ({ canvas, userEvent, loaded }) => {
    const { seeded } = loaded;
    const ch1Path = chapterPath(seeded, 'chapter01');
    const MARKER_V2 = 'MARKER-DOM-TRANSFORM-V2';
    try {
      await canvas.findByText('Transform Live Edit Book', {}, { timeout: 60000 });

      // Open the chapter and wait for the v1 marker to reach the persisted XHTML.
      const chapter = await canvas.findByTestId('spine-item-chapter01', {}, { timeout: 60000 });
      await userEvent.click(chapter);
      await pollFile(seeded, ch1Path, content => content.includes(MARKER));

      // Switch pane 1 to the transform script via the files menu (transform
      // entries are Advanced-mode-only, forced on in the loader).
      await userEvent.click(
        await canvas.findByRole('button', { name: 'Also in this chapter' }, { timeout: 30000 })
      );
      await userEvent.click(
        await canvas.findByRole('menuitemradio', { name: 'transformMarker.js' }, { timeout: 30000 })
      );

      // The pane loads the script from storage; wait until it's in the editor.
      const editor = await canvas.findByRole(
        'textbox',
        { name: 'Pane 1 content' },
        { timeout: 30000 }
      );
      await waitFor(
        () => {
          if (!editor.value.includes('transformDOM')) {
            throw new Error('transform script not loaded into the pane yet');
          }
        },
        { timeout: 30000 }
      );

      // Rewrite the script in place (same path, same settings list — only the
      // content changes). fireEvent.input rather than keyboard typing: the
      // script contains {} which userEvent.type treats as key syntax.
      await fireEvent.input(editor, {
        target: { value: MARKER_TRANSFORM.replace(MARKER, MARKER_V2) },
      });

      // The auto-save must invalidate the script cache and re-render: the v2
      // marker reaches the persisted chapter, and v1's is gone from it.
      const finalXhtml = await pollFile(seeded, ch1Path, content => content.includes(MARKER_V2));
      if (finalXhtml.includes(MARKER)) {
        throw new Error(
          'Stale transform scripts: the render after editing the script still used the old version.'
        );
      }
    } finally {
      advancedMode.current = false;
    }
  }}
>
  <App />
</Story>
