# Claude Code Project Instructions

## Claude Interaction Guidelines

First thing - ask the user whether this session is primarily **DOCUMENTATION**, **TESTING** or **DEVELOPMENT** based.

When the user asks you to document a plan or write a new document describing detailed technical information to be reviewed, create a new markdown document in @process/

### 🚨 Quality Standards for Claude

**See [QUALITY.md](./QUALITY.md) for complete quality validation requirements, TypeScript standards, and AI coding agent behavior.**

### Interaction Style

- **Quality First**: Always prioritize TypeScript compliance and test validity
- **Error Resolution**: Fix type errors immediately, never defer or ignore
- **Lint ratchet**: Never raise the `--max-warnings` cap; don't add warnings, and lower the cap when you remove them (see QUALITY.md)
- **Documentation**: When planning under-specified work, ask the user for clarification
- **IMPORTANT:** Ask the user one question at a time, not a list of questions

## Claude Interaction Memory

- The user usually has Storybook running. If Claude wants a screenshot, ask the user
- The user is the system architecture expert. Instead of searching the whole project, try asking the user for guidance
- **CRITICAL**: The user expects zero TypeScript errors in the codebase at all times
- The user will run the npm dev server, so the agent never needs to
- When writing api docs only document methods specified. do not invent features that haven't been requested.
- don't write fallback style code (auto-creating files, or other content) unless explicitly approved by the user

## SEED.html - Simple EPUB Editor

This is a **Svelte 5 application using runes mode** that runs in modern browsers. It allows users to create and edit EPUB files using plain text sources that are transformed to XHTML.

### Project name (IMPORTANT)

The product is **SEED.html** (short for _Simple EPUB EDitor_). The distributable single
file is `SEED.html`, the editor-source archive is `SEED.zip`, and the UI name shown to
users is **"Simple EPUB Editor"**.

- **"EDITME" is a former name.** Do NOT introduce "EDITME" into new UI text, code
  comments, sample content, or docs — always use **"SEED.html"** / **"Simple EPUB Editor"**.
- **Do NOT rename existing functional identifiers that contain `editme`** — they are
  load-bearing and renaming them breaks saved user workspaces and the build. This
  includes: the `seedhtml_*` localStorage keys (e.g. `seedhtml_app_workspace_id`,
  `seedhtml_nav_*`), the `__SEEDHTML_I18N_BUNDLE__` window global, the `editme-storage`
  IndexedDB database, the `seedhtml-content-panes` PaneForge id, the `seedhtmlPlugin`
  package metadata key, and the `editme-svelte` package / git-repo name.
- Some older docs still say "EDITME" / "EDITME.html". **SEED.html is canonical** — ignore
  those lingering references; a full docs rebrand is intentionally not done.

### Svelte 5 & Runes Mode

**CONSTRAINT: All Svelte components MUST use runes mode.** This is a hard project
rule, not a preference — for new components and existing ones alike:

- **State**: Use `$state()` instead of `let` for reactive variables
- **Props**: Use `$props()` instead of `export let`
- **Bindable Props**: Use `$bindable()` for two-way binding
- **Derived**: Use `$derived()` for simple expressions, `$derived.by()` for function bodies
- **Effects**: Use `$effect()` instead of reactive statements
- **Component events**: Use **callback props** (`onFoo?: (detail) => void`), not `createEventDispatcher`/`dispatch`
- **Composition**: Use **snippets** (`{#snippet}` / `{@render}`), not `<slot>`
- **DOM events**: Use `onclick`/`oninput`/… attributes, not `on:click`/`on:input` directives

**Legacy Svelte 4 syntax is prohibited** — `export let`, top-level `$:` reactive
statements, `createEventDispatcher`, `<slot>`, and `on:` event directives. If you
touch a component that still uses any of these, convert it to runes as part of
your change; do not add new legacy syntax. A small set of components is mid-
migration — finish them when you work in them rather than matching their old
style.

### Distribution Model

**SEED.html is distributed as MIT licensed open source** with three deployment methods:

1. **Web Application** - Hosted version accessible via browser
2. **Standalone HTML** - Single file download for offline use
3. **SEED EPUB** - Embedded within EPUB files for self-editing capability

The build process creates a single `index.html` file (~1MB) with all assets inlined, suitable for all distribution methods. See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment details.

## Technical Architecture

### Key Features

- EPUB unpacking/packaging using Compression Streams API
- Real-time plain text to XHTML transformation
- Multi-device preview (iPhone, iPad, e-reader variants)
- Extensible transform scripts loaded from EPUB manifest
- Accessibility-focused design
- Reactive internationalization system with RTL support (English + German shipped; 5 more scaffolded but not enabled — see `ENABLED_LOCALES`)

### Code Style Preferences

- **XML/HTML Parsing**: Use `DOMParser` and `querySelector` instead of regular expressions for robust parsing
- **CSS & Styling**: Use the comprehensive design system in `src/styles/` - see `src/styles/DESIGN_SYSTEM.md` for full documentation
- **Editor-source archive (`SEED.zip`)**: Use existing ZIP library (`src/lib/zip/`) for the editor-source archive's creation/extraction. The archive name constant lives in `src/lib/source/source-utils.ts` (`SOURCE_ARCHIVE_NAME`); imports also accept the legacy `SOURCE.zip`.
- **Import Paths**: Use absolute paths (`$lib/`) for new code
- Browser-native APIs preferred over regex for structured data handling

### Build Configuration Constraints

- **Treeshaking**: Do NOT enable aggressive Rollup treeshaking options (`moduleSideEffects: false`, `propertyReadSideEffects: false`, `unknownGlobalSideEffects: false`). Svelte 5's reactivity system requires runtime side effects for signal registration and context initialization. Aggressive treeshaking removes these dependencies, causing runtime errors like `"can't access property 'r1', t.l is null"`. Use Vite's default treeshaking instead.

### Storage Strategy

- OPFS (Origin Private File System) for performance
- IndexedDB fallback for broader browser support
- Feature detection for `.createWritable()` support
- Project-based organization with unique IDs

### State Persistence Pattern

Browser reload state management follows the **navigationStore pattern** for consistency:

- **Storage Keys**: Prefixed constants (`seedhtml_app_workspace_id`, `seedhtml_nav_current_view`)
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
SEED.zip (editor source files - extracted to SOURCE/ during editing)
SEED.html (editor app - to be extracted by the user to edit the EPUB file)
```

**Note**: The `SEED.zip` file (formerly `SOURCE.zip`; imports still accept the old name) contains all editor-specific files (settings, plain text sources, transform scripts, extensions) and is extracted to a `SOURCE/` directory in the workspace during editing. The archive filename is `SEED.zip`; the extracted working directory remains `SOURCE/`.

**Important**: When creating SEED EPUBs, always include extraction instructions for end users. See [EPUB_EMBEDDING.md](./EPUB_EMBEDDING.md) for detailed embedding guidelines.

## Key Systems

### CSS Design System

Complete design token system with utilities and themes. **Location**: All CSS files are in `src/styles/` with organized token/utility/theme structure. See `src/styles/DESIGN_SYSTEM.md` for complete documentation.

### ZIP Library

Complete browser-native ZIP implementation for EPUB workflows. See `src/lib/zip/API.md` for full documentation.

### Internationalization (i18n) System

Reactive internationalization system with instant locale switching. The framework targets seven languages, but only locales with a genuine reviewed translation are shipped/enabled (currently English + German); the rest are scaffolded but kept out of the bundle and picker via `ENABLED_LOCALES`. **Location**: All i18n code is in `src/lib/i18n/` with API documentation.

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
