import { describe, it, expect } from 'vitest';
import {
  createInitMessage,
  createContextMessage,
  isContextMessage,
  isImportEpubMessage,
  isAddMediaMessage,
  createMediaAddedMessage,
  isInitMessage,
  isInsertMessage,
  isNavigateMessage,
  isOpenMessage,
  isPluginReadyMessage,
  type PluginManifestEntry,
} from '../contract';
import {
  isPluginHostingAvailable,
  loadPluginManifest,
  resolvePluginEntryUrl,
  findActivePlugin,
} from '../plugin-registry';

/**
 * Browser-mode contract tests for the host ↔ plugin boundary. Runs in real
 * Chromium so the OPFS handle hand-off can be exercised for real (happy-dom has
 * no navigator.storage). The shape/registry checks are environment-agnostic but
 * live here too so the whole contract is pinned in one place.
 */

const PUBLISH: PluginManifestEntry = {
  id: 'publish-to-remote',
  name: 'Publish to Remote',
  entry: 'publish-to-remote/plugin.html',
  presentation: 'view',
};

const jsonResponse = (body: unknown, ok = true): Response =>
  new Response(ok ? JSON.stringify(body) : 'err', { status: ok ? 200 : 404 });
const fetchReturning = (make: () => Response): typeof fetch =>
  (async () => make()) as unknown as typeof fetch;

describe('contract message shapes', () => {
  it('isInsertMessage accepts a string payload only', () => {
    expect(isInsertMessage({ type: 'insert', content: 'x' })).toBe(true);
    expect(isInsertMessage({ type: 'insert', content: 1 })).toBe(false);
    expect(isInsertMessage({ type: 'init' })).toBe(false);
    expect(isInsertMessage(null)).toBe(false);
  });

  it('isNavigateMessage requires a string path', () => {
    expect(isNavigateMessage({ type: 'navigate', path: 'OEBPS/Text/c.xhtml' })).toBe(true);
    expect(isNavigateMessage({ type: 'navigate' })).toBe(false);
    expect(isNavigateMessage({ type: 'navigate', path: 7 })).toBe(false);
    expect(isNavigateMessage({ type: 'insert', content: 'x' })).toBe(false);
  });

  it('isPluginReadyMessage matches the handshake (pluginType optional)', () => {
    expect(isPluginReadyMessage({ type: 'plugin-ready' })).toBe(true);
    expect(isPluginReadyMessage({ type: 'plugin-ready', pluginType: 'publish-to-remote' })).toBe(
      true
    );
    expect(isPluginReadyMessage({ type: 'init' })).toBe(false);
  });

  it('isContextMessage requires a valid theme, locale string, and dir', () => {
    const ctx = createContextMessage('dark', 'ar', 'rtl');
    expect(ctx).toEqual({ type: 'context', theme: 'dark', locale: 'ar', dir: 'rtl' });
    expect(isContextMessage(ctx)).toBe(true);
    expect(isContextMessage({ type: 'context', theme: 'light', locale: 'en', dir: 'ltr' })).toBe(
      true
    );
    expect(isContextMessage({ type: 'context', theme: 'sepia', locale: 'en', dir: 'ltr' })).toBe(
      false
    );
    expect(isContextMessage({ type: 'context', theme: 'dark', locale: 'en', dir: 'up' })).toBe(
      false
    );
    expect(isContextMessage({ type: 'context', theme: 'dark', dir: 'ltr' })).toBe(false);
    expect(isContextMessage({ type: 'init', projectId: 'p' })).toBe(false);
  });

  it('createInitMessage carries the surface only when one is named', () => {
    const plain = createInitMessage('p', undefined, ['workspaces', 'p']);
    expect('surface' in plain).toBe(false);
    const send = createInitMessage('p', undefined, ['workspaces', 'p'], 'send');
    expect(send.surface).toBe('send');
  });

  it('createContextMessage carries the known identifiers only when given', () => {
    const plain = createContextMessage('light', 'en', 'ltr');
    expect('knownIdentifiers' in plain).toBe(false);
    const known = createContextMessage('light', 'en', 'ltr', {}, 'urn:uuid:a', undefined, [
      'urn:uuid:a',
      'urn:uuid:b',
    ]);
    expect(known.knownIdentifiers).toEqual(['urn:uuid:a', 'urn:uuid:b']);
    expect(isContextMessage(known)).toBe(true);
  });

  it('isImportEpubMessage requires a filename and an ArrayBuffer', () => {
    const bytes = new ArrayBuffer(4);
    expect(isImportEpubMessage({ type: 'import-epub', filename: 'b.epub', bytes })).toBe(true);
    expect(isImportEpubMessage({ type: 'import-epub', filename: 'b.epub' })).toBe(false);
    expect(isImportEpubMessage({ type: 'import-epub', bytes })).toBe(false);
    expect(isImportEpubMessage({ type: 'import-epub', filename: 'b.epub', bytes: 'x' })).toBe(
      false
    );
  });

  it('isAddMediaMessage requires a request id, a filename, a media type and bytes', () => {
    const bytes = new ArrayBuffer(4);
    const message = {
      type: 'add-media',
      requestId: 'r1',
      filename: 'take.mp3',
      mediaType: 'audio/mpeg',
      bytes,
    };
    expect(isAddMediaMessage(message)).toBe(true);
    expect(isAddMediaMessage({ ...message, requestId: undefined })).toBe(false);
    expect(isAddMediaMessage({ ...message, mediaType: 1 })).toBe(false);
    expect(isAddMediaMessage({ ...message, bytes: new Uint8Array(4) })).toBe(false);
  });

  it('createMediaAddedMessage carries the href or the error with the request id', () => {
    expect(createMediaAddedMessage('r1', { href: 'Audio/take.mp3' })).toEqual({
      type: 'media-added',
      requestId: 'r1',
      href: 'Audio/take.mp3',
    });
    expect(createMediaAddedMessage('r2', { error: 'no' })).toEqual({
      type: 'media-added',
      requestId: 'r2',
      error: 'no',
    });
  });

  it('isOpenMessage accepts the two host screens only', () => {
    expect(isOpenMessage({ type: 'open', target: 'published' })).toBe(true);
    expect(isOpenMessage({ type: 'open', target: 'destinations' })).toBe(true);
    expect(isOpenMessage({ type: 'open', target: 'settings' })).toBe(false);
    expect(isOpenMessage({ type: 'open' })).toBe(false);
  });

  it('isInitMessage requires a projectId and a directory handle', () => {
    expect(isInitMessage({ type: 'init', projectId: 'p', opfsDirHandle: { kind: 'directory' } })).toBe(
      true
    );
    expect(isInitMessage({ type: 'init', opfsDirHandle: { kind: 'directory' } })).toBe(false);
    expect(isInitMessage({ type: 'init', projectId: 'p', opfsDirHandle: { kind: 'file' } })).toBe(
      false
    );
  });
});

describe('registry: HTTP-only + availability × enablement', () => {
  it('hosting is unavailable on file://', () => {
    expect(isPluginHostingAvailable({ protocol: 'file:' })).toBe(false);
    expect(isPluginHostingAvailable({ protocol: 'https:' })).toBe(true);
  });

  it('loadPluginManifest short-circuits on file:// without fetching', async () => {
    let called = false;
    const fetchFn = (async () => {
      called = true;
      return jsonResponse([PUBLISH]);
    }) as unknown as typeof fetch;
    expect(await loadPluginManifest({ protocol: 'file:', fetch: fetchFn })).toEqual([]);
    expect(called).toBe(false);
  });

  it('loadPluginManifest parses and drops invalid entries', async () => {
    const out = await loadPluginManifest({
      protocol: 'https:',
      baseUrl: 'https://x/',
      fetch: fetchReturning(() => jsonResponse([PUBLISH, { id: 'incomplete' }])),
    });
    expect(out).toEqual([PUBLISH]);
  });

  it('loadPluginManifest returns [] on non-ok, malformed, non-array, or thrown fetch', async () => {
    const base = { protocol: 'https:', baseUrl: 'https://x/' } as const;
    expect(
      await loadPluginManifest({ ...base, fetch: fetchReturning(() => jsonResponse(null, false)) })
    ).toEqual([]);
    expect(
      await loadPluginManifest({
        ...base,
        fetch: fetchReturning(() => new Response('{not json', { status: 200 })),
      })
    ).toEqual([]);
    expect(
      await loadPluginManifest({ ...base, fetch: fetchReturning(() => jsonResponse({})) })
    ).toEqual([]);
    expect(
      await loadPluginManifest({
        ...base,
        fetch: (async () => {
          throw new Error('network');
        }) as unknown as typeof fetch,
      })
    ).toEqual([]);
  });

  it('findActivePlugin requires both available and enabled', () => {
    expect(findActivePlugin([PUBLISH], ['publish-to-remote'], 'publish-to-remote')).toEqual(PUBLISH);
    expect(findActivePlugin([PUBLISH], [], 'publish-to-remote')).toBeNull();
    expect(findActivePlugin([], ['publish-to-remote'], 'publish-to-remote')).toBeNull();
  });

  it('resolvePluginEntryUrl resolves plugins/<entry> against the base', () => {
    expect(resolvePluginEntryUrl(PUBLISH, { baseUrl: 'https://host/app/' })).toBe(
      'https://host/app/plugins/publish-to-remote/plugin.html'
    );
  });
});

describe('init hand-off with a real OPFS directory handle', () => {
  it('hands over a usable directory the plugin can scan for epubs', async () => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry('publish-contract-test', { recursive: true }).catch(() => {
      // No leftover from a previous run — fine.
    });
    const dir = await root.getDirectoryHandle('publish-contract-test', { create: true });

    // The core packages an epub into the output dir; the plugin scans the handle.
    const fileHandle = await dir.getFileHandle('book.epub', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob(['epub-bytes']));
    await writable.close();

    const init = createInitMessage('publish', dir, ['workspaces', 'publish']);
    expect(isInitMessage(init)).toBe(true);
    expect(init.opfsDirHandle?.kind).toBe('directory');
    expect(init.opfsDirPath).toEqual(['workspaces', 'publish']);

    // Mirror the plugin's findEpubFile: iterate the handed handle for *.epub.
    const epubs: string[] = [];
    for await (const entry of init.opfsDirHandle!.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.epub')) epubs.push(entry.name);
    }
    expect(epubs).toEqual(['book.epub']);

    await root.removeEntry('publish-contract-test', { recursive: true });
  });
});
