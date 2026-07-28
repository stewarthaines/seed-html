import { describe, it, expect, vi, afterEach } from 'vitest';
import { SpineService, SpineServiceError } from './spine.service.js';
import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';
import type { ManifestItem, SpineItem } from '../../epub/opf-utils.js';

const enc = new TextEncoder();

function makeWorkspace(): WorkspaceState {
  return {
    id: 'ws',
    pathInfo: { rootfilePath: 'OEBPS/content.opf', basePath: 'OEBPS', opfFileName: 'content.opf' },
    opf: {
      version: '3.0',
      metadata: { title: 'Book', language: ['en'], identifier: 'id' },
      manifest: [
        { id: 'chap01', href: 'Text/chap01.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'chap02', href: 'Text/chap02.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: [{ idref: 'chap01' }, { idref: 'chap02' }],
      guide: [],
    },
  } as unknown as WorkspaceState;
}

describe('SpineService.loadSpineItems titles (read-only EPUB)', () => {
  it('labels a source-less chapter from its stored XHTML <title>', async () => {
    const xhtml =
      '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head>' +
      '<title>Chapter One</title></head><body><h1>Ignored</h1></body></html>';

    const readFile = vi.fn(async () => enc.encode(xhtml).buffer);
    const ws = {
      // No source files exist — every chapter is source-less (a regular EPUB).
      fileExists: vi.fn(async () => false),
      readFile,
    } as unknown as WorkspaceService;

    const items = await new SpineService(ws).loadSpineItems(makeWorkspace());

    expect(items[0].hasSourceFile).toBe(false);
    expect(items[0].title).toBe('Chapter One');
    // Reads the stored XHTML at the OEBPS-resolved path.
    expect(readFile).toHaveBeenCalledWith('ws', 'OEBPS/Text/chap01.xhtml');
  });

  it('falls back to a heading when there is no <title>', async () => {
    const xhtml =
      '<html xmlns="http://www.w3.org/1999/xhtml"><head></head>' +
      '<body><h1>Heading Title</h1></body></html>';
    const ws = {
      fileExists: vi.fn(async () => false),
      readFile: vi.fn(async () => enc.encode(xhtml).buffer),
    } as unknown as WorkspaceService;

    const items = await new SpineService(ws).loadSpineItems(makeWorkspace());
    expect(items[0].title).toBe('Heading Title');
  });

  it('does not read XHTML or set a title when a source file exists (editable chapter)', async () => {
    const readFile = vi.fn(async () => new ArrayBuffer(0));
    const ws = {
      fileExists: vi.fn(async () => true), // every chapter has a SOURCE/text/*.txt
      readFile,
    } as unknown as WorkspaceService;

    const items = await new SpineService(ws).loadSpineItems(makeWorkspace());

    expect(items[0].hasSourceFile).toBe(true);
    expect(items[0].title).toBeUndefined();
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe('SpineService preview-data GC', () => {
  // listSourceFiles returns every SOURCE/ file; GC filters by the chapter's dir.
  const allSource = (paths: string[]) => paths.map(path => ({ path }));

  it('deleteChapter removes the chapter’s SOURCE/data/preview/<id>/ files (any slot)', async () => {
    const deleteSourceFile = vi.fn(async (_ws: unknown, _path: string) => {});
    const ws = {
      saveWorkspace: vi.fn(async () => {}),
      fileExists: vi.fn(async () => false),
      fileStorage: { deleteFile: vi.fn(async () => {}) },
      listSourceFiles: vi.fn(async () =>
        allSource([
          'SOURCE/text/chap01.txt',
          'SOURCE/data/preview/chap01/pagemap.json',
          'SOURCE/data/preview/chap01/notes.json',
          'SOURCE/data/preview/chap02/pagemap.json', // another chapter — must be kept
        ])
      ),
      deleteSourceFile,
    } as unknown as WorkspaceService;

    await new SpineService(ws).deleteChapter(makeWorkspace(), 'chap01');

    expect(deleteSourceFile).toHaveBeenCalledTimes(2);
    const deleted = deleteSourceFile.mock.calls.map(c => c[1]);
    expect(deleted).toContain('SOURCE/data/preview/chap01/pagemap.json');
    expect(deleted).toContain('SOURCE/data/preview/chap01/notes.json');
    expect(deleted).not.toContain('SOURCE/data/preview/chap02/pagemap.json');
  });

  it('renameChapterId moves preview data from the old id to the new id', async () => {
    const renameFile = vi.fn(async () => {});
    const wsState = makeWorkspace();
    const ws = {
      updateManifestItem: vi.fn(async () => wsState),
      fileExists: vi.fn(async () => false), // no source/meta files to rename
      renameFile,
      listSourceFiles: vi.fn(async () =>
        allSource([
          'SOURCE/data/preview/chap01/pagemap.json',
          'SOURCE/data/preview/chap02/pagemap.json',
        ])
      ),
    } as unknown as WorkspaceService;

    await new SpineService(ws).renameChapterId(wsState, 'chap01', 'prologue');

    expect(renameFile).toHaveBeenCalledTimes(1);
    expect(renameFile).toHaveBeenCalledWith(
      'ws',
      'SOURCE/data/preview/chap01/pagemap.json',
      'SOURCE/data/preview/prologue/pagemap.json'
    );
  });

  it('deleteChapter tolerates a chapter with no preview data (no deletes, no throw)', async () => {
    const deleteSourceFile = vi.fn(async () => {});
    const ws = {
      saveWorkspace: vi.fn(async () => {}),
      fileExists: vi.fn(async () => false),
      fileStorage: { deleteFile: vi.fn(async () => {}) },
      listSourceFiles: vi.fn(async () => allSource(['SOURCE/text/chap01.txt'])),
      deleteSourceFile,
    } as unknown as WorkspaceService;

    await expect(
      new SpineService(ws).deleteChapter(makeWorkspace(), 'chap01')
    ).resolves.toBeTruthy();
    expect(deleteSourceFile).not.toHaveBeenCalled();
  });
});

/** Capture a rejection so tests can assert on SpineServiceError fields. */
async function caught(promise: Promise<unknown>): Promise<SpineServiceError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(SpineServiceError);
  return error as SpineServiceError;
}

/** WorkspaceService stub whose spine mutators echo the workspace back. */
function makeMutatorService(overrides: Record<string, unknown> = {}): WorkspaceService {
  return {
    fileExists: vi.fn(async () => false),
    readFile: vi.fn(async () => new ArrayBuffer(0)),
    writeFile: vi.fn(async () => {}),
    addManifestItem: vi.fn(async (w: WorkspaceState, item: ManifestItem) => ({
      ...w,
      opf: { ...w.opf, manifest: [...w.opf.manifest, item] },
    })),
    addSpineItem: vi.fn(async (w: WorkspaceState, item: SpineItem) => ({
      ...w,
      opf: { ...w.opf, spine: [...w.opf.spine, item] },
    })),
    updateSpineOrder: vi.fn(async (w: WorkspaceState) => w),
    ...overrides,
  } as unknown as WorkspaceService;
}

describe('SpineService.loadSpineItems edge cases', () => {
  it('skips spine entries with no matching manifest item', async () => {
    const workspace = makeWorkspace();
    workspace.opf.spine.push({ idref: 'ghost' });
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });

    const items = await new SpineService(ws).loadSpineItems(workspace);

    expect(items.map(item => item.id)).toEqual(['chap01', 'chap02']);
  });

  it('preserves an explicit linear="no" flag and defaults missing linear to true', async () => {
    const workspace = makeWorkspace();
    workspace.opf.spine = [{ idref: 'chap01', linear: false }, { idref: 'chap02' }];
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });

    const items = await new SpineService(ws).loadSpineItems(workspace);

    expect(items[0].linear).toBe(false);
    expect(items[1].linear).toBe(true);
  });

  it('leaves the title undefined when the stored XHTML has no title or heading', async () => {
    const xhtml = '<html><head></head><body><p>Only prose.</p></body></html>';
    const ws = makeMutatorService({
      readFile: vi.fn(async () => enc.encode(xhtml).buffer),
    });

    const items = await new SpineService(ws).loadSpineItems(makeWorkspace());
    expect(items[0].title).toBeUndefined();
  });

  it('leaves the title undefined when reading the stored XHTML fails (best-effort)', async () => {
    const ws = makeMutatorService({
      readFile: vi.fn(async () => {
        throw new Error('missing file');
      }),
    });

    const items = await new SpineService(ws).loadSpineItems(makeWorkspace());
    expect(items[0].hasSourceFile).toBe(false);
    expect(items[0].title).toBeUndefined();
  });

  it('does not double-prefix hrefs that already include the base path', async () => {
    const workspace = makeWorkspace();
    workspace.opf.manifest[0].href = 'OEBPS/Text/chap01.xhtml';
    const readFile = vi.fn(async () => new ArrayBuffer(0));
    const ws = makeMutatorService({ readFile });

    await new SpineService(ws).loadSpineItems(workspace);

    expect(readFile).toHaveBeenCalledWith('ws', 'OEBPS/Text/chap01.xhtml');
  });

  it('wraps storage failures in a LOAD_ERROR SpineServiceError', async () => {
    const ws = makeMutatorService({
      fileExists: vi.fn(async () => {
        throw new Error('storage offline');
      }),
    });

    const error = await caught(new SpineService(ws).loadSpineItems(makeWorkspace()));
    expect(error.code).toBe('LOAD_ERROR');
    expect(error.workspaceId).toBe('ws');
    expect(error.message).toContain('storage offline');
  });
});

describe('SpineService.addChapter', () => {
  it('creates a manifest item, spine item, and XHTML file with an auto-numbered id', async () => {
    const ws = makeMutatorService();
    const workspace = makeWorkspace();

    const { updatedWorkspace, newChapter } = await new SpineService(ws).addChapter(workspace, {
      title: 'My Chapter',
    });

    // Existing ids are chap01/chap02, so the first auto id is free.
    expect(newChapter.id).toBe('chapter01');
    expect(newChapter.idref).toBe('chapter01');
    expect(newChapter.href).toBe('Text/chapter01.xhtml');
    expect(newChapter.mediaType).toBe('application/xhtml+xml');
    expect(newChapter.linear).toBe(true);
    expect(newChapter.hasSourceFile).toBe(false);
    expect(newChapter.sourcePath).toBeUndefined();

    expect(ws.addManifestItem).toHaveBeenCalledWith(workspace, {
      id: 'chapter01',
      href: 'Text/chapter01.xhtml',
      mediaType: 'application/xhtml+xml',
    });
    expect(ws.addSpineItem).toHaveBeenCalledWith(
      expect.anything(),
      { idref: 'chapter01', linear: true },
      undefined
    );
    expect(updatedWorkspace.opf.manifest.map(item => item.id)).toContain('chapter01');
    expect(updatedWorkspace.opf.spine.map(item => item.idref)).toContain('chapter01');

    // The placeholder XHTML carries the title in <title> and <h1>.
    const writeFile = ws.writeFile as ReturnType<typeof vi.fn>;
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [, path, content] = writeFile.mock.calls[0] as [string, string, string];
    expect(path).toBe('Text/chapter01.xhtml');
    expect(content).toContain('<title>My Chapter</title>');
    expect(content).toContain('<h1>My Chapter</h1>');
  });

  it('skips ids already taken when auto-numbering', async () => {
    const workspace = makeWorkspace();
    workspace.opf.manifest.push({
      id: 'chapter01',
      href: 'Text/chapter01.xhtml',
      mediaType: 'application/xhtml+xml',
    });
    const ws = makeMutatorService();

    const { newChapter } = await new SpineService(ws).addChapter(workspace, { title: 'Next' });
    expect(newChapter.id).toBe('chapter02');
  });

  it('derives a sanitized id from baseName and de-duplicates against the manifest', async () => {
    const workspace = makeWorkspace();
    const ws = makeMutatorService();
    const service = new SpineService(ws);

    const fromName = await service.addChapter(workspace, {
      title: 'Upload',
      baseName: 'My File.TXT',
    });
    expect(fromName.newChapter.id).toBe('my-file');

    const colliding = await service.addChapter(workspace, {
      title: 'Upload',
      baseName: 'chap01.txt', // sanitizes to the existing id chap01
    });
    expect(colliding.newChapter.id).toBe('chap01-1');
  });

  it('honours linear:false and passes insertIndex through to the spine', async () => {
    const ws = makeMutatorService();

    const { newChapter } = await new SpineService(ws).addChapter(makeWorkspace(), {
      title: 'Cover',
      linear: false,
      insertIndex: 0,
    });

    expect(newChapter.linear).toBe(false);
    expect(ws.addSpineItem).toHaveBeenCalledWith(
      expect.anything(),
      { idref: 'chapter01', linear: false },
      0
    );
  });

  it('writes a SOURCE text file when createSourceFile is set', async () => {
    const ws = makeMutatorService();

    const { newChapter } = await new SpineService(ws).addChapter(makeWorkspace(), {
      title: 'Draft',
      createSourceFile: true,
      sourceText: 'First words.',
    });

    expect(newChapter.hasSourceFile).toBe(true);
    expect(newChapter.sourcePath).toBe('SOURCE/text/chapter01.txt');
    expect(ws.writeFile).toHaveBeenCalledWith('ws', 'SOURCE/text/chapter01.txt', 'First words.');
  });

  it('renders sourceText into escaped XHTML paragraphs with <br /> line breaks', async () => {
    const ws = makeMutatorService();

    await new SpineService(ws).addChapter(makeWorkspace(), {
      title: 'A & B',
      sourceText: 'Tom & Jerry\nsecond line\n\n<script> tags stay text',
    });

    const writeFile = ws.writeFile as ReturnType<typeof vi.fn>;
    const [, , content] = writeFile.mock.calls[0] as [string, string, string];
    expect(content).toContain('<title>A &amp; B</title>');
    expect(content).toContain('<p>Tom &amp; Jerry<br />second line</p>');
    expect(content).toContain('<p>&lt;script&gt; tags stay text</p>');
    expect(content).not.toContain('<script>');
  });

  it('renders an empty paragraph for empty sourceText', async () => {
    const ws = makeMutatorService();

    await new SpineService(ws).addChapter(makeWorkspace(), { title: 'Blank', sourceText: '' });

    const writeFile = ws.writeFile as ReturnType<typeof vi.fn>;
    const [, , content] = writeFile.mock.calls[0] as [string, string, string];
    expect(content).toContain('<p></p>');
  });

  it('wraps storage failures in an ADD_CHAPTER_ERROR SpineServiceError', async () => {
    const ws = makeMutatorService({
      addManifestItem: vi.fn(async () => {
        throw new Error('disk full');
      }),
    });

    const error = await caught(new SpineService(ws).addChapter(makeWorkspace(), { title: 'X' }));
    expect(error.code).toBe('ADD_CHAPTER_ERROR');
    expect(error.workspaceId).toBe('ws');
    expect(error.message).toContain('disk full');
  });
});

describe('SpineService.overwriteChapter', () => {
  it('rewrites the chapter XHTML and SOURCE text without touching the OPF', async () => {
    const ws = makeMutatorService();
    const workspace = makeWorkspace();

    const { updatedWorkspace } = await new SpineService(ws).overwriteChapter(workspace, 'chap01', {
      title: 'Rewritten',
      sourceText: 'New body.',
    });

    expect(updatedWorkspace).toBe(workspace);
    const writeFile = ws.writeFile as ReturnType<typeof vi.fn>;
    expect(writeFile).toHaveBeenCalledTimes(2);
    const [, xhtmlPath, xhtmlContent] = writeFile.mock.calls[0] as [string, string, string];
    expect(xhtmlPath).toBe('Text/chap01.xhtml');
    expect(xhtmlContent).toContain('<title>Rewritten</title>');
    expect(xhtmlContent).toContain('<p>New body.</p>');
    expect(writeFile).toHaveBeenCalledWith('ws', 'SOURCE/text/chap01.txt', 'New body.');
  });

  it('throws MANIFEST_ITEM_NOT_FOUND for an unknown chapter id', async () => {
    const ws = makeMutatorService();

    const error = await caught(
      new SpineService(ws).overwriteChapter(makeWorkspace(), 'nope', {
        title: 'X',
        sourceText: '',
      })
    );
    expect(error.code).toBe('MANIFEST_ITEM_NOT_FOUND');
  });

  it('wraps write failures in an OVERWRITE_CHAPTER_ERROR SpineServiceError', async () => {
    const ws = makeMutatorService({
      writeFile: vi.fn(async () => {
        throw new Error('readonly');
      }),
    });

    const error = await caught(
      new SpineService(ws).overwriteChapter(makeWorkspace(), 'chap01', {
        title: 'X',
        sourceText: '',
      })
    );
    expect(error.code).toBe('OVERWRITE_CHAPTER_ERROR');
    expect(error.message).toContain('readonly');
  });
});

describe('SpineService reordering', () => {
  it('moveChapterUp swaps the chapter with its predecessor and persists the order', async () => {
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });

    const { newOrder } = await new SpineService(ws).moveChapterUp(makeWorkspace(), 1);

    expect(newOrder.map(item => item.id)).toEqual(['chap02', 'chap01']);
    expect(ws.updateSpineOrder).toHaveBeenCalledWith(expect.anything(), ['chap02', 'chap01']);
  });

  it('moveChapterUp rejects the first chapter with INVALID_MOVE', async () => {
    const ws = makeMutatorService();
    const error = await caught(new SpineService(ws).moveChapterUp(makeWorkspace(), 0));
    expect(error.code).toBe('INVALID_MOVE');
  });

  it('moveChapterUp rejects an out-of-range index with INVALID_INDEX', async () => {
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });
    const error = await caught(new SpineService(ws).moveChapterUp(makeWorkspace(), 2));
    expect(error.code).toBe('INVALID_INDEX');
  });

  it('moveChapterUp wraps storage failures in MOVE_ERROR', async () => {
    const ws = makeMutatorService({
      fileExists: vi.fn(async () => true),
      updateSpineOrder: vi.fn(async () => {
        throw new Error('save failed');
      }),
    });
    const error = await caught(new SpineService(ws).moveChapterUp(makeWorkspace(), 1));
    expect(error.code).toBe('MOVE_ERROR');
    expect(error.message).toContain('save failed');
  });

  it('moveChapterDown swaps the chapter with its successor and persists the order', async () => {
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });

    const { newOrder } = await new SpineService(ws).moveChapterDown(makeWorkspace(), 0);

    expect(newOrder.map(item => item.id)).toEqual(['chap02', 'chap01']);
    expect(ws.updateSpineOrder).toHaveBeenCalledWith(expect.anything(), ['chap02', 'chap01']);
  });

  it('moveChapterDown rejects the last chapter and negative indices with INVALID_MOVE', async () => {
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });
    const service = new SpineService(ws);

    const last = await caught(service.moveChapterDown(makeWorkspace(), 1));
    expect(last.code).toBe('INVALID_MOVE');

    const negative = await caught(service.moveChapterDown(makeWorkspace(), -1));
    expect(negative.code).toBe('INVALID_MOVE');
  });

  it('moveChapterDown wraps storage failures in MOVE_ERROR', async () => {
    const ws = makeMutatorService({
      fileExists: vi.fn(async () => true),
      updateSpineOrder: vi.fn(async () => {
        throw new Error('save failed');
      }),
    });
    const error = await caught(new SpineService(ws).moveChapterDown(makeWorkspace(), 0));
    expect(error.code).toBe('MOVE_ERROR');
  });

  it('reorderItems moves an item to the target index and persists the order', async () => {
    const workspace = makeWorkspace();
    workspace.opf.manifest.push({
      id: 'chap03',
      href: 'Text/chap03.xhtml',
      mediaType: 'application/xhtml+xml',
    });
    workspace.opf.spine.push({ idref: 'chap03' });
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });

    const { newOrder } = await new SpineService(ws).reorderItems(workspace, 0, 2);

    expect(newOrder.map(item => item.id)).toEqual(['chap02', 'chap03', 'chap01']);
    expect(ws.updateSpineOrder).toHaveBeenCalledWith(expect.anything(), [
      'chap02',
      'chap03',
      'chap01',
    ]);
  });

  it('reorderItems rejects out-of-range indices with INVALID_INDEX', async () => {
    const ws = makeMutatorService({ fileExists: vi.fn(async () => true) });
    const service = new SpineService(ws);

    expect((await caught(service.reorderItems(makeWorkspace(), -1, 0))).code).toBe('INVALID_INDEX');
    expect((await caught(service.reorderItems(makeWorkspace(), 0, 2))).code).toBe('INVALID_INDEX');
  });

  it('reorderItems wraps storage failures in REORDER_ERROR', async () => {
    const ws = makeMutatorService({
      fileExists: vi.fn(async () => true),
      updateSpineOrder: vi.fn(async () => {
        throw new Error('save failed');
      }),
    });
    const error = await caught(new SpineService(ws).reorderItems(makeWorkspace(), 0, 1));
    expect(error.code).toBe('REORDER_ERROR');
  });
});

describe('SpineService.deleteChapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeDeleteService(overrides: Record<string, unknown> = {}): WorkspaceService {
    return {
      saveWorkspace: vi.fn(async () => {}),
      fileExists: vi.fn(async () => false),
      fileStorage: { deleteFile: vi.fn(async () => {}) },
      listSourceFiles: vi.fn(async () => []),
      deleteSourceFile: vi.fn(async () => {}),
      ...overrides,
    } as unknown as WorkspaceService;
  }

  it('removes the chapter from spine and manifest and deletes its files', async () => {
    const ws = makeDeleteService();
    const workspace = makeWorkspace();

    const { updatedWorkspace } = await new SpineService(ws).deleteChapter(workspace, 'chap01');

    expect(updatedWorkspace.opf.spine.map(item => item.idref)).toEqual(['chap02']);
    expect(updatedWorkspace.opf.manifest.map(item => item.id)).toEqual(['chap02']);
    expect(ws.saveWorkspace).toHaveBeenCalledWith(updatedWorkspace);

    const deleteFile = (ws as unknown as { fileStorage: { deleteFile: ReturnType<typeof vi.fn> } })
      .fileStorage.deleteFile;
    const deleted = deleteFile.mock.calls.map(call => call[1]);
    expect(deleted).toContain('OEBPS/Text/chap01.xhtml');
    expect(deleted).toContain('SOURCE/text/chap01.txt');
    // No metadata sidecar exists, so it is not deleted.
    expect(deleted).not.toContain('SOURCE/text/chap01.json');
  });

  it('also deletes the metadata sidecar when it exists', async () => {
    const ws = makeDeleteService({
      fileExists: vi.fn(async (_id: string, path: string) => path === 'SOURCE/text/chap01.json'),
    });

    await new SpineService(ws).deleteChapter(makeWorkspace(), 'chap01');

    const deleteFile = (ws as unknown as { fileStorage: { deleteFile: ReturnType<typeof vi.fn> } })
      .fileStorage.deleteFile;
    expect(deleteFile.mock.calls.map(call => call[1])).toContain('SOURCE/text/chap01.json');
  });

  it('throws CHAPTER_NOT_FOUND when the id is not in the spine', async () => {
    const ws = makeDeleteService();
    const error = await caught(new SpineService(ws).deleteChapter(makeWorkspace(), 'nope'));
    expect(error.code).toBe('CHAPTER_NOT_FOUND');
    expect(error.workspaceId).toBe('ws');
  });

  it('throws MANIFEST_ITEM_NOT_FOUND when the spine entry has no manifest item', async () => {
    const workspace = makeWorkspace();
    workspace.opf.spine.push({ idref: 'ghost' });
    const ws = makeDeleteService();

    const error = await caught(new SpineService(ws).deleteChapter(workspace, 'ghost'));
    expect(error.code).toBe('MANIFEST_ITEM_NOT_FOUND');
  });

  it('still succeeds when file deletion fails (best-effort cleanup)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ws = makeDeleteService({
      fileStorage: {
        deleteFile: vi.fn(async () => {
          throw new Error('locked');
        }),
      },
    });

    await expect(
      new SpineService(ws).deleteChapter(makeWorkspace(), 'chap01')
    ).resolves.toBeTruthy();
    expect(warn).toHaveBeenCalled();
  });

  it('wraps saveWorkspace failures in DELETE_ERROR', async () => {
    const ws = makeDeleteService({
      saveWorkspace: vi.fn(async () => {
        throw new Error('quota exceeded');
      }),
    });

    const error = await caught(new SpineService(ws).deleteChapter(makeWorkspace(), 'chap01'));
    expect(error.code).toBe('DELETE_ERROR');
    expect(error.message).toContain('quota exceeded');
  });
});

describe('SpineService.renameChapterId', () => {
  function makeRenameService(overrides: Record<string, unknown> = {}): WorkspaceService {
    return {
      updateManifestItem: vi.fn(async (w: WorkspaceState) => w),
      fileExists: vi.fn(async () => false),
      renameFile: vi.fn(async () => {}),
      listSourceFiles: vi.fn(async () => []),
      ...overrides,
    } as unknown as WorkspaceService;
  }

  it('updates the manifest id and href together', async () => {
    const ws = makeRenameService();
    const workspace = makeWorkspace();

    await new SpineService(ws).renameChapterId(workspace, 'chap01', 'prologue');

    expect(ws.updateManifestItem).toHaveBeenCalledWith(workspace, 'chap01', {
      id: 'prologue',
      href: 'Text/prologue.xhtml',
    });
  });

  it('renames the SOURCE text file and metadata sidecar when they exist', async () => {
    const renameFile = vi.fn(async () => {});
    const ws = makeRenameService({ fileExists: vi.fn(async () => true), renameFile });

    await new SpineService(ws).renameChapterId(makeWorkspace(), 'chap01', 'prologue');

    expect(renameFile).toHaveBeenCalledWith(
      'ws',
      'SOURCE/text/chap01.txt',
      'SOURCE/text/prologue.txt'
    );
    expect(renameFile).toHaveBeenCalledWith(
      'ws',
      'SOURCE/text/chap01.json',
      'SOURCE/text/prologue.json'
    );
  });

  it('rejects an id that is not a valid XML NCName', async () => {
    const ws = makeRenameService();
    const service = new SpineService(ws);

    const startsWithDigit = await caught(
      service.renameChapterId(makeWorkspace(), 'chap01', '1bad')
    );
    expect(startsWithDigit.message).toContain('Invalid ID format');

    const withSpace = await caught(service.renameChapterId(makeWorkspace(), 'chap01', 'bad id'));
    expect(withSpace.message).toContain('Invalid ID format');
    expect(ws.updateManifestItem).not.toHaveBeenCalled();
  });

  it('rejects an id that already exists in the manifest', async () => {
    const ws = makeRenameService();
    const error = await caught(
      new SpineService(ws).renameChapterId(makeWorkspace(), 'chap01', 'chap02')
    );
    expect(error.message).toContain("'chap02' already exists");
  });

  it('rejects renaming an id that is not in the manifest', async () => {
    const ws = makeRenameService();
    const error = await caught(
      new SpineService(ws).renameChapterId(makeWorkspace(), 'ghost', 'newid')
    );
    expect(error.message).toContain("'ghost' not found");
  });

  it('wraps storage failures in RENAME_ERROR', async () => {
    const ws = makeRenameService({
      updateManifestItem: vi.fn(async () => {
        throw new Error('opf locked');
      }),
    });

    const error = await caught(
      new SpineService(ws).renameChapterId(makeWorkspace(), 'chap01', 'prologue')
    );
    expect(error.code).toBe('RENAME_ERROR');
    expect(error.message).toContain('opf locked');
  });
});

describe('SpineService.setChapterLinear', () => {
  it('delegates the linear flag update to the workspace service', async () => {
    const updated = makeWorkspace();
    const ws = {
      updateSpineItem: vi.fn(async () => updated),
    } as unknown as WorkspaceService;
    const workspace = makeWorkspace();

    const { updatedWorkspace } = await new SpineService(ws).setChapterLinear(
      workspace,
      'chap01',
      false
    );

    expect(ws.updateSpineItem).toHaveBeenCalledWith(workspace, 'chap01', { linear: false });
    expect(updatedWorkspace).toBe(updated);
  });

  it('wraps failures in UPDATE_LINEAR_ERROR', async () => {
    const ws = {
      updateSpineItem: vi.fn(async () => {
        throw new Error('no such idref');
      }),
    } as unknown as WorkspaceService;

    const error = await caught(new SpineService(ws).setChapterLinear(makeWorkspace(), 'x', true));
    expect(error.code).toBe('UPDATE_LINEAR_ERROR');
    expect(error.message).toContain('no such idref');
  });
});
