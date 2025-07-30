# State Management Refactor Implementation Plan

**Date:** 2025-01-29  
**Status:** Ready for Implementation  
**Purpose:** Actionable implementation plan for state management architecture refactor

## Overview

This document provides the implementation roadmap for refactoring EDITME.html's state management from the current manager-based system to a simplified 3-layer reactive architecture using Svelte 5 runes.

## Architecture Reference

**Primary Design Document**: [ARCHITECTURE_SIMPLIFICATION_ANALYSIS.md](./ARCHITECTURE_SIMPLIFICATION_ANALYSIS.md)

**Key Design Principles**:
- 3-layer architecture: Presentation → Service → Infrastructure
- Single source of truth: `workspace` object replaces fragmented state
- Service independence: No service-to-service calls
- Preserve existing storage backend (performance-justified)

## Implementation Strategy

### Test-Driven Development Process

**Testing Reference**: [TESTING_PROCESS_REACTIVE_ARCHITECTURE.md](./TESTING_PROCESS_REACTIVE_ARCHITECTURE.md)

**Key Testing Patterns**:
- Use `$effect.root()` and `flushSync()` for reactive testing
- File naming: `*.svelte.test.ts` for runes code, `*.test.ts` for pure TypeScript
- Mock services with dependency injection at infrastructure layer only
- Test workspace state transitions: `null → loading → loaded`

### Development Standards

**Quality Reference**: [QUALITY.md](../QUALITY.md)  
**Development Reference**: [DEVELOPMENT.md](../DEVELOPMENT.md)  
**Project Instructions**: [CLAUDE.md](../CLAUDE.md)

**Key Requirements**:
- Zero TypeScript errors at all times
- Follow existing code conventions and import patterns
- Use relative imports (`../`, `../../`) instead of absolute paths
- Preserve browser-native APIs over regex for structured data

## Implementation Phases

### Phase 1: Foundation (Low Risk, Immediate Benefits)

#### 1a. Manager Consolidation

**Target Structure**:
```
AppState
├── WorkspaceService (consolidated from WorkspaceManager + ManifestManager + MetadataManager + SpineItemManager)
├── ContentService (new, focused service)
└── SettingsService (new, multi-tier settings)
```

**Implementation Steps**:
1. **Create WorkspaceService** - Consolidate existing manager functionality
   - Location: `src/lib/services/workspace/workspace.service.ts`
   - Test: `src/lib/services/workspace/workspace.service.test.ts`
   - Dependencies: FileStorageAPI, EPUBProcessor (thin wrapper)

2. **Create ContentService** - Pure transformation functions
   - Location: `src/lib/services/content/content.service.ts`  
   - Test: `src/lib/services/content/content.service.test.ts`
   - Dependencies: TransformExecutor, I18nSystem

3. **Create SettingsService** - Multi-tier settings management
   - Location: `src/lib/services/settings/settings.service.ts`
   - Test: `src/lib/services/settings/settings.service.test.ts`
   - Reference: [SETTINGS_SERVICE_CONTRACT.md](./contracts/SETTINGS_SERVICE_CONTRACT.md)

4. **Create EPUBProcessor wrapper** - Thin interface over existing components
   - Location: `src/lib/infrastructure/epub/epub-processor.ts`
   - Test: `src/lib/infrastructure/epub/epub-processor.test.ts`
   - Wraps: EPUBPackager, EPUBUnpacker, OPFUtils

**Service Contracts**: See [contracts/](./contracts/) directory for detailed interfaces

#### 1b. Svelte 5 Runes Enhancement

**Target**: Enhanced AppState with full runes integration

**Implementation Steps**:
1. **Convert getters to $derived** in existing AppState
   ```typescript
   // Replace: get manifest() { return this.workspace?.manifest || []; }
   // With: manifest = $derived(this.workspace?.manifest || []);
   ```

2. **Add reactive coordination with $effect**
   ```typescript
   $effect(() => {
     if (this.workspaceLoading && this.workspace?.id !== this.workspaceLoading) {
       this.loadWorkspace();
     }
   });
   ```

3. **Update AppState location**: `src/lib/state/app-state.svelte.ts`
4. **Update AppState tests**: `src/lib/state/app-state.svelte.test.ts`

### Phase 2: Enhanced State Management (Medium Risk, Svelte 5 Optimized)

**Target**: Full workspace-as-single-source-of-truth implementation

**Implementation Steps**:
1. **Enhanced AppState** with complete workspace state management
   - Single reactive object: `workspace = $state<WorkspaceState | null>(null)`
   - Loading state: `workspaceLoading = $state<string | null>(null)`
   - Derived computations for all workspace properties

2. **Context-based dependency injection** for components
   ```svelte
   <script lang="ts">
     import { getContext } from 'svelte';
     const appState = getContext<AppState>('appState');
     
     // Direct reactive access
     $: manifest = appState.manifest;
     $: isLoading = appState.isLoading;
   </script>
   ```

3. **Component migration** to reactive patterns
   - Update existing components one at a time
   - Use workspace properties directly instead of separate state variables
   - Test reactive behavior with workspace state transitions

### Phase 3: Service Layer Migration (Higher Risk, Long-term Benefits)

**Target**: Complete service-based architecture

**Implementation Steps**:
1. **Implement service layer** alongside existing managers
2. **Create command classes** for complex operations (optional enhancement)
3. **Enhanced component composition** with Svelte 5 patterns
4. **Remove manager layer** once migration complete

## File Organization

### Directory Structure
```
src/lib/
├── services/           # Service Layer
│   ├── workspace/
│   │   ├── workspace.service.ts
│   │   └── workspace.service.test.ts
│   ├── content/
│   │   ├── content.service.ts
│   │   └── content.service.test.ts
│   └── settings/
│       ├── settings.service.ts
│       └── settings.service.test.ts
├── state/              # Presentation Layer State
│   ├── app-state.svelte.ts
│   └── app-state.svelte.test.ts
└── infrastructure/     # Infrastructure Layer (Existing + Thin Wrappers)
    └── epub/
        ├── epub-processor.ts
        └── epub-processor.test.ts
```

### Shared Types

**Reference**: [SHARED_TYPES_DESIGN.md](./contracts/SHARED_TYPES_DESIGN.md)

**Key Types**:
- `WorkspaceState` - Single source of truth for workspace data
- `EPUBMetadata`, `ManifestItem`, `SpineItem` - EPUB structure types
- Service interfaces and contracts

## Testing Strategy

### Test File Naming
- **Reactive/Runes code**: `*.svelte.test.ts`
- **Pure TypeScript**: `*.test.ts`
- **Components**: `ComponentName.svelte.test.ts`

### Testing Patterns
- **Services**: Test with infrastructure dependency injection only
- **Reactive State**: Use `$effect.root()` for deterministic testing
- **Components**: Context-based testing with AppState
- **Integration**: Cross-layer workflow testing

### Test Utilities
- Location: `test/helpers/`
- **reactive-test-utils.ts**: Reactive testing helpers
- **service-test-utils.ts**: Service mocking utilities
- **workspace-fixtures.ts**: Shared test data

## Development Workflow

### Quality Gates
1. **TypeScript compliance**: Zero type errors
2. **Test coverage**: All new code has corresponding tests
3. **Backward compatibility**: Existing APIs maintained during migration
4. **Performance**: No regression in storage backend performance

### Code Review Checklist
- [ ] Services only depend on infrastructure layer
- [ ] No service-to-service calls
- [ ] Reactive effects have proper cleanup
- [ ] Tests use appropriate file naming conventions
- [ ] WorkspaceState used as single source of truth

## Migration Strategy

### Incremental Approach
1. **Implement alongside existing**: New services work with current managers
2. **Feature flags**: Control which components use new architecture
3. **Component-by-component**: Migrate UI components individually
4. **Remove old layer**: Once all components migrated

### Rollback Plan
- Keep existing managers until migration complete
- Feature flags allow instant rollback
- Database/storage format unchanged

## Success Metrics

### Immediate Benefits (Phase 1)
- Reduced complexity: Fewer managers to coordinate
- Enhanced reactivity: Better Svelte 5 performance
- Improved testing: Simpler mocking
- Better debugging: Clearer data flow

### Long-term Benefits (Phase 2-3)
- Maintainability: Cleaner codebase
- Developer experience: Idiomatic Svelte 5 patterns
- Performance: Reduced overhead
- Extensibility: Clear service boundaries

## References

- **Architecture Analysis**: [ARCHITECTURE_SIMPLIFICATION_ANALYSIS.md](./ARCHITECTURE_SIMPLIFICATION_ANALYSIS.md)
- **Testing Process**: [TESTING_PROCESS_REACTIVE_ARCHITECTURE.md](./TESTING_PROCESS_REACTIVE_ARCHITECTURE.md)
- **Service Contracts**: [contracts/](./contracts/)
- **Quality Standards**: [QUALITY.md](../QUALITY.md)
- **Development Workflow**: [DEVELOPMENT.md](../DEVELOPMENT.md)
- **Project Instructions**: [CLAUDE.md](../CLAUDE.md)

## Implementation Notes

### Critical Preservation
- **Storage backend complexity**: Maintain FileStorageAPI's 3-tier system (OPFS-sync → OPFS-async → IndexedDB) due to proven 16x performance benefits
- **Existing components**: Leverage EPUBPackager, EPUBUnpacker, OPFUtils, TransformExecutor as-is
- **Browser APIs**: Continue using DOMParser and querySelector over regex

### Agent Instructions
When implementing this refactor:
1. Follow TDD approach from testing document
2. Use service contracts for interface definitions
3. Maintain project quality standards
4. Ask user for clarification on under-specified requirements
5. Reference existing code conventions and patterns
6. One question at a time, not lists of questions