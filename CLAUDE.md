# Claude Code Project Instructions

## Claude Interaction Guidelines

First thing - ask the user whether this session is primarily **DOCUMENTATION**, **TESTING** or **DEVELOPMENT** based.

When the user asks you to document a plan or write a new document describing detailed technical information to be reviewed, create a new markdown document in @process/

### 🚨 Quality Standards for Claude

**See [QUALITY.md](./QUALITY.md) for complete quality validation requirements, TypeScript standards, and AI coding agent behavior.**

### Interaction Style

- **Quality First**: Always prioritize TypeScript compliance and test validity
- **Error Resolution**: Fix type errors immediately, never defer or ignore
- **Documentation**: When planning under-specified work, ask the user for clarification
- **IMPORTANT:** Ask the user one question at a time, not a list of questions

## Claude Interaction Memory

- The user usually has Storybook running. If Claude wants a screenshot, ask the user
- The user is the system architecture expert. Instead of searching the whole project, try asking the user for guidance
- **CRITICAL**: The user expects zero TypeScript errors in the codebase at all times
- The user will run the npm dev server, so the agent never needs to
- When writing api docs only document methods specified. do not invent features that haven't been requested.
- don't write fallback style code (auto-creating files, or other content) unless explicitly approved by the user

## EDITME - EPUB Editor

This is a **Svelte 5 application using runes mode** that runs in modern browsers, replacing a previous Vue.js version. It allows users to create and edit EPUB files using plain text sources that are transformed to XHTML.

### Svelte 5 & Runes Mode

The application has been modernized to use Svelte 5's runes-based reactivity system. All new components should use runes syntax:

- **State**: Use `$state()` instead of `let` for reactive variables
- **Props**: Use `$props()` instead of `export let`
- **Bindable Props**: Use `$bindable()` for two-way binding
- **Derived**: Use `$derived()` instead of `$:`
- **Effects**: Use `$effect()` instead of reactive statements

**Legacy Svelte 4 syntax is being phased out** - when working with existing components, prefer converting to runes syntax when making significant changes.

### Distribution Model

**EDITME is distributed as freeware for personal use** with three deployment methods:

1. **Web Application** - Hosted version accessible via browser
2. **Standalone HTML** - Single file download for offline use
3. **Active EPUB** - Embedded within EPUB files for self-editing capability

The build process creates a single `EDITME.html` file (~2-3MB) with all assets inlined, suitable for all distribution methods. See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment details.

## Technical Architecture

### Key Features

- EPUB unpacking/packaging using Compression Streams API
- Real-time plain text to XHTML transformation
- Multi-device preview (iPhone, iPad, Pixel phone variants)
- Extensible transform scripts loaded from EPUB manifest
- Accessibility-focused design
- Reactive internationalization system with 7 languages and RTL support

### Code Style Preferences

- **XML/HTML Parsing**: Use `DOMParser` and `querySelector` instead of regular expressions for robust parsing
- **CSS & Styling**: Use the comprehensive design system in `src/styles/` - see `plans/features/css_design_system.md` for full documentation
- **SOURCE.zip Handling**: Use existing ZIP library (`src/lib/zip/`) for SOURCE.zip creation/extraction
- **Import Paths**: Use absolute paths (`$lib/`) for new code
- Browser-native APIs preferred over regex for structured data handling

### Build Configuration Constraints

- **Treeshaking**: Do NOT enable aggressive Rollup treeshaking options (`moduleSideEffects: false`, `propertyReadSideEffects: false`, `unknownGlobalSideEffects: false`). Svelte 5's reactivity system requires runtime side effects for signal registration and context initialization. Aggressive treeshaking removes these dependencies, causing runtime errors like `"can't access property 'r1', t.l is null"`. Use Vite's default treeshaking instead.

### Storage Strategy

- OPFS (Origin Private File System) for performance
- IndexedDB fallback for broader browser support
- Feature detection for `.createWritable()` support
- Workspace-based organization with unique IDs

### State Persistence Pattern

Browser reload state management follows the **navigationStore pattern** for consistency:

- **Storage Keys**: Prefixed constants (`editme_app_workspace_id`, `editme_nav_current_view`)
- **Auto-Persistence**: State changes automatically persist to localStorage with try/catch error handling
- **Restoration**: Components restore state during initialization, falling back to defaults on errors
- **Cleanup**: Invalid state is cleared when conflicts occur

**Reference Implementation**: See `src/lib/navigation/navigation-store.ts` and `src/lib/app-state-enhanced.svelte.ts` for the complete pattern.

### Text Processing Pipeline

```
Plain text source → transformText.js → transformDom.js → XHTML → Preview
```

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

## Key Systems

### CSS Design System

Complete design token system with utilities and themes. **Location**: All CSS files are in `src/styles/` with organized token/utility/theme structure. See `plans/features/css_design_system.md` for complete documentation.

### ZIP Library

Complete browser-native ZIP implementation for EPUB workflows. See `src/lib/zip/API.md` for full documentation.

### Internationalization (i18n) System

Complete reactive internationalization system supporting 7 languages with instant locale switching. **Location**: All i18n code is in `src/lib/i18n/` with API documentation.

**Usage Patterns:**

```svelte
<script>
  import { t } from '../i18n';
</script>

<!-- Reactive translation --><h1>{$t('Welcome')}</h1><p>{$t('Hello {name}', { name: 'User' })}</p>
```

## Development References

- **Quality Standards**: [QUALITY.md](./QUALITY.md) - Complete validation requirements and TypeScript standards
- **Development Workflow**: [DEVELOPMENT.md](./DEVELOPMENT.md) - Feature development process and API documentation standards
- **Testing Strategy**: [TESTING.md](./TESTING.md) - Comprehensive testing patterns and browser API testing
- **Linting Configuration**: [LINTING.md](./LINTING.md) - ESLint configuration and environment-specific rules
- **Storybook Guidelines**: [STORYBOOK.md](./STORYBOOK.md) - Component story development and backend integration patterns
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md) - Build process and distribution methods
- **EPUB Embedding**: [EPUB_EMBEDDING.md](./EPUB_EMBEDDING.md) - Active EPUB creation guidelines

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
