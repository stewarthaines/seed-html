import { describe, it, expect } from 'vitest';
import {
  payloadSlot,
  bytesToBase64,
  base64ToBytes,
  injectPayload,
  SEED_PAYLOAD_ID,
} from './html-payload.js';
import { SEED_PAYLOAD_SLOT, seedHtmlFilename } from './package-as-seed.js';

const SLOT = payloadSlot('test-payload');
const SHELL = `<!doctype html><html><body>${SLOT}<script>document.getElementById('test-payload')</${'script'}></body></html>`;

describe('payloadSlot', () => {
  it('builds the contract-shaped empty element', () => {
    expect(payloadSlot(SEED_PAYLOAD_ID)).toBe(
      '<script type="application/epub+zip;base64" id="seedhtml-payload"></' + 'script>'
    );
    expect(SEED_PAYLOAD_SLOT).toBe(payloadSlot(SEED_PAYLOAD_ID));
  });
});

describe('base64 helpers', () => {
  it('round-trips bytes, including multi-chunk payloads', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 7).map((_, i) => (i * 31) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});

describe('injectPayload', () => {
  it('fills the slot and recovers the exact bytes', () => {
    const bytes = new Uint8Array([80, 75, 3, 4, 255, 0, 128]);
    const result = injectPayload(SHELL, SLOT, bytes);
    const match = result.match(/id="test-payload">([^<]+)</);
    expect(match).not.toBeNull();
    expect(base64ToBytes(match![1])).toEqual(bytes);
    // Only the empty element is the slot; the boot-code reference survives.
    expect(result).toContain("getElementById('test-payload')");
  });

  it('throws when the slot is missing or duplicated', () => {
    expect(() => injectPayload('<html></html>', SLOT, new Uint8Array([1]))).toThrow(/not found/);
    expect(() => injectPayload(SHELL + SLOT, SLOT, new Uint8Array([1]))).toThrow(/not unique/);
  });
});

describe('the app document slot (contract check)', () => {
  it('index.html carries the seedhtml-payload slot exactly once', async () => {
    const fs = await import('node:fs');
    const html = fs.readFileSync('index.html', 'utf-8');
    expect(html.split(SEED_PAYLOAD_SLOT).length).toBe(2);
  });
});

describe('seedHtmlFilename', () => {
  it('swaps .epub for .SEED.html, case-insensitively', () => {
    expect(seedHtmlFilename('My-Book-2026-06-20.epub')).toBe('My-Book-2026-06-20.SEED.html');
    expect(seedHtmlFilename('BOOK.EPUB')).toBe('BOOK.SEED.html');
  });
});
