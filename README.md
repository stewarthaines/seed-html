# SEED.html - Simple EPUB EDitor

A modern browser-based EPUB editor that transforms plain text into beautifully formatted ebooks. Built with Svelte, TypeScript, and cutting-edge web technologies.

## Overview

SEED.html is a sophisticated EPUB editing application that runs entirely in your web browser. It enables authors to create, edit, and publish EPUB files using a simple plain text workflow with powerful transformation capabilities.

### Key Features

- **Plain Text to XHTML Transformation** - Write in plain text, publish as formatted EPUB
- **Browser-Based** - No installation required, works offline after first load
- **Multi-Device Preview** - See how your book looks on different devices
- **Extensible Transform System** - Customize text processing with JavaScript
- **Accessibility-First Design** - Full keyboard navigation and screen reader support
- **Internationalization** - Available in multiple languages with RTL support
- **Modern Storage** - Uses OPFS and IndexedDB for persistent local storage

## Distribution

SEED.html is distributed under the terms of the MIT license. It is free to use, modify and distribute. In addition to the source repository it may be available in these ways;

1. **Web Application** - Access at [readitinabook.com](https://readitinabook.com) for immediate use
2. **Downloadable HTML** - Save locally from the above site for offline authoring
3. **Embedded in EPUBs** - The SEED.html app can be added to an EPUB as a non-manifest item, so it travels with the book for the life of that artifact

See [USER_GUIDE.md](./USER_GUIDE.md) for detailed usage instructions.

## Technology Stack

- **Frontend Framework**: Svelte 5 with TypeScript
- **Build System**: Vite 6
- **Storage**: OPFS (Origin Private File System) with IndexedDB fallback
- **EPUB Processing**: Native Compression Streams API
- **Testing**: Vitest with happy-dom
- **Documentation**: Storybook for component development

## Development

This section is for developers maintaining or extending SEED.html.

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- Modern browser (Chrome/Edge 119+, Firefox 119+, Safari 17+)

### Setup

```bash
# Clone the repository
git clone https://github.com/stewarthaines/editme-svelte.git
cd editme-svelte

# Install dependencies
npm install

# Start development server
npm run dev
```

### Quality Standards

This project maintains **zero TypeScript errors** at all times. Before committing:

```bash
# Run all quality checks
npm run check && npm run lint && npm test
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for comprehensive development guidelines.

### Key Documentation

- **[CLAUDE.md](./CLAUDE.md)** - AI coding agent instructions
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development workflows and standards
- **[TESTING.md](./TESTING.md)** - Testing strategy and patterns
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Build and deployment instructions
- **[LOCALIZATION.md](./LOCALIZATION.md)** - Adding new languages and translations

### Project Structure

```
editme-svelte/
├── src/
│   ├── lib/           # Core libraries with API documentation
│   ├── routes/        # Application views
│   ├── stores/        # Svelte stores
│   └── styles/        # Design system
├── static/            # Static assets (inlined at build)
└── stories/           # Storybook component demos
```

## Building

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

The build creates a single `index.html` file in the `dist/` directory with all assets inlined.

## License

(c) 2025 Stewart Haines

This software is open source under the terms of the MIT license. See [LICENSE.txt](./LICENSE.txt) for full terms.

## Support

For bug reports and feature requests, please use [github](https://github.com/stewarthaines/editme-svelte).
