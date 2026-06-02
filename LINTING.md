# Linting Strategy & Environment Configuration

## Overview

The project uses an environment-aware ESLint configuration that applies different rules based on code context, maintaining high code quality while allowing flexibility where appropriate.

## Environment-Specific Rules

### Core Source Code (`src/lib/`, `src/routes/`)

- Strict TypeScript rules with zero tolerance for critical errors
- Browser globals available (DOM, Web APIs, IndexedDB, File System Access)
- Console statements produce warnings (acceptable for debugging)
- Unused variables must be prefixed with underscore (`_variable`)

### Svelte Components (`**/*.svelte`)

- All browser environment rules plus Svelte-specific adjustments
- Comprehensive DOM/Web API globals defined for modern browser features
- Lenient rules for regex escaping and case declarations in Svelte context

### Story/Demo Files (`src/stories/**/*`)

- Lenient rules for demonstration code
- `any` types allowed without warnings
- Console statements permitted
- Focus on visual demonstration over strict code quality

### Test Files (`**/*.test.{js,ts}`, `**/*.spec.{js,ts}`)

- Test framework globals (Vitest: `describe`, `it`, `expect`, `vi`)
- Relaxed rules for test-specific patterns
- `any` types allowed for mocking
- Unused variables permitted for test setup

### Build Scripts (`scripts/`, `build-scripts/`)

- Node.js environment with full Node.js globals
- Lenient console logging for build output
- Support for both ES modules and CommonJS patterns

## Acceptable Lint Issues

### Target: < 500 Total Problems

- ✅ **Main source code**: Should have minimal warnings, zero critical errors
- ✅ **Demo/story files**: Warnings acceptable for visual demonstration purposes
- ✅ **Test files**: Type-related warnings acceptable for mocking scenarios
- ✅ **Generated files**: Automatically ignored via `.eslintignore` patterns

### Critical vs Non-Critical Issues

- **Critical**: TypeScript errors, undefined variables, syntax errors
- **Non-Critical**: Style preferences, console warnings, prefer-const suggestions

## Browser API Coverage

The ESLint configuration includes comprehensive browser API coverage:

### Core Web APIs

- **DOM manipulation**: `document`, `window`, `Element`, `HTMLElement`
- **Events**: `Event`, `CustomEvent`, `KeyboardEvent`, `DragEvent`, `FocusEvent`
- **File handling**: `File`, `Blob`, `URL`, `FileSystemDirectoryHandle`
- **Networking**: `fetch`, `Response`, `Request`
- **Storage**: `localStorage`, `sessionStorage`, `indexedDB`
- **Streaming**: `ReadableStream`, `WritableStream`, `CompressionStream`

### Modern Browser Features

- **Web Workers**: `Worker`, `MessageEvent`, `ErrorEvent`
- **Performance**: `performance`, `PerformanceObserver`
- **Encoding**: `TextEncoder`, `TextDecoder`
- **Crypto**: `crypto.subtle`, `CryptoKey`

### File System Access API

- `FileSystemDirectoryHandle`
- `FileSystemFileHandle`

### IndexedDB

- `indexedDB`, `IDBDatabase`, `IDBTransaction`
- `IDBObjectStore`, `IDBOpenDBRequest`
- `IDBTransactionMode`, `IDBIndex`
- `IDBValidKey`, `IDBKeyRange`

## VSCode Integration

The linting setup integrates with VSCode for optimal developer experience:

### Format on Save

- Prettier handles code formatting automatically
- ESLint focuses on code quality and error detection
- No conflicts between formatting and linting rules

### Lint on Save

- Real-time error highlighting in editor
- Quick fixes available for auto-fixable issues
- Consistent feedback during development

## Common Lint Issue Resolution

### Unused Variables

```typescript
// ❌ ESLint error
import { layoutStore } from '../stores/layout';

// ✅ Prefix with underscore if unused
import { layoutStore as _layoutStore } from '../stores/layout';
```

### Global Variables

```typescript
// ❌ ESLint error: 'document' is not defined
const element = document.querySelector('.app');

// ✅ Already configured in environment-specific rules
// No changes needed - ESLint config handles browser globals
```

### Console Statements

```typescript
// In main source code - produces warning (acceptable)
console.log('Debug info');

// In test/story files - no warning (explicitly allowed)
console.log('Test output');
```

### Error Handlers

```typescript
// ❌ ESLint error: unused variable
catch (error) {
  // Handle error without using variable
}

// ✅ Prefix unused error variables with underscore
catch (_error) {
  // Handle error without using variable
}
```

## Configuration Details

The ESLint configuration is located in `eslint.config.js` and uses the flat configuration format. Key aspects:

### Environment Detection

- **Browser environments**: Automatic detection for `.svelte` and frontend TypeScript files
- **Node.js environments**: Build scripts and tooling files
- **Test environments**: Test framework globals automatically available

### Rule Inheritance

- Base rules from `@typescript-eslint/recommended`
- Svelte-specific rules from `eslint-plugin-svelte`
- Environment-specific overrides for different code contexts

### Ignore Patterns

- Build output directories (`dist/`, `build/`, `.svelte-kit/`)
- Generated documentation (`storybook-static/`, `coverage/`)
- Development tools (`.claude/`, `__screenshots__/`)
- Configuration files (`*.config.js`, `.storybook/`)

## Maintenance and Updates

### When to Update ESLint Rules

- **New browser APIs**: Add to browser globals when using cutting-edge web APIs
- **New development tools**: Update ignore patterns for new build outputs
- **Team feedback**: Adjust rule strictness based on development experience

### Performance Considerations

- **File-based rule application**: Rules are applied based on file patterns for optimal performance
- **Selective linting**: Use `--ext` flags to lint specific file types during development
- **Cache utilization**: ESLint cache is enabled for faster subsequent runs

### Integration with CI/CD

The linting configuration supports automated quality checks:

```bash
# Full project lint
npm run lint

# Lint with auto-fix
npm run lint -- --fix

# Lint specific patterns
npx eslint "src/**/*.{js,ts,svelte}"
```

This configuration ensures consistent code quality while supporting the diverse development needs of a modern TypeScript/Svelte application.
