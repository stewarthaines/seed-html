# Localization Guide

This document explains how to add new locales to SEED.html, which supports internationalization through a gettext-based workflow.

## Current Locales

The project currently supports 7 languages:

- **English** (`en`) - Default locale
- **German** (`de`) - Deutsch
- **Georgian** (`ka`) - ქართული
- **Arabic** (`ar`) - العربية (RTL)
- **Hebrew** (`he`) - עברית (RTL)
- **Chinese Traditional** (`zh-Hant`) - 繁體中文
- **Japanese** (`ja`) - 日本語

## Adding a New Locale

### 1. Update Locale Configuration

Add your new locale to the configuration files:

**File: `src/lib/i18n/locale-config.ts`**

```typescript
export const SUPPORTED_LOCALES = [
  'en',
  'de',
  'ka',
  'ar',
  'he',
  'zh-Hant',
  'ja',
  'fr', // Add your new locale here
] as const;
```

**File: `build-scripts/i18n-extract.js`**

```javascript
const locales = ['en', 'de', 'ka', 'ar', 'he', 'zh-Hant', 'ja', 'fr'];
```

### 2. Generate Translation Template

Run the extraction script to generate a new `.po` file for your locale:

```bash
npm run i18n:extract
```

This creates `locales/fr.po` with all translatable strings ready for translation.

### 3. Translate the Content

**Recommended**: Use our hosted Weblate instance for collaborative translation:

🌐 **[translate.codeberg.org/projects/seed-html](https://translate.codeberg.org/projects/seed-html/)**

Weblate provides:

- **Web-based interface**: No software installation required
- **Translation suggestions**: Automatic suggestions and translation memory
- **Collaboration features**: Multiple translators can work together
- **Quality checks**: Built-in validation for translation quality
- **Progress tracking**: See completion status for each language

**Alternative methods**:

- **[Poedit](https://poedit.net/)**: Desktop application for offline translation
- **Text editor**: Direct editing of `.po` files (advanced users)

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

### 4. Set Locale Metadata

Update the file headers in your `.po` file:

```po
"Language: fr\n"
"Last-Translator: Your Name <your.email@example.com>\n"
"Language-Team: French <team@example.com>\n"
```

### 5. Generate JSON Translations

Convert `.po` files to JSON format used by the application:

```bash
npm run i18n:convert
```

This creates `src/lib/i18n/locales/fr.json`.

### 6. Build Translation Bundle

Compress translations for efficient loading:

```bash
npm run i18n:compress
```

### 7. Test Your Locale

1. **Start development server**: `npm run dev`
2. **Change locale**: Use browser developer tools to set `localStorage.setItem('locale', 'fr')`
3. **Reload page**: Verify your translations appear correctly

### 8. RTL Language Support

For right-to-left languages (Arabic, Hebrew), add RTL configuration:

**File: `src/lib/i18n/locale-config.ts`**

```typescript
export const RTL_LOCALES = ['ar', 'he', 'ur'] as const; // Add new RTL locale
```

## Translation Guidelines

### String Quality

- **Keep it concise**: UI space is limited
- **Maintain context**: Consider where text appears
- **Use proper capitalization**: Follow target language conventions
- **Test thoroughly**: Verify text fits in UI components

### Special Strings

- **Sample content**: Strings starting with `sample.` are demo content
- **Technical terms**: Some terms like "EPUB" may remain untranslated
- **Placeholders**: Maintain placeholder format like `{name}` in translations

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

For languages with complex plural rules, update:

**File: `locales/[locale].po`**

```po
"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);\n"
```

## Maintenance Workflow

### Adding New Translatable Strings

1. **Add strings to code**: Use `$t('Your new string')` in Svelte components
2. **Extract strings**: Run `npm run i18n:extract`
3. **Update translations**: Translate new strings in all `.po` files
4. **Rebuild**: Run `npm run i18n:build`

### Updating Existing Translations

1. **Edit `.po` files**: Update translations using Poedit or text editor
2. **Rebuild**: Run `npm run i18n:build`
3. **Test**: Verify changes in development server

## File Structure

```
locales/
├── messages.pot          # Master translation template
├── en.po                 # English translations
├── de.po                 # German translations
├── fr.po                 # French translations (your new locale)
└── ...

src/lib/i18n/
├── locales/
│   ├── en.json           # Compiled English translations
│   ├── de.json           # Compiled German translations
│   ├── fr.json           # Compiled French translations
│   └── ...
└── locale-config.ts      # Locale configuration

static/
└── i18n-bundle.gz        # Compressed translation bundle
```

## Quality Assurance

Before submitting translations:

```bash
# Run all quality checks
npm run check && npm run lint && npm test

# Test full build
npm run build

# Verify translations load
npm run dev
```

## Getting Help

- **Translation issues**: Check existing translations for patterns
- **Technical issues**: See [DEVELOPMENT.md](./DEVELOPMENT.md)
- **RTL layout problems**: Test with Arabic or Hebrew locales
- **Build errors**: Ensure all `.po` files are valid gettext format
