# Claude Code Project Instructions

## EDITME.html - EPUB Editor

This is a Svelte-based EPUB editor that runs in modern browsers, replacing a previous Vue.js version. It allows users to create and edit EPUB files using plain text sources that are transformed to XHTML.

## Project Structure

- `plans/` - Project documentation and planning
  - `overview.md` - Initial project specification
  - `features.md` - Feature breakdown and development phases
  - `screens/` - UI screenshots from the previous VueJS version
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
- **SOURCE.zip Handling**: Use existing ZIP library (`src/lib/zip/`) for SOURCE.zip creation/extraction
- **Import Paths**: Use relative imports (`../`, `../../`) instead of absolute paths (`$lib/`) for consistency and explicit dependency tracking
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
- Reactive internationalization system with 7 languages and RTL support

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

8. Manifest View (file listing with preview and download)
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
├── SOURCE.zip (editor source files - extracted to SOURCE/ during editing)
└── EDITME.html (editor app - to be extracted by the user to edit the EPUB file)
```

**Note**: The `SOURCE.zip` file contains all editor-specific files (settings, plain text sources, transform scripts, extensions) and is extracted to a `SOURCE/` directory in the workspace during editing.

## Commands

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Quality Validation ⚠️ REQUIRED BEFORE ALL COMMITS

**MANDATORY**: All changes must pass TypeScript validation before commit. Zero TypeScript errors are tolerated in the codebase.

- `npm run check` - **REQUIRED** TypeScript validation (must pass)
- `npm run lint` - **REQUIRED** ESLint check (must pass)
- `npm test` - **REQUIRED** Run unit tests (must pass)

**Combined Quality Check** (recommended):
```bash
npm run check && npm run lint && npm test
```

### Testing

- `npm test` - Run unit tests once
- `npm run test:watch` - Run tests in watch mode  
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:stories` - Run Storybook tests with Vitest
- `npm run screenshots` - Capture component screenshots
- Use proper ES module imports (await import()) instead of require() for mocked modules

**Testing + TypeScript Validation** (recommended for development):
```bash
npm run check && npm test
```

### Storybook

- `npm run storybook` - Start Storybook development server
- `npm run build-storybook` - Build Storybook for production
- **Story Development**: See `STORYBOOK.md` section "Storybook Story Development Guidelines" for:
  - ✅ Component separation patterns (component → story → css)
  - ❌ Common anti-patterns that cause parsing errors
  - 🔧 Backend feature demo patterns
  - 📋 Development checklist for new stories
- **Backend Demos**: See `STORYBOOK.md` for interactive backend feature demonstration patterns

## Development Quality Requirements

### 🚨 Zero-Tolerance Policy

**TypeScript Errors**: The codebase maintains ZERO TypeScript errors at all times. Any commit introducing TypeScript errors will be rejected.

**Quality Gates**: All code changes must pass the following validation before commit:

1. ✅ **TypeScript Validation**: `npm run check` (zero errors)
2. ✅ **ESLint Compliance**: `npm run lint` (zero errors)  
3. ✅ **Unit Tests**: `npm test` (all tests passing)

### Pre-Commit Checklist

Before committing ANY changes:

```bash
# 1. Run full quality validation
npm run check && npm run lint && npm test

# 2. Verify zero TypeScript errors specifically
npx tsc --noEmit --project tsconfig.app.json

# 3. Check for any remaining issues
npm run build  # Should complete without errors
```

### Development Workflow Quality Standards

1. **Feature Development**:
   - Write TypeScript-compliant code from the start
   - Run `npm run check` frequently during development
   - Address TypeScript errors immediately, never defer

2. **Test Development**:
   - All new tests must be TypeScript compliant
   - Use proper type assertions (`as any`) only when necessary for mocks
   - Ensure test files import and instantiate classes correctly

3. **Error Resolution**:
   - Fix TypeScript errors before implementing new features
   - Never commit partial fixes that leave errors unresolved
   - Use proper type definitions instead of suppressing errors

### Quality Enforcement for AI Coding Agents

**Mandatory Validation**: All coding agents (Claude, GitHub Copilot, etc.) must:

1. Run `npm run check` after any code modification
2. Resolve ALL TypeScript errors before considering a task complete
3. Verify that tests pass and are TypeScript compliant
4. Never use `@ts-ignore` or `any` types unless absolutely necessary

**Error Prevention**: Coding agents should:
- Validate imports and class instantiation
- Use proper mock types for testing
- Ensure interface compliance in all implementations
- Test both positive and negative cases for type safety

## Development Workflow

### Step-by-Step Quality Assurance Process

Follow this workflow for ALL development work to prevent TypeScript errors from entering the codebase:

#### 1. 🏗️ Development Phase

```bash
# Start development with clean state
npm run check  # Verify current state is clean

# During active development (run frequently):
npm run check  # Check types after significant changes
npm run test:watch  # Run tests continuously
```

#### 2. ✅ Pre-Commit Validation Phase

**MANDATORY** before any commit:

```bash
# Full quality validation (all must pass):
npm run check     # TypeScript validation
npm run lint      # ESLint compliance  
npm test          # Unit test execution
npm run build     # Production build verification

# Alternative: Combined command
npm run check && npm run lint && npm test && npm run build
```

#### 3. 🚨 Error Resolution Protocol

If any validation fails:

1. **TypeScript Errors**: 
   - Fix immediately, never defer
   - Use proper types, avoid `any` unless necessary
   - Ensure imports and class instantiation are correct

2. **ESLint Errors**:
   - Address code style and potential bugs
   - Use `npm run lint -- --fix` for auto-fixable issues

3. **Test Failures**:
   - Fix broken functionality
   - Update tests if API contracts changed
   - Ensure new tests are TypeScript compliant

4. **Build Failures**:
   - Resolve any remaining compilation issues
   - Check for missing dependencies or configuration errors

#### 4. 📋 Code Review Checklist

Before requesting code review:

- [ ] Zero TypeScript errors (`npm run check`)
- [ ] Zero ESLint errors (`npm run lint`)
- [ ] All tests passing (`npm test`)
- [ ] Production build successful (`npm run build`)
- [ ] No use of `@ts-ignore` without justification
- [ ] Proper type definitions for new interfaces
- [ ] Mock types compatible with real implementations

#### 5. 🤖 AI Coding Agent Workflow

For AI assistants (Claude, GitHub Copilot, etc.):

**Required Actions:**
1. Run `npm run check` after EVERY code modification
2. Fix ALL TypeScript errors before task completion
3. Verify tests pass and are TypeScript compliant
4. Document any intentional use of `any` types
5. Ensure proper import statements and class instantiation

**Never Complete a Task With:**
- Outstanding TypeScript errors
- Commented-out critical code (like test setup)
- Missing imports or incorrect class instantiation
- Failing tests due to type issues

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

## Internationalization (i18n) System

Complete reactive internationalization system supporting 7 languages with instant locale switching. Key features:

- **Reactive Translations**: Uses Svelte stores for automatic UI updates when locale changes
- **Multi-Language Support**: English, German, Arabic, Hebrew, Japanese, Georgian, Chinese Traditional
- **RTL Layout**: Automatic layout direction switching for Arabic and Hebrew
- **Storybook Integration**: Locale switcher in Storybook toolbar for testing translations
- **Gettext Workflow**: Standard .po file workflow for translators
- **ZIP Compression**: Compressed translation bundles for efficient loading

### Usage Patterns

**In Svelte Components:**

```svelte
<script>
  import { t } from '$lib/i18n';
</script>

<!-- Reactive translation --><h1>{$t('Welcome')}</h1><p>{$t('Hello {name}', { name: 'User' })}</p>
```

**Non-Component Usage:**

```typescript
import { translate } from '$lib/i18n';

// Non-reactive function for use outside components
const message = translate('Save');
```

**RTL Detection:**

```typescript
import { documentDirection } from '$lib/i18n';
// Reactive store: 'ltr' | 'rtl'
```

**Location**: All i18n code is in `src/lib/i18n/` with API documentation

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

## Testing Strategy & TypeScript Quality Assurance

### Test Environment Architecture

The project uses a multi-tiered testing strategy with **mandatory TypeScript validation** at all levels:

- **Unit Tests (happy-dom)**: Fast, focused testing with TypeScript compliance required
- **Storybook Tests (browser)**: Integration testing with TypeScript validation
- **E2E Tests (browser)**: Full workflow testing with type safety
- **TypeScript Validation**: Continuous type checking during test development

### TypeScript Quality in Testing

**CRITICAL**: All tests must be TypeScript compliant. Common issues to avoid:

1. **Import Errors**: Ensure proper imports for test dependencies
   ```typescript
   // ✅ Correct
   import { SettingsManager } from '../settings-manager.js';
   
   // ❌ Incorrect
   // Commented imports that cause undefined variable errors
   ```

2. **Mock Type Compatibility**: Use proper type assertions for mocks
   ```typescript
   // ✅ Correct
   const mockStorage = createMockFileStorage();
   const manager = new SettingsManager(mockStorage as any, mockExt as any);
   
   // ❌ Incorrect
   const manager = new SettingsManager(mockStorage, mockExt); // Type error
   ```

3. **Test Variable Initialization**: Initialize variables in beforeEach
   ```typescript
   // ✅ Correct
   beforeEach(() => {
     settingsManager = new SettingsManager(mockStorage as any, mockExt as any);
   });
   
   // ❌ Incorrect
   beforeEach(() => {
     // settingsManager = new SettingsManager(...); // Commented out
   });
   ```

### Testing Quality Gates

Before considering any test complete:

1. **TypeScript Validation**: `npm run check` must pass
2. **Test Execution**: `npm test` must pass
3. **Combined Validation**: `npm run check && npm test`

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

## Component Development Guidelines

When creating new components, follow these accessibility and development standards:

### Accessibility Checklist

Before considering a component complete:

- ✅ **Use Semantic HTML**: Use proper elements (`<button>`, `<nav>`, `<input>`) instead of `<div>` with event handlers
- ✅ **Add ARIA Labels**: Include `aria-label` for icon-only buttons and controls
- ✅ **Include Focus Styles**: Apply `:focus-visible` styles using design system tokens
- ✅ **Ensure Touch Targets**: Interactive elements must be at least 44x44 pixels
- ✅ **Let Svelte Help**: Trust Svelte's compiler to catch accessibility issues

### Development Patterns

**Reference Components**: Learn from existing accessible patterns in:

- `ThemeToggle.svelte` - Icon button with proper ARIA
- `Sidebar.svelte` - Navigation with semantic markup

**Documentation**: See comprehensive guides at:

- `src/lib/components/ACCESSIBILITY.md` - Component patterns and examples
- `src/styles/ACCESSIBILITY.md` - CSS tokens and styling guidelines

### Testing Requirements

- **Keyboard Navigation**: Tab through your interface - can you see focus clearly?
- **Svelte Warnings**: Component must compile without accessibility warnings
- **Touch Targets**: Test on mobile - are interactive elements easy to tap?

## Claude Interaction Guidelines

### 🚨 MANDATORY Quality Validation for Claude

**TypeScript Compliance**: Claude MUST run `npm run check` after any code modification and resolve ALL TypeScript errors before considering any task complete.

**Quality Gates**: Every coding task must include:
1. ✅ TypeScript validation (`npm run check`)
2. ✅ ESLint compliance (`npm run lint`) 
3. ✅ Test execution (`npm test`)
4. ✅ Build verification (`npm run build`)

**Never Complete Tasks With**:
- Outstanding TypeScript errors
- Failing tests due to type issues
- Missing imports or class instantiation
- Commented-out critical code (especially test setup)

### Interaction Style

- **Quality First**: Always prioritize TypeScript compliance and test validity
- **Error Resolution**: Fix type errors immediately, never defer or ignore
- **Validation Workflow**: Run quality checks frequently during development
- **Documentation**: When planning under-specified work, ask the user for clarification
- **IMPORTANT:** Ask the user one question at a time, not a list of questions

### Development Best Practices

- **Proactive Type Checking**: Run `npm run check` after every significant code change
- **Proper Imports**: Ensure all imports are correct and classes can be instantiated
- **Mock Compatibility**: Use proper type assertions for test mocks (`as any`)
- **Interface Compliance**: Verify all implementations match their interfaces
- **Test Quality**: Ensure tests are TypeScript compliant and properly initialized

## Claude Interaction Memory

- The user usually has Storybook running. If Claude wants a screenshot, ask the user
- The user is the system architecture expert. Instead of searching the whole project, try asking the user for guidance
- **CRITICAL**: The user expects zero TypeScript errors in the codebase at all times
