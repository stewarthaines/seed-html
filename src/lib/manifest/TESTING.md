# ManifestManager Test Plan

This document provides a comprehensive test plan for the ManifestManager feature, following Test-Driven Development (TDD) principles and the 5-step development process described in DEVELOPMENT.md.

## TDD Strategy

**This feature follows strict Test-Driven Development:**

1. **RED**: Write tests FIRST based on the API specification - tests will FAIL initially
2. **GREEN**: Implement minimum code to make tests pass
3. **REFACTOR**: Improve code while keeping tests green

### Key TDD Principles

- **Tests Drive Implementation**: All tests are written before any ManifestManager code exists
- **Failing Tests Expected**: Initial test runs should fail - this proves tests are valid
- **No Implementation Mocking**: ManifestManager methods being tested are NOT mocked
- **External Dependencies Mocked**: Only WorkspaceManager and browser APIs are mocked
- **API Contract First**: Tests validate the exact API specified in API.md

### TDD Workflow

1. **Write Test Cases** - Based on API.md specifications, write comprehensive test cases
2. **Run Tests** - All tests should FAIL (no implementation exists yet)
3. **Implement Interface** - Create ManifestManager class with method stubs that throw "Not implemented"
4. **Implement Methods** - Add minimal implementation to make each test pass
5. **Refactor** - Improve implementation while maintaining green tests

## Test Strategy Overview

The ManifestManager testing strategy uses TDD to drive implementation of all public API methods, error scenarios, content type handling, cache behavior, validation logic, and integration with WorkspaceManager. Tests must achieve 100% coverage and validate the exact API contract.

## 1. Unit Tests

### Core Interface Methods

#### loadManifest()

**Valid Scenarios:**

- ✅ Load manifest with valid workspace ID returns ManifestItem[]
- ✅ Handle empty manifest gracefully (return empty array)
- ✅ Cache behavior on repeated calls (second call from cache)
- ✅ Return items in manifest order from OPF

**Error Scenarios:**

- ❌ Invalid workspace ID throws WorkspaceNotFoundError
- ❌ Corrupted OPF data throws ManifestCorruptedError
- ❌ Storage access failure propagates error

**TDD Test Implementation:**

```typescript
// TDD: Write this test FIRST - it will FAIL until implementation exists
describe('loadManifest', () => {
  it('should load manifest items in correct order', async () => {
    const workspaceId = 'test-workspace';
    const mockItems = [
      { id: 'item1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
      { id: 'item2', href: 'chapter2.xhtml', mediaType: 'application/xhtml+xml' },
    ];

    // Mock external dependency (WorkspaceManager) - NOT ManifestManager
    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: mockItems,
    });

    // Call actual ManifestManager method (will fail initially)
    const result = await manifestManager.loadManifest(workspaceId);
    expect(result).toEqual(mockItems);
    expect(mockWorkspaceManager.loadOPF).toHaveBeenCalledWith(workspaceId);
  });

  it('should throw WorkspaceNotFoundError for invalid workspace', async () => {
    // Use MockWorkspaceManager's failure simulation
    mockWorkspaceManager.setFailureMode('workspace-not-found');

    // This test will fail until error handling is implemented
    await expect(manifestManager.loadManifest('invalid-id')).rejects.toThrow('Workspace not found');
  });
});
```

#### getManifestItem()

**Valid Scenarios:**

- ✅ Get existing item returns correct ManifestItem data
- ✅ Cache hit returns cached data without workspace call
- ✅ Cache miss loads manifest then returns item

**Error Scenarios:**

- ❌ Non-existent item throws ItemNotFoundError
- ❌ Invalid workspace throws WorkspaceNotFoundError

#### updateManifestItem()

**Valid Scenarios:**

- ✅ Update valid fields (properties, mediaType, href)
- ✅ Persist changes to OPF file via WorkspaceManager
- ✅ Update cache after successful update
- ✅ Partial updates (only specified fields changed)

**Error Scenarios:**

- ❌ Invalid item ID throws ItemNotFoundError
- ❌ Validation failures throw ValidationError
- ❌ Storage failures propagate correctly
- ❌ Duplicate href throws DuplicateItemError

#### deleteManifestItem()

**Valid Scenarios:**

- ✅ Delete existing item successfully
- ✅ Remove from OPF and workspace storage
- ✅ Clear content cache for deleted item
- ✅ Update manifest cache after deletion

**Error Scenarios:**

- ❌ Delete non-existent item throws ItemNotFoundError
- ❌ Delete spine-referenced item throws error
- ❌ Storage deletion failure propagates error

### Content Operations

#### getItemContent()

**Valid Scenarios:**

- ✅ Text content returns string (UTF-8 decoded)
- ✅ Binary content returns ArrayBuffer
- ✅ Cache behavior with size limits (1MB text, 10MB binary)
- ✅ Large file handling within limits

**Error Scenarios:**

- ❌ Missing file throws error
- ❌ File too large for cache (graceful handling)
- ❌ Corrupted file content handling

**Test Implementation:**

```typescript
// TDD: Write these tests FIRST - they will FAIL until implementation exists
describe('getItemContent', () => {
  it('should return text content as string', async () => {
    const textContent = '<?xml version="1.0"?><html>Content</html>';
    const buffer = new TextEncoder().encode(textContent);

    // Mock external dependency only using MockWorkspaceManager methods
    mockWorkspaceManager.addTestFiles(workspaceId, {
      'OEBPS/text-item.xhtml': textContent,
    });

    // Call REAL ManifestManager method (will fail initially)
    const result = await manifestManager.getItemContent('workspace', 'text-item');
    expect(typeof result).toBe('string');
    expect(result).toBe(textContent);
  });

  it('should return binary content as ArrayBuffer', async () => {
    const binaryContent = new ArrayBuffer(1024);

    // Set up workspace with binary file using MockWorkspaceManager
    mockWorkspaceManager.addTestFiles(workspaceId, {
      'OEBPS/image.jpg': binaryContent,
    });

    // Set up manifest with binary item
    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [{ id: 'binary-item', href: 'OEBPS/image.jpg', mediaType: 'image/jpeg' }],
    });

    const result = await manifestManager.getItemContent('workspace', 'binary-item');
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(1024);
  });
});
```

#### setItemContent()

**Valid Scenarios:**

- ✅ Save text content as string
- ✅ Save binary content as ArrayBuffer
- ✅ Update item metadata (size, modified date)
- ✅ Update content cache
- ✅ Handle encoding for text content

**Error Scenarios:**

- ❌ Storage quota exceeded throws StorageQuotaExceededError
- ❌ Invalid content type for item media type
- ❌ File write permission errors

#### getContentPreview()

**Valid Scenarios:**

- ✅ Text content preview with metadata (character count, line count)
- ✅ Image metadata extraction (dimensions)
- ✅ Audio/video metadata extraction (duration, bitrate)
- ✅ Binary content basic metadata (size only)
- ✅ Preview data caching

**Error Scenarios:**

- ❌ Unsupported format error handling
- ❌ Corrupted media file handling
- ❌ Memory limits for large previews

**Test Implementation:**

```typescript
// TDD: Write this test FIRST - it will FAIL until implementation exists
describe('getContentPreview', () => {
  it('should extract metadata from image content', async () => {
    const imageData = new ArrayBuffer(2048);

    // Set up workspace with image file using MockWorkspaceManager
    mockWorkspaceManager.addTestFiles(workspaceId, {
      'OEBPS/cover.jpg': imageData,
    });

    // Set up manifest with image item
    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [{ id: 'image-item', href: 'OEBPS/cover.jpg', mediaType: 'image/jpeg' }],
    });

    // Call REAL ManifestManager method (will fail until implemented)
    const preview = await manifestManager.getContentPreview('workspace', 'image-item');

    expect(preview.contentType).toBe('image');
    expect(preview.metadata?.width).toBeDefined();
    expect(preview.metadata?.height).toBeDefined();
    expect(preview.itemId).toBe('image-item');
    expect(preview.mediaType).toBe('image/jpeg');

    // Note: previewUrl (blob URL) would be created by BlobURLManager, not ManifestManager
  });

  it('should extract text content metadata', async () => {
    const textContent =
      '<?xml version="1.0"?><html><body><p>Test content with multiple paragraphs.</p><p>Second paragraph.</p></body></html>';

    mockWorkspaceManager.addTestFiles(workspaceId, {
      'OEBPS/chapter1.xhtml': textContent,
    });

    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [
        { id: 'chapter1', href: 'OEBPS/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
      ],
    });

    const preview = await manifestManager.getContentPreview('workspace', 'chapter1');

    expect(preview.contentType).toBe('text');
    expect(preview.textContent).toBe(textContent);
    expect(preview.metadata?.characterCount).toBe(textContent.length);
    expect(preview.metadata?.wordCount).toBeGreaterThan(0);
  });
});
```

### Item Creation

#### createTextItem()

**Valid Scenarios:**

- ✅ Create with all required fields
- ✅ Generate ID if not provided
- ✅ Detect media type if not provided
- ✅ Add to manifest and persist to OPF
- ✅ Handle target directory specification

**Error Scenarios:**

- ❌ Duplicate ID throws DuplicateItemError
- ❌ Invalid data throws ValidationError
- ❌ File creation failure propagates error

**Test Implementation:**

```typescript
// TDD: Write this test FIRST - it will FAIL until implementation exists
describe('createTextItem', () => {
  it('should create text item with generated ID', async () => {
    const itemData = {
      fileName: 'chapter3.xhtml',
      content: '<?xml version="1.0"?><html>New Chapter</html>',
    };

    // Set up workspace using MockWorkspaceManager
    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [], // Start with empty manifest
    });

    // Call REAL ManifestManager method (will fail initially)
    const result = await manifestManager.createTextItem('workspace', itemData);

    expect(result.id).toBe('chapter3');
    expect(result.href).toBe('OEBPS/chapter3.xhtml');
    expect(result.mediaType).toBe('application/xhtml+xml');
    // Verify file was created in workspace
    const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles('workspace');
    expect(workspaceFiles.has('OEBPS/chapter3.xhtml')).toBe(true);
  });
});
```

#### createFileItem()

**Valid Scenarios:**

- ✅ Upload various file types (text, image, audio, video)
- ✅ Auto-detect media type from extension/content
- ✅ Generate unique ID from filename
- ✅ Handle large files within limits
- ✅ Custom target path handling

**Error Scenarios:**

- ❌ File too large throws ContentTooBigError
- ❌ Unsupported media type handling
- ❌ File read failure handling

**TDD Test Implementation:**

```typescript
// TDD: Test file upload scenarios using mock File objects
describe('createFileItem', () => {
  it('should create manifest item from uploaded file', async () => {
    const fileContent = 'body { color: red; }';
    const mockFile = createMockFile('styles.css', fileContent, 'text/css');

    // Set up workspace
    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [],
    });

    // Call REAL ManifestManager method (will fail initially)
    const result = await manifestManager.createFileItem(workspaceId, mockFile);

    expect(result.id).toBe('styles');
    expect(result.href).toBe('OEBPS/styles.css');
    expect(result.mediaType).toBe('text/css');

    // Verify file was stored through WorkspaceManager
    const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles(workspaceId);
    expect(workspaceFiles.has('OEBPS/styles.css')).toBe(true);
  });

  it('should handle binary file upload', async () => {
    const imageData = new ArrayBuffer(2048);
    const mockFile = createMockFile('cover.jpg', imageData, 'image/jpeg');

    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [],
    });

    const result = await manifestManager.createFileItem(workspaceId, mockFile);

    expect(result.mediaType).toBe('image/jpeg');
    expect(result.href).toBe('OEBPS/cover.jpg');
  });
});
```

### Validation

#### ManifestValidator.validateManifestItem()

**Test Cases:**

- ✅ Required fields validation (id, href, mediaType)
- ✅ ID format validation (XML ID rules)
- ✅ HREF path validation (relative paths only)
- ✅ Media type format validation
- ✅ Properties array validation
- ❌ Empty/null values return errors
- ❌ Invalid formats return specific errors

**Test Implementation:**

```typescript
describe('ManifestValidator.validateManifestItem', () => {
  it('should validate required fields', () => {
    const invalidItem = { href: 'test.html' }; // missing id and mediaType

    const results = ManifestValidator.validateManifestItem(invalidItem);

    expect(results).toHaveLength(2);
    expect(results.find(r => r.field === 'id')).toBeDefined();
    expect(results.find(r => r.field === 'mediaType')).toBeDefined();
  });

  it('should validate ID format', () => {
    const invalidItem = {
      id: '123-invalid-start', // starts with number
      href: 'test.html',
      mediaType: 'text/html',
    };

    const results = ManifestValidator.validateManifestItem(invalidItem);

    const idError = results.find(r => r.field === 'id');
    expect(idError?.severity).toBe('error');
    expect(idError?.message).toContain('XML ID format');
  });
});
```

#### ManifestValidator.validateItemId()

**Test Cases:**

- ✅ Valid XML ID formats pass
- ❌ Empty ID returns error
- ❌ Duplicate ID returns error
- ❌ Invalid characters return error
- ✅ Edge cases (underscore, hyphen, numbers)

#### ManifestValidator.validateManifestStructure()

**Test Cases:**

- ✅ Empty manifest returns error
- ✅ Missing nav document returns warning
- ✅ Orphaned spine references return errors
- ✅ Media type distribution analysis

### Utility Functions

#### generateItemId()

**Test Cases:**

- ✅ Remove file extensions correctly
- ✅ Convert to lowercase
- ✅ Replace invalid characters with underscores
- ✅ Ensure uniqueness within manifest
- ✅ Handle edge cases (empty string, special chars)

**Test Implementation:**

```typescript
describe('generateItemId', () => {
  it('should generate valid ID from filename', () => {
    const id = manifestManager.generateItemId('My Chapter 1.xhtml');
    expect(id).toBe('my_chapter_1');
  });

  it('should handle special characters', () => {
    const id = manifestManager.generateItemId('File@#$%Name.txt');
    expect(id).toBe('file____name');
  });
});
```

#### detectMediaType()

**Test Cases:**

- ✅ Extension-based detection for common types
- ✅ Content-based detection with magic bytes
- ✅ Fallback to application/octet-stream
- ✅ EPUB core media types correctly identified

## 2. Integration Tests

### WorkspaceManager Integration

**Test Scenarios:**

- ✅ OPF file read/write operations
- ✅ File storage operations (OPFS/IndexedDB)
- ✅ Workspace validation and error propagation
- ✅ Concurrent access handling

**Test Implementation:**

```typescript
// TDD: Integration tests use REAL ManifestManager with mocked WorkspaceManager
describe('WorkspaceManager Integration', () => {
  it('should handle OPF persistence correctly', async () => {
    const workspaceId = 'integration-test';

    // Set up workspace using MockWorkspaceManager (external dependency)
    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [], // Start with empty manifest
    });

    // Call REAL ManifestManager (will fail until implementation exists)
    const item = await manifestManager.createTextItem(workspaceId, {
      fileName: 'test.html',
      content: '<html>Test</html>',
    });

    // Verify OPF was updated through real implementation
    const updatedOPF = await mockWorkspaceManager.getWorkspaceOPF(workspaceId);
    expect(updatedOPF.manifest).toContainEqual(expect.objectContaining({ id: item.id }));

    // Verify file was saved through real implementation
    const workspaceFiles = mockWorkspaceManager.getWorkspaceFiles(workspaceId);
    expect(workspaceFiles.has(item.href)).toBe(true);
  });
});
```

### Cache Management

**Test Scenarios:**

- ✅ LRU eviction under memory pressure
- ✅ Blob URL creation and cleanup
- ✅ Cache invalidation on updates
- ✅ Memory leak prevention

**Test Implementation:**

```typescript
// TDD: Cache tests use REAL ManifestManager cache implementation
describe('Cache Management', () => {
  it('should cache and clear content data', async () => {
    const textContent = 'Sample content for caching test';

    // Set up workspace with text file
    mockWorkspaceManager.addTestFiles(workspaceId, {
      'OEBPS/test.txt': textContent,
    });

    mockWorkspaceManager.setWorkspaceOPF(workspaceId, {
      manifest: [{ id: 'test-item', href: 'OEBPS/test.txt', mediaType: 'text/plain' }],
    });

    // First call should read from workspace
    const content1 = await manifestManager.getItemContent(workspaceId, 'test-item');
    expect(typeof content1).toBe('string');
    expect(content1).toBe(textContent);

    // Second call should return cached content (verify by operation count)
    const initialOpCount = mockWorkspaceManager.getOperationCount();
    const content2 = await manifestManager.getItemContent(workspaceId, 'test-item');
    expect(content2).toBe(content1);

    // Clear cache and verify it forces re-read
    manifestManager.clearContentCache(workspaceId, 'test-item');
    const content3 = await manifestManager.getItemContent(workspaceId, 'test-item');
    expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOpCount);
  });
});
```

### Advanced Mode Features

**Test Scenarios:**

- ✅ SOURCE directory listing
- ✅ SOURCE file content access
- ✅ Advanced mode detection
- ✅ SOURCE.zip extraction integration

## 3. Storybook Stories

### Interactive Demos

**Manifest View Story:**

```typescript
export const ManifestView = {
  args: {
    workspaceId: 'demo-workspace',
    items: [
      { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: ['nav'] },
      { id: 'chapter1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
      { id: 'cover', href: 'cover.jpg', mediaType: 'image/jpeg', properties: ['cover-image'] },
    ],
  },
  render: args => new ManifestViewComponent({ target: document.body, props: args }),
};
```

**File Upload Story:**

- Drag-and-drop interface
- Progress indication
- Error handling display
- Multiple file support

**Content Editor Story:**

- Text editing with live preview
- Media type switching
- Validation feedback
- Save state indication

**Validation Display Story:**

- Error/warning visualization
- Field-specific feedback
- Batch validation results
- Interactive error correction

### Error State Stories

**Network Failures:**

- Offline mode handling
- Connection retry logic
- Cached data fallback

**Storage Errors:**

- Quota exceeded scenarios
- Permission denied handling
- Corrupted data recovery

**Validation Errors:**

- Invalid manifest display
- Field-level error highlighting
- Correction suggestions

## 4. Error Handling Tests

### Expected Error Types

**WorkspaceNotFoundError:**

```typescript
it('should handle workspace not found', async () => {
  mockWorkspaceManager.loadOPF.mockRejectedValue(new WorkspaceNotFoundError('Workspace not found'));

  await expect(manifestManager.loadManifest('missing-workspace')).rejects.toThrow(
    WorkspaceNotFoundError
  );
});
```

**ManifestCorruptedError:**

```typescript
it('should handle corrupted manifest', async () => {
  mockWorkspaceManager.loadOPF.mockResolvedValue({ manifest: null });

  await expect(manifestManager.loadManifest('corrupted-workspace')).rejects.toThrow(
    ManifestCorruptedError
  );
});
```

**Other Error Types:**

- ItemNotFoundError - Missing item operations
- DuplicateItemError - ID/href conflicts
- StorageQuotaExceededError - Storage limits
- InvalidMediaTypeError - Unsupported formats
- ContentTooBigError - Size limit enforcement
- ValidationError - Invalid data handling

### Error Recovery

**Test Scenarios:**

- ✅ Graceful degradation on storage failures
- ✅ Cache cleanup on errors
- ✅ User-friendly error messages
- ✅ Retry mechanisms for transient failures

## 5. Performance Tests

### Scale Testing

**Large Manifest Handling:**

```typescript
// TDD: Performance tests validate REAL implementation under load
describe('Performance Tests', () => {
  it('should handle 1000+ manifest items', async () => {
    const largeManifest = Array.from({ length: 1000 }, (_, i) => ({
      id: `item${i}`,
      href: `file${i}.html`,
      mediaType: 'text/html',
    }));

    // Set up workspace with large manifest using MockWorkspaceManager
    mockWorkspaceManager.setWorkspaceOPF('large-workspace', {
      manifest: largeManifest,
    });

    // Test REAL ManifestManager performance (will fail until implemented)
    const start = performance.now();
    const result = await manifestManager.loadManifest('large-workspace');
    const duration = performance.now() - start;

    expect(result).toHaveLength(1000);
    expect(duration).toBeLessThan(100); // 100ms threshold
  });
});
```

**Large File Operations:**

- File operations with 100MB+ files
- Memory usage monitoring
- Progress tracking accuracy

**Cache Performance:**

- Memory usage under load
- Cache eviction timing
- Access pattern optimization

### Content Type Performance

**Test Scenarios:**

- ✅ Text content processing speed
- ✅ Image preview generation time
- ✅ Media metadata extraction performance
- ✅ Binary file handling efficiency

## Test Environment Setup

### TDD Mocking Strategy

**CRITICAL: Mock External Dependencies Only**

- ✅ **Mock WorkspaceManager** - External dependency using existing MockWorkspaceManager
- ❌ **DO NOT Mock ManifestManager** - This is what we're testing!
- ❌ **DO NOT Mock FileStorageAPI** - WorkspaceManager abstracts this
- ❌ **DO NOT Mock BlobURLManager** - ManifestManager doesn't handle blob URLs directly
- ❌ **DO NOT Mock File API** - Only needed for upload UI testing, not ManifestManager logic

**WorkspaceManager Mock (using existing infrastructure):**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import { createMockWorkspaceManagerVi } from '../../test/mocks/workspace-manager-vitest.mock.js';
import { ManifestManagerImpl } from '../manifest-manager.js';

describe('ManifestManager', () => {
  let manifestManager: ManifestManagerImpl;
  let mockWorkspaceManager: MockWorkspaceManager;
  const testWorkspaceId = 'test-workspace-123';

  beforeEach(() => {
    // Use existing mock infrastructure
    mockWorkspaceManager = new MockWorkspaceManager();
    mockWorkspaceManager.reset();

    // Create REAL ManifestManager instance with mocked dependencies
    manifestManager = new ManifestManagerImpl(mockWorkspaceManager as any);
  });

  afterEach(() => {
    mockWorkspaceManager.reset();
  });
```

**File API Mock (only for createFileItem() tests that accept File objects):**

```typescript
// Simple File object mock for upload testing
const createMockFile = (name: string, content: string | ArrayBuffer, type = 'text/plain') => ({
  name,
  size: typeof content === 'string' ? content.length : content.byteLength,
  type,
  arrayBuffer: () =>
    Promise.resolve(
      typeof content === 'string' ? new TextEncoder().encode(content).buffer : content
    ),
  text: () =>
    Promise.resolve(typeof content === 'string' ? content : new TextDecoder().decode(content)),
});

// Note: ManifestManager doesn't handle blob URLs directly - see BlobURLManager
// Note: TextEncoder/TextDecoder are handled by WorkspaceManager/FileStorage layers
```

### Architectural Testing Notes

**File Operation Flow:**

1. `createFileItem(file: File)` accepts browser File object from drag-and-drop/upload
2. ManifestManager reads file content via `file.arrayBuffer()`
3. All persistence goes through MockWorkspaceManager (no FileStorageAPI mocking needed)
4. Content previews handled by separate BlobURLManager (not ManifestManager responsibility)

**What NOT to Mock:**

- FileStorageAPI (abstracted by WorkspaceManager)
- BlobURLManager (separate responsibility, not used by ManifestManager)
- Browser text encoding (handled by storage layer)
- Complex File API behaviors (just need content)

**Focus Areas:**

- ManifestManager business logic
- OPF manifest manipulation
- Content type detection
- Content caching (for getItemContent/setItemContent)
- Error handling and validation
- File upload processing (createFileItem)

### Test Data Fixtures

**Sample Manifest Items:**

```typescript
export const SAMPLE_MANIFEST_ITEMS = [
  {
    id: 'nav',
    href: 'OEBPS/nav.xhtml',
    mediaType: 'application/xhtml+xml',
    properties: ['nav'],
  },
  {
    id: 'chapter1',
    href: 'OEBPS/chapter1.xhtml',
    mediaType: 'application/xhtml+xml',
    size: 2048,
    modified: new Date('2025-01-01'),
  },
  {
    id: 'cover',
    href: 'OEBPS/images/cover.jpg',
    mediaType: 'image/jpeg',
    properties: ['cover-image'],
    size: 102400,
  },
];
```

**Mock File Content:**

```typescript
export const MOCK_CONTENT = {
  text: '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Test</title></head><body><p>Content</p></body></html>',
  image: new ArrayBuffer(2048), // Mock image data
  audio: new ArrayBuffer(4096), // Mock audio data
};
```

**Invalid Data Sets:**

```typescript
export const INVALID_MANIFEST_ITEMS = [
  { id: '', href: 'test.html', mediaType: 'text/html' }, // Empty ID
  { id: 'test', href: '', mediaType: 'text/html' }, // Empty href
  { id: 'test', href: 'test.html', mediaType: '' }, // Empty mediaType
  { id: '123invalid', href: 'test.html', mediaType: 'text/html' }, // Invalid ID format
];
```

## Validation Criteria

### Quality Gates

**TypeScript Compliance:**

- ✅ Zero TypeScript errors (`npm run check`)
- ✅ Strict mode compliance
- ✅ All types properly defined

**ESLint Compliance:**

- ✅ No linting errors (`npm run lint`)
- ✅ Code style consistency
- ✅ No unused imports/variables

**Test Coverage:**

- ✅ 100% coverage of public API methods
- ✅ All error scenarios covered
- ✅ Integration points tested
- ✅ Performance benchmarks met

### Test Coverage Requirements

**Unit Tests:**

- 100% of public methods in IManifestManager
- All validation functions
- All utility functions
- Error handling for every method

**Integration Tests:**

- All WorkspaceManager interactions
- Cache management operations
- Advanced mode functionality
- Concurrent operation handling

**Error Handling:**

- All expected error types
- Error propagation chains
- Recovery mechanisms
- User experience during errors

**Edge Cases:**

- Boundary conditions (empty data, large data)
- Limit enforcement (file sizes, cache sizes)
- Concurrent access scenarios
- Browser compatibility edge cases

### Performance Benchmarks

**Response Time Targets:**

- Manifest loading: < 100ms for 1000 items
- Content retrieval: < 50ms for cached items
- Preview generation: < 200ms for images
- Validation: < 10ms for single items

**Memory Usage Targets:**

- Cache size: < 50MB total
- Large file handling: No memory leaks
- Blob URL cleanup: 100% cleanup on cache clear

This test plan ensures the ManifestManager implementation meets all API specifications while maintaining the project's zero-error quality standards and provides comprehensive coverage for all functionality, error scenarios, and performance requirements.
