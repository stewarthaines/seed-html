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

API documentation should be created **after implementation and tests are working**, not as an afterthought. It helps clarify API design decisions and serves as integration reference for dependent features.
