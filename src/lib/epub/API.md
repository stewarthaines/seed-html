# EPUB Library API Reference

## Overview

The EPUB library provides classes for handling EPUB files and XML processing:

- **EPUBUnpacker**: Extracts EPUB files to workspace storage
- **EPUBPackager**: Creates EPUB files from workspace content
- **OPFUtils**: Static utilities for OPF and EPUB XML operations

All classes integrate with the File Storage API and ZIP library for browser-native EPUB processing.

## EPUBUnpacker

### Constructor

```typescript
new EPUBUnpacker();
```

Creates a new EPUB unpacker instance. Automatically creates a FileStorageAPI instance for workspace operations.

### Methods

#### unpackEPUB()

```typescript
unpackEPUB(file: File, workspaceId: string): Promise<UnpackResult>
```

**Input:**

- `file: File` - Browser File object (from `input.files[0]` or drag/drop)
- `workspaceId: string` - Target workspace identifier

**Output:** `Promise<UnpackResult>`

**Side Effects:**

- Creates files in specified workspace
- Initializes storage if not already initialized
- Validates EPUB structure before extraction

**Usage:**

```typescript
const unpacker = new EPUBUnpacker();
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0]; // Browser File object
const result = await unpacker.unpackEPUB(file, 'my-workspace-id');

if (result.success) {
  console.log(`Extracted ${result.processedFiles} files`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

#### analyzeEPUB()

```typescript
analyzeEPUB(file: File): Promise<AnalysisResult>
```

**Input:**

- `file: File` - Browser File object

**Output:** `Promise<AnalysisResult>`

**Side Effects:** None (read-only analysis)

**Usage:**

```typescript
const analysis = await unpacker.analyzeEPUB(file);
console.log(`Valid EPUB: ${analysis.isValid}`);
console.log(`File count: ${analysis.fileCount}`);
console.log(`Total size: ${analysis.totalSize} bytes`);
```

### Important Notes

- ❌ **Don't** convert File to ArrayBuffer before calling methods
- ❌ **Don't** pass ArrayBuffer directly to these methods
- ✅ **Do** pass File objects directly from upload handlers
- ✅ **Do** let the methods handle internal File→ArrayBuffer conversion

## EPUBPackager

### Constructor

```typescript
new EPUBPackager();
```

Creates a new EPUB packager instance. Automatically creates a FileStorageAPI instance for workspace operations.

### Methods

#### packageEPUB()

```typescript
packageEPUB(workspaceId: string, options?: PackageOptions): Promise<PackageResult>
```

**Input:**

- `workspaceId: string` - Source workspace identifier
- `options?: PackageOptions` - Optional configuration

**Output:** `Promise<PackageResult>`

**Side Effects:**

- Reads all files from specified workspace
- Initializes storage if not already initialized
- Creates ZIP blob in memory

**Usage:**

```typescript
const packager = new EPUBPackager();
const result = await packager.packageEPUB('my-workspace-id', {
  progressCallback: progress => {
    console.log(`${progress.processedFiles}/${progress.totalFiles} files processed`);
  },
});

if (result.success && result.blob) {
  // Download the EPUB
  packager.downloadEPUB(result.blob, result.filename);
}
```

#### downloadEPUB()

```typescript
downloadEPUB(blob: Blob, filename: string): void
```

**Input:**

- `blob: Blob` - EPUB file data (from packageEPUB result)
- `filename: string` - Suggested filename for download

**Output:** `void`

**Side Effects:** Triggers browser download

**Usage:**

```typescript
if (result.success && result.blob && result.filename) {
  packager.downloadEPUB(result.blob, result.filename);
}
```

#### generateFilename()

```typescript
generateFilename(metadata: EPUBMetadata): string
```

**Input:** `EPUBMetadata` object with title, author, etc.

**Output:** `string` - Sanitized filename

**Side Effects:** None

## OPFUtils

Static utility class for OPF (Open Packaging Format) and EPUB XML operations. All methods are static and namespace-aware.

### Methods

#### parseContainerXml()

```typescript
static parseContainerXml(containerXml: string): ContainerInfo
```

**Input:**

- `containerXml: string` - Container.xml content as string

**Output:** `ContainerInfo` - Contains `rootfilePath` or `error`

**Side Effects:** None (read-only parsing)

**Usage:**

```typescript
const containerInfo = OPFUtils.parseContainerXml(containerContent);
if (containerInfo.rootfilePath) {
  console.log('OPF file at:', containerInfo.rootfilePath);
} else {
  console.error('Error:', containerInfo.error);
}
```

#### parseOPFMetadata()

```typescript
static parseOPFMetadata(doc: Document): EPUBMetadata
```

**Input:**

- `doc: Document` - Parsed XML Document containing OPF content

**Output:** `EPUBMetadata` - Extracted metadata object

**Side Effects:** None (read-only parsing)

**Namespace Requirements:** Uses `getElementsByTagNameNS()` with Dublin Core namespace (`http://purl.org/dc/elements/1.1/`)

**Usage:**

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(opfContent, 'application/xml');
const metadata = OPFUtils.parseOPFMetadata(doc);

console.log('Title:', metadata.title);
console.log('Author:', metadata.author);
console.log('Language:', metadata.language);
```

#### parseOPFDocument()

```typescript
static parseOPFDocument(opfContent: string): OPFDocument
```

**Input:**

- `opfContent: string` - Complete OPF file content

**Output:** `OPFDocument` - Full OPF structure with metadata, manifest, spine

**Side Effects:** None (read-only parsing)

**Usage:**

```typescript
const opfDoc = OPFUtils.parseOPFDocument(opfContent);
console.log('EPUB version:', opfDoc.version);
console.log('Manifest items:', opfDoc.manifest.length);
console.log('Spine items:', opfDoc.spine.length);
```

#### generateOPFXML()

```typescript
static generateOPFXML(opfDocument: OPFDocument): string
```

**Input:**

- `opfDocument: OPFDocument` - Complete OPF structure

**Output:** `string` - Valid OPF XML content

**Side Effects:** None

**Usage:**

```typescript
const xml = OPFUtils.generateOPFXML(opfDocument);
await storage.writeTextFile(workspaceId, 'OEBPS/content.opf', xml);
```

#### validateXML()

```typescript
static validateXML(xmlContent: string): XMLValidationResult
```

**Input:**

- `xmlContent: string` - XML content to validate

**Output:** `XMLValidationResult` - Validation status and error details

**Side Effects:** None

#### detectEPUBVersion()

```typescript
static detectEPUBVersion(opfContent: string): string | undefined
```

**Input:**

- `opfContent: string` - OPF content to analyze

**Output:** `string | undefined` - EPUB version string ('EPUB 2.0', 'EPUB 3.0') or undefined

**Side Effects:** None

## Type Definitions

### UnpackResult

```typescript
interface UnpackResult {
  success: boolean;
  workspaceId?: string;
  error?: string;
  extractedFiles?: string[];
  totalSize?: number;
  processedFiles?: number;
}
```

### PackageResult

```typescript
interface PackageResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  error?: string;
  totalSize?: number;
  compressedSize?: number;
  fileCount?: number;
  processingTime?: number;
}
```

### AnalysisResult

```typescript
interface AnalysisResult {
  isValid: boolean;
  fileCount: number;
  totalSize: number;
  validation: ValidationResult;
  fileList: string[];
}
```

### PackageOptions

```typescript
interface PackageOptions {
  compressionLevel?: 'fast' | 'balanced' | 'maximum';
  includeEditmeFiles?: boolean;
  validateStructure?: boolean;
  progressCallback?: (progress: PackageProgress) => void;
}
```

## Common Integration Patterns

### File Upload Handler

```typescript
function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0]; // This is a File object

    // ✅ Correct usage
    await unpacker.unpackEPUB(file, workspaceId);

    // ❌ Wrong - don't do this
    // const buffer = await file.arrayBuffer();
    // await unpacker.unpackEPUB(buffer, workspaceId); // Will fail!
  }
}
```

### Round-Trip Workflow

```typescript
// 1. Unpack uploaded EPUB
const file = fileInput.files[0];
const unpackResult = await unpacker.unpackEPUB(file, 'temp-workspace');

// 2. Modify content in workspace (via File Storage API)
await storage.writeTextFile('temp-workspace', 'new-chapter.xhtml', content);

// 3. Package modified workspace
const packageResult = await packager.packageEPUB('temp-workspace');

// 4. Download new EPUB
if (packageResult.success && packageResult.blob) {
  packager.downloadEPUB(packageResult.blob, packageResult.filename);
}
```

## Storage Integration

Both classes use the File Storage API internally:

- Workspace operations are handled automatically
- Storage initialization happens on first use
- Files are stored with full path preservation
- Cross-browser compatibility (OPFS/IndexedDB) is handled transparently

## Error Handling

All async methods can throw or return error states:

- Check `result.success` before accessing result data
- Handle both exceptions and error result objects
- Storage quota errors are propagated from File Storage API
- ZIP parsing errors are caught and returned in error field
