/**
 * Tests for the Bricks extension's DOM transform: each bricks block becomes
 * the element bricks3d.js draws, naming only the parts libraries its parts
 * come from; the models a chapter defines are recorded at
 * SOURCE/data/bricks/<idref>.json and copied into the steps that use them;
 * problems are noted in the page. The scripts are loaded from the extension
 * sources, as the transform frame loads them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

type DomTransform = (doc: Document, idref: string, ctx: unknown) => Promise<Document>;

const jsyaml: Record<string, unknown> = {};
new Function('exports', 'module', readFileSync('extensions/bricks/js-yaml.min.js', 'utf8'))(
  jsyaml,
  {}
);
const transformBricks = new Function(
  'jsyaml',
  `${readFileSync('extensions/bricks/parseBricks.js', 'utf8')}
${readFileSync('extensions/bricks/transformBricks.js', 'utf8')}
return transformDOM;`
)(jsyaml) as DomTransform;

// The same transform where the frame can draw: bricks3d.js's setupStage and
// the canvas are stubs that record what they were given.
const drawn: { stage: Element; libraries: string[] }[] = [];
const transformWithStills = new Function(
  'jsyaml',
  'setupStage',
  'readLibrary',
  'mergeLibraries',
  'THREE',
  'OffscreenCanvas',
  `${readFileSync('extensions/bricks/parseBricks.js', 'utf8')}
${readFileSync('extensions/bricks/transformBricks.js', 'utf8')}
return transformDOM;`
)(
  jsyaml,
  (
    stage: Element,
    library: { hrefs: string[] },
    still: { done: (canvas: unknown, alt: string) => void }
  ) => {
    drawn.push({ stage, libraries: library.hrefs });
    still.done({ convertToBlob: async () => new Blob(['png'], { type: 'image/png' }) }, 'A J.');
  },
  (text: string) => ({ text }),
  (found: { text: string }[]) => ({
    hrefs: found.map(f => Object.keys(LIBRARIES).find(href => LIBRARIES[href] === f.text)),
  }),
  {},
  class OffscreenCanvas {}
) as DomTransform;

const library = (colours: string[], parts: string[]) =>
  [
    '0 LDraw.org Configuration File',
    ...colours.map((c, i) => `0 !COLOUR ${c} CODE ${i + 1} VALUE #000000 EDGE #333333`),
    ...parts.map(p => `0 FILE ${p}\n0 A part\n`),
  ].join('\n');

const LIBRARIES: Record<string, string> = {
  'Misc/bricks/core.mpd': library(
    ['Green', 'Yellow', 'White'],
    ['parts/3032.dat', 'parts/3005.dat', 'parts/s/3005s01.dat']
  ),
  'Misc/bricks/slopes.mpd': library([], ['parts/3040b.dat']),
  'Misc/bricks/minifig.mpd': library([], ['models/spaceman.ldr']),
};

function setup(records: Record<string, string> = {}) {
  const written: Record<string, string> = {};
  const ctx = {
    manifest: [
      { id: 'josh_o', href: 'Text/josh_o.xhtml', mediaType: 'application/xhtml+xml' },
      ...Object.keys(LIBRARIES).map((href, i) => ({
        id: `lib${i}`,
        href,
        mediaType: 'application/octet-stream',
      })),
      { id: 'stray', href: 'page05.mpd', mediaType: 'application/octet-stream' },
    ],
    spine: [{ idref: 'josh_o' }, { idref: 'josh' }, { idref: 'other' }],
    viewport: { width: 320, height: 460 } as { width: number; height: number } | null,
    readManifestText: async (href: string) => {
      if (!(href in LIBRARIES)) throw new Error(`not declared: ${href}`);
      return LIBRARIES[href];
    },
    readSourceText: async (path: string) => {
      if (path in written) return written[path];
      if (path in records) return records[path];
      throw new Error('not found');
    },
    writeSourceText: async (path: string, text: string) => {
      written[path] = text;
    },
  };
  return { ctx, written };
}

const block = (text: string) =>
  `<pre><code class="language-bricks">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`;

async function render(
  body: string,
  records?: Record<string, string>,
  transform: DomTransform = transformBricks,
  viewport: { width: number; height: number } | null = { width: 320, height: 460 }
) {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
  const { ctx, written } = setup(records);
  ctx.viewport = viewport;
  await transform(doc, 'josh_o', ctx);
  return { doc, written };
}

const libraries = (stage: Element) =>
  [...stage.querySelectorAll('span.bricks-library')].map(span => span.getAttribute('data-src'));

const JOSH_O = `---
model: letter-o
color: Yellow
from: [0, 0, 9]
---
built
3032 Green 0 -8 -1 turn 90
step
3005 0 -4 3
step
3040b 0 -5 6 turn 180
`;

describe('transformBricks', () => {
  it('replaces the block with the step the runtime draws', async () => {
    const { doc } = await render(block(JOSH_O));
    expect(doc.querySelector('pre')).toBeNull();
    const stage = doc.querySelector('div.bricks')!;
    expect(stage.getAttribute('data-width')).toBe('320');
    expect(stage.getAttribute('data-height')).toBe('460');
    expect(stage.getAttribute('data-step')).toBe('1');
    expect(stage.getAttribute('data-color')).toBe('Yellow');
    // core for the colours and its parts, slopes for 3040b; not the minifig set
    expect(libraries(stage)).toEqual(['../Misc/bricks/core.mpd', '../Misc/bricks/slopes.mpd']);
    expect(stage.querySelector('span.bricks-library')!.hasAttribute('hidden')).toBe(true);
    const parts = [...stage.querySelectorAll('p.bricks-set span.bricks-part')];
    expect(
      parts.map(span => [
        span.getAttribute('data-is'),
        span.getAttribute('data-color'),
        span.getAttribute('data-at'),
        span.getAttribute('data-turn'),
        span.getAttribute('data-from'),
        span.getAttribute('data-step'),
      ])
    ).toEqual([
      ['3032', 'Green', '0 -8 -1', '90', null, null],
      ['3005', null, '0 -4 3', null, '0 0 9', '1'],
      ['3040b', null, '0 -5 6', '180', '0 0 9', '2'],
    ]);
    expect(stage.querySelector('.bricks-notes')).toBeNull();
  });

  it('records the models a chapter defines, with a model line colour', async () => {
    const { written } = await render(
      block(JOSH_O) +
        block(
          '---\nspin: true\ncolor: White\n---\nmodel letter-b Yellow\n3005 0 0 0\nmodel letter-c\n3005 Green 2 0 0\n'
        )
    );
    expect(JSON.parse(written['SOURCE/data/bricks/josh_o.json'])).toEqual({
      'letter-o': {
        color: 'Yellow',
        parts: [
          { is: '3005', at: '0 -4 3' },
          { is: '3040b', at: '0 -5 6', turn: '180' },
        ],
      },
      'letter-b': { color: 'Yellow', parts: [{ is: '3005', at: '0 0 0' }] },
      'letter-c': { color: 'White', parts: [{ is: '3005', color: 'Green', at: '2 0 0' }] },
    });
  });

  it('gives a model section its colour for drawing', async () => {
    const { doc } = await render(block('---\nspin: 90\n---\nmodel letter-b Yellow\n3005 0 0 0\n'));
    const stage = doc.querySelector('div.bricks')!;
    expect(stage.getAttribute('data-spin')).toBe('90');
    expect(stage.hasAttribute('data-step')).toBe(false);
    expect(stage.querySelector('p.bricks-set')!.getAttribute('data-color')).toBe('Yellow');
  });

  it('numbers a turning page only when its step line gives a number', async () => {
    const numbered = await render(block('---\nspin: true\n---\nstep 5\n3005 Red 0 0 0\n'));
    expect(numbered.doc.querySelector('div.bricks')!.getAttribute('data-step')).toBe('5');
    const bare = await render(block('---\nspin: true\n---\nstep\n3005 Red 0 0 0\n'));
    expect(bare.doc.querySelector('div.bricks')!.hasAttribute('data-step')).toBe(false);
  });

  it('carries the style to the page', async () => {
    const { doc } = await render(block('---\nstyle: classic\n---\n3005 Red 0 0 0\n'));
    expect(doc.querySelector('div.bricks')!.getAttribute('data-style')).toBe('classic');
  });

  it('draws a parts page: every part the libraries offer, set by set, in a grid', async () => {
    const { doc } = await render(block('---\ninventory: library\n---\n'));
    const stage = doc.querySelector('div.bricks')!;
    expect(stage.getAttribute('data-inventory')).toBe('library');
    expect(stage.getAttribute('data-columns')).toBe('4');
    expect(stage.getAttribute('data-rows')).toBe('5');
    expect(stage.hasAttribute('data-step')).toBe(false);
    expect(
      [...stage.querySelectorAll('span.bricks-part')].map(s => s.getAttribute('data-is'))
    ).toEqual(['3005', '3032', '3040b', 'spaceman']);
    expect(libraries(stage)).toEqual([
      '../Misc/bricks/core.mpd',
      '../Misc/bricks/slopes.mpd',
      '../Misc/bricks/minifig.mpd',
    ]);
    expect(stage.querySelector('.bricks-notes')).toBeNull();
  });

  it('deals the parts out across the parts pages in reading order', async () => {
    const many = Array.from({ length: 45 }, (_, i) => `parts/${1000 + i}.dat`);
    LIBRARIES['Misc/bricks/many.mpd'] = library([], many);
    try {
      const two = block('---\ninventory: library\n---\n').repeat(2);
      // This chapter's two pages come first; a later chapter has a third.
      const shared = await render(two, {
        'SOURCE/text/josh.txt': '---\ninventory: library\n---\n',
      });
      const [first, second] = [...shared.doc.querySelectorAll('div.bricks')];
      const ids = (stage: Element) =>
        [...stage.querySelectorAll('span.bricks-part')].map(s => s.getAttribute('data-is'));
      expect(ids(first)).toHaveLength(20);
      expect(ids(first)[0]).toBe('3005');
      expect(ids(second)).toHaveLength(20);
      expect(second.querySelector('.bricks-notes')).toBeNull();
      // Alone, the second page is the last, and 9 parts are left over.
      const alone = await render(two);
      const last = [...alone.doc.querySelectorAll('div.bricks')][1];
      expect(last.querySelector('.bricks-notes')!.textContent).toBe(
        '9 more parts: add another parts page.'
      );
      // A page with nothing left to list says so.
      const spare = await render(block('---\ninventory: library\n---\n').repeat(4));
      expect([...spare.doc.querySelectorAll('div.bricks')][3].textContent).toContain(
        'Nothing left to list'
      );
    } finally {
      delete LIBRARIES['Misc/bricks/many.mpd'];
    }
  });

  it('records what a page counts towards the book’s parts list', async () => {
    const path = 'SOURCE/data/bricks/josh_o.counts.json';
    // By default the moving parts: not the built plate.
    const steps = await render(block(JOSH_O));
    expect(JSON.parse(steps.written[path])).toEqual({ '3005 yellow': 1, '3040b yellow': 1 });
    // count: all adds the built plate; count: none counts nothing.
    const all = await render(block(JOSH_O.replace('---\nbuilt', 'count: all\n---\nbuilt')));
    expect(JSON.parse(all.written[path])).toEqual({
      '3032 green': 1,
      '3005 yellow': 1,
      '3040b yellow': 1,
    });
    const none = await render(block(JOSH_O.replace('---\nbuilt', 'count: none\n---\nbuilt')));
    expect(path in none.written).toBe(false);
    // A model the book builds elsewhere is counted there; a minifig counts as one.
    const placed = await render(block('step\nletter-j Yellow 0 0 0\nspaceman White 0 2 0\n'), {
      'SOURCE/data/bricks/josh.json': '{"letter-j":{"parts":[{"is":"3005","at":"0 0 0"}]}}',
    });
    expect(JSON.parse(placed.written[path])).toEqual({ 'spaceman white': 1 });
  });

  it('clears the counts of a chapter that has lost its blocks', async () => {
    const path = 'SOURCE/data/bricks/josh_o.counts.json';
    const { written } = await render('<p>No bricks here.</p>', { [path]: '{"3005 yellow":2}' });
    expect(written[path]).toBe('null');
  });

  it('lists the book’s parts: every chapter’s counts added up, by colour', async () => {
    const page = block('---\ninventory: book\n---\n');
    const { doc } = await render(page + block(JOSH_O), {
      'SOURCE/data/bricks/josh.counts.json': '{"3005 yellow":3,"3032 green":1,"3040b white":2}',
    });
    const stage = doc.querySelector('div.bricks[data-inventory="book"]')!;
    const cells = [...stage.querySelectorAll('span.bricks-part')].map(
      s =>
        `${s.getAttribute('data-count')} ${s.getAttribute('data-color')} ${s.getAttribute('data-is')}`
    );
    expect(cells).toEqual(['1 green 3032', '2 white 3040b', '4 yellow 3005', '1 yellow 3040b']);
    expect(stage.hasAttribute('data-color')).toBe(false);
    expect(stage.querySelector('.bricks-notes')).toBeNull();
    const empty = await render(page);
    expect(empty.doc.querySelector('.bricks-notes')!.textContent).toBe(
      'Nothing counted yet: open the pages that build the book, then this one.'
    );
  });

  it('carries open to the page, and leaves it off when there is none', async () => {
    const opened = await render(
      block('---\nopen: 2\n---\nstep\n3005 Red 0 0 0\nstep\n3005 Red 0 0 3\n')
    );
    expect(opened.doc.querySelector('div.bricks')!.getAttribute('data-open')).toBe('2');
    const plain = await render(block('3005 Red 0 0 0\n'));
    expect(plain.doc.querySelector('div.bricks')!.hasAttribute('data-open')).toBe(false);
  });

  it('writes null once a chapter that had models has none, and leaves an unchanged record', async () => {
    const path = 'SOURCE/data/bricks/josh_o.json';
    const cleared = await render(block('3005 Yellow 0 0 0'), { [path]: '{"x":{"parts":[]}}' });
    expect(cleared.written[path]).toBe('null');
    const none = await render(block('3005 Yellow 0 0 0'));
    expect(path in none.written).toBe(false);
  });

  it('copies the models a step uses, and theirs, into the step', async () => {
    const { doc } = await render(block('---\ncolor: Yellow\n---\nletter-jo 0 0 0\n'), {
      'SOURCE/data/bricks/josh.json': JSON.stringify({
        'letter-jo': {
          parts: [
            { is: 'letter-j', at: '0 0 0' },
            { is: '3005', at: '2 0 0' },
          ],
        },
        'letter-j': { color: 'Yellow', parts: [{ is: 'spaceman', at: '0 0 0', turn: '90' }] },
      }),
    });
    const stage = doc.querySelector('div.bricks')!;
    const models = [...stage.querySelectorAll('div.bricks-model')];
    expect(models.map(m => [m.getAttribute('data-name'), m.getAttribute('data-color')])).toEqual([
      ['letter-jo', null],
      ['letter-j', 'Yellow'],
    ]);
    expect(models[1].querySelector('span.bricks-model-part')!.getAttribute('data-turn')).toBe('90');
    expect(libraries(stage)).toEqual(['../Misc/bricks/core.mpd', '../Misc/bricks/minifig.mpd']);
  });

  it('notes unknown parts and colours, parse notes and duplicate models', async () => {
    const { doc } = await render(
      block('---\nmodel: letter-j\ncolor: Mauve\n---\n9999 0 0 0\n3005 Plaid 0 0 0\n3005 0 0\n'),
      { 'SOURCE/data/bricks/other.json': JSON.stringify({ 'letter-j': { parts: [] } }) }
    );
    const notes = [...doc.querySelectorAll('.bricks-notes p')].map(p => p.textContent);
    expect(notes).toEqual([
      'Line 7: 3005 0 0: a part line is <part> [<colour>] <x> <y> <z> [turn <degrees>] [from <x> <y> <z>] [times <n> <x> <y> <z>]',
      "The header's color, Mauve, is not an LDraw colour.",
      "Line 5: 9999 is not in the parts libraries or the book's models.",
      'Line 6: Plaid is not an LDraw colour.',
      'The model letter-j is also defined in other.',
    ]);
  });

  it('notes a reflowable book and draws no still there', async () => {
    const { doc } = await render(block(JOSH_O), undefined, transformWithStills, null);
    const stage = doc.querySelector('div.bricks')!;
    expect(stage.hasAttribute('data-width')).toBe(false);
    expect(stage.querySelector('.bricks-notes')!.textContent).toBe(
      'Bricks pages need a fixed-layout book; this one is reflowable.'
    );
    expect(stage.querySelector('img')).toBeNull();
  });

  it('adds no still where the frame cannot draw', async () => {
    const { doc } = await render(block(JOSH_O));
    expect(doc.querySelector('img')).toBeNull();
  });

  it('draws each step without notes a still, first in the step', async () => {
    drawn.length = 0;
    const { doc } = await render(
      block(JOSH_O) + block('3005 Plaid 0 0 0'),
      undefined,
      transformWithStills
    );
    const [first, second] = [...doc.querySelectorAll('div.bricks')];
    const img = first.firstElementChild!;
    expect(img.localName).toBe('img');
    expect(img.getAttribute('class')).toBe('bricks-still');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(img.getAttribute('alt')).toBe('A J.');
    // the step it drew, from the libraries the step names
    expect(drawn).toHaveLength(1);
    expect(drawn[0].stage).toBe(first);
    expect(drawn[0].libraries).toEqual(['Misc/bricks/core.mpd', 'Misc/bricks/slopes.mpd']);
    expect(second.querySelector('img')).toBeNull();
  });

  it('finds Textile blocks', async () => {
    const { doc } = await render('<pre class="bricks">3005 Yellow 0 0 0</pre>');
    expect(doc.querySelector('div.bricks span.bricks-part')).not.toBeNull();
  });
});
