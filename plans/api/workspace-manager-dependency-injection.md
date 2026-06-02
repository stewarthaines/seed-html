# Architecture Decision Record: WorkspaceManager Dependency Injection

## Status

**Accepted** - December 2024

## Context

The `WorkspaceManager.createLocalizedEPUBWorkspace()` method currently accepts `contentGenerator` and `transformExecutor` as method parameters, but this approach is inconsistent with the established dependency injection pattern used throughout the codebase.

### Current Problems

1. **Architectural Inconsistency**: Other WorkspaceManager dependencies (`storage`, `cache`, `dependencyTracker`, `sourceManager`) are constructor-injected, but `contentGenerator` and `transformExecutor` are method parameters.

2. **Test Complexity**: Tests must pass mock instances to every method call instead of setting up dependencies once in test setup.

3. **Interface Mismatch**: SampleContentGenerator expects an `I18nSystem` interface that doesn't match the existing i18n system's export structure.

4. **Method Signature Pollution**: The method signature is cluttered with infrastructure dependencies rather than focusing on business logic parameters.

### Current State Analysis

**Existing WorkspaceManager Dependencies (Constructor Injected):**

```typescript
export class WorkspaceManager {
  private storage: FileStorageAPI; // ✅ Constructor injected
  private cache: WorkspaceMetadataCache; // ✅ Constructor injected
  private dependencyTracker: ManifestDependencyTracker; // ✅ Constructor injected
  private sourceManager: SourceManager; // ✅ Constructor injected
}
```

**Current Method Parameters (Inconsistent):**

```typescript
async createLocalizedEPUBWorkspace(
  metadata: Partial<EPUBMetadata> = {},
  locale = 'en',
  contentGenerator: SampleContentGenerator,    // ❌ Method parameter
  transformExecutor: TransformExecutor        // ❌ Method parameter
): Promise<string>
```

## Decision

### 1. Move to Constructor Injection Pattern

**Rationale:** `contentGenerator` and `transformExecutor` are functionally equivalent to other constructor dependencies:

- They provide core capabilities rather than being transient data
- They have the same lifecycle as the WorkspaceManager instance
- They are used across multiple methods, not just `createLocalizedEPUBWorkspace`

**New Constructor Signature:**

```typescript
constructor(
  config?: Partial<WorkspaceConfig>,
  contentGenerator?: SampleContentGenerator,
  transformExecutor?: TransformExecutor
)
```

**New Method Signature:**

```typescript
async createLocalizedEPUBWorkspace(
  metadata: Partial<EPUBMetadata> = {},
  locale = 'en'
): Promise<string>
```

### 2. Create Unified I18n Service

**Rationale:** The current i18n system exports individual functions, but SampleContentGenerator needs a unified interface.

**Solution:** Add a unified service object to the existing i18n system without breaking existing usage:

```typescript
// New export in src/lib/i18n/index.ts
export const i18nService = {
  translate,
  getCurrentLocale: () => get(currentLocale),
  getAvailableLocales,
  hasTranslation: (locale: string, key: string) => {
    const state = get(i18nState);
    return !!state.catalogs[locale]?.messages[key];
  },
  isLocaleSupported: (locale: string) => !!LOCALE_CONFIGS[locale],
  isRTL,
};
```

### 3. Update Default Instance Creation

**WorkspaceManager will create default instances:**

```typescript
this.contentGenerator = contentGenerator || new SampleContentGenerator(i18nService);
this.transformExecutor = transformExecutor || new TransformExecutor();
```

## Consequences

### Positive

- **Consistent Architecture**: All dependencies follow the same injection pattern
- **Cleaner Method Signatures**: Business logic parameters are separated from infrastructure dependencies
- **Improved Testability**: Dependencies set up once in test setup, not per method call
- **Type Safety**: Better TypeScript support with proper dependency resolution

### Negative

- **Breaking Change**: Existing code that calls `createLocalizedEPUBWorkspace` will need updates
- **Constructor Complexity**: More parameters in constructor, but with sensible defaults

### Neutral

- **No Performance Impact**: Same object instances, just different injection point
- **Backward Compatibility**: Not a concern for this standalone project

## Implementation Plan

1. **Phase 1**: Create unified i18n service in existing i18n system
2. **Phase 2**: Update WorkspaceManager constructor and method signatures
3. **Phase 3**: Update SampleContentGenerator to use unified i18n service
4. **Phase 4**: Update all tests to use constructor injection pattern
5. **Phase 5**: Validate with full test suite and TypeScript checks

## Alternatives Considered

### Alternative 1: Keep Method Parameters

- **Rejected**: Inconsistent with established architectural patterns
- **Drawback**: Continues test complexity and architectural inconsistency

### Alternative 2: Create Adapter Pattern

- **Rejected**: Adds unnecessary complexity and indirection
- **Drawback**: Doesn't address the core architectural inconsistency

### Alternative 3: Modify Existing I18n System Structure

- **Rejected**: Would require breaking changes to existing i18n usage
- **Drawback**: Impacts many components unnecessarily

## Decision Drivers

1. **Architectural Consistency**: Primary driver - align with established patterns
2. **Test Simplicity**: Secondary driver - improve developer experience
3. **Type Safety**: Secondary driver - better TypeScript support
4. **Clean Interfaces**: Secondary driver - separate concerns properly

## Validation Criteria

- [ ] All workspace tests pass with new dependency injection pattern
- [ ] TypeScript compilation succeeds with zero errors
- [ ] No regression in existing functionality
- [ ] Test setup is simplified and more maintainable
- [ ] API documentation accurately reflects new signatures

---

**Authors**: Claude  
**Date**: December 2024  
**Review Status**: Approved
