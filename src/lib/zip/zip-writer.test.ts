import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZipWriter } from './zip-writer.js';

// Mock the utils module
vi.mock('./utils.js', () => ({
  bufferToStream: vi.fn(
    buffer =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      })
  ),
  streamToBlob: vi.fn(async stream => {
    const reader = stream.getReader();
    const chunks = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }

    return new Blob(chunks);
  }),
}));

// Mock CompressionStream
global.CompressionStream = class MockCompressionStream {
  readable: ReadableStream;
  writable: WritableStream;

  constructor(_format: string) {
    const transform = new TransformStream({
      transform(chunk, controller) {
        // Simple mock: compress by reducing size slightly (but handle empty chunks)
        if (chunk.byteLength <= 2) {
          // For very small chunks, just pass through
          controller.enqueue(chunk);
        } else {
          const compressed = new Uint8Array(chunk.byteLength - 2);
          compressed.set(new Uint8Array(chunk).slice(0, chunk.byteLength - 2));
          controller.enqueue(compressed.buffer);
        }
      },
    });

    this.readable = transform.readable;
    this.writable = transform.writable;
  }
} as any;

describe('ZipWriter', () => {
  let zipWriter: ZipWriter;

  beforeEach(() => {
    zipWriter = new ZipWriter();
  });

  describe('constructor', () => {
    it('should create ZipWriter instance', () => {
      expect(zipWriter).toBeInstanceOf(ZipWriter);
      expect(zipWriter.fileCount).toBe(0);
    });
  });

  describe('addFile', () => {
    it('should add string data as file', async () => {
      const result = await zipWriter.addFile('test.txt', 'Hello World');

      expect(result).toBe(zipWriter); // Should return self for chaining
      expect(zipWriter.fileCount).toBe(1);
      expect(zipWriter.getFileNames()).toEqual(['test.txt']);
    });

    it('should add ArrayBuffer data as file', async () => {
      const data = new Uint8Array([1, 2, 3, 4]).buffer;
      await zipWriter.addFile('binary.dat', data);

      expect(zipWriter.fileCount).toBe(1);
      expect(zipWriter.getFileNames()).toEqual(['binary.dat']);
    });

    it('should add Uint8Array data as file', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      await zipWriter.addFile('array.dat', data);

      expect(zipWriter.fileCount).toBe(1);
      expect(zipWriter.getFileNames()).toEqual(['array.dat']);
    });

    it('should add Blob data as file', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      await zipWriter.addFile('blob.txt', blob);

      expect(zipWriter.fileCount).toBe(1);
      expect(zipWriter.getFileNames()).toEqual(['blob.txt']);
    });

    it('should handle mimetype file with no compression', async () => {
      await zipWriter.addFile('mimetype', 'application/epub+zip');

      expect(zipWriter.fileCount).toBe(1);
    });

    it('should support custom compression method', async () => {
      await zipWriter.addFile('test.txt', 'Hello World', {
        compressionMethod: 0x00, // Store (no compression)
      });

      expect(zipWriter.fileCount).toBe(1);
    });

    it('should support custom last modified date', async () => {
      const customDate = new Date('2023-01-01T12:00:00Z');
      await zipWriter.addFile('test.txt', 'Hello World', {
        lastModified: customDate,
      });

      expect(zipWriter.fileCount).toBe(1);
    });

    it('should reject unsupported data type', async () => {
      const unsupportedData = 12345; // Number is not supported

      await expect(zipWriter.addFile('test.txt', unsupportedData as any)).rejects.toThrow(
        'Unsupported data type'
      );
    });

    it('should reject unsupported compression method', async () => {
      await expect(
        zipWriter.addFile('test.txt', 'Hello World', {
          compressionMethod: 0x99, // Unsupported method
        })
      ).rejects.toThrow('Unsupported compression method: 153');
    });

    it('should allow method chaining', async () => {
      const result = await zipWriter
        .addFile('file1.txt', 'Content 1')
        .then(writer => writer.addFile('file2.txt', 'Content 2'));

      expect(result).toBe(zipWriter);
      expect(zipWriter.fileCount).toBe(2);
    });
  });

  describe('build', () => {
    it('should build empty ZIP', async () => {
      const zipBuffer = await zipWriter.build();

      expect(zipBuffer).toBeInstanceOf(ArrayBuffer);
      expect(zipBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should build ZIP with single file', async () => {
      await zipWriter.addFile('test.txt', 'Hello World');
      const zipBuffer = await zipWriter.build();

      expect(zipBuffer).toBeInstanceOf(ArrayBuffer);
      expect(zipBuffer.byteLength).toBeGreaterThan(50); // Reasonable minimum size
    });

    it('should build ZIP with multiple files', async () => {
      await zipWriter.addFile('file1.txt', 'Content 1');
      await zipWriter.addFile('file2.txt', 'Content 2');
      await zipWriter.addFile('file3.txt', 'Content 3');

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(100);
    });

    it('should place mimetype file first', async () => {
      await zipWriter.addFile('other.txt', 'Other content');
      await zipWriter.addFile('mimetype', 'application/epub+zip');
      await zipWriter.addFile('another.txt', 'Another content');

      const zipBuffer = await zipWriter.build();
      const view = new DataView(zipBuffer);

      // Check that the first local file header is present
      expect(view.getUint32(0, true)).toBe(0x04034b50); // Local file header signature

      // Check that mimetype filename follows the header
      const fileNameLength = view.getUint16(26, true);
      const fileName = new TextDecoder().decode(new Uint8Array(zipBuffer, 30, fileNameLength));
      expect(fileName).toBe('mimetype');
    });

    it('should create valid ZIP structure', async () => {
      await zipWriter.addFile('test.txt', 'Hello World');
      const zipBuffer = await zipWriter.build();
      const view = new DataView(zipBuffer);

      // Check for local file header signature
      expect(view.getUint32(0, true)).toBe(0x04034b50);

      // Find end of central directory signature
      let endDirOffset = -1;
      for (let i = zipBuffer.byteLength - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
          endDirOffset = i;
          break;
        }
      }
      expect(endDirOffset).toBeGreaterThan(-1);
    });
  });

  describe('buildBlob', () => {
    it('should build ZIP as Blob', async () => {
      await zipWriter.addFile('test.txt', 'Hello World');
      const blob = await zipWriter.buildBlob();

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/zip');
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await zipWriter.addFile('file1.txt', 'Content 1');
      await zipWriter.addFile('file2.txt', 'Content 2');

      expect(zipWriter.fileCount).toBe(2);

      const result = zipWriter.clear();
      expect(result).toBe(zipWriter); // Should return self for chaining
      expect(zipWriter.fileCount).toBe(0);
      expect(zipWriter.getFileNames()).toEqual([]);
    });
  });

  describe('fileCount', () => {
    it('should return correct file count', async () => {
      expect(zipWriter.fileCount).toBe(0);

      await zipWriter.addFile('file1.txt', 'Content 1');
      expect(zipWriter.fileCount).toBe(1);

      await zipWriter.addFile('file2.txt', 'Content 2');
      expect(zipWriter.fileCount).toBe(2);

      zipWriter.clear();
      expect(zipWriter.fileCount).toBe(0);
    });
  });

  describe('getFileNames', () => {
    it('should return array of file names', async () => {
      expect(zipWriter.getFileNames()).toEqual([]);

      await zipWriter.addFile('first.txt', 'First');
      expect(zipWriter.getFileNames()).toEqual(['first.txt']);

      await zipWriter.addFile('second.txt', 'Second');
      expect(zipWriter.getFileNames()).toEqual(['first.txt', 'second.txt']);

      await zipWriter.addFile('third.txt', 'Third');
      expect(zipWriter.getFileNames()).toEqual(['first.txt', 'second.txt', 'third.txt']);
    });
  });

  describe('CRC32 calculation', () => {
    it('should handle different data types for CRC calculation', async () => {
      // Test that CRC32 is calculated for different input types
      await zipWriter.addFile('string.txt', 'Hello World');
      await zipWriter.addFile('buffer.dat', new Uint8Array([1, 2, 3, 4]).buffer);
      await zipWriter.addFile('array.dat', new Uint8Array([5, 6, 7, 8]));

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe('DOS time conversion', () => {
    it('should handle various dates for DOS time conversion', async () => {
      const testDates = [
        new Date('1980-01-01T00:00:00Z'), // Min DOS date
        new Date('2023-06-15T14:30:45Z'), // Regular date
        new Date('2107-12-31T23:59:59Z'), // Max DOS date
      ];

      for (let i = 0; i < testDates.length; i++) {
        await zipWriter.addFile(`test${i}.txt`, `Content ${i}`, {
          lastModified: testDates[i],
        });
      }

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe('compression handling', () => {
    it('should handle store compression (no compression)', async () => {
      await zipWriter.addFile('uncompressed.txt', 'This content is not compressed', {
        compressionMethod: 0x00,
      });

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(0);
    });

    it('should handle deflate compression', async () => {
      await zipWriter.addFile('compressed.txt', 'This content should be compressed', {
        compressionMethod: 0x08,
      });

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe('EPUB compliance', () => {
    it('should handle EPUB structure correctly', async () => {
      // Add files in typical EPUB order
      await zipWriter.addFile('META-INF/container.xml', '<?xml version="1.0"?>...');
      await zipWriter.addFile('mimetype', 'application/epub+zip');
      await zipWriter.addFile('OEBPS/content.opf', '<?xml version="1.0"?>...');
      await zipWriter.addFile('OEBPS/chapter1.xhtml', '<html>...</html>');

      const zipBuffer = await zipWriter.build();

      // Verify mimetype is first file in ZIP
      const view = new DataView(zipBuffer);
      expect(view.getUint32(0, true)).toBe(0x04034b50); // Local file header

      const fileNameLength = view.getUint16(26, true);
      const fileName = new TextDecoder().decode(new Uint8Array(zipBuffer, 30, fileNameLength));
      expect(fileName).toBe('mimetype');
    });
  });

  describe('error handling', () => {
    it('should handle large files gracefully', async () => {
      // Create a moderately large file (don't want to slow down tests too much)
      const largeContent = 'x'.repeat(10000);
      await zipWriter.addFile('large.txt', largeContent);

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(largeContent.length);
    });

    it('should handle special characters in filenames', async () => {
      const specialNames = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.with.dots.txt',
        'UPPERCASE.TXT',
        '数字文件.txt', // Unicode filename
      ];

      for (const name of specialNames) {
        await zipWriter.addFile(name, `Content for ${name}`);
      }

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(0);
      expect(zipWriter.fileCount).toBe(specialNames.length);
    });

    it('should handle empty file content', async () => {
      await zipWriter.addFile('empty.txt', '');
      await zipWriter.addFile('empty.dat', new ArrayBuffer(0));
      await zipWriter.addFile('empty-array.dat', new Uint8Array(0));

      const zipBuffer = await zipWriter.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(0);
      expect(zipWriter.fileCount).toBe(3);
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic EPUB creation workflow', async () => {
      // Simulate creating a complete EPUB
      const writer = new ZipWriter();

      // Add mimetype first (will be sorted to front anyway)
      await writer.addFile('mimetype', 'application/epub+zip');

      // Add META-INF files
      await writer.addFile(
        'META-INF/container.xml',
        '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0">...</container>'
      );

      // Add OEBPS content
      await writer.addFile(
        'OEBPS/content.opf',
        '<?xml version="1.0" encoding="UTF-8"?>\n<package>...</package>'
      );
      await writer.addFile(
        'OEBPS/toc.ncx',
        '<?xml version="1.0" encoding="UTF-8"?>\n<ncx>...</ncx>'
      );

      // Add chapters
      for (let i = 1; i <= 3; i++) {
        await writer.addFile(
          `OEBPS/chapter${i}.xhtml`,
          `<html><head><title>Chapter ${i}</title></head><body><h1>Chapter ${i}</h1></body></html>`
        );
      }

      // Add CSS
      await writer.addFile('OEBPS/styles.css', 'body { font-family: serif; }');

      const zipBuffer = await writer.build();
      expect(zipBuffer.byteLength).toBeGreaterThan(1000); // Should be substantial
      expect(writer.fileCount).toBe(8); // mimetype + container + opf + ncx + 3 chapters + css

      // Verify structure
      const fileNames = writer.getFileNames();
      expect(fileNames).toContain('mimetype');
      expect(fileNames).toContain('META-INF/container.xml');
      expect(fileNames).toContain('OEBPS/content.opf');
    });
  });
});
