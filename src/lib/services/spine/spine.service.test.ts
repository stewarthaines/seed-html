import { describe, it, expect, vi } from 'vitest';
import { SpineService } from './spine.service.js';
import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';

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
