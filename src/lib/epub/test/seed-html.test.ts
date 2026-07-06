/**
 * Unit tests for SEED.html locale-catalog injection (Phase C of the multi-source
 * i18n delivery): buildLocaleBundleDataUrl and injectI18nBundle.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { buildLocaleBundleDataUrl, injectI18nBundle } from '../seed-html.js';
import type { FileStorageAPI } from '../../storage/index.js';
import { Zip } from '../../zip/index.js';

// happy-dom's stream implementation hangs the real Compression/Decompression
// pipeline (same reason zip-writer.test.ts mocks it). Stub both with a matched
// passthrough pair so writer→reader round-trips stay byte-faithful; the real
// deflate path runs in browsers, where the i18n loader already consumes these
// bundles in production.
class PassthroughStream {
  readable: ReadableStream;
  writable: WritableStream;
  constructor(_format: string) {
    const transform = new TransformStream();
    this.readable = transform.readable;
    this.writable = transform.writable;
  }
}

beforeAll(() => {
  vi.stubGlobal('CompressionStream', PassthroughStream);
  vi.stubGlobal('DecompressionStream', PassthroughStream);
});

const encode = (html: string): ArrayBuffer => new TextEncoder().encode(html).buffer as ArrayBuffer;
const decode = (bytes: ArrayBuffer): string => new TextDecoder().decode(bytes);

/** A minimal single-file build carrying the current null anchor. */
const MARKER_HTML =
  '<!doctype html><html><head><title>SEED</title>' +
  '<script id="editme-i18n-bundle">window.__EDITME_I18N_BUNDLE__=null;</script>' +
  '</head><body><div id="app"></div></body></html>';

/** A pre-anchor build with a populated (legacy, spaced) assignment. */
const LEGACY_HTML =
  '<!doctype html><html><head>' +
  "<script>window.__EDITME_I18N_BUNDLE__ = 'data:application/zip;base64,UEsDBA==';</script>" +
  '</head><body></body></html>';

/** An ancient build with no bundle assignment at all. */
const NO_ANCHOR_HTML = '<!doctype html><html><head></head><body></body></html>';

/**
 * A trap document: `</head>` appears inside an inlined script string literal
 * BEFORE the real assignment — string surgery must target the assignment, never
 * a generic `</head>` splice.
 */
const TRAP_HTML =
  '<!doctype html><html><head>' +
  '<script>const tpl = "</head><body>oops";</script>' +
  '<script id="editme-i18n-bundle">window.__EDITME_I18N_BUNDLE__=null;</script>' +
  '</head><body></body></html>';

const DATA_URL = 'data:application/zip;base64,AAAA';

function mockLocalesStorage(files: Record<string, string>): FileStorageAPI {
  return {
    listFiles: vi.fn().mockResolvedValue(Object.keys(files)),
    readTextFile: vi
      .fn()
      .mockImplementation(async (_workspace: string, name: string) => files[name]),
  } as unknown as FileStorageAPI;
}

describe('injectI18nBundle', () => {
  it('replaces the null anchor', () => {
    const result = decode(injectI18nBundle(encode(MARKER_HTML), DATA_URL));

    expect(result).toContain(`window.__EDITME_I18N_BUNDLE__='${DATA_URL}';`);
    expect(result).not.toContain('window.__EDITME_I18N_BUNDLE__=null;');
    // Surrounding document intact
    expect(result).toContain('<div id="app">');
    expect(result).toContain('<title>SEED</title>');
  });

  it('replaces a legacy populated assignment', () => {
    const result = decode(injectI18nBundle(encode(LEGACY_HTML), DATA_URL));

    expect(result).toContain(`window.__EDITME_I18N_BUNDLE__='${DATA_URL}';`);
    expect(result).not.toContain('UEsDBA==');
  });

  it('is idempotent: re-injecting an already-injected file replaces the payload', () => {
    const once = injectI18nBundle(encode(MARKER_HTML), 'data:application/zip;base64,FIRST');
    const twice = decode(injectI18nBundle(once, 'data:application/zip;base64,SECOND'));

    expect(twice).toContain("window.__EDITME_I18N_BUNDLE__='data:application/zip;base64,SECOND';");
    expect(twice).not.toContain('FIRST');
    // Exactly one assignment remains
    expect(twice.match(/__EDITME_I18N_BUNDLE__/g)).toHaveLength(1);
  });

  it('targets the assignment, not a </head> inside a script string literal', () => {
    const result = decode(injectI18nBundle(encode(TRAP_HTML), DATA_URL));

    expect(result).toContain(`window.__EDITME_I18N_BUNDLE__='${DATA_URL}';`);
    // The trap literal is untouched
    expect(result).toContain('const tpl = "</head><body>oops";');
  });

  it('throws when no assignment exists (pre-i18n build)', () => {
    expect(() => injectI18nBundle(encode(NO_ANCHOR_HTML), DATA_URL)).toThrow(
      /no i18n bundle assignment/
    );
  });
});

describe('buildLocaleBundleDataUrl', () => {
  const deCatalog = JSON.stringify({ '': { Language: 'de' }, Save: 'Speichern' });
  const arCatalog = JSON.stringify({ '': { Language: 'ar' }, Save: 'حفظ' });

  it('zips all cached non-en catalogs into a data URL', async () => {
    const storage = mockLocalesStorage({
      'de.json': deCatalog,
      'ar.json': arCatalog,
      'en.json': JSON.stringify({ '': { Language: 'en' } }),
      '.manifest.json': JSON.stringify({ version: '1', locales: [] }),
    });

    const dataUrl = await buildLocaleBundleDataUrl(storage);

    expect(dataUrl).toMatch(/^data:application\/zip;base64,/);

    // Round-trip through the same Zip reader the loader uses
    const base64 = (dataUrl as string).split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const zip = new Zip(bytes.buffer);

    const names = zip.entries.map(e => e.fileName).sort();
    expect(names).toEqual(['ar.json', 'de.json']); // no en.json, no .manifest.json

    const deEntry = zip.entries.find(e => e.fileName === 'de.json');
    const deText = await (await deEntry!.extract()).text();
    expect(JSON.parse(deText)).toEqual(JSON.parse(deCatalog));
  });

  it('returns null when only en/dot-files are cached', async () => {
    const storage = mockLocalesStorage({
      'en.json': JSON.stringify({}),
      '.manifest.json': JSON.stringify({}),
    });

    expect(await buildLocaleBundleDataUrl(storage)).toBeNull();
  });

  it('returns null when the locales workspace does not exist', async () => {
    const storage = {
      listFiles: vi.fn().mockRejectedValue(new Error('no workspace')),
    } as unknown as FileStorageAPI;

    expect(await buildLocaleBundleDataUrl(storage)).toBeNull();
  });

  it('skips corrupt catalogs but carries the rest', async () => {
    const storage = mockLocalesStorage({
      'de.json': deCatalog,
      'ka.json': 'not json{{{',
    });

    const dataUrl = await buildLocaleBundleDataUrl(storage);

    const base64 = (dataUrl as string).split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const zip = new Zip(bytes.buffer);

    expect(zip.entries.map(e => e.fileName)).toEqual(['de.json']);
  });

  it('round-trips an injected bundle through injectI18nBundle', async () => {
    const storage = mockLocalesStorage({ 'de.json': deCatalog });

    const dataUrl = await buildLocaleBundleDataUrl(storage);
    const injected = decode(injectI18nBundle(encode(MARKER_HTML), dataUrl as string));

    // Extract the data URL back out of the injected HTML, exactly as the loader
    // would read the global at runtime.
    const match = /window\.__EDITME_I18N_BUNDLE__='([^']+)';/.exec(injected);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(dataUrl);
  });
});
