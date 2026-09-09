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
      { id: 'bad' }, // missing name → filtered
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
        generators: [],
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
        generators: [],
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
        generators: [],
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

  it('normalizes generators (id/name/script required; options + license aggregated)', async () => {
    const entries = [
      {
        id: 'djot-figures',
        name: 'List of Figures',
        scripts: ['djot.js'],
        generators: [
          {
            id: 'figures',
            name: 'List of Figures',
            script: 'listFigures.js',
            license: 'figures-LICENSE.txt',
            options: [
              { type: 'string', name: 'template', label: 'Template', placeholder: '<caption>' },
              { type: 'boolean', name: 'show_thumbnail', label: 'Show thumbnail', default: false },
              {
                type: 'select',
                name: 'style',
                label: 'Style',
                options: [
                  { value: 'plain', label: 'Plain' },
                  { value: 'bad' }, // missing label → dropped
                ],
              },
              { name: 'noLabel' }, // missing label → dropped
              { type: 'string', label: 'No name' }, // missing name → dropped
            ],
          },
          { id: 'incomplete', name: 'Incomplete' }, // missing script → dropped
        ],
      },
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const [entry] = await loadExtensionCatalog({ protocol: 'https:', baseUrl: BASE, fetch: fetchFn });

    expect(entry.generators).toEqual([
      {
        id: 'figures',
        name: 'List of Figures',
        description: undefined,
        script: 'listFigures.js',
        license: 'figures-LICENSE.txt',
        options: [
          {
            type: 'string',
            name: 'template',
            label: 'Template',
            placeholder: '<caption>',
            default: undefined,
            options: undefined,
          },
          {
            type: 'boolean',
            name: 'show_thumbnail',
            label: 'Show thumbnail',
            placeholder: undefined,
            default: false,
            options: undefined,
          },
          {
            type: 'select',
            name: 'style',
            label: 'Style',
            placeholder: undefined,
            default: undefined,
            options: [{ value: 'plain', label: 'Plain' }],
          },
        ],
      },
    ]);
    // The generator's license is bundled alongside the extension's.
    expect(entry.licenses).toContain('figures-LICENSE.txt');
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

  it('parses the optional previewHead fragment filename', async () => {
    const entries = [
      { id: 'print-index', name: 'Print Index', domTransforms: ['x.js'], previewHead: 'capture.head.xml' },
      { id: 'prism', name: 'Prism', scripts: ['prism.js'] }, // no previewHead
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const [printIndex, prism] = await loadExtensionCatalog({
      protocol: 'https:',
      baseUrl: BASE,
      fetch: fetchFn,
    });

    expect(printIndex.previewHead).toBe('capture.head.xml');
    expect(prism.previewHead).toBeUndefined();
  });

  it('keeps per-script licenses a manifest has already aggregated into licenses', async () => {
    // The manifest builders flatten { file, license } scripts to filenames and
    // put their licenses in `licenses`; the entry must not lose them.
    const entries = [
      {
        id: 'family-history',
        name: 'Family',
        license: 'LICENSE.txt',
        scripts: ['json-schema.js'],
        domTransforms: ['x.js'],
        licenses: ['LICENSE.txt', 'LICENSE-json-schema.txt'],
      },
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));
    const [family] = await loadExtensionCatalog({ protocol: 'https:', baseUrl: BASE, fetch: fetchFn });
    expect(family.licenses).toEqual(['LICENSE.txt', 'LICENSE-json-schema.txt']);
  });

  it('parses the optional extra data files list', async () => {
    const entries = [
      { id: 'family-history', name: 'Family', domTransforms: ['x.js'], files: ['person.schema.json'] },
      { id: 'prism', name: 'Prism', scripts: ['prism.js'], files: [] },
      { id: 'bad', name: 'Bad', scripts: ['b.js'], files: ['ok.json', 3] },
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const [family, prism, bad] = await loadExtensionCatalog({
      protocol: 'https:',
      baseUrl: BASE,
      fetch: fetchFn,
    });

    expect(family.files).toEqual(['person.schema.json']);
    expect(prism.files).toBeUndefined();
    expect(bad.files).toBeUndefined();
  });

  it('parses the optional insertion templates (dropping non-string/empty keys)', async () => {
    const entries = [
      {
        id: 'djot',
        name: 'Djot',
        scripts: ['djot.js'],
        templates: {
          image: '![<alt>](<href>)',
          video: '`<video src="<href>"></video>`{=html}',
          audioClip: ':clip[<label>]{src="<href>" begin="<begin>" end="<end>"}',
          bogus: 'ignored',
        },
      },
      { id: 'weird', name: 'Weird', scripts: ['w.js'], templates: { image: 42, video: '' } },
      { id: 'prism', name: 'Prism', scripts: ['prism.js'] }, // no templates
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const [djot, weird, prism] = await loadExtensionCatalog({
      protocol: 'https:',
      baseUrl: BASE,
      fetch: fetchFn,
    });

    expect(djot.templates).toEqual({
      image: '![<alt>](<href>)',
      video: '`<video src="<href>"></video>`{=html}',
      audioClip: ':clip[<label>]{src="<href>" begin="<begin>" end="<end>"}',
    });
    // All keys invalid → the whole field collapses to undefined.
    expect(weird.templates).toBeUndefined();
    expect(prism.templates).toBeUndefined();
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
