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
  });

  it('excludes reserved workspaces (publish, locales)', async () => {
    await seedWorkspace(storage, PUBLISH_WORKSPACE_ID, { title: 'should-not-appear', language: 'en' });
    await seedWorkspace(storage, 'locales', { title: 'should-not-appear', language: 'en' });

    const list = await service.listWorkspaces();
    const ids = list.map(w => w.id);

    expect(ids).not.toContain(PUBLISH_WORKSPACE_ID);
    expect(ids).not.toContain('locales');
    expect(ids.sort()).toEqual(['ws-a', 'ws-b']);
  });
});
