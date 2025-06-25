#!/usr/bin/env node

/**
 * Script to create test ZIP fixtures for the ZIP library tests
 * Run with: node src/lib/zip/test/create-fixtures.js
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

// Create a simple ZIP file with store compression (no compression)
function createSimpleStoreZip() {
  const textContent = 'Hello, World!';
  const filename = 'hello.txt';

  // Calculate sizes
  const filenameBytes = new TextEncoder().encode(filename);
  const contentBytes = new TextEncoder().encode(textContent);

  // ZIP structure:
  // Local file header (30 bytes) + filename + content + central directory (46 bytes) + filename + end of central directory (22 bytes)
  const totalSize =
    30 + filenameBytes.length + contentBytes.length + 46 + filenameBytes.length + 22;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let offset = 0;

  // Local file header
  view.setUint32(offset, 0x04034b50, true); // Local file header signature
  view.setUint16(offset + 4, 20, true); // Version needed to extract
  view.setUint16(offset + 6, 0, true); // General purpose bit flag
  view.setUint16(offset + 8, 0, true); // Compression method (0 = store)
  view.setUint16(offset + 10, 0, true); // Last mod file time
  view.setUint16(offset + 12, 0, true); // Last mod file date
  view.setUint32(offset + 14, 0x0d4a1185, true); // CRC-32 of "Hello, World!"
  view.setUint32(offset + 18, contentBytes.length, true); // Compressed size
  view.setUint32(offset + 22, contentBytes.length, true); // Uncompressed size
  view.setUint16(offset + 26, filenameBytes.length, true); // File name length
  view.setUint16(offset + 28, 0, true); // Extra field length
  offset += 30;

  // Filename
  bytes.set(filenameBytes, offset);
  offset += filenameBytes.length;

  // File content
  bytes.set(contentBytes, offset);
  const contentOffset = offset;
  offset += contentBytes.length;

  // Central directory file header
  const centralDirOffset = offset;
  view.setUint32(offset, 0x02014b50, true); // Central file header signature
  view.setUint16(offset + 4, 20, true); // Version made by
  view.setUint16(offset + 6, 20, true); // Version needed to extract
  view.setUint16(offset + 8, 0, true); // General purpose bit flag
  view.setUint16(offset + 10, 0, true); // Compression method
  view.setUint16(offset + 12, 0, true); // Last mod file time
  view.setUint16(offset + 14, 0, true); // Last mod file date
  view.setUint32(offset + 16, 0x0d4a1185, true); // CRC-32
  view.setUint32(offset + 20, contentBytes.length, true); // Compressed size
  view.setUint32(offset + 24, contentBytes.length, true); // Uncompressed size
  view.setUint16(offset + 28, filenameBytes.length, true); // File name length
  view.setUint16(offset + 30, 0, true); // Extra field length
  view.setUint16(offset + 32, 0, true); // File comment length
  view.setUint16(offset + 34, 0, true); // Disk number start
  view.setUint16(offset + 36, 0, true); // Internal file attributes
  view.setUint32(offset + 38, 0, true); // External file attributes
  view.setUint32(offset + 42, 0, true); // Relative offset of local header
  offset += 46;

  // Filename in central directory
  bytes.set(filenameBytes, offset);
  offset += filenameBytes.length;

  // End of central directory record
  view.setUint32(offset, 0x06054b50, true); // End of central dir signature
  view.setUint16(offset + 4, 0, true); // Number of this disk
  view.setUint16(offset + 6, 0, true); // Disk where central directory starts
  view.setUint16(offset + 8, 1, true); // Number of central directory records on this disk
  view.setUint16(offset + 10, 1, true); // Total number of central directory records
  view.setUint32(offset + 12, 46 + filenameBytes.length, true); // Size of central directory
  view.setUint32(offset + 16, centralDirOffset, true); // Offset of start of central directory
  view.setUint16(offset + 20, 0, true); // Comment length

  return buffer;
}

// Create the fixture files
try {
  console.log('Creating ZIP test fixtures...');

  // Create simple store ZIP
  const simpleStoreZip = createSimpleStoreZip();
  writeFileSync(resolve(fixturesDir, 'simple-store.zip'), new Uint8Array(simpleStoreZip));
  console.log('Created simple-store.zip');

  console.log('ZIP fixtures created successfully!');
} catch (error) {
  console.error('Error creating fixtures:', error);
  process.exit(1);
}
