import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureGeneratedNav } from './nav-coherence.js';
import { OutlineGenerator } from './outline-generator.js';
import type { WorkspaceService, WorkspaceState } from '../services/workspace/workspace.service.js';
import type { SpineService } from '../services/spine/spine.service.js';

vi.mock('./outline-generator.js', () => ({
  OutlineGenerator: {
    generateFromSpine: vi.fn(),
  },
}));

const NAV_XHTML = '<nav epub:type="toc"><ol><li><a href="ch1.xhtml">One</a></li></ol></nav>';

function makeWorkspace(manifest: Array<Record<string, unknown>> = []): WorkspaceState {
  return {
    id: 'ws-1',
    opf: { manifest },
    pathInfo: { basePath: 'OEBPS', rootfilePath: 'OEBPS/content.opf', opfFileName: 'content.opf' },
  } as unknown as WorkspaceState;
}

function makeWorkspaceService(navTxt: string | null) {
  return {
    fileExists: vi.fn(async (_id: string, path: string) =>
      path === 'SOURCE/text/nav.txt' ? navTxt !== null : false
    ),
    readFile: vi.fn(async () => new TextEncoder().encode(navTxt ?? '').buffer),
    writeFile: vi.fn(async () => undefined),
    addManifestItem: vi.fn(async (ws: WorkspaceState, item: Record<string, unknown>) => ({
      ...ws,
      opf: { ...ws.opf, manifest: [...ws.opf.manifest, item] },
    })),
  } as unknown as WorkspaceService;
}

function makeSpineService() {
  return {
    loadSpineItems: vi.fn(async () => [
      {
        idref: 'ch1',
        href: 'ch1.xhtml',
        linear: true,
        id: 'ch1',
        mediaType: 'application/xhtml+xml',
      },
    ]),
  } as unknown as SpineService;
}

beforeEach(() => {
  vi.mocked(OutlineGenerator.generateFromSpine).mockResolvedValue({
    xhtmlContent: NAV_XHTML,
    metadata: { id: 'nav', href: 'nav.xhtml', properties: ['nav'] },
  } as Awaited<ReturnType<typeof OutlineGenerator.generateFromSpine>>);
});

describe('ensureGeneratedNav', () => {
  it('auto mode (no nav.txt): writes nav.xhtml and registers the nav manifest entry', async () => {
    const ws = makeWorkspace([]);
    const workspaceService = makeWorkspaceService(null);
    const spineService = makeSpineService();

    const result = await ensureGeneratedNav(ws, spineService, workspaceService);

    expect(workspaceService.writeFile).toHaveBeenCalledWith('ws-1', 'OEBPS/nav.xhtml', NAV_XHTML);
    expect(workspaceService.addManifestItem).toHaveBeenCalledWith(
      ws,
      expect.objectContaining({ id: 'nav', href: 'nav.xhtml', properties: ['nav'] })
    );
    expect(result.xhtml).toBe(NAV_XHTML);
    expect(result.workspace.opf.manifest.some(m => m.properties?.includes('nav'))).toBe(true);
  });

  it('auto mode with an existing nav entry: regenerates but does not add a duplicate', async () => {
    const ws = makeWorkspace([
      { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: ['nav'] },
    ]);
    const workspaceService = makeWorkspaceService(null);
    const spineService = makeSpineService();

    const result = await ensureGeneratedNav(ws, spineService, workspaceService);

    expect(workspaceService.writeFile).toHaveBeenCalledWith('ws-1', 'OEBPS/nav.xhtml', NAV_XHTML);
    expect(workspaceService.addManifestItem).not.toHaveBeenCalled();
    expect(result.xhtml).toBe(NAV_XHTML);
    expect(result.workspace).toBe(ws);
  });

  it('passes the book primary language to the generator (so the nav is tagged + RTL)', async () => {
    const ws = {
      ...makeWorkspace([]),
      opf: { manifest: [], metadata: { language: ['ar'] } },
    } as unknown as WorkspaceState;
    await ensureGeneratedNav(ws, makeSpineService(), makeWorkspaceService(null));
    expect(OutlineGenerator.generateFromSpine).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'ws-1',
      expect.anything(),
      'ar'
    );
  });

  it('manual mode (non-empty nav.txt): leaves nav.xhtml untouched and returns the workspace unchanged', async () => {
    const ws = makeWorkspace([]);
    const workspaceService = makeWorkspaceService('* Part One\n  * Chapter 1');
    const spineService = makeSpineService();

    const result = await ensureGeneratedNav(ws, spineService, workspaceService);

    expect(spineService.loadSpineItems).not.toHaveBeenCalled();
    expect(workspaceService.writeFile).not.toHaveBeenCalled();
    expect(workspaceService.addManifestItem).not.toHaveBeenCalled();
    expect(result).toEqual({ workspace: ws, xhtml: null });
  });
});
