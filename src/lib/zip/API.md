# ZIP Library API Documentation

## Overview

The ZIP library provides browser-native ZIP file creation and extraction capabilities using the Compression Streams API. It's designed specifically for EPUB workflows with no external dependencies.

**Main Classes:**

- `Zip` - ZIP file reader and parser
- `ZipWriter` - ZIP file creation with EPUB compliance
- `ZipEntry` - Individual file entries within ZIP archives

## Core Files

- **`zip-reader.ts`** - ZIP parsing and extraction using DecompressionStream
- **`zip-writer.ts`** - ZIP creation with EPUB compliance using CompressionStream
- **`utils.ts`** - Stream conversion, downloads, data reading utilities
- **`types.ts`** - Complete TypeScript interfaces and type definitions
- **`index.ts`** - Clean API exports

## Key Features

- Browser-native Compression Streams API (no external dependencies)
- EPUB-compliant ZIP handling (mimetype file first, uncompressed)
- Memory-efficient streaming for large files
- File type-based compression optimization
- CRC32 checksum calculation and DOS timestamp conversion
- Unicode filename support and error handling

## Class Documentation

### Zip

#### constructor()

```typescript
constructor(buffer: ArrayBuffer)
```

**Input:**

- `buffer: ArrayBuffer` - ZIP file data to parse

**Output:** `Zip` - ZIP reader instance

**Side Effects:** Parses ZIP directory structure in memory

**Usage:**

```typescript
const zip = new Zip(arrayBuffer);
console.log('Files in ZIP:', zip.entries.length);
```

#### entries

```typescript
get entries(): ZipEntry[]
```

**Output:** `ZipEntry[]` - Array of all entries in the ZIP file

**Usage:**

```typescript
for (const entry of zip.entries) {
  console.log(`File: ${entry.filename}, Size: ${entry.uncompressedSize}`);
}
```

### ZipWriter

#### constructor()

```typescript
constructor();
```

**Output:** `ZipWriter` - ZIP writer instance

**Side Effects:** Initializes empty ZIP structure

#### addFile()

```typescript
addFile(filename: string, content: string | ArrayBuffer | Uint8Array): Promise<void>
```

**Input:**

- `filename: string` - Path within ZIP file
- `content: string | ArrayBuffer | Uint8Array` - File content

**Output:** `Promise<void>` - Resolves when file is added

**Side Effects:** Adds file to ZIP structure with compression optimization

**Usage:**

```typescript
const writer = new ZipWriter();
await writer.addFile('mimetype', 'application/epub+zip');
await writer.addFile('content.txt', 'Hello World');
```

#### buildBlob()

```typescript
buildBlob(): Promise<Blob>
```

**Output:** `Promise<Blob>` - Complete ZIP file as blob

**Side Effects:** Finalizes ZIP structure and creates blob

**Usage:**

```typescript
const zipBlob = await writer.buildBlob();
console.log('ZIP size:', zipBlob.size);
```

### ZipEntry

#### extract()

```typescript
extract(): Promise<Blob>
```

**Output:** `Promise<Blob>` - Decompressed file content

**Side Effects:** Decompresses file data using DecompressionStream

**Usage:**

```typescript
const blob = await entry.extract();
const text = await blob.text();
console.log('File content:', text);
```

#### extractAsArrayBuffer()

```typescript
extractAsArrayBuffer(): Promise<ArrayBuffer>
```

**Output:** `Promise<ArrayBuffer>` - Decompressed file as array buffer

#### extractAsText()

```typescript
extractAsText(): Promise<string>
```

**Output:** `Promise<string>` - Decompressed file as UTF-8 text

## Type Definitions

```typescript
interface ZipEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  lastModified: Date;
  compressionMethod: number;
  extract(): Promise<Blob>;
  extractAsArrayBuffer(): Promise<ArrayBuffer>;
  extractAsText(): Promise<string>;
}

interface CompressionResult {
  method: number;
  reason: string;
}
```

## Common Integration Patterns

### EPUB Reading Workflow

```typescript
import { Zip } from '$lib/zip';

// Load EPUB file
const zip = new Zip(epubArrayBuffer);

// Find OPF file
const containerEntry = zip.entries.find(e => e.filename === 'META-INF/container.xml');
const containerXml = await containerEntry.extractAsText();
const opfPath = parseOPFPath(containerXml);

// Read OPF document
const opfEntry = zip.entries.find(e => e.filename === opfPath);
const opfContent = await opfEntry.extractAsText();
```

### EPUB Creation Workflow

```typescript
import { ZipWriter } from '$lib/zip';

// Create EPUB structure
const writer = new ZipWriter();

// Add required files (mimetype first, uncompressed)
await writer.addFile('mimetype', 'application/epub+zip');
await writer.addFile('META-INF/container.xml', containerXml);
await writer.addFile('OEBPS/content.opf', opfContent);

// Add content files
for (const chapter of chapters) {
  await writer.addFile(`OEBPS/Text/${chapter.filename}`, chapter.content);
}

// Generate final EPUB
const epubBlob = await writer.buildBlob();
```

### File Storage Integration

```typescript
import { Zip, ZipWriter } from '$lib/zip';
import { FileStorageAPI } from '$lib/storage';

// Extract EPUB to workspace
async function extractToWorkspace(epubBuffer: ArrayBuffer, workspaceId: string) {
  const zip = new Zip(epubBuffer);
  const storage = new FileStorageAPI();

  for (const entry of zip.entries) {
    const content = await entry.extract();
    await storage.writeFile(workspaceId, entry.filename, content);
  }
}

// Package workspace to EPUB
async function packageFromWorkspace(workspaceId: string) {
  const storage = new FileStorageAPI();
  const writer = new ZipWriter();
  const files = await storage.listFiles(workspaceId);

  for (const filename of files) {
    const content = await storage.readFile(workspaceId, filename);
    await writer.addFile(filename, content);
  }

  return await writer.buildBlob();
}
```

## Error Handling

The ZIP library uses specific error types for different failure scenarios:

```typescript
try {
  const zip = new Zip(arrayBuffer);
  const entry = zip.entries[0];
  const content = await entry.extract();
} catch (error) {
  if (error.message.includes('Invalid ZIP')) {
    // Handle corrupted ZIP file
  } else if (error.message.includes('Compression')) {
    // Handle decompression errors
  } else {
    // Handle other errors
  }
}
```

Common error scenarios:

- **Invalid ZIP structure** - Corrupted or non-ZIP files
- **Compression errors** - Unsupported compression methods
- **File not found** - Missing entries in ZIP directory
- **Memory limits** - Large files exceeding browser limits

## Testing

**64 comprehensive tests** across utils, reader, and writer:

- Browser API mocking (document, window, URL, Compression Streams)
- Edge cases, error handling, and EPUB workflow scenarios
- Run with: `npm test src/lib/zip`

## Performance Notes

- **Memory efficiency**: Streaming decompression for large files
- **Compression optimization**: Automatic detection of compressible file types
- **EPUB compliance**: Mimetype file stored uncompressed and first
- **Browser compatibility**: Uses native Compression Streams API (Chrome 80+, Firefox 65+, Safari 16.4+)

## Integration Notes

- Ready for File Storage API integration (Feature 1)
- Supports OPFS and IndexedDB storage backends
- Handles workspace-based file organization
- Compatible with blob URL management for previews
- Designed for EPUB 2.0 and 3.0 specifications
