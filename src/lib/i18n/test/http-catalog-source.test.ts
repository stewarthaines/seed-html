/**
 * Unit tests for the http catalog source (injectable env — no global mutation)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isHttpSourceAvailable,
  fetchLocalesManifest,
  fetchCatalogFile,
} from '../http-catalog-source.js';
import type { LocalesManifestEntry } from '../types.js';

const deEntry: LocalesManifestEntry = {
  code: 'de',
  name: 'Deutsch',
  englishName: 'German',
  direction: 'ltr',
  file: 'de.json',
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('http-catalog-source', () => {
  describe('isHttpSourceAvailable', () => {
    it('is false on file://', () => {
      expect(isHttpSourceAvailable({ protocol: 'file:' })).toBe(false);
    });

    it('is true on http(s)', () => {
      expect(isHttpSourceAvailable({ protocol: 'https:' })).toBe(true);
      expect(isHttpSourceAvailable({ protocol: 'http:' })).toBe(true);
    });
  });

  describe('fetchLocalesManifest', () => {
    it('returns the validated manifest', async () => {
      const manifest = { version: '1.0.0', locales: [deEntry] };
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(manifest));

      const result = await fetchLocalesManifest({ protocol: 'https:', fetch: fetchMock });

      expect(fetchMock).toHaveBeenCalledWith('locales/manifest.json', { cache: 'no-cache' });
      expect(result).toEqual(manifest);
    });

    it('filters malformed entries', async () => {
      const manifest = {
        version: '1.0.0',
        locales: [deEntry, { code: 42 }, null, { file: 'x.json' }],
      };
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(manifest));

      const result = await fetchLocalesManifest({ protocol: 'https:', fetch: fetchMock });

      expect(result?.locales).toEqual([deEntry]);
    });

    it('returns null on file://', async () => {
      const fetchMock = vi.fn();
      expect(await fetchLocalesManifest({ protocol: 'file:', fetch: fetchMock })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null on http error, network failure, or malformed body', async () => {
      expect(
        await fetchLocalesManifest({
          protocol: 'https:',
          fetch: vi.fn().mockResolvedValue(jsonResponse({}, false)),
        })
      ).toBeNull();
      expect(
        await fetchLocalesManifest({
          protocol: 'https:',
          fetch: vi.fn().mockRejectedValue(new Error('offline')),
        })
      ).toBeNull();
      expect(
        await fetchLocalesManifest({
          protocol: 'https:',
          fetch: vi.fn().mockResolvedValue(jsonResponse('not an object')),
        })
      ).toBeNull();
    });
  });

  describe('fetchCatalogFile', () => {
    it('returns the raw catalog text', async () => {
      const body = { '': { Language: 'de' }, Save: 'Speichern' };
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));

      const result = await fetchCatalogFile(deEntry, { protocol: 'https:', fetch: fetchMock });

      expect(fetchMock).toHaveBeenCalledWith('locales/de.json', { cache: 'no-cache' });
      expect(result).toBe(JSON.stringify(body));
    });

    it('returns null on file://, http error, or network failure', async () => {
      expect(await fetchCatalogFile(deEntry, { protocol: 'file:', fetch: vi.fn() })).toBeNull();
      expect(
        await fetchCatalogFile(deEntry, {
          protocol: 'https:',
          fetch: vi.fn().mockResolvedValue(jsonResponse({}, false)),
        })
      ).toBeNull();
      expect(
        await fetchCatalogFile(deEntry, {
          protocol: 'https:',
          fetch: vi.fn().mockRejectedValue(new Error('offline')),
        })
      ).toBeNull();
    });
  });
});
