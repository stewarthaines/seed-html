import { describe, it, expect } from 'vitest';
import {
  PAYLOAD_SLOT,
  bytesToBase64,
  injectEpubPayload,
  readHtmlFilename,
} from './package-as-read.js';

const SHELL = `<!doctype html><html><head><meta name="readhtml-version" content="1.0.0" /></head><body>${PAYLOAD_SLOT}<script>document.getElementById('readhtml-payload')</${'script'}></body></html>`;

describe('bytesToBase64', () => {
  it('round-trips bytes through base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const decoded = Uint8Array.from(atob(bytesToBase64(bytes)), c => c.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });

  it('handles payloads larger than one encoding chunk', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 7).map((_, i) => i % 256);
    const decoded = Uint8Array.from(atob(bytesToBase64(bytes)), c => c.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });
});

describe('injectEpubPayload', () => {
  it('fills the slot and leaves the rest of the shell byte-identical', () => {
    const bytes = new Uint8Array([80, 75, 3, 4]); // zip magic
    const result = injectEpubPayload(SHELL, bytes);
    expect(result).toBe(
      SHELL.replace(PAYLOAD_SLOT, PAYLOAD_SLOT.replace('></', `>${btoa('PK\x03\x04')}</`))
    );
    // The id also appears in the reader's boot code — only the empty element is the slot.
    expect(result).toContain("getElementById('readhtml-payload')");
  });

  it('recovers the exact EPUB bytes from the injected document', () => {
    const bytes = new Uint8Array(1024).map((_, i) => (i * 31) % 256);
    const result = injectEpubPayload(SHELL, bytes);
    const match = result.match(/id="readhtml-payload">([^<]+)</);
    expect(match).not.toBeNull();
    const decoded = Uint8Array.from(atob(match![1]), c => c.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });

  it('throws when the slot is missing', () => {
    expect(() => injectEpubPayload('<html></html>', new Uint8Array([1]))).toThrow(/not found/);
  });

  it('throws when the slot appears more than once', () => {
    expect(() => injectEpubPayload(SHELL + PAYLOAD_SLOT, new Uint8Array([1]))).toThrow(
      /not unique/
    );
  });

  it('matches the slot in the vendored reader exactly once (contract check)', async () => {
    const fs = await import('node:fs');
    const shell = fs.readFileSync('public/read/READ.html', 'utf-8');
    expect(shell.split(PAYLOAD_SLOT).length).toBe(2);
  });
});

describe('readHtmlFilename', () => {
  it('swaps .epub for .html, case-insensitively', () => {
    expect(readHtmlFilename('My-Book-2026-06-20.epub')).toBe('My-Book-2026-06-20.html');
    expect(readHtmlFilename('BOOK.EPUB')).toBe('BOOK.html');
  });
});
