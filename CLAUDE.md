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
4. Workspace Management

### Phase 2: Data & UI
5. Content.opf Parser/Generator
6. Blob URL Manager
7. Layout System (resizable panels)
8. Navigation Router

### Phase 3: Content Management
9. Manifest View (file listing)
10. Metadata Editor (form-based)
11. Spine Item Manager (chapter ordering)
12. Theme System (light/dark mode)

### Phase 4: Text Processing
13. Transform Pipeline (dynamic function execution)
14. Text Editor (debounced preview updates)
15. Error Handling (transform failures)

### Phase 5: Preview & Polish
16. Device Preview (responsive + multi-device)
17. Preview Iframe (blob URL substitution)
18. Navigation Editor (TOC editing)
19. Storage Quota Monitor
20. Audio Clip Editor

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

### Linting
- `npm run lint` - ESLint check
- `npm run typecheck` - TypeScript validation

## ZIP Library Implementation

### Location: `src/lib/zip/`

The ZIP library is complete and fully tested, ready for Features 02 & 03 implementation.

#### Core Files:
- **`zip-reader.ts`** - ZIP parsing and extraction using DecompressionStream
- **`zip-writer.ts`** - ZIP creation with EPUB compliance using CompressionStream  
- **`utils.ts`** - Stream conversion, downloads, data reading utilities
- **`types.ts`** - Complete TypeScript interfaces and type definitions
- **`index.ts`** - Clean API exports

#### Key Features:
- Browser-native Compression Streams API (no external dependencies)
- EPUB-compliant ZIP handling (mimetype file first, uncompressed)
- Memory-efficient streaming for large files
- File type-based compression optimization
- CRC32 checksum calculation and DOS timestamp conversion
- Unicode filename support and error handling

#### Usage Examples:
```typescript
// Reading ZIP files
import { Zip } from '$lib/zip';
const zip = new Zip(arrayBuffer);
for (const entry of zip.entries) {
  const blob = await entry.extract();
}

// Creating ZIP files  
import { ZipWriter } from '$lib/zip';
const writer = new ZipWriter();
await writer.addFile('mimetype', 'application/epub+zip');
await writer.addFile('content.txt', 'Hello World');
const zipBlob = await writer.buildBlob();
```

#### Testing:
- **64 comprehensive tests** across utils, reader, and writer
- Browser API mocking (document, window, URL, Compression Streams)
- Edge cases, error handling, and EPUB workflow scenarios
- Run with: `npm test src/lib/zip`

### Integration Notes:
- Ready for File Storage API integration (Feature 01)
- Supports OPFS and IndexedDB storage backends  
- Handles workspace-based file organization
- Compatible with blob URL management for previews