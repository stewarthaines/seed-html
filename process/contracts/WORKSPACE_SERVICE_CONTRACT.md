# WorkspaceService Contract

**Date:** 2025-01-29  
**Status:** TDD Contract - Red Phase  
**Purpose:** Executable specification for WorkspaceService implementation in the clean service architecture

## Contract Overview

The WorkspaceService is the **workspace lifecycle and EPUB structure service** in the clean service architecture. It has **single responsibility** for workspace CRUD operations and EPUB structure management (OPF, manifest, spine). It **never calls other services** - all coordination happens through reactive state in AppState.

### Core Responsibilities (Single Service Boundary)

1. **Workspace Lifecycle**: Create, load, save, delete complete workspaces
2. **EPUB Structure Management**: OPF document, manifest items, spine order operations  
3. **Metadata Operations**: Update workspace metadata with automatic timestamps
4. **WorkspaceState Consistency**: Return complete WorkspaceState objects for reactive consumption

### What This Service Does NOT Do

- **Content transformation**: Handled by ContentService
- **Settings management**: Handled by SettingsService  
- **Navigation generation**: Handled by ContentService
- **SOURCE/ directory management**: Handled by reactive effects in AppState
- **Cross-service coordination**: Handled by AppState reactive layers

### Architecture Principle

**Services never call other services**. The WorkspaceService only depends on infrastructure (FileStorageAPI, EPUBProcessor) and returns pure WorkspaceState objects. All service coordination happens through AppState reactive effects.

## Interface Contract

### Core Interface

```typescript
interface WorkspaceService {
  // Lifecycle operations
  createWorkspace(metadata: EPUBMetadata): Promise<WorkspaceState>;
  loadWorkspace(id: string): Promise<WorkspaceState>;
  saveWorkspace(workspace: WorkspaceState): Promise<WorkspaceState>;
  deleteWorkspace(id: string): Promise<void>;
  
  // Metadata operations  
  updateMetadata(workspace: WorkspaceState, updates: Partial<EPUBMetadata>): Promise<WorkspaceState>;
  
  // Manifest operations (workspace structure management)
  addManifestItem(workspace: WorkspaceState, item: Partial<ManifestItem>): Promise<WorkspaceState>;
  removeManifestItem(workspace: WorkspaceState, itemId: string): Promise<WorkspaceState>;
  updateManifestItem(workspace: WorkspaceState, itemId: string, updates: Partial<ManifestItem>): Promise<WorkspaceState>;
  
  // Spine operations (reading order management)
  updateSpineOrder(workspace: WorkspaceState, itemIds: string[]): Promise<WorkspaceState>;
  addSpineItem(workspace: WorkspaceState, item: SpineItem, insertIndex?: number): Promise<WorkspaceState>;
  removeSpineItem(workspace: WorkspaceState, idref: string): Promise<WorkspaceState>;
  
  // Query operations
  listWorkspaces(): Promise<WorkspaceInfo[]>;
  workspaceExists(id: string): Promise<boolean>;
  
  // Batch content operations (for navigation generation)
  loadChapterContents(workspace: WorkspaceState, chapterIds: string[]): Promise<ChapterContent[]>;
  loadAllLinearChapterContents(workspace: WorkspaceState): Promise<ChapterContent[]>;
}
```

### Type Dependencies

WorkspaceService uses the following types:

**From `src/lib/types/content.ts`:**
- `ChapterContent` - Pre-loaded chapter content for navigation generation (shared with ContentService)

**From existing project types:**
- `WorkspaceState` - Complete workspace state with OPF and path information
- `EPUBMetadata` - EPUB metadata structure
- `ManifestItem` - EPUB manifest item structure
- `SpineItem` - EPUB spine item structure
- `OPFDocument` - Complete EPUB OPF document structure
- `WorkspacePathInfo` - File system path information

**Service-Specific Types:**
```typescript
interface WorkspaceInfo {
  id: string;
  title: string;
  language: string;
  lastModified: Date;
  fileCount: number;
  totalSize: number;
}
```

## Behavioral Contracts (Test-First Specifications)

### Contract 1: Workspace Creation

**Specification**: `createWorkspace()` must generate complete WorkspaceState with valid OPF structure.

```typescript
describe('Contract: Workspace Creation', () => {
  test('createWorkspace returns complete WorkspaceState', async () => {
    // RED: This test must fail initially
    const metadata = {
      title: 'Test Book',
      language: 'en', 
      identifier: 'urn:uuid:test-123'
    };
    
    const result = await service.createWorkspace(metadata);
    
    // CONTRACT: MUST return complete WorkspaceState
    expect(result).toMatchObject({
      id: expect.any(String),
      opf: expect.objectContaining({
        metadata: expect.objectContaining({
          title: 'Test Book',
          language: 'en',
          identifier: 'urn:uuid:test-123',
          modifiedDate: expect.any(String) // MUST auto-generate
        }),
        manifest: expect.any(Array),  // MUST be empty array initially
        spine: expect.any(Array),     // MUST be empty array initially
        version: expect.any(String)   // MUST default to EPUB version
      }),
      pathInfo: expect.objectContaining({
        rootfilePath: expect.stringMatching(/content\.opf$/),
        basePath: expect.any(String),
        opfFileName: 'content.opf'
      })
    });
  });
  
  test('createWorkspace generates unique IDs', async () => {
    const metadata = { title: 'Test', language: 'en', identifier: 'test' };
    
    const workspace1 = await service.createWorkspace(metadata);
    const workspace2 = await service.createWorkspace(metadata);
    
    // CONTRACT: MUST generate unique workspace IDs
    expect(workspace1.id).not.toBe(workspace2.id);
    expect(workspace1.id).toMatch(/^[a-z0-9-]+$/); // MUST be URL-safe
  });
  
  test('createWorkspace persists to storage', async () => {
    const metadata = { title: 'Persistent Test', language: 'en', identifier: 'persist' };
    
    const created = await service.createWorkspace(metadata);
    
    // CONTRACT: MUST be loadable after creation
    const loaded = await service.loadWorkspace(created.id);
    expect(loaded).toEqual(created);
  });
});
```

### Contract 2: Workspace Loading

**Specification**: `loadWorkspace()` must return complete WorkspaceState or throw specific errors.

```typescript
describe('Contract: Workspace Loading', () => {
  test('loadWorkspace returns complete WorkspaceState', async () => {
    // SETUP: Create workspace first
    const metadata = { title: 'Load Test', language: 'en', identifier: 'load-test' };
    const created = await service.createWorkspace(metadata);
    
    const result = await service.loadWorkspace(created.id);
    
    // CONTRACT: MUST return complete state matching creation
    expect(result).toEqual(created);
    expect(result.opf.metadata.title).toBe('Load Test');
  });
  
  test('loadWorkspace throws WorkspaceNotFoundError for missing workspace', async () => {
    // CONTRACT: MUST throw specific error type for missing workspaces
    await expect(
      service.loadWorkspace('non-existent-workspace')
    ).rejects.toThrow('WorkspaceNotFoundError');
  });
  
  test('loadWorkspace handles corrupted OPF files', async () => {
    // SETUP: Create workspace then corrupt its OPF
    const created = await service.createWorkspace({ 
      title: 'Corrupt Test', language: 'en', identifier: 'corrupt' 
    });
    
    // Simulate OPF corruption (implementation detail will vary)
    await mockFileStorage.writeTextFile(created.id, 'OEBPS/content.opf', 'invalid xml');
    
    // CONTRACT: MUST throw OPFCorruptedError with recovery suggestions
    await expect(
      service.loadWorkspace(created.id)
    ).rejects.toThrow('OPFCorruptedError');
  });
});
```

### Contract 3: Metadata Updates

**Specification**: `updateMetadata()` must preserve workspace structure while updating metadata.

```typescript
describe('Contract: Metadata Updates', () => {
  test('updateMetadata preserves workspace structure', async () => {
    // SETUP: Create workspace with content
    const workspace = await service.createWorkspace({
      title: 'Original Title', language: 'en', identifier: 'update-test'
    });
    
    // Add some manifest items to test preservation
    workspace.opf.manifest.push({
      id: 'chapter1',
      href: 'Text/chapter1.xhtml', 
      mediaType: 'application/xhtml+xml'
    });
    workspace.opf.spine.push({ idref: 'chapter1' });
    
    const originalManifest = [...workspace.opf.manifest];
    const originalSpine = [...workspace.opf.spine];
    
    const updated = await service.updateMetadata(workspace, { 
      title: 'Updated Title',
      description: 'New description'
    });
    
    // CONTRACT: MUST preserve workspace ID and structure
    expect(updated.id).toBe(workspace.id);
    expect(updated.pathInfo).toEqual(workspace.pathInfo);
    expect(updated.opf.manifest).toEqual(originalManifest);
    expect(updated.opf.spine).toEqual(originalSpine);
    
    // CONTRACT: MUST update specified metadata
    expect(updated.opf.metadata.title).toBe('Updated Title');
    expect(updated.opf.metadata.description).toBe('New description');
    
    // CONTRACT: MUST preserve unchanged metadata
    expect(updated.opf.metadata.language).toBe('en');
    expect(updated.opf.metadata.identifier).toBe('update-test');
    
    // CONTRACT: MUST update modifiedDate
    expect(updated.opf.metadata.modifiedDate).toBeDefined();
    expect(updated.opf.metadata.modifiedDate).not.toBe(workspace.opf.metadata.modifiedDate);
  });
  
  test('updateMetadata persists changes to storage', async () => {
    const workspace = await service.createWorkspace({
      title: 'Persist Test', language: 'en', identifier: 'persist'
    });
    
    const updated = await service.updateMetadata(workspace, { title: 'Persisted Title' });
    
    // CONTRACT: MUST persist to storage
    const reloaded = await service.loadWorkspace(workspace.id);
    expect(reloaded.opf.metadata.title).toBe('Persisted Title');
  });
  
  test('updateMetadata validates metadata fields', async () => {
    const workspace = await service.createWorkspace({
      title: 'Validation Test', language: 'en', identifier: 'validate'
    });
    
    // CONTRACT: MUST reject invalid language codes
    await expect(
      service.updateMetadata(workspace, { language: 'invalid-lang-code' })
    ).rejects.toThrow('ValidationError');
    
    // CONTRACT: MUST reject empty required fields
    await expect(
      service.updateMetadata(workspace, { title: '' })
    ).rejects.toThrow('ValidationError');
  });
});
```

### Contract 4: Workspace Deletion

**Specification**: `deleteWorkspace()` must completely remove workspace and all associated files.

```typescript
describe('Contract: Workspace Deletion', () => {
  test('deleteWorkspace removes workspace completely', async () => {
    // SETUP: Create workspace
    const workspace = await service.createWorkspace({
      title: 'Delete Test', language: 'en', identifier: 'delete-test'
    });
    
    await service.deleteWorkspace(workspace.id);
    
    // CONTRACT: MUST not be loadable after deletion
    await expect(
      service.loadWorkspace(workspace.id)
    ).rejects.toThrow('WorkspaceNotFoundError');
    
    // CONTRACT: MUST not appear in workspace list
    const workspaces = await service.listWorkspaces();
    expect(workspaces.find(w => w.id === workspace.id)).toBeUndefined();
  });
  
  test('deleteWorkspace handles non-existent workspace gracefully', async () => {
    // CONTRACT: MUST not throw for non-existent workspace (idempotent)
    await expect(
      service.deleteWorkspace('non-existent-workspace')
    ).resolves.not.toThrow();
  });
  
  test('deleteWorkspace cleans up associated files', async () => {
    const workspace = await service.createWorkspace({
      title: 'Cleanup Test', language: 'en', identifier: 'cleanup'
    });
    
    // SETUP: Add some files to workspace
    await mockFileStorage.writeTextFile(workspace.id, 'OEBPS/Text/chapter1.xhtml', '<html/>');
    await mockFileStorage.writeTextFile(workspace.id, 'SOURCE/text/chapter1.txt', 'Chapter content');
    
    await service.deleteWorkspace(workspace.id);
    
    // CONTRACT: MUST clean up all associated files
    const files = await mockFileStorage.listFiles(workspace.id);
    expect(files).toEqual([]); // MUST be empty
  });
});
```

## Infrastructure Integration Contract

**Specification**: WorkspaceService must properly coordinate existing infrastructure components.

```typescript
describe('Contract: Infrastructure Integration', () => {
  test('delegates file operations to FileStorageAPI', async () => {
    const mockFileStorage = createMockFileStorage();
    const service = new WorkspaceService(mockFileStorage, mockEPUBProcessor);
    
    await service.createWorkspace({ title: 'Integration Test', language: 'en', identifier: 'int' });
    
    // CONTRACT: MUST use FileStorageAPI for all file operations
    expect(mockFileStorage.writeTextFile).toHaveBeenCalledWith(
      expect.any(String),
      'OEBPS/content.opf',
      expect.stringContaining('Integration Test')
    );
  });
  
  test('delegates EPUB operations to EPUBProcessor', async () => {
    const mockEPUBProcessor = createMockEPUBProcessor();
    const service = new WorkspaceService(mockFileStorage, mockEPUBProcessor);
    
    const metadata = { title: 'EPUB Test', language: 'en', identifier: 'epub' };
    await service.createWorkspace(metadata);
    
    // CONTRACT: MUST use EPUBProcessor for OPF generation
    expect(mockEPUBProcessor.generateOPF).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ title: 'EPUB Test' })
      })
    );
  });
});
```

## Error Handling Contract

**Specification**: All errors must be typed and recoverable.

```typescript
describe('Contract: Error Handling', () => {
  test('throws typed errors with recovery information', async () => {
    // CONTRACT: All service errors must extend ServiceError
    try {
      await service.loadWorkspace('invalid-workspace');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceNotFoundError);
      expect(error.workspaceId).toBe('invalid-workspace');
      expect(error.recoveryHint).toContain('check workspace ID');
    }
  });
  
  test('provides error context for debugging', async () => {
    try {
      await service.updateMetadata(null as any, { title: 'Test' });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.context).toEqual({
        operation: 'updateMetadata',
        workspace: null,
        updates: { title: 'Test' }
      });
    }
  });
});
```

### Contract 5: Manifest Operations

**Specification**: Manifest operations must maintain EPUB structure integrity and consistency.

```typescript
describe('Contract: Manifest Operations', () => {
  test('addManifestItem adds item and returns updated workspace', async () => {
    const workspace = await service.createWorkspace({
      title: 'Manifest Test', language: 'en', identifier: 'manifest'
    });
    
    const updated = await service.addManifestItem(workspace, {
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    
    // CONTRACT: MUST return updated workspace with new manifest item
    expect(updated.id).toBe(workspace.id);
    expect(updated.opf.manifest).toContainEqual({
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    
    // CONTRACT: MUST update modifiedDate
    expect(updated.opf.metadata.modifiedDate).toBeDefined();
    expect(updated.opf.metadata.modifiedDate).not.toBe(workspace.opf.metadata.modifiedDate);
  });
  
  test('addManifestItem generates unique ID when not provided', async () => {
    const workspace = await service.createWorkspace({
      title: 'ID Gen Test', language: 'en', identifier: 'idgen'
    });
    
    const updated = await service.addManifestItem(workspace, {
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    
    // CONTRACT: MUST generate valid ID from href
    const addedItem = updated.opf.manifest.find(item => item.href === 'Text/chapter1.xhtml');
    expect(addedItem).toBeDefined();
    expect(addedItem!.id).toMatch(/^[a-z0-9-]+$/); // Valid ID format
  });
  
  test('addManifestItem rejects duplicate IDs', async () => {
    const workspace = await service.createWorkspace({
      title: 'Duplicate Test', language: 'en', identifier: 'dup'
    });
    
    // Add first item
    const updated1 = await service.addManifestItem(workspace, {
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    
    // CONTRACT: MUST reject duplicate ID
    await expect(
      service.addManifestItem(updated1, {
        id: 'chapter1', // Same ID
        href: 'Text/chapter2.xhtml',
        mediaType: 'application/xhtml+xml'
      })
    ).rejects.toThrow('ValidationError');
  });
  
  test('removeManifestItem removes item and updates spine', async () => {
    let workspace = await service.createWorkspace({
      title: 'Remove Test', language: 'en', identifier: 'remove'
    });
    
    // Add manifest item
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    
    // Add to spine
    workspace = await service.addSpineItem(workspace, { idref: 'chapter1' });
    
    const updated = await service.removeManifestItem(workspace, 'chapter1');
    
    // CONTRACT: MUST remove from manifest
    expect(updated.opf.manifest.find(item => item.id === 'chapter1')).toBeUndefined();
    
    // CONTRACT: MUST remove from spine automatically
    expect(updated.opf.spine.find(item => item.idref === 'chapter1')).toBeUndefined();
  });
  
  test('updateManifestItem preserves ID and updates properties', async () => {
    let workspace = await service.createWorkspace({
      title: 'Update Test', language: 'en', identifier: 'update'
    });
    
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    
    const updated = await service.updateManifestItem(workspace, 'chapter1', {
      properties: ['scripted']
    });
    
    // CONTRACT: MUST preserve ID and update specified properties
    const updatedItem = updated.opf.manifest.find(item => item.id === 'chapter1');
    expect(updatedItem).toMatchObject({
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: ['scripted']
    });
  });
});
```

### Contract 6: Spine Operations

**Specification**: Spine operations must maintain reading order integrity and manifest consistency.

```typescript
describe('Contract: Spine Operations', () => {
  test('updateSpineOrder sets complete reading order', async () => {
    let workspace = await service.createWorkspace({
      title: 'Spine Test', language: 'en', identifier: 'spine'
    });
    
    // Add manifest items
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml'
    });
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter2', href: 'Text/chapter2.xhtml', mediaType: 'application/xhtml+xml'
    });
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter3', href: 'Text/chapter3.xhtml', mediaType: 'application/xhtml+xml'
    });
    
    const updated = await service.updateSpineOrder(workspace, ['chapter3', 'chapter1', 'chapter2']);
    
    // CONTRACT: MUST set spine order exactly as specified
    expect(updated.opf.spine).toEqual([
      { idref: 'chapter3' },
      { idref: 'chapter1' },
      { idref: 'chapter2' }
    ]);
  });
  
  test('updateSpineOrder validates manifest item existence', async () => {
    const workspace = await service.createWorkspace({
      title: 'Spine Validation Test', language: 'en', identifier: 'spine-val'
    });
    
    // CONTRACT: MUST reject spine items not in manifest
    await expect(
      service.updateSpineOrder(workspace, ['non-existent-chapter'])
    ).rejects.toThrow('ValidationError');
  });
  
  test('addSpineItem inserts at correct position', async () => {
    let workspace = await service.createWorkspace({
      title: 'Spine Insert Test', language: 'en', identifier: 'spine-insert'
    });
    
    // Add manifest items
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml'
    });
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter2', href: 'Text/chapter2.xhtml', mediaType: 'application/xhtml+xml'
    });
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter3', href: 'Text/chapter3.xhtml', mediaType: 'application/xhtml+xml'
    });
    
    // Set initial spine order
    workspace = await service.updateSpineOrder(workspace, ['chapter1', 'chapter3']);
    
    // Insert chapter2 at position 1
    const updated = await service.addSpineItem(workspace, { idref: 'chapter2' }, 1);
    
    // CONTRACT: MUST insert at specified position
    expect(updated.opf.spine).toEqual([
      { idref: 'chapter1' },
      { idref: 'chapter2' },
      { idref: 'chapter3' }
    ]);
  });
  
  test('addSpineItem validates manifest item exists', async () => {
    const workspace = await service.createWorkspace({
      title: 'Spine Item Validation', language: 'en', identifier: 'spine-item-val'
    });
    
    // CONTRACT: MUST reject spine items not in manifest
    await expect(
      service.addSpineItem(workspace, { idref: 'non-existent-item' })
    ).rejects.toThrow('ValidationError');
  });
  
  test('removeSpineItem maintains order of remaining items', async () => {
    let workspace = await service.createWorkspace({
      title: 'Spine Remove Test', language: 'en', identifier: 'spine-remove'
    });
    
    // Add manifest items and spine
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml'
    });
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter2', href: 'Text/chapter2.xhtml', mediaType: 'application/xhtml+xml'
    });
    workspace = await service.addManifestItem(workspace, {
      id: 'chapter3', href: 'Text/chapter3.xhtml', mediaType: 'application/xhtml+xml'
    });
    workspace = await service.updateSpineOrder(workspace, ['chapter1', 'chapter2', 'chapter3']);
    
    const updated = await service.removeSpineItem(workspace, 'chapter2');
    
    // CONTRACT: MUST maintain order of remaining items
    expect(updated.opf.spine).toEqual([
      { idref: 'chapter1' },
      { idref: 'chapter3' }
    ]);
  });
});
```

### Contract 7: Query Operations

**Specification**: Query operations must provide accurate workspace information.

```typescript
describe('Contract: Query Operations', () => {
  test('listWorkspaces returns workspace summary info', async () => {
    // Create test workspaces
    await service.createWorkspace({
      title: 'Query Test 1', language: 'en', identifier: 'query1'
    });
    await service.createWorkspace({
      title: 'Query Test 2', language: 'fr', identifier: 'query2'
    });
    
    const workspaces = await service.listWorkspaces();
    
    // CONTRACT: MUST include summary information for all workspaces
    expect(workspaces.length).toBeGreaterThanOrEqual(2);
    workspaces.forEach(workspace => {
      expect(workspace).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        language: expect.any(String),
        lastModified: expect.any(Date),
        fileCount: expect.any(Number),
        totalSize: expect.any(Number)
      });
    });
    
    // CONTRACT: MUST include our test workspaces
    const testWorkspace1 = workspaces.find(w => w.title === 'Query Test 1');
    const testWorkspace2 = workspaces.find(w => w.title === 'Query Test 2');
    expect(testWorkspace1).toBeDefined();
    expect(testWorkspace2).toBeDefined();
    expect(testWorkspace1!.language).toBe('en');
    expect(testWorkspace2!.language).toBe('fr');
  });
  
  test('workspaceExists returns accurate boolean', async () => {
    const workspace = await service.createWorkspace({
      title: 'Exists Test', language: 'en', identifier: 'exists'
    });
    
    // CONTRACT: MUST return true for existing workspace
    expect(await service.workspaceExists(workspace.id)).toBe(true);
    
    // CONTRACT: MUST return false for non-existent workspace
    expect(await service.workspaceExists('non-existent-workspace')).toBe(false);
  });
});
```

## Performance Contract

**Specification**: Operations must meet performance expectations.

```typescript
describe('Contract: Performance', () => {
  test('loadWorkspace completes within acceptable time', async () => {
    const workspace = await service.createWorkspace({
      title: 'Performance Test', language: 'en', identifier: 'perf'
    });
    
    const startTime = Date.now();
    await service.loadWorkspace(workspace.id);
    const duration = Date.now() - startTime;
    
    // CONTRACT: MUST load workspace within 500ms for typical size
    expect(duration).toBeLessThan(500);
  });
  
  test('manifest operations complete efficiently', async () => {
    let workspace = await service.createWorkspace({
      title: 'Manifest Perf Test', language: 'en', identifier: 'manifest-perf'
    });
    
    const startTime = Date.now();
    
    // Add 50 manifest items
    for (let i = 1; i <= 50; i++) {
      workspace = await service.addManifestItem(workspace, {
        id: `chapter${i}`,
        href: `Text/chapter${i}.xhtml`,
        mediaType: 'application/xhtml+xml'
      });
    }
    
    const duration = Date.now() - startTime;
    
    // CONTRACT: MUST handle typical manifest operations efficiently
    expect(duration).toBeLessThan(2000); // 2 seconds for 50 items
    expect(workspace.opf.manifest).toHaveLength(50);
  });
  
  test('supports concurrent operations', async () => {
    const operations = Array.from({ length: 10 }, (_, i) => 
      service.createWorkspace({
        title: `Concurrent ${i}`, 
        language: 'en', 
        identifier: `concurrent-${i}`
      })
    );
    
    // CONTRACT: MUST handle concurrent operations without corruption
    const results = await Promise.all(operations);
    const ids = results.map(w => w.id);
    expect(new Set(ids).size).toBe(10); // All unique IDs
  });
});
```

### Contract 8: Batch Content Loading

**Specification**: Batch content loading operations must efficiently load XHTML content for navigation generation.

```typescript
describe('Contract: Batch Content Loading', () => {
  test('loadAllLinearChapterContents returns all linear chapters with content', async () => {
    const workspace = await service.createWorkspace({
      title: 'Content Test', language: 'en', identifier: 'content-test'
    });
    
    // Add chapters with different linear settings
    const updated1 = await service.addManifestItem(workspace, {
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    const updated2 = await service.addSpineItem(updated1, { idref: 'chapter1', linear: true });
    
    const updated3 = await service.addManifestItem(updated2, {
      id: 'appendix',
      href: 'Text/appendix.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    const finalWorkspace = await service.addSpineItem(updated3, { idref: 'appendix', linear: false });
    
    // Mock file content
    mockFileStorage.readTextFile.mockImplementation((workspaceId, path) => {
      if (path === 'OEBPS/Text/chapter1.xhtml') {
        return Promise.resolve('<html><body><h1>Chapter 1</h1><p>Content</p></body></html>');
      }
      if (path === 'OEBPS/Text/appendix.xhtml') {
        return Promise.resolve('<html><body><h1>Appendix</h1><p>Extra content</p></body></html>');
      }
      return Promise.reject(new Error('File not found'));
    });
    
    const chapterContents = await service.loadAllLinearChapterContents(finalWorkspace);
    
    // CONTRACT: MUST return only linear chapters with loaded content
    expect(chapterContents).toHaveLength(1);
    expect(chapterContents[0]).toEqual({
      id: 'chapter1',
      href: 'Text/chapter1.xhtml',
      xhtmlContent: '<html><body><h1>Chapter 1</h1><p>Content</p></body></html>',
      linear: true
    });
  });
  
  test('loadChapterContents loads specific chapters by ID', async () => {
    const workspace = await service.createWorkspace({
      title: 'Batch Test', language: 'en', identifier: 'batch-test'
    });
    
    // Add multiple chapters
    let updated = workspace;
    for (let i = 1; i <= 3; i++) {
      updated = await service.addManifestItem(updated, {
        id: `chapter${i}`,
        href: `Text/chapter${i}.xhtml`,
        mediaType: 'application/xhtml+xml'
      });
      updated = await service.addSpineItem(updated, { idref: `chapter${i}`, linear: true });
    }
    
    // Mock file content
    mockFileStorage.readTextFile.mockImplementation((workspaceId, path) => {
      const match = path.match(/chapter(\d+)\.xhtml$/);
      if (match) {
        const num = match[1];
        return Promise.resolve(`<html><body><h1>Chapter ${num}</h1></body></html>`);
      }
      return Promise.reject(new Error('File not found'));
    });
    
    const chapterContents = await service.loadChapterContents(updated, ['chapter1', 'chapter3']);
    
    // CONTRACT: MUST load only requested chapters
    expect(chapterContents).toHaveLength(2);
    expect(chapterContents.map(c => c.id)).toEqual(['chapter1', 'chapter3']);
    expect(chapterContents[0].xhtmlContent).toContain('Chapter 1');
    expect(chapterContents[1].xhtmlContent).toContain('Chapter 3');
  });
  
  test('loadChapterContents handles missing files gracefully', async () => {
    const workspace = await service.createWorkspace({
      title: 'Missing File Test', language: 'en', identifier: 'missing-test'
    });
    
    const updated = await service.addManifestItem(workspace, {
      id: 'missing-chapter',
      href: 'Text/missing.xhtml',
      mediaType: 'application/xhtml+xml'
    });
    
    // Mock file not found
    mockFileStorage.readTextFile.mockRejectedValue(new Error('File not found'));
    
    const chapterContents = await service.loadChapterContents(updated, ['missing-chapter']);
    
    // CONTRACT: MUST handle missing files gracefully (skip or provide fallback)
    expect(chapterContents).toHaveLength(0); // Skip missing files
  });
});
```

## Implementation Guidance

### Red Phase (Failing Tests)
1. **Copy all contract tests** into `src/lib/services/workspace/workspace.service.test.ts`
2. **Run tests** - they should all fail (Red phase)
3. **Create minimal class** that satisfies TypeScript compilation

### Green Phase (Make Tests Pass)
1. **Implement WorkspaceService class** with existing infrastructure
2. **Use FileStorageAPI and EPUBProcessor** as dependencies
3. **Make each contract test pass** one at a time
4. **Focus on simplest implementation** that satisfies contracts

### Refactor Phase (Optimize)
1. **Extract common patterns** and utilities
2. **Optimize performance** while maintaining contract compliance
3. **Add error handling** and edge case coverage
4. **Ensure all contracts still pass**

## Success Criteria

- ✅ All contract tests pass
- ✅ No direct file system access (delegates to FileStorageAPI)
- ✅ No direct OPF parsing (delegates to EPUBProcessor)
- ✅ Returns complete WorkspaceState objects for reactive consumption
- ✅ Maintains consistency between OPF structure and file system
- ✅ Provides typed, recoverable errors
- ✅ Meets performance expectations

This contract serves as the **executable specification** for TDD implementation of WorkspaceService in the simplified reactive architecture.