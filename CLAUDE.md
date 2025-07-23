# Claude Code Project Instructions

## Claude Interaction Guidelines

If it's not been established yet ask the user whether this session is primarily DOCUMENTATION, TESTING or DEVELOPMENT based.

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete AI coding agent requirements and development best practices.**

**See [TESTING.md](./TESTING.md) for complete AI coding agent testing best practices.**

### 🚨 MANDATORY Quality Validation for Claude

**TypeScript Compliance**: Claude MUST run `npm run check` after any code modification and resolve ALL TypeScript errors before considering any task complete.

**Quality Gates**: Every coding task must include:

1. ✅ TypeScript validation (`npm run check`)
2. ✅ ESLint compliance (`npm run lint` - < 500 problems, zero critical errors)
3. ✅ Test execution (`npm test`)
4. ✅ Build verification (`npm run build`)

**Never Complete Tasks With**:

- Outstanding TypeScript errors
- Critical ESLint errors (undefined variables, syntax errors)
- Failing tests due to type issues
- Missing imports or class instantiation
- Commented-out critical code (especially test setup)

### Interaction Style

- **Quality First**: Always prioritize TypeScript compliance and test validity
- **Error Resolution**: Fix type errors immediately, never defer or ignore
- **Validation Workflow**: Run quality checks frequently during development
- **Documentation**: When planning under-specified work, ask the user for clarification
- **IMPORTANT:** Ask the user one question at a time, not a list of questions

## Claude Interaction Memory

- The user usually has Storybook running. If Claude wants a screenshot, ask the user
- The user is the system architecture expert. Instead of searching the whole project, try asking the user for guidance
- **CRITICAL**: The user expects zero TypeScript errors in the codebase at all times
- The user will run the npm dev server, so the agent never needs to
- When writing api docs only document methods specified. do not invent features that haven't been requested.

## EDITME.html - EPUB Editor

This is a Svelte-based EPUB editor that runs in modern browsers, replacing a previous Vue.js version. It allows users to create and edit EPUB files using plain text sources that are transformed to XHTML.

### Distribution Model

**EDITME.html is distributed as freeware for personal use** with three deployment methods:

1. **Web Application** - Hosted version accessible via browser
2. **Standalone HTML** - Single file download for offline use
3. **Active EPUB** - Embedded within EPUB files for self-editing capability

The build process creates a single `EDITME.html` file (~2-3MB) with all assets inlined, suitable for all distribution methods. See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment details.

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

**Important**: When creating Active EPUBs, always include extraction instructions for end users. See [EPUB_EMBEDDING.md](./EPUB_EMBEDDING.md) for detailed embedding guidelines.

## Commands

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production (creates single EDITME.html file)
- `npm run preview` - Preview production build

### Quality Validation ⚠️ REQUIRED BEFORE ALL COMMITS

**MANDATORY**: All changes must pass TypeScript validation before commit. Zero TypeScript errors are tolerated in the codebase.

- `npm run check` - **REQUIRED** TypeScript validation (must pass)
- `npm run lint` - **REQUIRED** ESLint check (zero warnings, zero errors)
- `npm run format` - **REQUIRED** Prettier code formatting for consistency
- `npm test` - **REQUIRED** Run unit tests (must pass)

**Combined Quality Check** (recommended):

```bash
npm run check && npm run lint && npm run format && npm test
```

**See [LINTING.md](./LINTING.md) for detailed ESLint configuration and acceptable lint thresholds.**

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
2. ✅ **ESLint Compliance**: `npm run lint` (< 500 problems, zero critical errors)
3. ✅ **Unit Tests**: `npm test` (all tests passing)

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete development workflow quality standards and AI coding agent requirements.**

## Development Workflow

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for comprehensive development workflow, quality assurance process, and AI coding agent requirements.**

## Linting Strategy & Environment Configuration

**See [LINTING.md](./LINTING.md) for comprehensive ESLint configuration including environment-specific rules, browser API coverage, VSCode integration, and common lint issue resolution.**

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
  import { t } from '../i18n';
</script>

<!-- Reactive translation --><h1>{$t('Welcome')}</h1><p>{$t('Hello {name}', { name: 'User' })}</p>
```

**Non-Component Usage:**

```typescript
import { translate } from '../i18n';

// Non-reactive function for use outside components
const message = translate('Save');
```

**RTL Detection:**

```typescript
import { documentDirection } from '../i18n';
// Reactive store: 'ltr' | 'rtl'
```

**Location**: All i18n code is in `src/lib/i18n/` with API documentation

## API Documentation Standards

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for comprehensive API documentation standards including required sections, documentation style, key guidelines, and when to create API docs.**

## Feature Development Process

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for the complete 5-step feature development process including planning, API documentation, testing, implementation, and Storybook story creation.**

## Testing Strategy & TypeScript Quality Assurance

**See [TESTING.md](./TESTING.md) for comprehensive testing strategy including test environment architecture, TypeScript quality requirements, happy-dom limitations, testing patterns, and browser API testing in Storybook.**

## Component Development Guidelines

**See [DEVELOPMENT.md](./DEVELOPMENT.md) for component development guidelines including accessibility checklist, development patterns, reference components, and testing requirements.**
