# Shared Types Design for Clean Service Architecture

**Date:** 2025-01-29  
**Status:** Definitive Type Reference - Complete Type Catalog  
**Purpose:** Definitive location for all project types with source tracking and change management

## Overview

This document serves as the **single source of truth** for all TypeScript interfaces used across the EDITME.html project. It provides complete type definitions extracted from the existing codebase, tracks their source locations, and establishes guidelines for type management in the clean service architecture.

## Design Principles

1. **Eliminate Duplication**: Same concepts should use the same type definitions
2. **Simplify Interfaces**: Remove non-essential properties from service interfaces
3. **Reuse Existing Types**: Prefer existing EPUB/project types over custom definitions
4. **Maintain Clean Boundaries**: Shared types should be domain-agnostic and stable

## Complete Type Catalog

### 1. EPUB Core Types

**Source**: `src/lib/epub/opf-utils.ts`  
**Status**: Well-established, widely used

```typescript
export interface EPUBMetadata {
  // Required Dublin Core elements
  title: string;
  language: string;
  identifier: string;

  // Optional Dublin Core elements
  creator?: string[];
  contributor?: string[];
  publisher?: string;
  date?: string;
  description?: string;
  subject?: string[];
  rights?: string;
  source?: string;
  relation?: string;
  coverage?: string;
  type?: string;
  format?: string;

  // EPUB-specific metadata
  modifiedDate?: string;
  epubVersion?: string;

  // EPUB 3 rendition metadata
  renditionLayout?: string;
  pageProgressionDirection?: string;
  renditionOrientation?: string;
  renditionSpread?: string;

  // EPUB 3 accessibility metadata
  accessMode?: string[];
  accessModeSufficient?: string[];
  accessibilityFeature?: string[];
  accessibilityHazard?: string[];
  accessibilitySummary?: string;
}

export interface OPFDocument {
  metadata: EPUBMetadata;
  manifest: ManifestItem[];
  spine: SpineItem[];
  version?: string;
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string[];
  fallback?: string;
}

export interface SpineItem {
  idref: string;
  linear?: boolean;
  properties?: string[];
}

export interface ContainerInfo {
  rootfilePath?: string;
  error?: string;
}

export interface XMLValidationResult {
  isValid: boolean;
  error?: string;
}
```

**Used By**: All services, WorkspaceManager, EPUBProcessor, ManifestManager

### 2. Workspace Types

**Source**: `src/lib/workspace/types.ts`  
**Status**: Well-established, core workspace management

```typescript
export interface WorkspaceInfo {
  id: string;
  title: string;
  author?: string;
  language: string;
  fileCount: number;
  epubVersion: string;
  hasError?: boolean;
}

export interface WorkspacePathInfo {
  rootfilePath: string; // Full path to OPF file (e.g., "OEBPS/content.opf")
  basePath: string; // Base directory for EPUB content (e.g., "OEBPS")
  opfFileName: string; // OPF filename (e.g., "content.opf")
}
```

**Used By**: WorkspaceService, WorkspaceManager, validation systems

### 3. Navigation Types

**Source**: `src/lib/outline/outline-generator.ts`  
**Status**: Existing implementation, needs extraction to shared location

TBD: in the revised, simplified architecture this should just be a ManifestItem, not a navigation specific interface

**Used By**: ContentService, OutlineGenerator  
**Extraction Target**: `src/lib/types/navigation.ts`

### 4. Content Types

**Source**: Not yet implemented - needs creation  
**Status**: Required for clean service architecture

```typescript
export interface ChapterContent {
  /** Spine item ID */
  id: string;

  /** Relative path to XHTML file */
  href: string;

  /** Pre-loaded XHTML content */
  xhtmlContent: string;

  /** Whether chapter is in linear reading order */
  linear: boolean;
}

export interface TransformResult {
  /** Generated XHTML content */
  xhtml: string;

  /** Transformation warnings */
  warnings: string[];

  /** Optional source map for debugging */
  sourceMap?: SourceMap;

  /** Transform execution time in milliseconds */
  transformTime: number;
}

export interface ContentPreview {
  /** Rendered HTML content */
  html: string;

  /** Plain text content */
  plainText: string;

  /** Transformation warnings */
  warnings: string[];
}

export interface TransformContext {
  /** Optional context for transform pipeline */
  workspaceId?: string;

  /** Base URL for relative links */
  baseUrl?: string;
}
```

**Used By**: ContentService, WorkspaceService  
**Target Location**: `src/lib/types/content.ts`

### 5. Localization Types

**Source**: Not yet implemented - needs creation  
**Status**: Required for ContentService sample content generation

```typescript
export interface LocalizedSampleContent {
  /** Target locale identifier */
  locale: string;

  /** EPUB metadata (reuses existing EPUBMetadata) */
  metadata: EPUBMetadata;

  /** Chapter content (reuses existing DemoChapter) */
  chapters: DemoChapter[];

  /** Right-to-left text direction flag */
  isRTL: boolean;

  /** Page progression direction for EPUB */
  pageProgressionDirection?: 'rtl' | 'ltr';
}
```

**Used By**: ContentService, i18n system  
**Target Location**: `src/lib/types/localization.ts`

### 6. Settings Types

**Source**: Service-specific - defined in SettingsService contract  
**Status**: Domain-specific, should remain with SettingsService

```typescript
export interface GlobalSettings {
  theme: 'light' | 'dark' | 'system';
  locale: string;
  editor_font_size: number; // 8-32 pixels
}

export interface WorkspaceSettings {
  bust_cache: boolean;
  draft_id: number;
  editor?: {
    preview_delay_ms: number; // 100-2000ms
    advanced_mode: boolean;
  };
}

export interface EPUBSettings {
  text_transform: string;
  dom_transforms: string[];
  spine_basename: string;
  cover?: {
    template: string;
    background_color: string;
    text_color: string;
    font_family: string;
  };
}

export interface SettingsValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TransformOption {
  path: string;
  extensionName: string;
  fileName: string;
}
```

**Used By**: SettingsService exclusively  
**Rationale**: These types represent the three-tier settings architecture unique to settings management

### 7. Workspace Manager Interface

**Source**: `src/lib/workspace/types.ts`  
**Status**: Critical interface for service integration

```typescript
export interface IWorkspaceManager {
  // Workspace lifecycle
  init(): Promise<void>;
  listWorkspacesWithMetadata(): Promise<WorkspaceInfo[]>;
  startLoadingWorkspaces(): Promise<void>;
  createEPUBWorkspace(metadata: EPUBMetadata): Promise<string>;
  createLocalizedEPUBWorkspace(metadata: Partial<EPUBMetadata>, locale: string): Promise<string>;
  switchWorkspace(workspaceId: string): Promise<WorkspaceInfo>;
  deleteWorkspace(workspaceId: string): Promise<void>;

  // Reactive stores
  get workspaces(): any;
  get isLoadingWorkspaces(): any;
  get hasStartedLoadingWorkspaces(): boolean;

  // OPF Management
  getWorkspaceOPF(workspaceId: string): Promise<OPFDocument>;
  updateWorkspaceOPF(workspaceId: string, opf: OPFDocument): Promise<void>;

  // Manifest operations
  addManifestItem(workspaceId: string, item: Partial<ManifestItem>): Promise<ManifestItem>;
  removeManifestItem(workspaceId: string, itemId: string): Promise<void>;

  // Spine operations
  updateSpineOrder(workspaceId: string, spineItems: string[]): Promise<void>;
  addSpineItem(workspaceId: string, item: SpineItem, insertIndex?: number): Promise<void>;
  removeSpineItem(workspaceId: string, idref: string): Promise<void>;

  // File operations
  fileExists(workspaceId: string, path: string): Promise<boolean>;
  writeTextFile(workspaceId: string, path: string, content: string): Promise<void>;
  readTextFile(workspaceId: string, path: string): Promise<string>;
  readFile(workspaceId: string, path: string): Promise<ArrayBuffer>;
  writeFile(workspaceId: string, path: string, content: string | ArrayBuffer): Promise<void>;
  deleteFile(workspaceId: string, path: string): Promise<void>;

  // Metadata operations
  getWorkspaceMetadata(workspaceId: string): Promise<EPUBMetadata>;
  updateMetadata(workspaceId: string, metadata: EPUBMetadata): Promise<void>;

  // Validation and utilities
  validateWorkspaceStructure(workspaceId: string): Promise<ValidationResult>;
  getWorkspacePathInfo(workspaceId: string): Promise<WorkspacePathInfo>;
  cleanupOrphanedWorkspaces(): Promise<{ cleaned: string[]; errors: string[] }>;

  // Advanced features
  isAdvancedModeEnabled(workspaceId: string): Promise<boolean>;
  listSourceFiles(workspaceId: string): Promise<any[]>;
  getSourceFile(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string>;
}
```

**Used By**: All services that need workspace operations  
**Purpose**: Contract that prevents missing method errors during service integration

## Type Reuse Strategy

### Existing Types to Leverage

Instead of creating custom types, reuse these existing project types:

1. **EPUBMetadata** - For all book metadata needs
2. **DemoChapter** - For sample/demo chapter content
3. **ManifestItem** - For EPUB manifest entries
4. **SpineItem** - For EPUB spine entries
5. **WorkspaceState** - For workspace data structures
6. **OPFDocument** - For complete EPUB structure

### Type Location Strategy

**Feature-Based Type Organization (Recommended):**

```
src/lib/
├── workspace/
│   ├── workspace-service.ts
│   └── types.ts              # Workspace-specific types
├── content/
│   ├── content-service.ts
│   └── types.ts              # Content transformation types
├── i18n/
│   ├── localization-service.ts
│   └── types.ts              # i18n and RTL support types
└── shared/
    └── types.ts              # Truly cross-cutting types only
```

## Service Interface Updates

### Updated ContentService Interface

```typescript
interface ContentService {
  // Content transformation operations (simplified)
  transformContent(
    sourceText: string,
    transformContext?: TransformContext
  ): Promise<TransformResult>;
  previewContent(sourceText: string, transformContext?: TransformContext): Promise<ContentPreview>;

  // Navigation document generation (using shared types)
  generateNavigationFromContent(chapters: ChapterContent[]): NavigationDocument;
  processUserNavigation(navText: string): NavigationDocument;

  // Sample content generation (using existing EPUB types)
  generateLocalizedContent(locale: string): Promise<LocalizedSampleContent>;
  generateLocalizedMetadata(locale: string): Promise<EPUBMetadata>;
  generateLocalizedChapters(locale: string): Promise<DemoChapter[]>;
}
```

### Updated WorkspaceService Interface

```typescript
interface WorkspaceService {
  // ... existing methods ...

  // Batch content operations (using shared ChapterContent)
  loadChapterContents(workspace: WorkspaceState, chapterIds: string[]): Promise<ChapterContent[]>;
  loadAllLinearChapterContents(workspace: WorkspaceState): Promise<ChapterContent[]>;
}
```

## Implementation Plan

### Phase 1: Create Shared Type Files

1. Create `src/lib/types/content.ts` with content transformation types
2. Create `src/lib/types/navigation.ts` with navigation types
3. Create `src/lib/types/localization.ts` with i18n types

### Phase 2: Update Service Contracts

1. Update ContentService contract to use shared types
2. Update WorkspaceService contract to use shared types
3. Update testing documentation with shared type examples

### Phase 3: Implementation Alignment

1. Ensure TDD implementations use shared types
2. Update existing OutlineGenerator to use shared NavigationDocument
3. Validate type consistency across all services

## Benefits

1. **Reduced Complexity**: Simpler service interfaces focus on core responsibilities
2. **Type Consistency**: Same concepts use same type definitions across services
3. **Maintainability**: Changes to shared types update all services automatically
4. **Clean Architecture**: Clear separation between service logic and data structures
5. **Reusability**: Types can be used by UI components and other systems

## Success Criteria

- ✅ No duplicate type definitions across service contracts
- ✅ All service interfaces use shared types where appropriate
- ✅ Existing EPUB types are reused instead of creating custom equivalents
- ✅ Service interfaces contain only essential properties
- ✅ Type definitions are stable and domain-agnostic
- ✅ Clear ownership and location for each shared type

## Type Organization Matrix

| Type Category    | Current Location                       | Target Location                 | Status              | Services Using                     |
| ---------------- | -------------------------------------- | ------------------------------- | ------------------- | ---------------------------------- |
| **EPUB Core**    | `src/lib/epub/opf-utils.ts`            | ✅ Current location             | Established         | All services                       |
| **Workspace**    | `src/lib/workspace/types.ts`           | ✅ Current location             | Established         | WorkspaceService, WorkspaceManager |
| **Navigation**   | `src/lib/outline/outline-generator.ts` | `src/lib/types/navigation.ts`   | 🔄 Needs extraction | ContentService, OutlineGenerator   |
| **Content**      | ❌ Not yet created                     | `src/lib/types/content.ts`      | 📝 Needs creation   | ContentService, WorkspaceService   |
| **Localization** | ❌ Not yet created                     | `src/lib/types/localization.ts` | 📝 Needs creation   | ContentService, i18n system        |
| **Settings**     | Service-specific contracts             | ✅ Stay with SettingsService    | Domain-specific     | SettingsService only               |

## Change Management Process

### 1. Adding New Types

**When creating a new shared type:**

1. **Determine Scope**: Is this type used by multiple services?
   - **Single Service**: Keep in service-specific location
   - **Multiple Services**: Create in appropriate `src/lib/types/` file

2. **Update Documentation**: Add complete type definition to this document with:
   - Source location
   - Used by services
   - Status and rationale

3. **Update Service Contracts**: Reference the type location in all affected service contracts

### 2. Modifying Existing Types

**When changing a shared type:**

1. **Update Source Code**: Make changes in the actual TypeScript file
2. **Update This Document**: Copy the updated type definition here
3. **Update Service Contracts**: Review all contracts that use the type
4. **Test Integration**: Ensure changes don't break service implementations

### 3. Type Extraction Process

**For extracting existing types to shared locations:**

1. **Create Target File**: Create new file in `src/lib/types/`
2. **Copy Type Definition**: Move complete interface from source
3. **Update Imports**: Update all files that import the type
4. **Update This Document**: Change status from "needs extraction" to "established"
5. **Validate Services**: Ensure all service contracts reference correct location

### 4. Documentation Synchronization

**Rules for keeping documentation and code in sync:**

- ✅ **Single Source of Truth**: This document contains complete type definitions
- ✅ **Regular Updates**: Update this document immediately when types change
- ✅ **Version Control**: Include documentation updates in same commit as type changes
- ✅ **Review Process**: Type changes require review of this document

### 5. Breaking Change Prevention

**Before modifying a shared type:**

1. **Impact Analysis**: Check "Used By" field to identify affected services
2. **Backward Compatibility**: Prefer adding optional fields over changing existing ones
3. **Migration Plan**: Document migration steps for breaking changes
4. **Service Coordination**: Update all service contracts before implementation

## Implementation Roadmap

### Phase 1: Extract Navigation Types ✅ Ready

- [x] Navigation types exist in `src/lib/outline/outline-generator.ts`
- [ ] Create `src/lib/types/navigation.ts`
- [ ] Update imports in ContentService and OutlineGenerator
- [ ] Update service contracts to reference new location

### Phase 2: Create Content Types ✅ Ready

- [ ] Create `src/lib/types/content.ts` with ChapterContent, TransformResult, etc.
- [ ] Update ContentService and WorkspaceService contracts
- [ ] Implement types in service implementations

### Phase 3: Create Localization Types ✅ Ready

- [ ] Create `src/lib/types/localization.ts` with LocalizedSampleContent
- [ ] Update ContentService contract
- [ ] Implement in ContentService sample content generation

### Phase 4: Validation ✅ Ready

- [ ] Verify all service contracts reference correct type locations
- [ ] Test that service implementations compile with shared types
- [ ] Update TDD contracts to use shared type imports

## Success Metrics

- ✅ **Zero Duplication**: No type definitions repeated across files
- ✅ **Single Source**: This document contains all project type definitions
- ✅ **Clear Ownership**: Each type has defined source location and maintainer
- ✅ **Service Integration**: All service contracts reference shared types correctly
- ✅ **Change Tracking**: Type modifications are documented and synchronized
- ✅ **Implementation Ready**: Types support clean service architecture TDD implementation

This shared types design provides the definitive type reference for the clean service architecture, ensuring consistency, eliminating duplication, and supporting maintainable service implementations.
