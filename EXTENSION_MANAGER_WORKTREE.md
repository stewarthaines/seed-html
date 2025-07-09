# Extension Manager Implementation Worktree

This document provides setup instructions for implementing the Extension Manager using a dedicated git worktree.

## Worktree Setup

**Location**: `/Users/stewart/Projects/editme-svelte-extension-manager`
**Branch**: `feature/extension-manager`
**Base**: Current main branch with all completed features

## Implementation Scope

### What to Implement

The Extension Manager implementation based on the comprehensive API documentation and unit tests:

**API Documentation**: `src/lib/extensions/API.md` (651 lines)
**Unit Tests**: Complete test suite (9 files, 2330+ lines)

- `src/lib/extensions/test/extension-manager.test.ts` (720 lines)
- `src/lib/extensions/test/extension-cache.test.ts` (580 lines)
- `src/lib/extensions/test/utils.test.ts` (380 lines)
- `src/lib/extensions/test/integration.test.ts` (650 lines)
- Supporting mocks and fixtures

### Core Classes to Implement

1. **ExtensionManager** (`src/lib/extensions/extension-manager.ts`)
   - Main API class with all documented methods
   - Extension import/export functionality
   - Cache integration and management

2. **ExtensionCache** (`src/lib/extensions/extension-cache.ts`)
   - Global extension cache management
   - Conflict detection and resolution
   - Cache scanning and validation

3. **Extension Utils** (`src/lib/extensions/utils.ts`)
   - Name detection from JavaScript files
   - Extension validation utilities
   - File processing helpers

4. **Index Exports** (`src/lib/extensions/index.ts`)
   - Clean API exports for all classes and types

### Key Implementation Details

#### Storage Strategy

- Uses existing File Storage API with `'extensions-cache'` as global cache workspace ID
- Extensions copied to workspace `SOURCE/extensions/` directory (not linked)
- Cache stored at global level for reuse across workspaces

#### Extension Structure

```
SOURCE/extensions/
├── extension-name/
│   ├── extension-file.js      # Main JavaScript file
│   └── LICENSE.txt           # Optional license file
```

#### Conflict Resolution

- File list + size comparison for detecting cache conflicts
- Minimal validation approach (check file exists and basic structure)
- Best-effort batch operations with partial success handling

#### Auto-Detection

- Extension name auto-detected from JavaScript filename
- User confirmation with ability to choose different name
- Automatic cache population during workspace import and extension creation

## Available Resources

### Complete API Specification

The Extension Manager has comprehensive documentation in `src/lib/extensions/API.md` including:

- All method signatures with Input/Output/Side Effects
- Integration patterns and error handling
- Browser compatibility notes
- Performance characteristics

### Comprehensive Unit Tests

All functionality is covered by unit tests that can guide implementation:

- Core ExtensionManager functionality tests (720 lines)
- Cache utilities and operations tests (580 lines)
- Name detection and validation tests (380 lines)
- End-to-end integration workflow tests (650 lines)

### Mock Infrastructure

Complete mock setup available for development:

- Mock File Storage with failure injection capabilities
- Test data generators for realistic extension samples
- Fixture creation utilities

## Development Approach

### 1. Start with Types and Interfaces

Begin by implementing the type definitions from the API documentation to establish the contracts.

### 2. Implement Core Classes

Follow the test-driven approach using the existing comprehensive unit tests:

- Run tests to see what needs to be implemented
- Implement functionality to make tests pass
- Iterate until all tests pass

### 3. Integration Testing

Use the integration tests to validate end-to-end workflows and cross-class interactions.

### 4. Validation

Ensure implementation matches the documented API specification exactly.

## Testing Strategy

The worktree includes complete unit tests that should guide implementation:

```bash
# Run Extension Manager tests
npm test -- src/lib/extensions/

# Run specific test files
npm test -- src/lib/extensions/test/extension-manager.test.ts
npm test -- src/lib/extensions/test/extension-cache.test.ts
```

## File Structure

Expected implementation files:

```
src/lib/extensions/
├── extension-manager.ts      # Main ExtensionManager class
├── extension-cache.ts        # ExtensionCache utility class
├── utils.ts                 # Extension utilities
├── types.ts                 # Type definitions (already exists)
├── index.ts                 # Clean exports
├── API.md                   # Complete documentation (already exists)
└── test/                    # Complete test suite (already exists)
    ├── extension-manager.test.ts
    ├── extension-cache.test.ts
    ├── utils.test.ts
    ├── integration.test.ts
    └── mocks/
        └── file-storage.mock.ts
```

## Integration Points

### File Storage API

Uses the existing File Storage API (`src/lib/storage/`) for all file operations:

- Global cache at workspace ID `'extensions-cache'`
- Workspace extensions at `SOURCE/extensions/`
- Standard file read/write/list operations

### Workspace Manager Integration

Will integrate with existing Workspace Manager for:

- Automatic extension scanning during workspace import
- Extension validation as part of workspace validation
- SOURCE/ directory structure management

## Key Design Decisions

### Extension vs Transform Scripts

- **Extensions**: Vendor JavaScript files (in `SOURCE/extensions/`)
- **Transform Scripts**: User code (in `SOURCE/scripts/`)
- Clear separation maintained throughout implementation

### Cache Strategy

- Global cache for reuse across workspaces
- Copy operations (not linking) for packaging simplicity
- File-based conflict detection with size comparison

### Validation Approach

- Minimal validation for performance and simplicity
- Focus on file existence and basic structure
- User-friendly error messages for common issues

## Implementation Timeline

The Extension Manager is ready for implementation with:

- ✅ Complete API documentation (651 lines)
- ✅ Comprehensive unit tests (2330+ lines)
- ✅ Integration with existing File Storage API
- ✅ Clear separation from Transform Pipeline (already implemented)

This provides a solid foundation for test-driven development where the implementation can be guided by the existing test suite.

## Merging Back

Once implementation is complete:

1. Ensure all unit tests pass
2. Run integration tests to validate cross-feature compatibility
3. Test with existing Transform Pipeline and SOURCE.zip features
4. Merge back to main branch

The worktree setup ensures parallel development without interfering with the main codebase while providing access to all existing foundation features.
