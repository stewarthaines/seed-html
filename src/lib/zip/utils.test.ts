import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  bufferToStream,
  downloadArrayBuffer,
  downloadBlob,
  streamToBlob,
  unixTimestampToDate,
  readString,
  readTerminatedString,
  readBytes,
  readFlags,
} from './utils.js';

describe('ZIP Utils', () => {
  describe('bufferToStream', () => {
    it('should convert ArrayBuffer to ReadableStream', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const stream = bufferToStream(data.buffer);

      expect(stream).toBeInstanceOf(ReadableStream);

      const reader = stream.getReader();
      const result = await reader.read();

      expect(result.done).toBe(false);
      expect(result.value).toEqual(data.buffer);

      const nextResult = await reader.read();
      expect(nextResult.done).toBe(true);
    });

    it('should handle empty ArrayBuffer', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      const stream = bufferToStream(emptyBuffer);

      const reader = stream.getReader();
      const result = await reader.read();

      expect(result.done).toBe(false);
      expect(result.value).toEqual(emptyBuffer);
    });
  });

  describe('downloadArrayBuffer', () => {
    let mockCreateObjectURL: any;
    let mockRevokeObjectURL: any;
    let mockClick: any;

    beforeEach(() => {
      mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      mockRevokeObjectURL = vi.fn();
      mockClick = vi.fn();

      // Mock URL methods
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock window object if it doesn't exist
      if (typeof window === 'undefined') {
        global.window = {
          URL: {
            createObjectURL: mockCreateObjectURL,
            revokeObjectURL: mockRevokeObjectURL,
          },
        } as any;
      } else {
        // Override existing window URL methods
        window.URL.createObjectURL = mockCreateObjectURL;
        window.URL.revokeObjectURL = mockRevokeObjectURL;
      }

      // Mock document.createElement
      const mockElement = {
        href: '',
        setAttribute: vi.fn(),
        click: mockClick,
      };

      // Create global document mock if it doesn't exist
      if (typeof document === 'undefined') {
        global.document = { createElement: vi.fn() } as any;
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should trigger download with correct filename', () => {
      const data = new Uint8Array([1, 2, 3]).buffer;
      const fileName = 'test.zip';

      downloadArrayBuffer(data, fileName);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('downloadBlob', () => {
    let mockCreateObjectURL: any;
    let mockRevokeObjectURL: any;
    let mockClick: any;
    let mockSetAttribute: any;

    beforeEach(() => {
      mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      mockRevokeObjectURL = vi.fn();
      mockClick = vi.fn();
      mockSetAttribute = vi.fn();

      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock window object if it doesn't exist
      if (typeof window === 'undefined') {
        global.window = {
          URL: {
            createObjectURL: mockCreateObjectURL,
            revokeObjectURL: mockRevokeObjectURL,
          },
        } as any;
      } else {
        // Override existing window URL methods
        window.URL.createObjectURL = mockCreateObjectURL;
        window.URL.revokeObjectURL = mockRevokeObjectURL;
      }

      const mockElement = {
        href: '',
        setAttribute: mockSetAttribute,
        click: mockClick,
      };

      // Create global document mock if it doesn't exist
      if (typeof document === 'undefined') {
        global.document = { createElement: vi.fn() } as any;
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should trigger download with specified filename', () => {
      const blob = new Blob(['test content']);
      const fileName = 'custom.txt';

      downloadBlob(blob, fileName);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
      expect(mockSetAttribute).toHaveBeenCalledWith('download', fileName);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should use default filename when not provided', () => {
      const blob = new Blob(['test content']);

      downloadBlob(blob);

      expect(mockSetAttribute).toHaveBeenCalledWith('download', 'download.x');
    });
  });

  describe('streamToBlob', () => {
    it('should convert ReadableStream to Blob', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const blob = await streamToBlob(stream);
      expect(blob).toBeInstanceOf(Blob);

      const result = await blob.arrayBuffer();
      expect(new Uint8Array(result)).toEqual(data);
    });

    it('should handle multiple chunks', async () => {
      const chunk1 = new Uint8Array([1, 2]);
      const chunk2 = new Uint8Array([3, 4]);

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk1);
          controller.enqueue(chunk2);
          controller.close();
        },
      });

      const blob = await streamToBlob(stream, 'application/octet-stream');
      expect(blob.type).toBe('application/octet-stream');

      const result = await blob.arrayBuffer();
      expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('should handle empty stream', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const blob = await streamToBlob(stream);
      expect(blob.size).toBe(0);
    });
  });

  describe('unixTimestampToDate', () => {
    it('should convert Unix timestamp to Date', () => {
      const timestamp = 1640995200; // 2022-01-01 00:00:00 UTC
      const date = unixTimestampToDate(timestamp);

      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(timestamp * 1000);
    });

    it('should handle zero timestamp', () => {
      const date = unixTimestampToDate(0);
      expect(date.getTime()).toBe(0);
    });
  });

  describe('readString', () => {
    it('should read string from DataView', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const dataView = new DataView(data.buffer);

      const result = readString(dataView, 0, 5);
      expect(result).toBe('Hello');
    });

    it('should read partial string', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]); // "Hello World"
      const dataView = new DataView(data.buffer);

      const result = readString(dataView, 6, 5); // "World"
      expect(result).toBe('World');
    });

    it('should handle empty string', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]);
      const dataView = new DataView(data.buffer);

      const result = readString(dataView, 0, 0);
      expect(result).toBe('');
    });
  });

  describe('readTerminatedString', () => {
    it('should read null-terminated string', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111, 0, 87, 111, 114, 108, 100]); // "Hello\0World"
      const dataView = new DataView(data.buffer);

      const result = readTerminatedString(dataView, 0);
      expect(result).toBe('Hello');
    });

    it('should handle string at offset', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111, 0, 87, 111, 114, 108, 100, 0]);
      const dataView = new DataView(data.buffer);

      const result = readTerminatedString(dataView, 6);
      expect(result).toBe('World');
    });

    it('should handle immediate null terminator', () => {
      const data = new Uint8Array([0, 72, 101, 108, 108, 111]);
      const dataView = new DataView(data.buffer);

      const result = readTerminatedString(dataView, 0);
      expect(result).toBe('');
    });
  });

  describe('readBytes', () => {
    it('should read array of bytes', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const dataView = new DataView(data.buffer);

      const result = readBytes(dataView, 0, 3);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should read bytes at offset', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const dataView = new DataView(data.buffer);

      const result = readBytes(dataView, 2, 2);
      expect(result).toEqual([3, 4]);
    });

    it('should handle empty read', () => {
      const data = new Uint8Array([1, 2, 3]);
      const dataView = new DataView(data.buffer);

      const result = readBytes(dataView, 0, 0);
      expect(result).toEqual([]);
    });
  });

  describe('readFlags', () => {
    it('should read flag bits correctly', () => {
      const data = new Uint8Array([0b10101010]); // Binary: 10101010
      const dataView = new DataView(data.buffer);
      const flagLabels = ['flag0', 'flag1', 'flag2', 'flag3', 'flag4', 'flag5', 'flag6', 'flag7'];

      const result = readFlags(dataView, 0, flagLabels);

      expect(result).toEqual({
        flag0: false, // bit 0
        flag1: true, // bit 1
        flag2: false, // bit 2
        flag3: true, // bit 3
        flag4: false, // bit 4
        flag5: true, // bit 5
        flag6: false, // bit 6
        flag7: true, // bit 7
      });
    });

    it('should handle partial flag reading', () => {
      const data = new Uint8Array([0b11110000]);
      const dataView = new DataView(data.buffer);
      const flagLabels = ['a', 'b', 'c', 'd'];

      const result = readFlags(dataView, 0, flagLabels);

      expect(result).toEqual({
        a: false,
        b: false,
        c: false,
        d: false,
      });
    });

    it('should handle empty flag labels', () => {
      const data = new Uint8Array([0xff]);
      const dataView = new DataView(data.buffer);

      const result = readFlags(dataView, 0, []);
      expect(result).toEqual({});
    });
  });
});
