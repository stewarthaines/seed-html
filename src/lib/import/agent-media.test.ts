import { describe, it, expect, vi } from 'vitest';
import { addAgentMedia, checkAgentMedia, isAgentMediaTypeAllowed } from './agent-media.js';
import type {
  WorkspaceService,
  WorkspaceState,
} from '$lib/services/workspace/workspace.service.js';

const bytes = (...values: number[]) => new Uint8Array(values);

function setup(stored: Record<string, Uint8Array> = {}) {
  const workspace = {
    id: 'ws1',
    pathInfo: { basePath: 'OEBPS' },
    opf: {
      manifest: Object.keys(stored).map((path, i) => ({
        id: `m${i}`,
        href: path.replace(/^OEBPS\//, ''),
        mediaType: 'image/jpeg',
      })),
    },
  } as unknown as WorkspaceState;
  const service = {
    readFile: vi.fn(async (_id: string, path: string) => {
      const found = stored[path];
      if (!found) throw new Error('missing ' + path);
      return found.buffer.slice(found.byteOffset, found.byteOffset + found.byteLength);
    }),
  } as unknown as WorkspaceService;
  return { workspace, service };
}

describe('isAgentMediaTypeAllowed', () => {
  it('allows pictures, sound, video and fonts, never code or markup', () => {
    for (const type of ['image/jpeg', 'image/svg+xml', 'audio/mpeg', 'video/mp4', 'font/woff2']) {
      expect(isAgentMediaTypeAllowed(type)).toBe(true);
    }
    for (const type of ['application/javascript', 'application/xhtml+xml', 'text/css', '']) {
      expect(isAgentMediaTypeAllowed(type)).toBe(false);
    }
  });
});

describe('checkAgentMedia', () => {
  it('places a new picture under the app file-name rules', async () => {
    const { workspace, service } = setup();
    const plan = await checkAgentMedia(
      { filename: '/Users/a/Emma Portrait.JPG', bytes: bytes(1, 2) },
      workspace,
      service
    );
    expect(plan).toEqual({
      href: 'Images/Emma-Portrait.jpg',
      mediaType: 'image/jpeg',
      status: 'new',
    });
  });

  it('puts the file in the one subfolder asked for', async () => {
    const { workspace, service } = setup();
    const plan = await checkAgentMedia(
      { filename: 'ship.png', bytes: bytes(1), folder: 'ships' },
      workspace,
      service
    );
    expect(plan.href).toBe('Images/ships/ship.png');
  });

  it('tells identical bytes apart from different bytes under the same name', async () => {
    const { workspace, service } = setup({ 'OEBPS/Images/emma.jpg': bytes(1, 2, 3) });
    const same = await checkAgentMedia(
      { filename: 'EMMA.jpg', bytes: bytes(1, 2, 3) },
      workspace,
      service
    );
    expect(same).toMatchObject({ href: 'Images/emma.jpg', status: 'identical' });
    const other = await checkAgentMedia(
      { filename: 'emma.jpg', bytes: bytes(9) },
      workspace,
      service
    );
    expect(other).toMatchObject({ href: 'Images/emma.jpg', status: 'changed' });
  });

  it('refuses code, empty files and folder paths', async () => {
    const { workspace, service } = setup();
    await expect(
      checkAgentMedia({ filename: 'x.js', bytes: bytes(1) }, workspace, service)
    ).rejects.toThrow(/only pictures, audio, video and fonts/);
    await expect(
      checkAgentMedia({ filename: 'x.jpg', bytes: bytes() }, workspace, service)
    ).rejects.toThrow('the file is empty');
    await expect(
      checkAgentMedia({ filename: 'x.jpg', bytes: bytes(1), folder: '../Text' }, workspace, service)
    ).rejects.toThrow(/Not a folder name/);
  });
});

describe('addAgentMedia', () => {
  it('does nothing for identical bytes', async () => {
    const { workspace, service } = setup();
    const result = await addAgentMedia(
      { filename: 'emma.jpg', bytes: bytes(1) },
      { href: 'Images/emma.jpg', mediaType: 'image/jpeg', status: 'identical' },
      workspace,
      service
    );
    expect(result).toEqual({ workspace, href: 'Images/emma.jpg' });
  });

  it('overwrites in place without touching the manifest', async () => {
    const { workspace } = setup();
    const writeBinaryFile = vi.fn(async () => {});
    const service = { writeBinaryFile } as unknown as WorkspaceService;
    const result = await addAgentMedia(
      { filename: 'emma.jpg', bytes: bytes(7, 8) },
      { href: 'Images/emma.jpg', mediaType: 'image/jpeg', status: 'changed' },
      workspace,
      service
    );
    expect(result.workspace).toBe(workspace);
    expect(writeBinaryFile).toHaveBeenCalledWith(
      'ws1',
      'OEBPS/Images/emma.jpg',
      expect.any(ArrayBuffer)
    );
  });

  it('adds a new file to the manifest and writes it', async () => {
    const { workspace } = setup();
    const updated = {
      ...workspace,
      opf: { manifest: [{ id: 'img1', href: 'Images/ships/ship.png' }] },
    };
    const addManifestItem = vi.fn(async () => updated);
    const writeBinaryFile = vi.fn(async () => {});
    const service = { addManifestItem, writeBinaryFile } as unknown as WorkspaceService;
    const result = await addAgentMedia(
      { filename: 'ship.png', bytes: bytes(1), folder: 'ships' },
      { href: 'Images/ships/ship.png', mediaType: 'image/png', status: 'new' },
      workspace,
      service
    );
    expect(addManifestItem).toHaveBeenCalledWith(workspace, {
      href: 'Images/ships/ship.png',
      mediaType: 'image/png',
    });
    expect(result).toEqual({ workspace: updated, href: 'Images/ships/ship.png' });
  });
});
