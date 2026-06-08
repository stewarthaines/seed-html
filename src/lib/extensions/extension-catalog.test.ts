import { describe, it, expect, vi } from 'vitest';
import {
  loadExtensionCatalog,
  resolveExtensionFileUrl,
  isExtensionCatalogAvailable,
} from './extension-catalog.js';

const BASE = 'https://app.example.com/';

function jsonResponse(data: unknown): Response {
  return { ok: true, json: async () => data } as unknown as Response;
}

describe('extension-catalog', () => {
  it('parses and validates a manifest', async () => {
    const entries = [
      { id: 'prism', name: 'Prism', scripts: ['prism.js'], transforms: ['transformPrism.js'] },
      { id: 'bad' }, // missing scripts/transforms → filtered
    ];
    const fetchFn = vi.fn(async () => jsonResponse(entries));

    const result = await loadExtensionCatalog({
      protocol: 'https:',
      baseUrl: BASE,
      fetch: fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith('https://app.example.com/extensions/manifest.json');
    expect(result).toEqual([
      { id: 'prism', name: 'Prism', scripts: ['prism.js'], transforms: ['transformPrism.js'] },
    ]);
  });

  it('returns [] on file:// without fetching', async () => {
    const fetchFn = vi.fn();
    expect(
      await loadExtensionCatalog({ protocol: 'file:', baseUrl: BASE, fetch: fetchFn })
    ).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns [] on a non-array / malformed manifest', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ nope: true }));
    expect(
      await loadExtensionCatalog({ protocol: 'https:', baseUrl: BASE, fetch: fetchFn })
    ).toEqual([]);
  });

  it('returns [] when the fetch throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network');
    });
    expect(
      await loadExtensionCatalog({ protocol: 'https:', baseUrl: BASE, fetch: fetchFn })
    ).toEqual([]);
  });

  it('resolves a file URL under extensions/<id>/', () => {
    expect(resolveExtensionFileUrl('prism', 'prism.js', { baseUrl: BASE })).toBe(
      'https://app.example.com/extensions/prism/prism.js'
    );
  });

  it('reports availability by protocol', () => {
    expect(isExtensionCatalogAvailable({ protocol: 'https:' })).toBe(true);
    expect(isExtensionCatalogAvailable({ protocol: 'file:' })).toBe(false);
  });
});
