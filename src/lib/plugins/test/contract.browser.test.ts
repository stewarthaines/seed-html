import { describe, it, expect } from 'vitest';
import {
  createInitMessage,
  isInitMessage,
  isInsertMessage,
  isNavigateMessage,
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

    const init = createInitMessage('publish', dir);
    expect(isInitMessage(init)).toBe(true);
    expect(init.opfsDirHandle.kind).toBe('directory');

    // Mirror the plugin's findEpubFile: iterate the handed handle for *.epub.
    const epubs: string[] = [];
    for await (const entry of init.opfsDirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.epub')) epubs.push(entry.name);
    }
    expect(epubs).toEqual(['book.epub']);

    await root.removeEntry('publish-contract-test', { recursive: true });
  });
});
