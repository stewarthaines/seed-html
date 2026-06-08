import { describe, it, expect, vi } from 'vitest';
import type { FileStorageAPI } from '../storage/index.js';
import { ExtensionManager } from './extension-manager.js';
import type { ExtensionCatalogEntry } from './extension-catalog.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

function makeFileStorage(initial: Record<string, string> = {}) {
  const files = new Map<string, Uint8Array>();
  for (const [k, v] of Object.entries(initial)) files.set(k, enc.encode(v));

  const api = {
    writeFile: vi.fn(async (_ws: string, path: string, content: ArrayBuffer | Uint8Array) => {
      files.set(path, content instanceof Uint8Array ? content : new Uint8Array(content));
    }),
    readFile: vi.fn(async (_ws: string, path: string) => {
      const b = files.get(path);
      if (!b) throw new Error(`not found: ${path}`);
      return b.slice().buffer;
    }),
    readTextFile: vi.fn(async (_ws: string, path: string) => {
      const b = files.get(path);
      if (!b) throw new Error(`not found: ${path}`);
      return dec.decode(b);
    }),
    listFiles: vi.fn(async () => [...files.keys()]),
    fileExists: vi.fn(async (_ws: string, path: string) => files.has(path)),
  } as unknown as FileStorageAPI;

  return { api, files };
}

describe('ExtensionManager.importCatalogExtension', () => {
  it('fetches and writes the lib, transforms, license and extension.json', async () => {
    const { api, files } = makeFileStorage();
    const entry: ExtensionCatalogEntry = {
      id: 'prism',
      name: 'Prism',
      license: 'LICENSE.txt',
      scripts: ['prism.js'],
      domTransforms: ['transformPrism.js'],
      textTransforms: [],
      assets: [],
      licenses: ['LICENSE.txt'],
    };
    const bodies: Record<string, string> = {
      'prism.js': 'PRISM_LIB',
      'transformPrism.js': 'TRANSFORM',
      'LICENSE.txt': 'LICENSE',
      'extension.json': '{"id":"prism"}',
    };
    const fetchImpl = vi.fn(async (url: string) => {
      const file = url.split('/').pop() as string;
      return { ok: true, arrayBuffer: async () => enc.encode(bodies[file]).buffer } as Response;
    });

    const mgr = new ExtensionManager(api);
    const written = await mgr.importCatalogExtension('ws', entry, {
      fetch: fetchImpl,
      baseUrl: 'https://x/',
    });

    expect(dec.decode(files.get('SOURCE/extensions/prism/prism.js')!)).toBe('PRISM_LIB');
    expect(dec.decode(files.get('SOURCE/extensions/prism/transformPrism.js')!)).toBe('TRANSFORM');
    expect(files.has('SOURCE/extensions/prism/LICENSE.txt')).toBe(true);
    expect(files.has('SOURCE/extensions/prism/extension.json')).toBe(true);
    // No assets declared → none written, none returned.
    expect(written).toEqual([]);
  });

  it('writes EPUB assets to OEBPS/<target> and returns them for manifest registration', async () => {
    const { api, files } = makeFileStorage();
    const entry: ExtensionCatalogEntry = {
      id: 'highlight',
      name: 'highlight.js',
      scripts: ['highlight.min.js'],
      domTransforms: ['transformHighlight.js'],
      textTransforms: [],
      assets: [{ file: 'themes/default.css', target: 'Styles/highlight.css', media: 'text/css' }],
      licenses: [],
    };
    const bodies: Record<string, string> = {
      'highlight.min.js': 'HLJS',
      'transformHighlight.js': 'TRANSFORM',
      'extension.json': '{"id":"highlight"}',
      'default.css': 'CSS',
    };
    const fetchImpl = vi.fn(async (url: string) => {
      const file = url.split('/').pop() as string;
      return { ok: true, arrayBuffer: async () => enc.encode(bodies[file]).buffer } as Response;
    });

    const mgr = new ExtensionManager(api);
    const written = await mgr.importCatalogExtension('ws', entry, {
      fetch: fetchImpl,
      baseUrl: 'https://x/',
    });

    // The asset is fetched at extensions/<id>/<file> (preserving subdirs) ...
    expect(fetchImpl).toHaveBeenCalledWith('https://x/extensions/highlight/themes/default.css');
    // ... written into the EPUB output, not SOURCE/ ...
    expect(dec.decode(files.get('OEBPS/Styles/highlight.css')!)).toBe('CSS');
    // ... and reported back for manifest registration.
    expect(written).toEqual([{ target: 'Styles/highlight.css', media: 'text/css' }]);
  });

  it('bundles every per-file license into SOURCE/extensions/<id>/ (deduped)', async () => {
    const { api, files } = makeFileStorage();
    // Two scripts + an asset, each with its own license, plus a shared extension-wide one.
    const entry: ExtensionCatalogEntry = {
      id: 'abc2svg',
      name: 'abc2svg',
      license: 'LICENSE.txt',
      scripts: ['abc2svg-1.js', 'js-yaml.min.js'],
      domTransforms: ['transformAbc.js'],
      textTransforms: [],
      assets: [{ file: 'fonts/music.woff', target: 'Fonts/music.woff', media: 'font/woff' }],
      licenses: ['LICENSE.txt', 'abc2svg-LICENSE.txt', 'js-yaml-LICENSE.txt', 'font-LICENSE.txt'],
    };
    const fetchImpl = vi.fn(async (url: string) => {
      const file = url.split('/').pop() as string;
      return { ok: true, arrayBuffer: async () => enc.encode(file).buffer } as Response;
    });

    const mgr = new ExtensionManager(api);
    const written = await mgr.importCatalogExtension('ws', entry, {
      fetch: fetchImpl,
      baseUrl: 'https://x/',
    });

    // Every declared license lands in SOURCE/ (not OEBPS/).
    for (const lic of entry.licenses) {
      expect(files.has(`SOURCE/extensions/abc2svg/${lic}`)).toBe(true);
    }
    // The font asset still goes to OEBPS/; its license is bundled to SOURCE/ above.
    expect(files.has('OEBPS/Fonts/music.woff')).toBe(true);
    expect(files.has('OEBPS/font-LICENSE.txt')).toBe(false);
    expect(written).toEqual([{ target: 'Fonts/music.woff', media: 'font/woff' }]);
    // Each unique file fetched once (LICENSE.txt not double-fetched).
    const licenseFetches = fetchImpl.mock.calls.filter(([u]) =>
      String(u).endsWith('/LICENSE.txt')
    );
    expect(licenseFetches).toHaveLength(1);
  });

  it('rejects an asset target that escapes OEBPS/', async () => {
    const { api } = makeFileStorage();
    const entry: ExtensionCatalogEntry = {
      id: 'evil',
      name: 'Evil',
      scripts: ['lib.js'],
      domTransforms: [],
      textTransforms: [],
      assets: [{ file: 'x.css', target: '../escape.css' }],
      licenses: [],
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => enc.encode('x').buffer,
    })) as unknown as typeof fetch;

    const mgr = new ExtensionManager(api);
    await expect(
      mgr.importCatalogExtension('ws', entry, { fetch: fetchImpl, baseUrl: 'https://x/' })
    ).rejects.toThrow(/Unsafe asset target/);
  });
});

describe('ExtensionManager.getAvailableTransforms', () => {
  it('uses extension.json domTransforms[] (not the lib) and dedupes; includes loose scripts', async () => {
    const { api } = makeFileStorage({
      'SOURCE/scripts/transformDom.js': 'x',
      'SOURCE/scripts/transformText.js': 'x',
      'SOURCE/extensions/prism/prism.js': 'lib',
      'SOURCE/extensions/prism/transformPrism.js': 't',
      'SOURCE/extensions/prism/extension.json': JSON.stringify({
        scripts: ['prism.js'],
        domTransforms: ['transformPrism.js'],
        textTransforms: [],
      }),
    });

    const mgr = new ExtensionManager(api);
    const opts = await mgr.getAvailableTransforms('ws');
    const paths = opts.map(o => o.path);

    // The extension transform is offered exactly once, grouped under the extension id.
    expect(paths.filter(p => p === 'SOURCE/extensions/prism/transformPrism.js')).toHaveLength(1);
    expect(
      opts.find(o => o.path === 'SOURCE/extensions/prism/transformPrism.js')!.extensionName
    ).toBe('prism');
    // The lib is never offered as a transform.
    expect(paths).not.toContain('SOURCE/extensions/prism/prism.js');
    // Loose project scripts are still found.
    expect(paths).toContain('SOURCE/scripts/transformDom.js');
    expect(paths).toContain('SOURCE/scripts/transformText.js');
  });

  it('does not offer an extension text transform (djot) as a DOM transform', async () => {
    const { api } = makeFileStorage({
      'SOURCE/extensions/djot/djot.js': 'lib',
      'SOURCE/extensions/djot/transformDjot.js': 't',
      'SOURCE/extensions/djot/extension.json': JSON.stringify({
        scripts: ['djot.js'],
        domTransforms: [],
        textTransforms: ['transformDjot.js'],
      }),
    });

    const mgr = new ExtensionManager(api);
    const paths = (await mgr.getAvailableTransforms('ws')).map(o => o.path);
    expect(paths).not.toContain('SOURCE/extensions/djot/transformDjot.js');
  });

  it('falls back to the transform-name heuristic for an extension without a manifest', async () => {
    const { api } = makeFileStorage({
      'SOURCE/extensions/legacy/lib.js': 'lib',
      'SOURCE/extensions/legacy/transformLegacy.js': 't',
    });

    const mgr = new ExtensionManager(api);
    const paths = (await mgr.getAvailableTransforms('ws')).map(o => o.path);

    expect(paths).toContain('SOURCE/extensions/legacy/transformLegacy.js');
    expect(paths).not.toContain('SOURCE/extensions/legacy/lib.js');
  });
});

describe('ExtensionManager.getAvailableTextTransforms', () => {
  it('returns the default text transform plus extension textTransforms', async () => {
    const { api } = makeFileStorage({
      'SOURCE/scripts/transformText.js': 'x',
      'SOURCE/extensions/djot/djot.js': 'lib',
      'SOURCE/extensions/djot/transformDjot.js': 't',
      'SOURCE/extensions/djot/extension.json': JSON.stringify({
        scripts: ['djot.js'],
        domTransforms: [],
        textTransforms: ['transformDjot.js'],
      }),
    });

    const mgr = new ExtensionManager(api);
    const opts = await mgr.getAvailableTextTransforms('ws');
    const paths = opts.map(o => o.path);

    expect(paths).toContain('SOURCE/scripts/transformText.js');
    expect(paths).toContain('SOURCE/extensions/djot/transformDjot.js');
    expect(
      opts.find(o => o.path === 'SOURCE/extensions/djot/transformDjot.js')!.extensionName
    ).toBe('djot');
    // The lib is not a text transform.
    expect(paths).not.toContain('SOURCE/extensions/djot/djot.js');
  });
});
