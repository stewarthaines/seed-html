import { describe, it, expect, vi } from 'vitest';
import type { FileStorageAPI } from '../storage/index.js';
import type { GeneratorManifest } from '../extensions/extension-catalog.js';
import {
  listGenerators,
  writeGenerator,
  readGeneratorScript,
  deleteGenerator,
} from './generator-store.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

function makeFileStorage(initial: Record<string, string> = {}) {
  const files = new Map<string, Uint8Array>();
  for (const [k, v] of Object.entries(initial)) files.set(k, enc.encode(v));

  const api = {
    writeFile: vi.fn(async (_ws: string, path: string, content: ArrayBuffer | Uint8Array) => {
      files.set(path, content instanceof Uint8Array ? content : new Uint8Array(content));
    }),
    writeTextFile: vi.fn(async (_ws: string, path: string, content: string) => {
      files.set(path, enc.encode(content));
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
    deleteFile: vi.fn(async (_ws: string, path: string) => {
      files.delete(path);
    }),
    listFiles: vi.fn(async () => [...files.keys()]),
    fileExists: vi.fn(async (_ws: string, path: string) => files.has(path)),
  } as unknown as FileStorageAPI;

  return { api, files };
}

const figures: GeneratorManifest = {
  id: 'figures',
  name: 'List of Figures',
  description: undefined,
  script: 'listFigures.js',
  license: 'LICENSE.txt',
  options: [{ type: 'string', name: 'template', label: 'Template' }],
};

describe('generator-store', () => {
  it('writes a manifest + script (+ license), then discovers it', async () => {
    const { api, files } = makeFileStorage();

    await writeGenerator(api, 'ws', figures, enc.encode('SCRIPT').buffer, enc.encode('LIC').buffer);

    expect(dec.decode(files.get('SOURCE/generators/figures/listFigures.js')!)).toBe('SCRIPT');
    expect(dec.decode(files.get('SOURCE/generators/figures/LICENSE.txt')!)).toBe('LIC');
    expect(JSON.parse(dec.decode(files.get('SOURCE/generators/figures/generator.json')!))).toEqual(
      figures
    );

    const found = await listGenerators(api, 'ws');
    expect(found).toHaveLength(1);
    expect(found[0].manifest.id).toBe('figures');
    expect(found[0].dir).toBe('SOURCE/generators/figures');
    expect(found[0].scriptPath).toBe('SOURCE/generators/figures/listFigures.js');
    expect(await readGeneratorScript(api, 'ws', found[0])).toBe('SCRIPT');
  });

  it('skips a generator with no license content when none declared', async () => {
    const { api, files } = makeFileStorage();
    const noLicense: GeneratorManifest = { ...figures, license: undefined };
    await writeGenerator(api, 'ws', noLicense, enc.encode('S').buffer);
    expect(files.has('SOURCE/generators/figures/LICENSE.txt')).toBe(false);
    expect(files.has('SOURCE/generators/figures/generator.json')).toBe(true);
  });

  it('discovers multiple generators sorted by name; skips malformed manifests', async () => {
    const { api } = makeFileStorage({
      // malformed (missing required script) → skipped
      'SOURCE/generators/broken/generator.json': '{"id":"broken","name":"Broken"}',
      // not JSON → skipped
      'SOURCE/generators/junk/generator.json': 'not json',
      'SOURCE/generators/zed/generator.json': JSON.stringify({
        id: 'zed',
        name: 'Zed Tool',
        script: 'z.js',
      }),
      'SOURCE/generators/zed/z.js': 'Z',
      'SOURCE/generators/abc/generator.json': JSON.stringify({
        id: 'abc',
        name: 'Abc Tool',
        script: 'a.js',
      }),
      'SOURCE/generators/abc/a.js': 'A',
    });

    const found = await listGenerators(api, 'ws');
    expect(found.map(g => g.manifest.id)).toEqual(['abc', 'zed']); // sorted by name, malformed dropped
  });

  it('deletes every file under a generator dir', async () => {
    const { api, files } = makeFileStorage();
    await writeGenerator(api, 'ws', figures, enc.encode('S').buffer, enc.encode('L').buffer);
    await deleteGenerator(api, 'ws', 'figures');
    expect([...files.keys()].some(k => k.startsWith('SOURCE/generators/figures/'))).toBe(false);
    expect(await listGenerators(api, 'ws')).toEqual([]);
  });

  it('returns [] when listing throws (missing workspace)', async () => {
    const api = {
      listFiles: vi.fn(async () => {
        throw new Error('no workspace');
      }),
    } as unknown as FileStorageAPI;
    expect(await listGenerators(api, 'ws')).toEqual([]);
  });
});
