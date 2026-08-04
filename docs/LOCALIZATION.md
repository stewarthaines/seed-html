# Localization Guide

This document explains how SEED.html translations work and how to add a new locale. The app uses a gettext-based workflow: `.po` files are the source, everything else is generated.

## Current Locales

Two locales ship today:

- **English** (`en`) — the source language. There is no English catalog: the `msgid` strings in the code _are_ the English UI.
- **German** (`de`) — Deutsch. Substantially complete and hand-reviewed. Any string not yet translated falls back to English at runtime, so a partial catalog never shows an empty or broken screen.

Five more locales are **scaffolded but not enabled**. They have display names, RTL flags, and `.po` files, but no reviewed translation, so they are deliberately kept out of the published catalogs, the locale picker, and browser auto-detection:

- **Georgian** (`ka`) — ქართული. The furthest along of the five, but awaiting native review.
- **Arabic** (`ar`) — العربية (RTL)
- **Hebrew** (`he`) — עברית (RTL)
- **Chinese Traditional** (`zh-Hant`) — 繁體中文
- **Japanese** (`ja`) — 日本語

Neither RTL locale currently ships, so the RTL layout paths are supported but not exercised by a shipped language.

The distinction between _known_ and _shipped_ is the thing to keep straight: a locale exists once it is in `LOCALE_CONFIGS`, and it reaches users only once it is also in `ENABLED_LOCALES`. Both live in **`src/lib/i18n/locale-meta.js`**, the single source of truth shared by the runtime (`locale-config.ts` re-exports it) and the Node build scripts (`build-scripts/enabled-locales.js` re-exports it).

## How a Catalog Reaches the App

1. `locales/<code>.po` — the committed translation source.
2. `npm run i18n:convert` compiles the **enabled** locales to `src/lib/i18n/locales/<code>.json`. These are gitignored build artifacts — **never edit them by hand**; the next convert run overwrites your changes.
3. `npm run build:locales` copies them to `dist/locales/` and writes `dist/locales/manifest.json`, the sidecar the app discovers catalogs from. English is skipped — it needs no catalog.
4. At runtime the app fetches a catalog on demand when the user picks that language. The service worker precaches the sidecar, so a locale stays available offline.

## Adding a New Locale

### 1. Register the Locale

**File: `src/lib/i18n/locale-meta.js`**

Add an entry to `LOCALE_CONFIGS`:

```javascript
fr: {
  code: 'fr',
  name: 'Français',
  direction: 'ltr',
  englishName: 'French',
},
```

For a right-to-left language, set `direction: 'rtl'` and add the code to `RTL_LOCALES` in the same file.

Leave `ENABLED_LOCALES` alone for now — see [Shipping a Locale](#shipping-a-locale).

**File: `build-scripts/i18n-extract.js`**

Add the code to the `locales` array, which drives which `.po` files the extractor creates and keeps merged:

```javascript
const locales = ['en', 'de', 'ka', 'ar', 'he', 'zh-Hant', 'ja', 'fr'];
```

### 2. Generate the Translation Template

```bash
npm run i18n:extract
```

This rewrites `locales/messages.pot` and creates `locales/fr.po` with every translatable string. Re-running it later merges new strings in and preserves existing translations.

The extractor scans `src/**` and `plugins/*/src/**`, so plugin strings land in the same catalog as the app's.

### 3. Translate the Content

**Recommended**: use the hosted Weblate instance for collaborative translation:

🌐 **[translate.codeberg.org/projects/seed-html](https://translate.codeberg.org/projects/seed-html/)**

Weblate provides:

- **Web-based interface**: no software installation required
- **Translation suggestions**: automatic suggestions and translation memory
- **Collaboration features**: multiple translators can work together
- **Quality checks**: built-in validation for translation quality
- **Progress tracking**: see completion status for each language

**Alternative methods**:

- **[Poedit](https://poedit.net/)**: desktop application for offline translation
- **Text editor**: direct editing of `.po` files (advanced users)

The translation files contain entries like:

```po
#: src/lib/components/workspace/WorkspaceList.svelte:106
msgid "Get started by creating your first EPUB"
msgstr ""  # Add your translation here
```

Fill in the `msgstr` values with your translations:

```po
msgstr "Commencez par créer votre premier EPUB"
```

### 4. Set Translator Metadata

Two `.po` headers survive re-extraction and are worth filling in:

```po
"Last-Translator: Your Name <your.email@example.com>\n"
"Language-Team: French <team@example.com>\n"
```

The remaining headers are stamped by the extractor on every run — `Language` is set from the locale code automatically, and hand-edits to the others are overwritten.

## Shipping a Locale

A locale only reaches users once its translation is real and reviewed. Adding a half-finished catalog to the build is worse than shipping English, so this is a deliberate second step.

### 1. Enable It

**File: `src/lib/i18n/locale-meta.js`**

```javascript
export const ENABLED_LOCALES = ['en', 'de', 'fr'];
```

This one list gates the compiled catalogs, the picker, and browser auto-detection.

### 2. Build the Catalogs

```bash
npm run i18n:convert   # locales/fr.po -> src/lib/i18n/locales/fr.json
npm run build:locales  # -> dist/locales/fr.json + manifest.json
```

`npm run i18n:build` runs extract and convert together; `npm run build:i18n` runs that plus the Vite build.

### 3. Test It

1. **Start the development server**: `npm run dev`
2. **Switch language**: use the language picker in Settings
3. **Verify**: check that strings appear translated, and that text still fits its controls

The preference persists in localStorage under `seedhtml-locale`.

## Translation Guidelines

### String Quality

- **Keep it concise**: UI space is limited
- **Maintain context**: consider where text appears
- **Use proper capitalization**: follow target language conventions
- **Test thoroughly**: verify text fits in UI components

### Special Strings

- **Technical terms**: some terms like "EPUB" may remain untranslated
- **Placeholders**: maintain placeholder format like `{name}` in translations

### Translator Comments

Developers can add context for translators using comments in source files. The extraction script supports multiple comment formats:

**HTML comments** (in template sections):

```html
<!-- i18n: This button creates a new EPUB project -->
<button>{$t('Create New')}</button>
```

**JavaScript line comments** (in script sections):

```javascript
// i18n: Message shown when saving is successful
const message = $t('Saved successfully');
```

**JavaScript block comments** (in script sections):

```javascript
/* i18n: Label for the main navigation menu */
const navLabel = $t('Navigation');
```

These comments appear in translation files as extracted comments:

```po
#. This button creates a new EPUB project
#: src/components/Button.svelte:45
msgid "Create New"
msgstr ""
```

The extraction script automatically finds comments within 3 lines before translation strings.

### Pluralization

The translation layer has no plural support — `$t()` looks up one message and interpolates `{param}` placeholders, and the converter ignores `msgid_plural`. Where a count changes the wording, write the variants as separate strings in the source rather than relying on gettext plural forms.

The `Plural-Forms` header in each `.po` is stamped by the extractor and not preserved across runs, so hand-editing it has no effect.

## Maintenance Workflow

### Adding New Translatable Strings

1. **Add strings to code**: use `$t('Your new string')` in Svelte components
2. **Extract strings**: run `npm run i18n:extract`
3. **Update translations**: translate the new strings in the `.po` files
4. **Compile**: run `npm run i18n:convert`

Steps 2 and 4 together are `npm run i18n:build`.

### Updating Existing Translations

1. **Edit `.po` files**: update translations in Weblate, Poedit, or a text editor
2. **Compile**: run `npm run i18n:convert`
3. **Test**: verify changes in the development server

## File Structure

```
locales/                  # committed source of truth
├── messages.pot          # master template
├── en.po                 # English (msgids only — no translations)
├── de.po                 # German translations
├── fr.po                 # French translations (your new locale)
└── ...

src/lib/i18n/
├── locales/              # generated, gitignored — never edit
│   ├── en.json
│   ├── de.json
│   └── ...
├── locale-meta.js        # LOCALE_CONFIGS, ENABLED_LOCALES, RTL_LOCALES
└── locale-config.ts      # runtime helpers over locale-meta

dist/locales/             # published sidecar, fetched on demand
├── manifest.json
└── de.json
```

## Quality Assurance

Before submitting translations:

```bash
# Flag user-facing strings that bypass $t()
npm run lint:i18n

# Full quality gate
npm run validate

# Verify translations load
npm run dev
```

## Getting Help

- **Translation issues**: check existing translations for patterns
- **Technical issues**: see [DEVELOPMENT.md](./DEVELOPMENT.md)
- **API and usage details**: see `src/lib/i18n/README.md`
- **Build errors**: ensure all `.po` files are valid gettext format
