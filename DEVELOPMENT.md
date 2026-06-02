# Development Workflow Guide

## Overview

This document provides the structured development process for features in the editme-svelte project. For quality standards and validation requirements, see [QUALITY.md](./QUALITY.md).

## Feature Development Process

The project follows a structured 5-step development process to ensure high-quality, well-documented features:

### 1. Feature Planning & Specification

- Start with detailed feature plan in `plans/features/{number}_{name}.md`
- Collaborate on requirements, technical approach, and integration points
- Define API interfaces, error handling, and performance considerations
- Clarify implementation details through iterative discussion

### 2. API Documentation

- Create comprehensive `src/lib/{feature}/API.md` **before implementation**
- Document all public methods with Input/Output/Side Effects/Usage examples
- Include error scenarios, edge cases, and integration patterns
- Add testing considerations and internal API details for unit test development

### 3. Unit Test Development

- Write comprehensive unit tests based on the API documentation **before implementation**
- Cover all methods, error scenarios, edge cases, and integration points
- Test internal behavior, caching, error handling, and state management
- Ensure tests validate the API contract defined in documentation
- Use existing shared mocks where available in `src/lib/test/mocks/`

### 4. Implementation

- Implement the feature following the API specification exactly
- Code should pass all unit tests without requiring test modifications
- Focus on meeting the documented API contract and behavior
- Implementation validates that the API design is practical and complete

### 5. Storybook Story Creation

- Create interactive Storybook stories demonstrating the feature
- Show integration patterns, error scenarios, and real-world usage
- Follow patterns in [STORYBOOK.md](./STORYBOOK.md) for component and backend feature demonstrations
- Stories serve as live documentation and manual testing interface

**Process Benefits**: This approach ensures features are well-designed, thoroughly tested, and properly documented before implementation begins. The API documentation serves as a contract that guides both test development and implementation.

## API Documentation Standards

### Required Sections

When implementing new features, create comprehensive API documentation in `src/lib/{feature}/API.md`:

1. **Overview** - Brief description of main classes and purpose
2. **Class Documentation** - Each public class with constructor and methods
3. **Method Documentation** - Input/Output/Side Effects/Usage examples for each method
4. **Type Definitions** - All publicly useful interfaces and types
5. **Common Integration Patterns** - Real-world usage examples
6. **Error Handling** - Exception types and error handling patterns

### Documentation Style

````typescript
#### methodName()

```typescript
methodName(param: Type): Promise<ReturnType>
```

**Input:**
- `param: Type` - Description of parameter

**Output:** `Promise<ReturnType>` - Description of return value

**Side Effects:** List any side effects (file creation, state changes, etc.)

**Usage:**

```typescript
const example = new ClassName();
const result = await example.methodName(value);
console.log('Result:', result);
```
````

### Key Guidelines

- **Focus on Integration**: Show how the API integrates with other features
- **Practical Examples**: Include real-world usage patterns, not toy examples
- **Error Scenarios**: Document common error cases and handling
- **Browser Compatibility**: Note any browser-specific behavior or limitations
- **Performance Notes**: Highlight performance characteristics and optimization tips

### When to Create API Docs

- **New feature implementation** - Always create API.md for new `src/lib/{feature}/` modules
- **Public API changes** - Update existing API.md when interfaces change
- **Integration points** - Document any APIs that other features will consume
- **Complex workflows** - Show end-to-end integration patterns

### Reference Examples

- `src/lib/epub/API.md` - Comprehensive EPUB library documentation
- `src/lib/storage/API.md` - File Storage API with backend detection details
- `src/lib/zip/API.md` - Browser-native ZIP implementation documentation

## File Naming Conventions

### TypeScript Files

Use **kebab-case** for all TypeScript filenames to maintain consistency across the codebase.

### Svelte Files

Use **PascalCase** for Svelte component filenames following Svelte conventions.

```bash
# ✅ Correct naming conventions
outline-generator.ts      # TypeScript - kebab-case
settings-manager.ts       # TypeScript - kebab-case
workspace-cache.ts        # TypeScript - kebab-case
ContentPreview.svelte     # Svelte - PascalCase
ThemeToggle.svelte        # Svelte - PascalCase
NavigationEditor.svelte   # Svelte - PascalCase

# ❌ Incorrect naming conventions
OutlineGenerator.ts       # TypeScript should be kebab-case
settingsManager.ts        # TypeScript should be kebab-case
content-preview.svelte    # Svelte should be PascalCase
theme-toggle.svelte       # Svelte should be PascalCase
```

**Rationale**: TypeScript files use kebab-case for consistency and readability. Svelte files use PascalCase to follow established Svelte component naming conventions.

**Exceptions**:

- Documentation files: `API.md`, `README.md`, `TESTING.md` (UPPERCASE)
- Configuration files: Follow their respective conventions (`package.json`, `tsconfig.json`, etc.)

## Component Development Guidelines

### Svelte 5 Runes (mandatory — no legacy syntax)

**All components use runes mode. Legacy Svelte 4 syntax is not permitted** and
must be converted whenever you touch a file that still contains it (don't match
its old style). Conversion reference:

| Legacy (Svelte 4)                                | Runes (Svelte 5)                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `export let x = d`                               | `let { x = d } = $props()`                                                     |
| `export let x` (two-way bound)                   | `let { x = $bindable() } = $props()`                                           |
| `$: y = f(a)` (pure)                             | `let y = $derived(f(a))` / `$derived.by(...)`                                  |
| `$: { …side effects… }`                          | `$effect(() => { … })`                                                         |
| `createEventDispatcher()` + `dispatch('foo', d)` | callback prop `onFoo?.(d)`                                                     |
| parent `on:foo={h}`                              | parent `onFoo={h}`                                                             |
| `<slot name="x" />`                              | `Snippet` prop + `{@render x?.()}` (parent passes `{#snippet x()}…{/snippet}`) |
| `on:click` / `on:input`                          | `onclick` / `oninput`                                                          |

`svelte-check` (`npm run check`) flags mixed runes/legacy in one component as an
error, so migrate a file fully in one pass.

### Accessibility Requirements

Before considering a component complete:

- ✅ **Use Semantic HTML**: Use proper elements (`<button>`, `<nav>`, `<input>`) instead of `<div>` with event handlers
- ✅ **Add ARIA Labels**: Include `aria-label` for icon-only buttons and controls
- ✅ **Include Focus Styles**: Apply `:focus-visible` styles using design system tokens
- ✅ **Test Keyboard Navigation**: All interactive elements accessible via Tab/Enter/Space
- ✅ **Screen Reader Testing**: Test with screen reader software when possible

### Development Patterns

- **Import Paths**: Use `$lib` alias for cleaner imports (`import { StorageManager } from '$lib/storage'`) following Svelte conventions. Relative imports (`../`, `../../`) are acceptable for local files within the same feature directory.
- **CSS & Styling**: Use the comprehensive design system in `src/styles/`
- **Browser APIs**: Prefer browser-native APIs over regex for structured data handling
- **Error Handling**: Implement proper TypeScript error types and handling patterns
- **Svelte 5 Runes**: Runes are mandatory for all components (no legacy syntax) - `$props()`, `$state()`, `$derived()`, `$effect()`, `$bindable()`, callback props, and snippets

### Reference Components

Study these well-implemented components for patterns:

- `src/lib/components/metadata/MetadataEditor.svelte` - Form handling and validation
- `src/lib/components/manifest/ManifestTable.svelte` - Data display and interaction
- `src/lib/navigation/views/WorkspaceView.svelte` - Complex state management

## Development Integration

### With Quality Standards

- All development must follow the quality gates defined in [QUALITY.md](./QUALITY.md)
- TypeScript validation is required before any commit
- API documentation is validated during implementation

### With Testing Strategy

- Unit tests are written based on API specifications
- Storybook stories provide integration testing and documentation
- See [TESTING.md](./TESTING.md) for comprehensive testing patterns

### With Design System

- All components must integrate with the design system in `src/styles/`
- Use semantic design tokens instead of hardcoded values
- Follow the established CSS patterns and utility classes

This development workflow ensures consistent, high-quality feature implementation with comprehensive documentation and testing throughout the process.
