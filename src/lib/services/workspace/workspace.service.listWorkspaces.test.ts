/**
 * WorkspaceService.listWorkspaces — performance refactor characterization tests.
 *
 * These guard the parallel, metadata-only, reserved-filtering behaviour of the
 * Projects-list load path. OPFUtils is mocked because happy-dom cannot reliably
 * parse namespaced OPF XML (see the it.skip cases in opf-utils.test.ts); here we
 * test the listWorkspaces ORCHESTRATION, not real XML parsing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FileStorageAPI } from '../../storage/index.js';
import { MockFileStorage } from '../../test/mocks/file-storage.mock.js';
import { PUBLISH_WORKSPACE_ID } from '../../workspace/types.js';

// Mock OPFUtils: parseContainerXml always resolves to the standard rootfile, and
// parseOPFMetadataFromString returns metadata encoded in the OPF string, or
// throws when the string is marked corrupt — so we can drive resilience.
vi.mock('../../epub/opf-utils.js', () => ({
  OPFUtils: {
    parseContainerXml: vi.fn(() => ({ rootfilePath: 'OEBPS/content.opf' })),
    parseOPFMetadataFromString: vi.fn((opfContent: string) => {
      const parsed = JSON.parse(opfContent) as {
        title?: string;
        language?: string;
        creator?: string[];
      };
      if (!parsed.title) {
        throw new Error('Missing required dc:title in OPF metadata');
      }
      return parsed;
    }),
  },
  generateEPUBTimestamp: vi.fn(() => '2026-01-01T00:00:00Z'),
  creatorName: (c: any) => (typeof c === 'string' ? c : (c?.name ?? '')),
  primaryLanguage: (m: any) =>
    Array.isArray(m?.language) ? (m.language[0] ?? '') : (m?.language ?? ''),
}));

import { WorkspaceService } from './workspace.service.js';

const CONTAINER = '<container/>';

async function seedWorkspace(
  storage: MockFileStorage,
  id: string,
  meta: { title?: string; language?: string; creator?: string[] } | 'corrupt',
  extraFiles: string[] = []
) {
  const opf = meta === 'corrupt' ? '{"language":"en"}' : JSON.stringify(meta);
  const files: Record<string, string> = {
    'META-INF/container.xml': CONTAINER,
    'OEBPS/content.opf': opf,
  };
  for (const f of extraFiles) files[f] = 'x';
  await storage.addTestFiles(id, files);
}

describe('WorkspaceService.listWorkspaces (parallel, metadata-only)', () => {
  let storage: MockFileStorage;
  let service: WorkspaceService;

  beforeEach(async () => {
    localStorage.clear(); // the persistent Projects cache must not leak between tests
    storage = new MockFileStorage();
    service = new WorkspaceService(storage as unknown as FileStorageAPI);

    await seedWorkspace(storage, 'ws-a', { title: 'Book A', language: 'en', creator: ['Alice'] }, [
      'OEBPS/ch1.xhtml',
    ]);
    await seedWorkspace(storage, 'ws-b', { title: 'Book B', language: 'fr' });
  });

  it('returns valid workspaces and skips corrupted ones', async () => {
    await seedWorkspace(storage, 'ws-bad', 'corrupt');

    const list = await service.listWorkspaces();

    expect(list.map(w => w.id).sort()).toEqual(['ws-a', 'ws-b']);
  });

  it('maps metadata-only fields (title, author, language)', async () => {
    const list = await service.listWorkspaces();

    const a = list.find(w => w.id === 'ws-a')!;
    expect(a.title).toBe('Book A');
    expect(a.author).toBe('Alice');
    expect(a.language).toBe('en');
    // fileCount is loaded lazily per row, not in the fast list path
    expect(a.fileCount).toBeUndefined();

    const b = list.find(w => w.id === 'ws-b')!;
    expect(b.author).toBeUndefined();
  });

  it('getWorkspaceRowDetails returns the lazily-loaded fileCount', async () => {
    const details = await service.getWorkspaceRowDetails('ws-a');
    // container.xml + content.opf + ch1.xhtml
    expect(details.fileCount).toBe(3);
    // No SOURCE/ files were seeded → a regular (read-only) EPUB.
    expect(details.readOnly).toBe(true);
  });

  it('serves row details to a fresh service instance without re-walking the tree', async () => {
    // First instance pays the cold cost and persists what it derived.
    await service.getWorkspaceRowDetails('ws-a');

    // A new instance (= a page reload) must hydrate from the persistent cache:
    // one stat for freshness, zero directory walks.
    const reloaded = new WorkspaceService(storage as unknown as FileStorageAPI);
    const listFilesSpy = vi.spyOn(storage, 'listFiles');
    const details = await reloaded.getWorkspaceRowDetails('ws-a');

    expect(details.fileCount).toBe(3);
    expect(details.readOnly).toBe(true);
    expect(listFilesSpy).not.toHaveBeenCalled();
  });

  it('rebuilds row details when the OPF changes after hydration', async () => {
    await service.getWorkspaceRowDetails('ws-a');

    // Touch the OPF (new mtime) and add a file: the persisted entry is stale.
    // The mock stamps writes with the current time — make sure it ticks.
    await new Promise(resolve => setTimeout(resolve, 5));
    await storage.addTestFiles('ws-a', {
      'OEBPS/content.opf': JSON.stringify({ title: 'Book A', language: 'en' }),
      'OEBPS/ch2.xhtml': 'x',
    });

    const reloaded = new WorkspaceService(storage as unknown as FileStorageAPI);
    const listFilesSpy = vi.spyOn(storage, 'listFiles');
    const details = await reloaded.getWorkspaceRowDetails('ws-a');

    expect(details.fileCount).toBe(4);
    expect(listFilesSpy).toHaveBeenCalled();
  });

  it('walks the tree only once per cold row (extensions reuse the listing)', async () => {
    const listFilesSpy = vi.spyOn(storage, 'listFiles');
    await service.getWorkspaceRowDetails('ws-a');
    expect(listFilesSpy).toHaveBeenCalledTimes(1);
  });

  it('invalidateWorkspaceCache removes the persistent entry', async () => {
    await service.getWorkspaceRowDetails('ws-a');
    expect(localStorage.getItem('seedhtml_projcache_ws-a')).not.toBeNull();

    service.invalidateWorkspaceCache('ws-a');
    expect(localStorage.getItem('seedhtml_projcache_ws-a')).toBeNull();
  });

  it('overwriting the cached cover path drops the cached row data', async () => {
    // Build + persist the entry, then graft a cover path onto it (the JSON OPF
    // used by these orchestration tests never yields one via DOMParser).
    await service.getWorkspaceRowDetails('ws-a');
    const key = 'seedhtml_projcache_ws-a';
    const entry = JSON.parse(localStorage.getItem(key)!);
    entry.rowMeta.cover = { path: 'OEBPS/images/cover.png', mediaType: 'image/png' };
    localStorage.setItem(key, JSON.stringify(entry));

    // A fresh instance hydrates the grafted cover into its in-memory slot.
    const reloaded = new WorkspaceService(storage as unknown as FileStorageAPI);
    await reloaded.getWorkspaceRowDetails('ws-a');

    // Overwriting bytes at the cover path (no OPF change) must invalidate…
    await reloaded.writeBinaryFile('ws-a', 'OEBPS/images/cover.png', new ArrayBuffer(4));
    expect(localStorage.getItem(key)).toBeNull();

    // …while writing any other file leaves the rebuilt cache alone.
    await reloaded.getWorkspaceRowDetails('ws-a');
    await reloaded.writeFile('ws-a', 'SOURCE/text/ch1.txt', 'hello');
    expect(localStorage.getItem(key)).not.toBeNull();
  });

  it('listWorkspaces prunes persistent entries for deleted workspaces', async () => {
    await service.getWorkspaceRowDetails('ws-a');
    localStorage.setItem(
      'seedhtml_projcache_ws-gone',
      JSON.stringify({ v: 2, opfMtime: 1, rowMeta: { fileCount: 1, readOnly: false } })
    );

    await service.listWorkspaces();

    expect(localStorage.getItem('seedhtml_projcache_ws-gone')).toBeNull();
    expect(localStorage.getItem('seedhtml_projcache_ws-a')).not.toBeNull();
  });

  it('excludes reserved workspaces (publish, locales)', async () => {
    await seedWorkspace(storage, PUBLISH_WORKSPACE_ID, {
      title: 'should-not-appear',
      language: 'en',
    });
    await seedWorkspace(storage, 'locales', { title: 'should-not-appear', language: 'en' });

    const list = await service.listWorkspaces();
    const ids = list.map(w => w.id);

    expect(ids).not.toContain(PUBLISH_WORKSPACE_ID);
    expect(ids).not.toContain('locales');
    expect(ids.sort()).toEqual(['ws-a', 'ws-b']);
  });
});
