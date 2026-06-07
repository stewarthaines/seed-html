import { describe, it, expect, vi } from 'vitest';
import type { FileStorageAPI } from '../../storage/index.js';
import { WorkspaceService, type WorkspaceState } from './workspace.service.js';

/** Minimal in-memory FileStorage keyed by `${workspaceId}:${path}`. */
function makeFileStorage() {
  const created = new Set<string>();
  const files = new Map<string, Uint8Array>();
  const enc = new TextEncoder();
  const key = (ws: string, p: string) => `${ws}:${p}`;

  const api = {
    createWorkspace: vi.fn(async (id: string) => {
      created.add(id);
    }),
    listFiles: vi.fn(async (ws: string) =>
      [...files.keys()].filter(k => k.startsWith(`${ws}:`)).map(k => k.slice(ws.length + 1))
    ),
    readFile: vi.fn(async (ws: string, p: string) => {
      const b = files.get(key(ws, p));
      if (!b) throw new Error(`not found: ${p}`);
      return b.slice().buffer; // exact-size ArrayBuffer
    }),
    writeFile: vi.fn(async (ws: string, p: string, content: ArrayBuffer | string) => {
      files.set(
        key(ws, p),
        typeof content === 'string' ? enc.encode(content) : new Uint8Array(content)
      );
    }),
  } as unknown as FileStorageAPI;

  return {
    api,
    created,
    seed: (ws: string, p: string, s: string) => files.set(key(ws, p), enc.encode(s)),
  };
}

// loadWorkspace/updateMetadata depend on OPF XML parsing, which Happy-DOM can't
// do (see the note in workspace.service.test.ts). Stub them so this test can
// isolate duplicateWorkspace's copy + re-stamp logic.
const SOURCE_STATE: WorkspaceState = {
  id: 'placeholder',
  opf: {
    version: '3.0',
    metadata: {
      title: 'My Book',
      identifier: 'urn:uuid:source-id',
      language: ['en'],
      epubVersion: '3.0',
    },
    manifest: [],
    spine: [],
    guide: [],
  },
  pathInfo: { rootfilePath: 'OEBPS/content.opf', basePath: 'OEBPS', opfFileName: 'content.opf' },
};

describe('WorkspaceService.duplicateWorkspace', () => {
  it('copies every file into a new workspace and re-stamps title + identifier', async () => {
    const storage = makeFileStorage();
    const src = 'workspace-src';
    storage.created.add(src);
    storage.seed(src, 'OEBPS/content.opf', '<opf/>');
    storage.seed(src, 'OEBPS/Text/ch1.xhtml', 'CH1');
    storage.seed(src, 'SOURCE/text/ch1.txt', 'SRC1');

    const service = new WorkspaceService(storage.api);
    vi.spyOn(service, 'loadWorkspace').mockImplementation(async (id: string) => ({
      ...SOURCE_STATE,
      id,
    }));
    const updateSpy = vi
      .spyOn(service, 'updateMetadata')
      .mockImplementation(async (ws, updates) => ({
        ...ws,
        opf: { ...ws.opf, metadata: { ...ws.opf.metadata, ...updates } },
      }));

    const copy = await service.duplicateWorkspace(src);

    // A new, distinct workspace was created.
    const newId = vi.mocked(storage.api.createWorkspace).mock.calls[0][0] as string;
    expect(newId).toMatch(/^workspace-/);
    expect(newId).not.toBe(src);
    expect(copy.id).toBe(newId);

    // Every source file was copied verbatim into the new workspace.
    const dec = new TextDecoder();
    expect(dec.decode(await storage.api.readFile(newId, 'OEBPS/content.opf'))).toBe('<opf/>');
    expect(dec.decode(await storage.api.readFile(newId, 'OEBPS/Text/ch1.xhtml'))).toBe('CH1');
    expect(dec.decode(await storage.api.readFile(newId, 'SOURCE/text/ch1.txt'))).toBe('SRC1');

    // Identity re-stamped on the copy: "(copy)" title + a fresh identifier.
    const updates = updateSpy.mock.calls[0][1];
    expect(updates.title).toBe('My Book (copy)');
    expect(updates.identifier).toMatch(/^urn:uuid:/);
    expect(updates.identifier).not.toBe('urn:uuid:source-id');
    expect(copy.opf.metadata.title).toBe('My Book (copy)');

    // Nothing was written back to the source workspace.
    const writes = vi.mocked(storage.api.writeFile).mock.calls;
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every(c => c[0] === newId)).toBe(true);
  });
});
