/**
 * ZIP Reader Integration Tests - Simplified
 * Tests ZIP structure parsing without file extraction to avoid happy-dom DecompressionStream issues
 * Real file extraction is tested in Storybook and e2e tests in browser environment
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { Zip } from './zip-reader.js';

// Helper to load fixture files
const loadZipFixture = async (filename: string): Promise<ArrayBuffer> => {
  const fixturePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'test/fixtures',
    filename
  );
  const data = await readFile(fixturePath);
  // Convert Node.js Buffer to ArrayBuffer properly
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
};

describe('ZIP Reader - Structure Parsing', () => {
  describe('ZIP File Parsing', () => {
    it('should parse ZIP file structure correctly', async () => {
      const zipData = await loadZipFixture('simple-store.zip');
      const zip = new Zip(zipData);

      // Verify ZIP structure is parsed correctly
      expect(zip.entries).toHaveLength(1);

      const entry = zip.entries[0];
      expect(entry.fileName).toBe('hello.txt');
      expect(entry.compressionMethod).toBe(0x00); // Store (no compression)
      expect(entry.uncompressedSize).toBe(13); // "Hello, World!" length
      expect(entry.compressedSize).toBe(13);
      expect(entry.startsAt).toBeGreaterThan(0);
      expect(typeof entry.extract).toBe('function');
    });

    it('should handle ZIP creation without hanging', async () => {
      const zipData = await loadZipFixture('simple-store.zip');

      // Test that ZIP parsing doesn't hang
      const createPromise = new Promise(resolve => {
        const zip = new Zip(zipData);
        resolve(zip);
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ZIP parsing timeout')), 1000)
      );

      const zip = await Promise.race([createPromise, timeoutPromise]);
      expect(zip).toBeInstanceOf(Zip);
    });
  });

  describe('Entry Properties', () => {
    it('should expose correct entry properties for integration', async () => {
      const zipData = await loadZipFixture('simple-store.zip');
      const zip = new Zip(zipData);

      // Verify we can find entries like EPUBUnpacker does
      const textEntry = zip.entries.find(entry => entry.fileName === 'hello.txt');
      expect(textEntry).toBeDefined();

      if (textEntry) {
        // Verify all properties needed by EPUBUnpacker are available
        expect(textEntry.fileName).toBe('hello.txt');
        expect(textEntry.compressionMethod).toBe(0);
        expect(textEntry.compressedSize).toBe(13);
        expect(textEntry.uncompressedSize).toBe(13);
        expect(textEntry.startsAt).toBeGreaterThan(0);
        expect(typeof textEntry.extract).toBe('function');

        // Log for debugging - structure info is safe to display
        console.log('Entry structure verified:', {
          fileName: textEntry.fileName,
          compressionMethod: textEntry.compressionMethod,
          compressedSize: textEntry.compressedSize,
          uncompressedSize: textEntry.uncompressedSize,
          startsAt: textEntry.startsAt,
        });
      }
    });
  });
});
