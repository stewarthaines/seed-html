# Claude Code Project Instructions

## EDITME.html - EPUB Editor

This is a Svelte-based EPUB editor that runs in modern browsers, replacing a previous Vue.js version. It allows users to create and edit EPUB files using plain text sources that are transformed to XHTML.

## Project Structure

- `plans/` - Project documentation and planning
  - `overview.md` - Complete project specification
  - `features.md` - Feature breakdown and development phases
  - `screens/` - UI mockup screenshots
- `src/` - Svelte application source code
- `static/` - Static assets (inlined by Vite build)

## Technical Architecture

### Browser Support

- Modern browsers only (recent Safari, Chromium, Firefox, Edge)
- Supports both web server and file:// scheme URLs
- No external library dependencies in core app
- All static resources inlined by Vite build system

### Code Style Preferences

- **XML/HTML Parsing**: Use `DOMParser` and `querySelector` instead of regular expressions for robust parsing
- **CSS & Styling**: Use the comprehensive design system in `src/styles/` - see `plans/features/css_design_system.md` for full documentation
- Browser-native APIs preferred over regex for structured data handling

### Storage Strategy

- OPFS (Origin Private File System) for performance
- IndexedDB fallback for broader browser support
- Feature detection for `.createWritable()` support
- Workspace-based organization with unique IDs

### Text Processing Pipeline

```
Plain text source → transformText.js → transformDom.js → XHTML → Preview
```

### Key Features

- EPUB unpacking/packaging using Compression Streams API
- Real-time plain text to XHTML transformation
- Multi-device preview (iPhone, iPad, Pixel phone variants)
- Extensible transform scripts loaded from EPUB manifest
- Accessibility-focused design

## Development Phases

### Phase 1: Foundation

1. File Storage API (OPFS + IndexedDB fallback)
2. EPUB Unpacking (Compression Streams)
3. EPUB Packaging (ZIP creation)
4. Workspace & OPF Manager

### Phase 2: Data & UI

5. Blob URL Manager
6. Layout System (resizable panels)
7. Navigation Router

### Phase 3: Content Management

8. Manifest View (file listing)
9. Metadata Editor (form-based)
10. Spine Item Manager (chapter ordering)
11. Theme System (light/dark mode)

### Phase 4: Text Processing

12. Transform Pipeline (dynamic function execution)
13. Text Editor (debounced preview updates)
14. Error Handling (transform failures)

### Phase 5: Preview & Polish

15. Device Preview (responsive + multi-device)
16. Preview Iframe (blob URL substitution)
17. Navigation Editor (TOC editing)
18. Storage Quota Monitor
19. Audio Clip Editor

## Active EPUB Format

Extension to standard EPUB structure:

```
mimetype
META-INF/content.opf
OEBPS/ (standard EPUB content)
EDITME/ (editor-specific files)
  ├── src/ (plain text sources)
  ├── scripts/ (transform functions)
  ├── ext/ (third-party libraries)
  └── EDITME.html (editor app)
```

## Commands

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Testing

- `npm test` - Run unit tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:stories` - Run Storybook tests with Vitest
- `npm run screenshots` - Capture component screenshots
- Use proper ES module imports (await import()) instead of require() for mocked modules

### Storybook

- `npm run storybook` - Start Storybook development server
- `npm run build-storybook` - Build Storybook for production
- **Story Development**: See `STORYBOOK.md` section "Storybook Story Development Guidelines" for:
  - ✅ Component separation patterns (component → story → css)
  - ❌ Common anti-patterns that cause parsing errors
  - 🔧 Backend feature demo patterns
  - 📋 Development checklist for new stories
- **Backend Demos**: See `STORYBOOK.md` for interactive backend feature demonstration patterns

### Linting

- `npm run lint` - ESLint check
- `npm run check` - TypeScript validation

## CSS Design System

Complete design token system with utilities and themes for consistent styling. Key features:

- **Design Tokens**: Semantic color palette, spacing scale, typography system, elevation levels
- **Theme Support**: Light/dark mode with automatic system preference detection
- **Utility Classes**: Atomic layout utilities (flexbox, grid, spacing, colors)
- **Svelte Optimized**: Component-scoped CSS patterns leveraging Svelte's built-in scoping

**Documentation**: See `plans/features/css_design_system.md` for complete system overview
**Location**: All CSS files are in `src/styles/` with organized token/utility/theme structure

### Usage Guidelines

1. **Import design system**: `@import './styles/index.css';` in your main CSS file
2. **Use semantic tokens**: `color: var(--color-text-primary);` instead of hardcoded colors
3. **Apply utility classes**: `class="flex items-center gap-4"` for common patterns
4. **Component styles**: Use Svelte `<style>` blocks with design tokens for component-specific CSS
5. **Theme switching**: Apply `data-theme="dark"` attribute to root element

## ZIP Library

Complete browser-native ZIP implementation for EPUB workflows. See `src/lib/zip/API.md` for full documentation.

## API Documentation Standards

### Writing API Documentation

When implementing new features, create comprehensive API documentation in `src/lib/{feature}/API.md` following these standards:

#### Required Sections:

1. **Overview** - Brief description of main classes and purpose
2. **Class Documentation** - Each public class with constructor and methods
3. **Method Documentation** - Input/Output/Side Effects/Usage examples for each method
4. **Type Definitions** - All publicly useful interfaces and types
5. **Common Integration Patterns** - Real-world usage examples
6. **Error Handling** - Exception types and error handling patterns

#### Documentation Style:

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

#### Key Guidelines:

- **Focus on Integration**: Show how the API integrates with other features
- **Practical Examples**: Include real-world usage patterns, not toy examples
- **Error Scenarios**: Document common error cases and handling
- **Browser Compatibility**: Note any browser-specific behavior or limitations
- **Performance Notes**: Highlight performance characteristics and optimization tips

#### Examples to Follow:

- `src/lib/epub/API.md` - Comprehensive EPUB library documentation
- `src/lib/storage/API.md` - File Storage API with backend detection details

#### When to Create API Docs:

- **New feature implementation** - Always create API.md for new `src/lib/{feature}/` modules
- **Public API changes** - Update existing API.md when interfaces change
- **Integration points** - Document any APIs that other features will consume
- **Complex workflows** - Show end-to-end integration patterns

## Feature Development Process

The project follows a structured development process to ensure high-quality, well-documented features:

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

### 4. Implementation

- Implement the feature following the API specification exactly
- Code should pass all unit tests without requiring test modifications
- Focus on meeting the documented API contract and behavior
- Implementation validates that the API design is practical and complete

### 5. Storybook Story Creation

- Create interactive Storybook stories demonstrating the feature
- Show integration patterns, error scenarios, and real-world usage
- Follow patterns in `STORYBOOK.md` for backend feature demonstrations
- Stories serve as live documentation and manual testing interface

This process ensures features are well-designed, thoroughly tested, and properly documented before implementation begins. The API documentation serves as a contract that guides both test development and implementation.

## Testing Strategy & Happy-DOM Limitations

### Test Environment Architecture

The project uses a multi-tiered testing strategy to accommodate browser API limitations in the unit testing environment:

- **Unit Tests (happy-dom)**: Fast, focused testing of pure logic and mocked integrations
- **Storybook Tests (browser)**: Integration testing with real browser APIs
- **E2E Tests (browser)**: Full workflow testing in real browser environment

### Happy-DOM Limitations

Happy-dom provides excellent performance for unit testing but has limitations with certain browser APIs. The following APIs should be avoided in unit tests:

#### ❌ Not Supported / Problematic APIs

- **DecompressionStream/CompressionStream**: ZIP file extraction hangs in happy-dom
- **getElementsByTagNameNS()**: XML namespace parsing doesn't work correctly
- **CSSOM APIs**: CSS Object Model parsing is incomplete
- **Complex DOM manipulation**: Advanced DOM operations may not work as expected
- **Fetch to localhost**: Network operations fail in test environment

#### ✅ Well-Supported APIs

- **Basic DOM operations**: createElement, querySelector, innerHTML
- **DOMParser**: Basic XML/HTML parsing (without namespaces)
- **File/Blob APIs**: File and Blob creation and basic operations
- **URL.createObjectURL/revokeObjectURL**: Basic blob URL operations

### Testing Patterns

#### When to Skip Tests

Use `.skip` for tests that require unsupported browser APIs:

```typescript
// Skip: requires getElementsByTagNameNS which doesn't work in happy-dom
// This functionality is tested in browser environment via Storybook
it.skip('should parse XML with namespaces', () => {
  // Test that requires namespace parsing
});
```

#### When to Mock vs Skip

- **Mock**: When the API is central to the logic being tested
- **Skip**: When the API is a secondary concern or integration point

#### Documentation Requirements

When skipping tests, always include:

1. **Reason**: Which API limitation causes the skip
2. **Alternative**: Where the functionality is tested (Storybook/E2E)
3. **Clear comment**: Explaining the browser API requirement

### Browser API Testing in Storybook

For functionality requiring full browser APIs:

1. **Create interactive stories** demonstrating the feature
2. **Test real file operations** with actual ZIP/EPUB files
3. **Validate complex DOM operations** in browser environment
4. **Use Storybook test runner** for automated browser testing

### Guidelines for New Tests

1. **Start with unit tests** for pure logic
2. **Mock browser APIs** when testing integration logic
3. **Skip tests** that require unsupported APIs
4. **Create Storybook stories** for browser API integration
5. **Document limitations** clearly in test comments

This strategy ensures comprehensive test coverage while maintaining fast, reliable unit tests that can run in any environment.
