import { describe, it, expect, vi } from 'vitest';
import { addPluginMedia, isPluginMediaTypeAllowed, pluginMediaFilename } from './add-media.js';
import type {
  WorkspaceService,
  WorkspaceState,
} from '$lib/services/workspace/workspace.service.js';

const workspace = { id: 'ws1' } as unknown as WorkspaceState;
const service = {} as WorkspaceService;

function fakeImport() {
  return vi.fn(async (ws: WorkspaceState, _svc: WorkspaceService, file: File, mediaType?: string) => ({
    workspace: ws,
    href: `Audio/${file.name}`,
    mediaType: mediaType ?? file.type,
  }));
}

describe('addPluginMedia', () => {
  it('imports an audio file under its own name and returns where it landed', async () => {
    const importFile = fakeImport();
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const result = await addPluginMedia(
      { filename: 'take.mp3', mediaType: 'audio/mpeg', bytes },
      workspace,
      service,
      importFile
    );
    expect(result.href).toBe('Audio/take.mp3');
    const file = importFile.mock.calls[0][2];
    expect(file.name).toBe('take.mp3');
    expect(file.type).toBe('audio/mpeg');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('refuses anything but audio', async () => {
    const importFile = fakeImport();
    await expect(
      addPluginMedia(
        { filename: 'x.js', mediaType: 'application/javascript', bytes: new ArrayBuffer(4) },
        workspace,
        service,
        importFile
      )
    ).rejects.toThrow(/only add audio/);
    expect(importFile).not.toHaveBeenCalled();
  });

  it('refuses an empty or unnamed file', async () => {
    const importFile = fakeImport();
    const request = { filename: 'take.mp3', mediaType: 'audio/mpeg', bytes: new ArrayBuffer(0) };
    await expect(addPluginMedia(request, workspace, service, importFile)).rejects.toThrow(/empty/);
    await expect(
      addPluginMedia(
        { ...request, filename: '  ', bytes: new ArrayBuffer(2) },
        workspace,
        service,
        importFile
      )
    ).rejects.toThrow(/no name/);
    expect(importFile).not.toHaveBeenCalled();
  });
});

describe('pluginMediaFilename', () => {
  it('keeps only the last path segment', () => {
    expect(pluginMediaFilename('../../META-INF/take.mp3')).toBe('take.mp3');
    expect(pluginMediaFilename('a\\b\\take.mp3')).toBe('take.mp3');
  });
});

describe('isPluginMediaTypeAllowed', () => {
  it('allows audio types only', () => {
    expect(isPluginMediaTypeAllowed('audio/mpeg')).toBe(true);
    expect(isPluginMediaTypeAllowed('image/png')).toBe(false);
  });
});
