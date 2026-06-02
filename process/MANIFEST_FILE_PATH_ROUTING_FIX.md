# Manifest File Path Routing Fix

## Key Concept: File System vs Manifest Paths

**Critical Distinction**: EPUB uses two different path systems:

1. **File System Paths** (workspace storage): `OEBPS/Scripts/app.js`
   - Full paths from workspace root
   - Used for actual file storage operations
   - Include the OEBPS container directory

2. **Manifest hrefs** (OPF document): `Scripts/app.js`
   - Relative to the OPF file location (inside OEBPS)
   - Used in the EPUB manifest/spine
   - Do NOT include OEBPS prefix

**The Bug**: Current system confuses these two path types, incorrectly using file system paths as manifest hrefs.

## Problem Analysis

### Current Issue

When creating a new file through the "Create Text File" dialog in the manifest view, the system has a path handling bug that causes files to be created with incorrect paths and broken preview functionality.

**Workflow Breakdown:**

1. User creates `new_file.js` through the modal
2. Modal hardcodes path to `OEBPS/new_file.js` in the file system
3. File gets created at workspace path `OEBPS/new_file.js`
4. Manifest item incorrectly shows href `OEBPS/new_file.js` (should be relative)
5. Preview fails because JavaScript files should use `Scripts/` directory structure
6. User expects manifest href `Scripts/new_file.js` with working preview

**Key Issue**: Manifest `href` attributes should be relative to the OPF file location (inside OEBPS), not absolute workspace paths.

### Root Cause Analysis

#### 1. Modal Path Generation (`ManifestItemEditor.svelte`)

```typescript
// Line 95: Hardcoded OEBPS prefix
formData.href = `OEBPS/${selectedFile.name}`;

// Line 163: Hardcoded OEBPS prefix
formData.href = `OEBPS/${formData.id}${extension}`;
```

#### 2. ManifestManager Default Directory

```typescript
// createTextItem() incorrectly defaults to OEBPS/ for manifest hrefs
const targetDirectory = itemData.targetDirectory || 'OEBPS/';
```

#### 3. No Media Type → Directory Mapping

The system lacks logic to route files to appropriate EPUB directories based on media type:

- JavaScript → `Scripts/`
- CSS → `Styles/`
- XHTML → `Text/`
- Images → `Images/`

#### 4. File Creation vs Preview Mismatch

Files are created at hardcoded paths but the preview system expects proper EPUB directory structure.

## Technical Solution

### Media Type to Directory Mapping System

Create a centralized utility function that maps media types to proper EPUB directories following industry standards.

#### Directory Mapping Rules

```typescript
const EPUB_DIRECTORY_MAP = {
  // Text content
  'application/xhtml+xml': 'Text/',
  'text/html': 'Text/',

  // Stylesheets
  'text/css': 'Styles/',

  // Scripts
  'text/javascript': 'Scripts/',
  'application/javascript': 'Scripts/',

  // Images
  'image/jpeg': 'Images/',
  'image/png': 'Images/',
  'image/gif': 'Images/',
  'image/svg+xml': 'Images/',
  'image/webp': 'Images/',

  // Audio
  'audio/mpeg': 'Audio/',
  'audio/ogg': 'Audio/',
  'audio/wav': 'Audio/',
  'audio/mp4': 'Audio/',

  // Video
  'video/mp4': 'Video/',
  'video/webm': 'Video/',
  'video/ogg': 'Video/',

  // Fonts
  'font/ttf': 'Fonts/',
  'font/otf': 'Fonts/',
  'font/woff': 'Fonts/',
  'font/woff2': 'Fonts/',
  'application/font-woff': 'Fonts/',

  // Documents
  'application/pdf': 'Misc/',
  'text/plain': 'Text/',

  // Default fallback (root level relative to OPF)
  DEFAULT: '',
};
```

## Implementation Plan

### Phase 1: Create Utility Function

#### Location: `src/lib/epub/opf-utils.ts` (add to existing file)

```typescript
/**
 * EPUB Path Utilities
 *
 * Provides standardized path generation for EPUB file structure
 */

export interface DirectoryMapping {
  [mediaType: string]: string;
}

export const EPUB_DIRECTORY_MAP: DirectoryMapping = {
  // Text content
  'application/xhtml+xml': 'Text/',
  'text/html': 'Text/',

  // Stylesheets
  'text/css': 'Styles/',

  // Scripts
  'text/javascript': 'Scripts/',
  'application/javascript': 'Scripts/',

  // Images
  'image/jpeg': 'Images/',
  'image/png': 'Images/',
  'image/gif': 'Images/',
  'image/svg+xml': 'Images/',
  'image/webp': 'Images/',

  // Audio
  'audio/mpeg': 'Audio/',
  'audio/ogg': 'Audio/',
  'audio/wav': 'Audio/',
  'audio/mp4': 'Audio/',

  // Video
  'video/mp4': 'Video/',
  'video/webm': 'Video/',
  'video/ogg': 'Video/',

  // Fonts
  'font/ttf': 'Fonts/',
  'font/otf': 'Fonts/',
  'font/woff': 'Fonts/',
  'font/woff2': 'Fonts/',
  'application/font-woff': 'Fonts/',

  // Documents
  'application/pdf': 'Misc/',
  'text/plain': 'Text/',
};

/**
 * Get the appropriate EPUB directory for a given media type
 * @param mediaType - MIME type of the file
 * @returns Directory path with trailing slash
 */
export function getDirectoryFromMediaType(mediaType: string): string {
  // Normalize media type (remove charset, etc.)
  const normalizedType = mediaType.split(';')[0].trim().toLowerCase();

  // Return mapped directory or default (root relative to OPF)
  return EPUB_DIRECTORY_MAP[normalizedType] || '';
}

/**
 * Generate full EPUB manifest href from filename and media type
 * @param filename - Name of the file
 * @param mediaType - MIME type of the file
 * @returns Manifest href relative to OPF file (e.g., "Scripts/app.js")
 * @note This is for manifest hrefs, not file system paths
 */
export function generateEPUBPath(filename: string, mediaType: string): string {
  const directory = getDirectoryFromMediaType(mediaType);
  return directory + filename;
}

/**
 * Extract directory from existing EPUB path
 * @param path - Full EPUB path
 * @returns Directory portion with trailing slash
 */
export function extractDirectoryFromPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return path.substring(0, lastSlash + 1);
}

/**
 * Validate if a path follows EPUB directory conventions
 * @param path - Full EPUB path to validate
 * @param mediaType - Expected media type
 * @returns True if path is in correct directory for media type
 */
export function validateEPUBPath(path: string, mediaType: string): boolean {
  const expectedDirectory = getDirectoryFromMediaType(mediaType);
  return path.startsWith(expectedDirectory);
}
```

### Phase 2: Update ManifestItemEditor Modal

#### File: `src/lib/components/manifest/ManifestItemEditor.svelte`

```typescript
// Add import
import { generateEPUBPath } from '../../utils/epub-paths.js';

// Update file selection handler (line ~95)
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile = target.files[0];

    // Auto-fill form data based on file
    if (!formData.id) {
      formData.id = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
    }
    if (!formData.href) {
      const mediaType = selectedFile.type || detectMediaType(selectedFile.name);
      formData.href = generateEPUBPath(selectedFile.name, mediaType);
    }
    if (!formData.mediaType) {
      formData.mediaType = selectedFile.type || detectMediaType(selectedFile.name);
    }
  }
};

// Update href generation from ID (line ~163)
const generateHrefFromId = () => {
  if (formData.id && !formData.href) {
    const extension = getExtensionFromMediaType(formData.mediaType || '');
    const filename = formData.id + extension;
    formData.href = generateEPUBPath(filename, formData.mediaType || '');
  }
};
```

### Phase 3: Update ManifestManager

#### File: `src/lib/manifest/manifest-manager.ts`

```typescript
// Add import
import { getDirectoryFromMediaType } from '../utils/epub-paths.js';

// Update createTextItem method
async createTextItem(workspaceId: string, itemData: CreateTextItemData): Promise<ManifestItem> {
  try {
    // Validate input
    if (!itemData.fileName || itemData.fileName.trim() === '') {
      throw new ValidationError('File name is required');
    }

    // Generate ID if not provided
    const id = itemData.id || this.generateItemId(itemData.fileName);

    // Detect media type if not provided
    const mediaType = itemData.mediaType || this.detectMediaType(itemData.fileName);

    // Build manifest href using media type routing (relative to OPF file)
    const targetDirectory = itemData.targetDirectory || getDirectoryFromMediaType(mediaType);
    const href = targetDirectory + itemData.fileName;

    // File system path will be OEBPS/ + href for actual file creation
    const fileSystemPath = 'OEBPS/' + href;

    // Rest of the method remains the same...
  }
}
```

### Phase 4: Update Interface Types

#### File: `src/lib/manifest/types.ts`

```typescript
export interface CreateTextItemData {
  fileName: string;
  content: string;
  id?: string;
  mediaType?: string;
  properties?: string[];
  targetDirectory?: string; // Make this optional, will use media-type routing by default
}
```

## Unit Testing Strategy

### Test File: `src/lib/epub/test/opf-utils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getDirectoryFromMediaType, generateEPUBPath } from '../opf-utils.js';

describe('EPUB Path Utilities', () => {
  describe('getDirectoryFromMediaType', () => {
    it('should map core file types to correct directories', () => {
      expect(getDirectoryFromMediaType('text/javascript')).toBe('Scripts/');
      expect(getDirectoryFromMediaType('application/javascript')).toBe('Scripts/');
      expect(getDirectoryFromMediaType('text/css')).toBe('Styles/');
      expect(getDirectoryFromMediaType('application/xhtml+xml')).toBe('Text/');
      expect(getDirectoryFromMediaType('text/html')).toBe('Text/');
      expect(getDirectoryFromMediaType('image/jpeg')).toBe('Images/');
    });

    it('should handle media types with charset parameters', () => {
      expect(getDirectoryFromMediaType('text/css; charset=utf-8')).toBe('Styles/');
      expect(getDirectoryFromMediaType('text/javascript;charset=UTF-8')).toBe('Scripts/');
    });

    it('should default to root level for unknown media types', () => {
      expect(getDirectoryFromMediaType('application/unknown')).toBe('');
      expect(getDirectoryFromMediaType('text/unknown')).toBe('');
      expect(getDirectoryFromMediaType('')).toBe('');
    });

    it('should be case insensitive', () => {
      expect(getDirectoryFromMediaType('TEXT/JAVASCRIPT')).toBe('Scripts/');
      expect(getDirectoryFromMediaType('Image/JPEG')).toBe('Images/');
    });
  });

  describe('generateEPUBPath', () => {
    it('should generate correct paths for core file types', () => {
      expect(generateEPUBPath('app.js', 'text/javascript')).toBe('Scripts/app.js');
      expect(generateEPUBPath('style.css', 'text/css')).toBe('Styles/style.css');
      expect(generateEPUBPath('chapter1.xhtml', 'application/xhtml+xml')).toBe(
        'Text/chapter1.xhtml'
      );
      expect(generateEPUBPath('cover.jpg', 'image/jpeg')).toBe('Images/cover.jpg');
    });

    it('should handle filenames with special characters', () => {
      expect(generateEPUBPath('my-script.js', 'text/javascript')).toBe('Scripts/my-script.js');
      expect(generateEPUBPath('chapter_1.xhtml', 'application/xhtml+xml')).toBe(
        'Text/chapter_1.xhtml'
      );
    });

    it('should default to root level for unknown types', () => {
      expect(generateEPUBPath('data.bin', 'application/octet-stream')).toBe('data.bin');
    });
  });
});
```

### Integration Test: `src/lib/manifest/test/epub-path-integration.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManifestManagerImpl } from '../manifest-manager.js';
import { createVitestMockFileStorage } from '../../test/mocks/file-storage-vitest.mock.js';
import { createMockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import type { CreateTextItemData } from '../types.js';

describe('ManifestManager EPUB Path Integration', () => {
  let manifestManager: ManifestManagerImpl;
  let mockWorkspaceManager: ReturnType<typeof createMockWorkspaceManager>;
  const workspaceId = 'test-workspace';

  beforeEach(async () => {
    mockWorkspaceManager = createMockWorkspaceManager();

    // Setup basic OPF structure for path resolution
    mockWorkspaceManager.getWorkspaceOPF.mockResolvedValue({
      metadata: { title: 'Test', language: 'en', identifier: 'test' },
      manifest: [],
      spine: [],
    });

    mockWorkspaceManager.getWorkspacePathInfo.mockResolvedValue({
      basePath: 'OEBPS',
      opfPath: 'OEBPS/content.opf',
    });

    manifestManager = new ManifestManagerImpl(mockWorkspaceManager);
  });

  describe('createTextItem with proper path routing', () => {
    it('should create JavaScript files in Scripts directory', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'app.js',
        content: 'console.log("Hello");',
        mediaType: 'text/javascript',
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Scripts/app.js');
      expect(result.mediaType).toBe('text/javascript');

      // Verify file was written to correct file system path
      expect(mockWorkspaceManager.writeFile).toHaveBeenCalledWith(
        workspaceId,
        'OEBPS/Scripts/app.js',
        'console.log("Hello");'
      );
    });

    it('should create CSS files in Styles directory', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'main.css',
        content: 'body { margin: 0; }',
        mediaType: 'text/css',
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Styles/main.css');
      expect(mockWorkspaceManager.writeFile).toHaveBeenCalledWith(
        workspaceId,
        'OEBPS/Styles/main.css',
        'body { margin: 0; }'
      );
    });

    it('should auto-detect media type and use appropriate directory', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'script.js',
        content: 'const x = 1;',
        // No mediaType provided - should auto-detect
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Scripts/script.js');
      expect(result.mediaType).toBe('text/javascript');
    });

    it('should allow custom target directory override', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'custom.js',
        content: 'console.log("custom");',
        mediaType: 'text/javascript',
        targetDirectory: 'Custom/', // Override default Scripts/
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Custom/custom.js');
      expect(mockWorkspaceManager.writeFile).toHaveBeenCalledWith(
        workspaceId,
        'OEBPS/Custom/custom.js',
        'console.log("custom");'
      );
    });
  });
});
```

**Note**: Modal UI integration tests are covered by Storybook stories, which provide better browser environment testing for form interactions and path generation behavior.

## Integration Points

### 1. ManifestItemEditor Modal

- **Impact**: Path generation logic changes
- **Testing**: UI integration tests for form behavior
- **Backward Compatibility**: Existing hrefs remain unchanged

### 2. ManifestManager

- **Impact**: `createTextItem()` directory logic changes
- **Testing**: Unit tests for all media type mappings
- **Backward Compatibility**: Existing files not affected

### 3. Preview System

- **Impact**: Should work better with correct paths
- **Testing**: End-to-end preview tests
- **Validation**: Ensure Scripts/app.js files are accessible

### 4. File Creation Workflow

- **Impact**: Files created in proper directories
- **Testing**: Integration tests for complete workflow
- **Verification**: Check file system structure matches manifest

## EPUB Standards Compliance

### Directory Structure Standards

Following EPUB 3.3 specification recommendations:

**File System Structure:**

```
OEBPS/
├── Text/           # XHTML content files
├── Styles/         # CSS stylesheets
├── Scripts/        # JavaScript files
├── Images/         # Image assets
├── Audio/          # Audio files
├── Video/          # Video files
├── Fonts/          # Font files
├── Misc/           # Other files
└── content.opf     # Package document
```

**Manifest hrefs (relative to content.opf):**

```xml
<manifest>
  <item id="ch1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
  <item id="script" href="Scripts/app.js" media-type="text/javascript"/>
  <item id="style" href="Styles/main.css" media-type="text/css"/>
  <item id="cover" href="Images/cover.jpg" media-type="image/jpeg"/>
</manifest>
```

**Key Distinction:** Manifest hrefs are relative to the OPF file location, while file system paths include the OEBPS container directory.

### Media Type Mappings

All mappings follow EPUB 3.3 Core Media Type specifications:

- XHTML Content Documents: `application/xhtml+xml`
- CSS Style Sheets: `text/css`
- JavaScript: `text/javascript` or `application/javascript`
- Images: Standard image MIME types
- Audio/Video: Standard media MIME types

### Validation Rules

- Directory names are case-sensitive
- Paths use forward slashes (/)
- No spaces in directory names
- Consistent with EPUB package document structure

## Success Criteria

### Functional Requirements

1. ✅ JavaScript files created in `Scripts/` directory
2. ✅ CSS files created in `Styles/` directory
3. ✅ XHTML files created in `Text/` directory
4. ✅ Image files created in `Images/` directory
5. ✅ Preview system works with new paths
6. ✅ Manifest items show correct paths
7. ✅ File creation matches manifest entries

### Technical Requirements

1. ✅ 100% unit test coverage for path utilities
2. ✅ Integration tests for ManifestManager
3. ✅ Modal UI tests for path generation
4. ✅ End-to-end workflow testing
5. ✅ Backward compatibility maintained
6. ✅ Performance impact minimal
7. ✅ TypeScript types updated

### User Experience Requirements

1. ✅ Modal shows correct paths in real-time
2. ✅ File preview works immediately after creation
3. ✅ Error messages are clear and helpful
4. ✅ No breaking changes to existing workflows
5. ✅ Directory structure follows EPUB standards

## Risk Mitigation

### Backward Compatibility

- Existing files keep their current paths
- Only new files use media-type routing
- No migration required for existing workspaces

### Error Handling

- Fallback to root level for unknown media types
- Validation prevents duplicate paths
- Clear error messages for path conflicts

### Performance

- Minimal computational overhead
- No database schema changes
- Client-side path generation only

### Testing Strategy

- Comprehensive unit test coverage
- Integration tests for all components
- Manual testing of complete workflows
- Automated regression testing

This implementation will fix the path routing issue while maintaining system stability and following EPUB industry standards.
