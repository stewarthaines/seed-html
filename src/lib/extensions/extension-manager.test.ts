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
    await mgr.importCatalogExtension('ws', entry, { fetch: fetchImpl, baseUrl: 'https://x/' });

    expect(dec.decode(files.get('SOURCE/extensions/prism/prism.js')!)).toBe('PRISM_LIB');
    expect(dec.decode(files.get('SOURCE/extensions/prism/transformPrism.js')!)).toBe('TRANSFORM');
    expect(files.has('SOURCE/extensions/prism/LICENSE.txt')).toBe(true);
    expect(files.has('SOURCE/extensions/prism/extension.json')).toBe(true);
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
