/**
 * Tests for the list-of-figures sample extension's scripts. They run in the
 * transform iframe as `transformDOM` / `generateText`; here we load the source and
 * eval it the same way the sandbox does (wrap → return the function), then drive it
 * with mock ctx/DOM. Covers the storeImageReferences → SOURCE/data → listFigures
 * handoff that the generator feature is meant to showcase.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const dir = 'extensions/list-of-figures';
const load = (file: string, fnName: string) => {
  const src = readFileSync(`${dir}/${file}`, 'utf8');
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn ${fnName};`)();
};

const transformDOM = load('storeImageReferences.js', 'transformDOM') as (
  doc: Document,
  idref: string,
  ctx: unknown
) => Promise<Document>;

const generateText = load('listFigures.js', 'generateText') as (
  ctx: unknown,
  options: unknown
) => Promise<string>;

function parse(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
}

describe('storeImageReferences (DOM transform)', () => {
  it('records figcaption + alt captions to SOURCE/data/figures/<idref>.json', async () => {
    const doc = parse(`
      <figure><img src="Images/a.png" alt="alt A"/><figcaption>Caption A</figcaption></figure>
      <p><img src="Images/b.png" alt="alt B"/></p>
      <img alt="no source"/>
    `);
    const writes: Record<string, string> = {};
    const ctx = { writeSourceText: async (p: string, t: string) => void (writes[p] = t) };

    const result = await transformDOM(doc, 'chapter1', ctx);

    expect(result).toBe(doc); // document returned unchanged
    expect(JSON.parse(writes['SOURCE/data/figures/chapter1.json'])).toEqual([
      { src: 'Images/a.png', caption: 'Caption A' }, // figcaption wins over alt
      { src: 'Images/b.png', caption: 'alt B' }, // falls back to alt
      // the src-less img is skipped
    ]);
  });

  it('is a no-op without a writable ctx (does not throw)', async () => {
    const doc = parse('<img src="x.png"/>');
    await expect(transformDOM(doc, 'chapter1', {})).resolves.toBe(doc);
  });
});

describe('listFigures (generator)', () => {
  const manifest = [
    { id: 'nav', mediaType: 'application/xhtml+xml', properties: 'nav' },
    { id: 'chapter1', mediaType: 'application/xhtml+xml' },
    { id: 'chapter2', mediaType: 'application/xhtml+xml' },
    { id: 'cover-img', mediaType: 'image/png' },
  ];
  const data: Record<string, string> = {
    'SOURCE/data/figures/chapter1.json': JSON.stringify([{ src: 'Images/a.png', caption: 'Cap A' }]),
    'SOURCE/data/figures/chapter2.json': JSON.stringify([{ src: 'Images/b.png', caption: 'Cap B' }]),
  };
  const ctx = {
    manifest,
    readSourceText: async (path: string) => {
      if (path in data) return data[path];
      throw new Error(`not found: ${path}`);
    },
  };

  it('lists figures across chapters in manifest order, applying the template', async () => {
    const out = await generateText(ctx, { template: '<chapter>: <caption>, <source>' });
    expect(out).toBe('- chapter1: Cap A, Images/a.png\n- chapter2: Cap B, Images/b.png');
  });

  it('skips the nav doc and chapters with no recorded data', async () => {
    const partial = {
      manifest,
      readSourceText: async (path: string) => {
        if (path === 'SOURCE/data/figures/chapter1.json') return data[path];
        throw new Error('not found');
      },
    };
    const out = await generateText(partial, { template: '<caption>' });
    expect(out).toBe('- Cap A'); // only chapter1; nav excluded; chapter2 skipped
  });

  it('emits a thumbnail line when show_thumbnail is set', async () => {
    const out = await generateText(ctx, { template: '<caption>', show_thumbnail: true });
    expect(out).toBe('- Cap A\n  ![Cap A](Images/a.png)\n- Cap B\n  ![Cap B](Images/b.png)');
  });

  it('returns a helpful note when nothing has been recorded', async () => {
    const empty = { manifest, readSourceText: async () => Promise.reject(new Error('none')) };
    const out = await generateText(empty, {});
    expect(out).toContain('No figures found');
  });
});
