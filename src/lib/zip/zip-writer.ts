import { bufferToStream, streamToBlob } from './utils.js';
import type { ZipWriterEntry, AddFileOptions, DosTime, SupportedDataType } from './types.js';

/**
 * ZIP file writer with compression capabilities
 */
export class ZipWriter {
  #entries: ZipWriterEntry[] = [];
  private static _crcTable: number[] = [];

  constructor() {
    this.#entries = [];
  }

  /**
   * Adds a file to the ZIP archive
   */
  async addFile(
    fileName: string,
    data: SupportedDataType,
    options: AddFileOptions = {}
  ): Promise<ZipWriter> {
    const {
      compressionMethod = fileName === 'mimetype' ? 0x00 : 0x08, // mimetype must be uncompressed
      lastModified = new Date(),
    } = options;

    let compressedData: ArrayBuffer;
    let crc32: number;
    let uncompressedSize: number;
    let compressedSize: number;

    // Convert data to ArrayBuffer if needed
    let arrayBuffer: ArrayBuffer;
    if (data instanceof ArrayBuffer) {
      arrayBuffer = data;
    } else if (data instanceof Uint8Array) {
      arrayBuffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ) as ArrayBuffer;
    } else if (data instanceof Blob) {
      arrayBuffer = await data.arrayBuffer();
    } else if (typeof data === 'string') {
      arrayBuffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
    } else {
      throw new Error('Unsupported data type');
    }

    uncompressedSize = arrayBuffer.byteLength;
    crc32 = this.#calculateCRC32(new Uint8Array(arrayBuffer));

    // Compress data if needed
    if (compressionMethod === 0x00) {
      // No compression
      compressedData = arrayBuffer;
      compressedSize = uncompressedSize;
    } else if (compressionMethod === 0x08) {
      // Deflate compression
      const compressionStream = new CompressionStream('deflate-raw');
      const stream = bufferToStream(arrayBuffer);
      const compressedStream = stream.pipeThrough(compressionStream);
      const compressedBlob = await streamToBlob(compressedStream);
      compressedData = await compressedBlob.arrayBuffer();
      compressedSize = compressedData.byteLength;
    } else {
      throw new Error(`Unsupported compression method: ${compressionMethod}`);
    }

    const entry: ZipWriterEntry = {
      fileName,
      compressionMethod,
      lastModified,
      crc32,
      compressedSize,
      uncompressedSize,
      data: compressedData,
      localHeaderOffset: 0, // Will be set when building the ZIP
    };

    this.#entries.push(entry);
    return this;
  }

  /**
   * Builds the ZIP file as an ArrayBuffer
   */
  async build(): Promise<ArrayBuffer> {
    const chunks: ArrayBuffer[] = [];
    let offset = 0;

    // Sort entries to ensure 'mimetype' file is first
    const sortedEntries = [...this.#entries].sort((a, b) => {
      if (a.fileName === 'mimetype') return -1;
      if (b.fileName === 'mimetype') return 1;
      return 0;
    });

    // Write local file headers and data
    for (const entry of sortedEntries) {
      entry.localHeaderOffset = offset;

      const localHeader = this.#createLocalFileHeader(entry);
      chunks.push(localHeader);
      offset += localHeader.byteLength;

      chunks.push(entry.data);
      offset += entry.data.byteLength;
    }

    // Write central directory
    const centralDirectoryOffset = offset;
    for (const entry of sortedEntries) {
      const centralDirEntry = this.#createCentralDirectoryHeader(entry);
      chunks.push(centralDirEntry);
      offset += centralDirEntry.byteLength;
    }

    // Write end of central directory
    const endOfCentralDir = this.#createEndOfCentralDirectory(
      this.#entries.length,
      offset - centralDirectoryOffset,
      centralDirectoryOffset
    );
    chunks.push(endOfCentralDir);

    // Combine all chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let position = 0;

    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk), position);
      position += chunk.byteLength;
    }

    return result.buffer;
  }

  /**
   * Builds the ZIP file as a Blob
   */
  async buildBlob(): Promise<Blob> {
    const arrayBuffer = await this.build();
    return new Blob([arrayBuffer], { type: 'application/zip' });
  }

  /**
   * Creates a local file header for a ZIP entry
   */
  #createLocalFileHeader(entry: ZipWriterEntry): ArrayBuffer {
    const fileNameBytes = new TextEncoder().encode(entry.fileName);
    const headerSize = 30 + fileNameBytes.length;
    const buffer = new ArrayBuffer(headerSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    // Local file header signature
    view.setUint32(0, 0x04034b50, true);
    // Version needed to extract
    view.setUint16(4, 20, true);
    // General purpose bit flag
    view.setUint16(6, 0, true);
    // Compression method
    view.setUint16(8, entry.compressionMethod, true);
    // Last mod time & date (simplified - using current time)
    const dosTime = this.#toDosTime(entry.lastModified);
    view.setUint16(10, dosTime.time, true);
    view.setUint16(12, dosTime.date, true);
    // CRC-32
    view.setUint32(14, entry.crc32, true);
    // Compressed size
    view.setUint32(18, entry.compressedSize, true);
    // Uncompressed size
    view.setUint32(22, entry.uncompressedSize, true);
    // File name length
    view.setUint16(26, fileNameBytes.length, true);
    // Extra field length
    view.setUint16(28, 0, true);
    // File name
    uint8View.set(fileNameBytes, 30);

    return buffer;
  }

  /**
   * Creates a central directory header for a ZIP entry
   */
  #createCentralDirectoryHeader(entry: ZipWriterEntry): ArrayBuffer {
    const fileNameBytes = new TextEncoder().encode(entry.fileName);
    const headerSize = 46 + fileNameBytes.length;
    const buffer = new ArrayBuffer(headerSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    // Central directory signature
    view.setUint32(0, 0x02014b50, true);
    // Version made by
    view.setUint16(4, 20, true);
    // Version needed to extract
    view.setUint16(6, 20, true);
    // General purpose bit flag
    view.setUint16(8, 0, true);
    // Compression method
    view.setUint16(10, entry.compressionMethod, true);
    // Last mod time & date
    const dosTime = this.#toDosTime(entry.lastModified);
    view.setUint16(12, dosTime.time, true);
    view.setUint16(14, dosTime.date, true);
    // CRC-32
    view.setUint32(16, entry.crc32, true);
    // Compressed size
    view.setUint32(20, entry.compressedSize, true);
    // Uncompressed size
    view.setUint32(24, entry.uncompressedSize, true);
    // File name length
    view.setUint16(28, fileNameBytes.length, true);
    // Extra field length
    view.setUint16(30, 0, true);
    // File comment length
    view.setUint16(32, 0, true);
    // Disk number start
    view.setUint16(34, 0, true);
    // Internal file attributes
    view.setUint16(36, 0, true);
    // External file attributes
    view.setUint32(38, 0, true);
    // Local header offset
    view.setUint32(42, entry.localHeaderOffset, true);
    // File name
    uint8View.set(fileNameBytes, 46);

    return buffer;
  }

  /**
   * Creates the end of central directory record
   */
  #createEndOfCentralDirectory(
    numEntries: number,
    centralDirSize: number,
    centralDirOffset: number
  ): ArrayBuffer {
    const buffer = new ArrayBuffer(22);
    const view = new DataView(buffer);

    // End of central directory signature
    view.setUint32(0, 0x06054b50, true);
    // Number of this disk
    view.setUint16(4, 0, true);
    // Disk where central directory starts
    view.setUint16(6, 0, true);
    // Number of central directory records on this disk
    view.setUint16(8, numEntries, true);
    // Total number of central directory records
    view.setUint16(10, numEntries, true);
    // Size of central directory
    view.setUint32(12, centralDirSize, true);
    // Offset of start of central directory
    view.setUint32(16, centralDirOffset, true);
    // Comment length
    view.setUint16(20, 0, true);

    return buffer;
  }

  /**
   * Converts a JavaScript Date to DOS time format
   */
  #toDosTime(date: Date): DosTime {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosDate = ((year - 1980) << 9) | (month << 5) | day;
    const dosTime = (hours << 11) | (minutes << 5) | seconds;

    return { date: dosDate, time: dosTime };
  }

  /**
   * Calculates CRC32 checksum for given data
   */
  #calculateCRC32(data: Uint8Array): number {
    // CRC-32 lookup table
    const crcTable = this.#getCRC32Table();
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Gets or creates the CRC32 lookup table
   */
  #getCRC32Table(): number[] {
    if (ZipWriter._crcTable.length === 0) {
      const table: number[] = Array.from({ length: 256 }, () => 0);
      for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
          crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
        table[i] = crc;
      }
      ZipWriter._crcTable = table;
    }
    return ZipWriter._crcTable;
  }

  // Utility methods

  /**
   * Clears all entries from the ZIP
   */
  clear(): ZipWriter {
    this.#entries = [];
    return this;
  }

  /**
   * Gets the number of files in the ZIP
   */
  get fileCount(): number {
    return this.#entries.length;
  }

  /**
   * Gets an array of all file names in the ZIP
   */
  getFileNames(): string[] {
    return this.#entries.map(entry => entry.fileName);
  }
}
