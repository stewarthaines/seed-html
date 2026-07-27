import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import type { FileStorageAPI } from '../../storage/index.js';
import { WorkspaceService } from './workspace.service.js';
import { OPFUtils } from '../../epub/opf-utils.js';
import type { OPFDocument } from '../../epub/opf-utils.js';

/**
 * loadWorkspace's parsed-workspace cache (validated by OPF mtime): repeat loads
 * with an unchanged OPF must skip the read+parse, any OPF change (new mtime or
 * a save through this service) must re-read, and cached state must never be
 * shared by reference (callers mutate the returned workspace in place).
 *
 * The OPF parse and container.xml resolution are stubbed: happy-dom cannot
 * parse the namespaced OPF/container XML (known unit-env limitation).
 */

const PATH_INFO = {
  rootfilePath: 'OEBPS/content.opf',
  basePath: 'OEBPS',
  opfFileName: 'content.opf',
};

function makeOpf(): OPFDocument {
  return {
    version: '3.0',
    metadata: { title: 'Book', identifier: 'urn:uuid:x', language: ['en'], epubVersion: '3.0' },
    manifest: [
      { id: 'ch1', href: 'Text/ch1.xhtml', mediaType: 'application/xhtml+xml' },
      { id: 'style', href: 'Styles/main.css', mediaType: 'text/css' },
    ],
    spine: [{ idref: 'ch1' }],
    guide: [],
  } as unknown as OPFDocument;
}

function makeFileStorage(mtimeRef: { value: number }) {
  return {
    listWorkspaces: vi.fn(async () => ['ws']),
    readTextFile: vi.fn(async () => '<package/>'),
    writeTextFile: vi.fn(async () => {}),
    getFileInfo: vi.fn(async () => ({ lastModified: new Date(mtimeRef.value) })),
  } as unknown as FileStorageAPI;
}

describe('WorkspaceService — loadWorkspace parsed cache', () => {
  const mtime = { value: 1000 };
  let storage: FileStorageAPI;
  let service: WorkspaceService;
  let parseSpy: MockInstance<(opfContent: string) => OPFDocument>;

  beforeEach(() => {
    mtime.value = 1000;
    storage = makeFileStorage(mtime);
    service = new WorkspaceService(storage);
    // Dodge container.xml parsing (happy-dom namespace limitation).
    vi.spyOn(
      service as unknown as { getWorkspacePathInfo: (id: string) => Promise<typeof PATH_INFO> },
      'getWorkspacePathInfo'
    ).mockResolvedValue(PATH_INFO);
    parseSpy = vi.spyOn(OPFUtils, 'parseOPFDocument').mockImplementation(() => makeOpf());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses once for repeat loads while the OPF mtime is unchanged', async () => {
    const first = await service.loadWorkspace('ws');
    const second = await service.loadWorkspace('ws');

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect((storage.readTextFile as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(second).toEqual(first);
  });

  it('never shares references: mutating a returned workspace cannot poison later loads', async () => {
    const first = await service.loadWorkspace('ws');
    first.opf.manifest.push({
      id: 'rogue',
      href: 'Text/rogue.xhtml',
      mediaType: 'application/xhtml+xml',
    });
    first.opf.metadata.title = 'Mutated';

    const second = await service.loadWorkspace('ws');
    expect(second.opf.manifest.map(m => m.id)).toEqual(['ch1', 'style']);
    expect(second.opf.metadata.title).toBe('Book');
  });

  it('re-reads when the OPF mtime changes (out-of-band write)', async () => {
    await service.loadWorkspace('ws');
    mtime.value = 2000;
    await service.loadWorkspace('ws');
    expect(parseSpy).toHaveBeenCalledTimes(2);
  });

  it('drops the entry on saveWorkspace, so the next load re-reads even at the same mtime', async () => {
    const loaded = await service.loadWorkspace('ws');
    vi.spyOn(OPFUtils, 'generateOPFXML').mockReturnValue('<package/>');
    await service.saveWorkspace(loaded);
    await service.loadWorkspace('ws'); // mtime unchanged in the mock
    expect(parseSpy).toHaveBeenCalledTimes(2);
  });

  it('drops the entry on invalidateWorkspaceCache', async () => {
    await service.loadWorkspace('ws');
    service.invalidateWorkspaceCache('ws');
    await service.loadWorkspace('ws');
    expect(parseSpy).toHaveBeenCalledTimes(2);
  });

  it('skips caching when the stat fails (mtime unavailable)', async () => {
    (storage.getFileInfo as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no stat'));
    await service.loadWorkspace('ws');
    await service.loadWorkspace('ws');
    expect(parseSpy).toHaveBeenCalledTimes(2);
  });
});
