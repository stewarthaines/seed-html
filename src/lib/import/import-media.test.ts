import { describe, it, expect, vi } from 'vitest';
import type {
  WorkspaceService,
  WorkspaceState,
} from '$lib/services/workspace/workspace.service.js';
import {
  importFileToManifest,
  reliableMediaType,
  filenameStem,
  formatImageSnippet,
  formatVideoSnippet,
} from './import-media.js';

describe('reliableMediaType', () => {
  const file = (name: string, type: string) => new File([''], name, { type });

  it('trusts a specific browser type', () => {
    expect(reliableMediaType(file('photo.jpg', 'image/jpeg'))).toBe('image/jpeg');
  });

  it('falls back to filename detection for generic types', () => {
    expect(reliableMediaType(file('track.mp3', 'application/octet-stream'))).toBe('audio/mpeg');
  });

  it('prefers filename detection for fonts and JavaScript', () => {
    expect(reliableMediaType(file('font.woff2', 'application/font-woff2'))).toBe('font/woff2');
    expect(reliableMediaType(file('app.js', 'text/plain'))).toBe('application/javascript');
  });
});

describe('filenameStem', () => {
  it('drops the extension', () => {
    expect(filenameStem('cover-photo.png')).toBe('cover-photo');
  });

  it('keeps extensionless and dot-leading names whole', () => {
    expect(filenameStem('README')).toBe('README');
    expect(filenameStem('.hidden')).toBe('.hidden');
  });
});

describe('snippet formatting', () => {
  it('substitutes the image template placeholders (all occurrences)', () => {
    const template = '![<alt>](<href> "<alt>")';
    expect(formatImageSnippet(template, { href: 'Images/a.png', alt: 'A photo' })).toBe(
      '![A photo](Images/a.png "A photo")'
    );
  });

  it('substitutes the video template placeholder', () => {
    expect(
      formatVideoSnippet('<video src="<href>" controls="controls"></video>', {
        href: 'Video/clip.mp4',
      })
    ).toBe('<video src="Video/clip.mp4" controls="controls"></video>');
  });
});

describe('importFileToManifest', () => {
  function fakeBook(hrefs: string[]) {
    const workspace = {
      id: 'ws1',
      opf: {
        manifest: hrefs.map((href, i) => ({ id: `i${i}`, href, mediaType: 'image/svg+xml' })),
      },
      pathInfo: { basePath: 'OEBPS' },
    } as unknown as WorkspaceState;
    const service = {
      addManifestItem: vi.fn(
        async (ws: WorkspaceState, item: { href: string; mediaType: string }) => ({
          ...ws,
          opf: { ...ws.opf, manifest: [...ws.opf.manifest, { id: 'new', ...item }] },
        })
      ),
      writeFile: vi.fn(async () => {}),
      writeBinaryFile: vi.fn(async () => {}),
    } as unknown as WorkspaceService;
    return { workspace, service };
  }

  it('places a file in the requested subfolder of its media folder, kept unique', async () => {
    const { workspace, service } = fakeBook(['Images/maps/ballarat.svg']);
    const file = new File(['<svg/>'], 'ballarat.svg', { type: 'image/svg+xml' });
    const result = await importFileToManifest(workspace, service, file, 'image/svg+xml', 'maps');
    expect(result.href).toMatch(/^Images\/maps\/ballarat.+\.svg$/);
    expect(result.href).not.toBe('Images/maps/ballarat.svg');
  });

  it('keeps the media folder alone without a subfolder', async () => {
    const { workspace, service } = fakeBook([]);
    const file = new File(['<svg/>'], 'albany.svg', { type: 'image/svg+xml' });
    const result = await importFileToManifest(workspace, service, file, 'image/svg+xml');
    expect(result.href).toBe('Images/albany.svg');
  });
});
