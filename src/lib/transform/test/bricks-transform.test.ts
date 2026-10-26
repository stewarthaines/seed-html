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

async function render(body: string, records?: Record<string, string>) {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
  const { ctx, written } = setup(records);
  await transformBricks(doc, 'josh_o', ctx);
  return { doc, written };
}

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
    expect(stage.getAttribute('data-step')).toBe('1');
    expect(stage.getAttribute('data-color')).toBe('Yellow');
    // core for the colours and its parts, slopes for 3040b; not the minifig set
    expect(stage.getAttribute('data-src')).toBe(
      '../Misc/bricks/core.mpd ../Misc/bricks/slopes.mpd'
    );
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
    expect(stage.querySelector('p.bricks-set')!.getAttribute('data-color')).toBe('Yellow');
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
    expect(stage.getAttribute('data-src')).toBe(
      '../Misc/bricks/core.mpd ../Misc/bricks/minifig.mpd'
    );
  });

  it('notes unknown parts and colours, parse notes and duplicate models', async () => {
    const { doc } = await render(
      block('---\nmodel: letter-j\ncolor: Mauve\n---\n9999 0 0 0\n3005 Plaid 0 0 0\n3005 0 0\n'),
      { 'SOURCE/data/bricks/other.json': JSON.stringify({ 'letter-j': { parts: [] } }) }
    );
    const notes = [...doc.querySelectorAll('.bricks-notes p')].map(p => p.textContent);
    expect(notes).toEqual([
      'Line 7: 3005 0 0: a part line is <part> [<colour>] <x> <y> <z> [turn <degrees>] [from <x> <y> <z>]',
      "The header's color, Mauve, is not an LDraw colour.",
      "Line 5: 9999 is not in the parts libraries or the book's models.",
      'Line 6: Plaid is not an LDraw colour.',
      'The model letter-j is also defined in other.',
    ]);
  });

  it('finds Textile blocks', async () => {
    const { doc } = await render('<pre class="bricks">3005 Yellow 0 0 0</pre>');
    expect(doc.querySelector('div.bricks span.bricks-part')).not.toBeNull();
  });
});
