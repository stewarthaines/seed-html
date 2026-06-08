import { describe, it, expect, vi } from 'vitest';
import {
  loadExtensionCatalog,
  resolveExtensionFileUrl,
  isExtensionCatalogAvailable,
} from './extension-catalog.js';

const BASE = 'https://app.example.com/';

function jsonResponse(data: unknown): Response {
  return { ok: true, json: async () => data } as unknown as Response;
}

describe('extension-catalog', () => {
  it('parses and normalizes a manifest (coercing missing transform arrays)', async () => {
    const entries = [
      // domTransforms present, textTransforms missing → coerced to []
      { id: 'prism', name: 'Prism', scripts: ['prism.js'], domTransforms: ['transformPrism.js'] },
      // textTransforms present, domTransforms missing → coerced to []; keeps url
      {
        id: 'djot',
        name: 'Djot',
        url: 'https://x',
        scripts: ['djot.js'],
        textTransforms: ['transformDjot.js'],
      },
      // assets present (one well-formed, one malformed → dropped)
      {
        id: 'highlight',
        name: 'highlight.js',
        scripts: ['highlight.min.js'],
        assets: [
          { file: 'themes/default.css', target: 'Styles/highlight.css', media: 'text/css' },
          { file: 'broken.css' }, // missing target → dropped
        ],
      },
      { id: 'bad' }, // missing scripts → filtered
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const result = await loadExtensionCatalog({
      protocol: 'https:',
      baseUrl: BASE,
      fetch: fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith('https://app.example.com/extensions/manifest.json');
    expect(result).toEqual([
      {
        id: 'prism',
        name: 'Prism',
        description: undefined,
        url: undefined,
        license: undefined,
        scripts: ['prism.js'],
        domTransforms: ['transformPrism.js'],
        textTransforms: [],
        assets: [],
        licenses: [],
        chapter: undefined,
      },
      {
        id: 'djot',
        name: 'Djot',
        description: undefined,
        url: 'https://x',
        license: undefined,
        scripts: ['djot.js'],
        domTransforms: [],
        textTransforms: ['transformDjot.js'],
        assets: [],
        licenses: [],
        chapter: undefined,
      },
      {
        id: 'highlight',
        name: 'highlight.js',
        description: undefined,
        url: undefined,
        license: undefined,
        scripts: ['highlight.min.js'],
        domTransforms: [],
        textTransforms: [],
        assets: [
          {
            file: 'themes/default.css',
            target: 'Styles/highlight.css',
            media: 'text/css',
            license: undefined,
          },
        ],
        licenses: [],
        chapter: undefined,
      },
    ]);
  });

  it('flattens object-form scripts and aggregates per-file licenses (deduped)', async () => {
    const entries = [
      {
        id: 'abc2svg',
        name: 'abc2svg',
        license: 'LICENSE.txt',
        scripts: [
          'plain.js', // bare string still accepted
          { file: 'abc2svg-1.js', license: 'abc2svg-LICENSE.txt' },
          { file: 'js-yaml.min.js', license: 'LICENSE.txt' }, // shared with extension-wide → deduped
          { license: 'orphan.txt' }, // no file → dropped from scripts, license ignored too
        ],
        assets: [
          {
            file: 'fonts/music.woff',
            target: 'Fonts/music.woff',
            media: 'font/woff',
            license: 'font-LICENSE.txt',
          },
        ],
      },
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const [entry] = await loadExtensionCatalog({
      protocol: 'https:',
      baseUrl: BASE,
      fetch: fetchFn,
    });

    expect(entry.scripts).toEqual(['plain.js', 'abc2svg-1.js', 'js-yaml.min.js']);
    expect(entry.assets[0].license).toBe('font-LICENSE.txt');
    // Extension-wide first, then per-script (deduped), then per-asset. 'orphan.txt'
    // is ignored because its entry declares no file.
    expect(entry.licenses).toEqual(['LICENSE.txt', 'abc2svg-LICENSE.txt', 'font-LICENSE.txt']);
  });

  it('parses the optional sample chapter filename', async () => {
    const entries = [
      { id: 'djot', name: 'Djot', scripts: ['djot.js'], chapter: 'chapter.txt' },
      { id: 'prism', name: 'Prism', scripts: ['prism.js'] }, // no chapter
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const [djot, prism] = await loadExtensionCatalog({
      protocol: 'https:',
      baseUrl: BASE,
      fetch: fetchFn,
    });

    expect(djot.chapter).toBe('chapter.txt');
    expect(prism.chapter).toBeUndefined();
  });

  it('returns [] on file:// without fetching', async () => {
    const fetchFn = vi.fn();
    expect(
      await loadExtensionCatalog({ protocol: 'file:', baseUrl: BASE, fetch: fetchFn })
    ).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns [] on a non-array / malformed manifest', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ nope: true }));
    expect(
      await loadExtensionCatalog({ protocol: 'https:', baseUrl: BASE, fetch: fetchFn })
    ).toEqual([]);
  });

  it('returns [] when the fetch throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network');
    });
    expect(
      await loadExtensionCatalog({ protocol: 'https:', baseUrl: BASE, fetch: fetchFn })
    ).toEqual([]);
  });

  it('resolves a file URL under extensions/<id>/', () => {
    expect(resolveExtensionFileUrl('prism', 'prism.js', { baseUrl: BASE })).toBe(
      'https://app.example.com/extensions/prism/prism.js'
    );
  });

  it('reports availability by protocol', () => {
    expect(isExtensionCatalogAvailable({ protocol: 'https:' })).toBe(true);
    expect(isExtensionCatalogAvailable({ protocol: 'file:' })).toBe(false);
  });
});
