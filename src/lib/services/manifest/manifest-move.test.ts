import { describe, it, expect, vi } from 'vitest';
import type { FileStorageAPI } from '../../storage/index.js';
import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';
import { commitMovePlan } from './manifest-move.js';
import { buildMovePlan } from '../../manifest/move-plan.js';
import type { ManifestItem } from '../../epub/opf-utils.js';

/**
 * commitMovePlan's crash-safe ordering: copy → rewrite → single OPF save →
 * delete originals. Mocked storage records every operation in order.
 */

const item = (id: string, href: string, mediaType = 'image/jpeg'): ManifestItem => ({
  id,
  href,
  mediaType,
});

function makeWorkspace(manifest: ManifestItem[]): WorkspaceState {
  return {
    id: 'ws',
    opf: {
      version: '3.0',
      metadata: {
        title: 'Book',
        identifier: 'urn:uuid:x',
        language: ['en'],
        epubVersion: '3.0',
      },
      manifest,
      spine: [],
      guide: [],
    },
    pathInfo: { rootfilePath: 'OEBPS/content.opf', basePath: 'OEBPS', opfFileName: 'content.opf' },
  } as unknown as WorkspaceState;
}

function makeStorage(files: Record<string, string>) {
  const store = new Map(Object.entries(files));
  const ops: string[] = [];
  const api = {
    readFile: vi.fn(async (_ws: string, path: string) => {
      ops.push(`read:${path}`);
      const text = store.get(path);
      if (text === undefined) throw new Error(`missing: ${path}`);
      return new TextEncoder().encode(text).buffer as ArrayBuffer;
    }),
    writeFile: vi.fn(async (_ws: string, path: string, bytes: ArrayBuffer) => {
      ops.push(`write:${path}`);
      store.set(path, new TextDecoder().decode(bytes));
    }),
    readTextFile: vi.fn(async (_ws: string, path: string) => {
      ops.push(`readText:${path}`);
      const text = store.get(path);
      if (text === undefined) throw new Error(`missing: ${path}`);
      return text;
    }),
    writeTextFile: vi.fn(async (_ws: string, path: string, text: string) => {
      ops.push(`writeText:${path}`);
      store.set(path, text);
    }),
    deleteFile: vi.fn(async (_ws: string, path: string) => {
      ops.push(`delete:${path}`);
      store.delete(path);
    }),
  } as unknown as FileStorageAPI;
  return { api, store, ops };
}

function makeWorkspaceService(ops: string[]) {
  return {
    saveWorkspace: vi.fn(async (ws: WorkspaceState) => {
      ops.push('saveWorkspace');
      return ws;
    }),
  } as unknown as WorkspaceService;
}

describe('commitMovePlan', () => {
  it('copies, rewrites, saves the OPF once, then deletes originals — in that order', async () => {
    const manifest = [item('img-a', 'Images/a.jpg'), item('img-b', 'Images/b.jpg')];
    const workspace = makeWorkspace(manifest);
    const { api, store, ops } = makeStorage({
      'OEBPS/Images/a.jpg': 'A-BYTES',
      'OEBPS/Images/b.jpg': 'B-BYTES',
      'SOURCE/text/ch1.txt': 'see ![](../Images/a.jpg) and ![](../Images/b.jpg)',
    });
    const service = makeWorkspaceService(ops);

    const plan = buildMovePlan({
      manifest,
      moves: [
        { id: 'img-a', newHref: 'Images/c01/a.jpg' },
        { id: 'img-b', newHref: 'Images/c01/b.jpg' },
      ],
      sources: [{ path: 'SOURCE/text/ch1.txt', text: store.get('SOURCE/text/ch1.txt')! }],
      stylesheets: [],
    });
    const result = await commitMovePlan(service, api, workspace, plan);

    // Files moved and source rewritten.
    expect(store.get('OEBPS/Images/c01/a.jpg')).toBe('A-BYTES');
    expect(store.has('OEBPS/Images/a.jpg')).toBe(false);
    expect(store.get('SOURCE/text/ch1.txt')).toBe(
      'see ![](../Images/c01/a.jpg) and ![](../Images/c01/b.jpg)'
    );

    // OPF updated in one save.
    expect(ops.filter(op => op === 'saveWorkspace')).toHaveLength(1);
    expect(result.updatedWorkspace.opf.manifest.map(m => m.href)).toEqual([
      'Images/c01/a.jpg',
      'Images/c01/b.jpg',
    ]);

    // Ordering: every write precedes the OPF save; every delete follows it.
    const saveIndex = ops.indexOf('saveWorkspace');
    const writeIndices = ops.map((op, i) => (op.startsWith('write') ? i : -1)).filter(i => i >= 0);
    const deleteIndices = ops
      .map((op, i) => (op.startsWith('delete') ? i : -1))
      .filter(i => i >= 0);
    expect(Math.max(...writeIndices)).toBeLessThan(saveIndex);
    expect(Math.min(...deleteIndices)).toBeGreaterThan(saveIndex);

    expect(result.movedIds).toEqual(['img-a', 'img-b']);
    expect(result.staleHrefs.sort()).toEqual(['Images/a.jpg', 'Images/b.jpg']);
  });

  it("writes a moved stylesheet's rewritten text to its NEW location", async () => {
    const manifest = [
      item('css', 'Styles/page.css', 'text/css'),
      item('font', 'Fonts/f.woff2', 'font/woff2'),
    ];
    const workspace = makeWorkspace(manifest);
    const css = '@font-face { src: url(../Fonts/f.woff2); }';
    const { api, store } = makeStorage({ 'OEBPS/Styles/page.css': css });
    const service = makeWorkspaceService([]);

    const plan = buildMovePlan({
      manifest,
      moves: [{ id: 'css', newHref: 'Styles/sub/page.css' }],
      sources: [],
      stylesheets: [{ href: 'Styles/page.css', text: css }],
    });
    await commitMovePlan(service, api, workspace, plan);

    expect(store.get('OEBPS/Styles/sub/page.css')).toBe(
      '@font-face { src: url(../../Fonts/f.woff2); }'
    );
    expect(store.has('OEBPS/Styles/page.css')).toBe(false);
  });

  it('treats a missing stored file as manifest-only: OPF updates, no delete', async () => {
    const manifest = [item('ghost', 'Images/ghost.jpg')];
    const workspace = makeWorkspace(manifest);
    const { api, ops } = makeStorage({});
    const service = makeWorkspaceService(ops);

    const plan = buildMovePlan({
      manifest,
      moves: [{ id: 'ghost', newHref: 'Images/c01/ghost.jpg' }],
      sources: [],
      stylesheets: [],
    });
    const result = await commitMovePlan(service, api, workspace, plan);

    expect(result.updatedWorkspace.opf.manifest[0].href).toBe('Images/c01/ghost.jpg');
    expect(ops.some(op => op.startsWith('delete'))).toBe(false);
    expect(result.movedIds).toEqual(['ghost']);
    expect(result.staleHrefs).toEqual([]);
  });

  it('is a no-op for a fully blocked plan', async () => {
    const manifest = [item('img-a', 'Images/a.jpg'), item('img-b', 'Images/b.jpg')];
    const workspace = makeWorkspace(manifest);
    const { api, ops } = makeStorage({ 'OEBPS/Images/a.jpg': 'A' });
    const service = makeWorkspaceService(ops);

    const plan = buildMovePlan({
      manifest,
      moves: [{ id: 'img-a', newHref: 'Images/b.jpg' }], // collides, b not moving
      sources: [],
      stylesheets: [],
    });
    const result = await commitMovePlan(service, api, workspace, plan);
    expect(ops).toEqual([]);
    expect(result.updatedWorkspace).toBe(workspace);
  });
});
