# WorkspaceManager Dependency Injection Implementation Plan

## Overview

This document outlines the step-by-step implementation of the dependency injection refactoring for WorkspaceManager as described in the ADR `/plans/api/workspace-manager-dependency-injection.md`.

## Implementation Sequence

### Phase 1: Implement Unified i18n Service ⚠️ **CRITICAL PATH**

**Files to Modify:**

- `/src/lib/i18n/index.ts`

**Changes:**

1. Add unified i18n service export to existing i18n system
2. Implement service methods using existing functions and stores

**Implementation:**

```typescript
// Add to /src/lib/i18n/index.ts
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

**Required Imports:**

- Import `isRTL` from `./locale-config.js`
- Import `LOCALE_CONFIGS` from `./locale-config.js`

**Validation:**

- [ ] TypeScript compilation passes
- [ ] All existing i18n functionality remains unchanged
- [ ] New service object exports correctly

### Phase 2: Refactor WorkspaceManager Constructor ⚠️ **CRITICAL PATH**

**Files to Modify:**

- `/src/lib/workspace/workspace-manager.ts`

**Changes:**

1. Update constructor signature to accept optional dependencies
2. Create default instances using unified i18n service
3. Update private class properties
4. Update method signatures to remove parameters

**Implementation:**

```typescript
// Update class properties
private contentGenerator: SampleContentGenerator;
private transformExecutor: TransformExecutor;

// Update constructor
constructor(
  config?: Partial<WorkspaceConfig>,
  contentGenerator?: SampleContentGenerator,
  transformExecutor?: TransformExecutor
) {
  this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...config };
  this.storage = new FileStorageAPI();
  this.cache = new WorkspaceMetadataCache(this.storage, this.config.cache);
  this.dependencyTracker = new ManifestDependencyTracker(this.storage);
  this.sourceManager = new SourceManager(this.storage);
  this.contentGenerator = contentGenerator || new SampleContentGenerator(i18nService);
  this.transformExecutor = transformExecutor || new TransformExecutor();
}

// Update method signature
async createLocalizedEPUBWorkspace(
  metadata: Partial<EPUBMetadata> = {},
  locale = 'en'
): Promise<string>
```

**Required Imports:**

- Import `i18nService` from `../i18n/index.js`

**Validation:**

- [ ] TypeScript compilation passes
- [ ] Constructor creates default instances correctly
- [ ] Method signature updated correctly

### Phase 3: Update Internal Method Calls

**Files to Modify:**

- `/src/lib/workspace/workspace-manager.ts`

**Changes:**

1. Update `createLocalizedEPUBWorkspace` method call
2. Update `generateLocalizedSampleContent` method signature and body
3. Update all internal calls to use `this.contentGenerator` and `this.transformExecutor`

**Implementation:**

```typescript
// Update method call
await this.generateLocalizedSampleContent(workspaceId, locale);

// Update private method signature
private async generateLocalizedSampleContent(
  workspaceId: string,
  locale: string
): Promise<void>

// Update internal usage
const sampleContent = await this.contentGenerator.generateLocalizedContent(locale);
const htmlContent = await this.transformExecutor.executeTextTransform(/*...*/);
const transformedDoc = await this.transformExecutor.executeDOMTransform(/*...*/);
```

**Validation:**

- [ ] All method calls updated to use instance properties
- [ ] No remaining parameter passing of dependencies
- [ ] Method signatures are clean and focused

### Phase 4: Update Workspace Tests ⚠️ **CRITICAL PATH**

**Files to Modify:**

- `/src/lib/workspace/test/workspace-manager-localized.test.ts`

**Changes:**

1. Update test setup to use constructor injection
2. Remove parameter passing from method calls
3. Update mock setup patterns

**Implementation:**

```typescript
// Update test setup
beforeEach(async () => {
  // ... existing setup ...

  // Create WorkspaceManager with injected dependencies
  workspaceManager = new WorkspaceManager(
    undefined,
    mockSampleContentGenerator,
    mockTransformExecutor
  );

  // ... rest of setup ...
});

// Update all method calls
await workspaceManager.createLocalizedEPUBWorkspace(mockMetadata, 'en');
```

**Validation:**

- [ ] All workspace tests pass
- [ ] Mock setup is cleaner and more maintainable
- [ ] Test patterns are consistent with dependency injection

### Phase 5: Validate Complete Implementation

**Commands to Run:**

1. `npm run check` - TypeScript validation
2. `npm run lint` - ESLint validation
3. `npm test` - Unit test validation
4. `npm run build` - Build validation

**Validation Criteria:**

- [ ] Zero TypeScript errors
- [ ] ESLint errors < 500 (existing threshold)
- [ ] All unit tests pass
- [ ] Build completes successfully
- [ ] No regression in existing functionality

## Risk Mitigation

### Critical Dependencies

- **i18n Service**: Must be implemented first as it's required by WorkspaceManager
- **Constructor Changes**: Must be coordinated with test updates

### Rollback Plan

If implementation fails:

1. Revert WorkspaceManager constructor changes
2. Revert test changes
3. Keep i18n service (non-breaking addition)

### Testing Strategy

- **Unit Tests**: Focus on workspace manager functionality
- **Integration Tests**: Verify end-to-end workspace creation
- **Type Safety**: Ensure all TypeScript compilation passes

## Success Metrics

### Functional

- All workspace tests pass
- New dependency injection pattern works correctly
- Existing functionality remains unchanged

### Code Quality

- TypeScript compilation with zero errors
- Cleaner method signatures
- Improved testability

### Architecture

- Consistent dependency injection pattern
- Clear separation of concerns
- Maintainable test setup

## Timeline

**Total Estimated Time:** 1-2 hours

- **Phase 1**: 15 minutes (unified i18n service)
- **Phase 2**: 30 minutes (WorkspaceManager refactoring)
- **Phase 3**: 15 minutes (internal method updates)
- **Phase 4**: 30 minutes (test updates)
- **Phase 5**: 30 minutes (validation and testing)

## Post-Implementation

### Documentation Updates

- [x] ADR created
- [x] API documentation updated
- [x] Implementation plan documented

### Follow-up Tasks

- Consider applying similar pattern to other managers
- Evaluate test patterns for reusability
- Monitor for any performance impacts

---

**Created:** December 2024  
**Status:** Ready for Implementation  
**Dependencies:** ADR approved, documentation updated
