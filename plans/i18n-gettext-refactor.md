# i18n Gettext Workflow Refactoring

## Overview

Refactor the current i18n extraction system to follow proper gettext workflow using Node.js libraries instead of custom file manipulation. This will improve compatibility with standard translation tools and provide a more maintainable solution.

## Current State Analysis

### Problems with Current Implementation

- ❌ No `.pot` (master template) file - downstream tools expect this
- ❌ Direct `.po` file generation without proper gettext workflow
- ❌ Custom header manipulation causing newline stripping issues
- ❌ Manual translation merging logic prone to bugs
- ❌ Non-standard workflow incompatible with translation tools

### Current Files

```
locales/
├── ar.po                # Arabic translations
├── de.po                # German translations
├── en.po                # English translations
├── he.po                # Hebrew translations
├── ja.po                # Japanese translations
├── ka.po                # Georgian translations
└── zh-Hant.po           # Traditional Chinese translations
```

### Current Script: `build-scripts/i18n-extract.js`

- ✅ Custom Svelte/TypeScript string extraction (keep this)
- ❌ Direct `.po` file generation using `gettext-extractor.savePotFile()`
- ❌ Manual header cleanup causing newline issues
- ❌ Custom translation preservation logic

## Target Solution: Node.js Gettext Libraries

### New Dependencies

```json
{
  "devDependencies": {
    "gettext-parser": "^8.0.0" // Parse/write .po/.pot files
  }
}
```

### Target File Structure

```
locales/
├── messages.pot         # Master template (committed to repo)
├── ar.po                # Arabic translations
├── de.po                # German translations
├── en.po                # English translations
├── he.po                # Hebrew translations
├── ja.po                # Japanese translations
├── ka.po                # Georgian translations
└── zh-Hant.po           # Traditional Chinese translations
```

## Implementation Plan

### Phase 1: Setup and Dependencies

- [ ] Install `gettext-parser` dependency
- [ ] Remove unused `gettext-extractor-svelte` dependency (already done)
- [ ] Import gettext-parser in extraction script

### Phase 2: Refactor Extraction Script

- [ ] Keep existing custom Svelte/TS string extraction logic
- [ ] Replace `gettext-extractor.savePotFile()` with `gettext-parser`
- [ ] Generate `messages.pot` file using `gettextParser.po.compile()`
- [ ] Remove custom header cleanup logic (let gettext-parser handle it)

### Phase 3: Implement Proper .po File Workflow

- [ ] Create `mergePoWithPot()` function to update existing `.po` files
- [ ] Create `initializePoFromPot()` function for new locales
- [ ] Use `gettextParser.po.parse()` to read existing `.po` files
- [ ] Use `gettextParser.po.compile()` to write updated `.po` files

### Phase 4: Translation Preservation

- [ ] Preserve existing translations when updating from `.pot`
- [ ] Add new strings from `.pot` with empty translations
- [ ] Remove obsolete strings no longer in `.pot`
- [ ] Update source references from `.pot` file
- [ ] Preserve translator metadata (Last-Translator, etc.)

### Phase 5: Testing and Validation

- [ ] Test with existing translations to ensure preservation
- [ ] Verify `.pot` file format compatibility
- [ ] Test change detection logic
- [ ] Validate all locales generate correctly
- [ ] Check downstream processing with new format

### Phase 6: Documentation

- [ ] **Create developer documentation** explaining:
  - How the new gettext workflow works
  - How to add new translatable strings
  - How translators should work with the files
  - How to add new locales
  - How to run the extraction script

## Technical Specifications

### Script Architecture

```javascript
import gettextParser from 'gettext-parser';

// Phase 1: Extract strings (keep existing custom logic)
const extractedMessages = extractFromSvelteAndTS();

// Phase 2: Create .pot file using gettext-parser
const potData = {
  headers: {
    /* standard pot headers */
  },
  translations: {
    '': extractedMessages, // Default context
  },
};
const potContent = gettextParser.po.compile(potData);
writeFileSync('locales/messages.pot', potContent);

// Phase 3: Update .po files using gettext-parser
for (const locale of locales) {
  const poPath = `locales/${locale}.po`;

  if (existsSync(poPath)) {
    // Read existing .po
    const existingPo = gettextParser.po.parse(readFileSync(poPath));

    // Merge with .pot (preserve translations, update metadata)
    const mergedPo = mergePoWithPot(existingPo, potData, locale);

    // Write back
    writeFileSync(poPath, gettextParser.po.compile(mergedPo));
  } else {
    // Initialize new .po from .pot
    const newPo = initializePoFromPot(potData, locale);
    writeFileSync(poPath, gettextParser.po.compile(newPo));
  }
}
```

### Key Functions to Implement

#### `mergePoWithPot(existingPo, potData, locale)`

- Preserve existing translations
- Add new strings from .pot with empty translations
- Remove obsolete strings not in .pot
- Update source references from .pot
- Preserve translator metadata
- Handle proper gettext headers

#### `initializePoFromPot(potData, locale)`

- Create new .po with locale-specific headers
- Copy all strings from .pot with empty translations
- Set proper Language header for locale

## Benefits of This Approach

### Technical Benefits

- ✅ Standard gettext workflow compatibility
- ✅ Proper `.pot` master template file
- ✅ Battle-tested gettext-parser library
- ✅ No custom header manipulation bugs
- ✅ Proper encoding and format handling

### Workflow Benefits

- ✅ Compatible with translation tools (Poedit, etc.)
- ✅ Standard translator workflow
- ✅ Upstream compatibility with translation services
- ✅ Proper change tracking for translatable content
- ✅ Single source of truth (`.pot` file)

### Maintenance Benefits

- ✅ Less custom code to maintain
- ✅ Industry standard approach
- ✅ Better error handling from mature library
- ✅ Future-proof solution

## Testing Requirements

### Functional Testing

- [ ] Verify existing translations are preserved exactly
- [ ] Test new string addition workflow
- [ ] Test string removal workflow
- [ ] Verify proper header generation
- [ ] Test change detection logic

### Format Validation

- [ ] Validate `.pot` file format with standard tools
- [ ] Verify `.po` files are properly formatted
- [ ] Check encoding handling (UTF-8)
- [ ] Test with complex strings (multiline, escapes, etc.)

### Integration Testing

- [ ] Test full extraction → update cycle
- [ ] Verify no regressions in translation loading
- [ ] Test with all supported locales
- [ ] Check build process integration

## Success Criteria

- [ ] All existing translations preserved without changes
- [ ] Proper `messages.pot` file generated and committed
- [ ] Standard gettext workflow implemented
- [ ] Zero custom header manipulation
- [ ] Compatible with standard translation tools
- [ ] Comprehensive developer documentation created
- [ ] All tests passing
- [ ] No breaking changes to translation loading

## Developer Documentation Requirements

At the end of this refactoring, create comprehensive documentation covering:

### For Developers

- How the new gettext workflow works
- How to add new translatable strings to code
- How to run the extraction script
- How to add new locales to the system
- Troubleshooting common issues

### For Translators

- How to work with the `.po` files
- Recommended tools (Poedit, etc.)
- How to handle the `.pot` template file
- Translation workflow and best practices

### For Maintainers

- How the extraction script works internally
- How to modify the extraction logic
- How to update gettext-parser dependency
- How to handle edge cases and debugging
