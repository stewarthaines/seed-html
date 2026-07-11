# Translator Comments Guide

## Purpose

Add contextual comments for translators to understand the purpose and constraints of translatable strings. These comments are extracted into `.pot` files as standard gettext extracted comments to help translators provide accurate, appropriate translations.

## HTML Syntax Rules

**CRITICAL**: Never place HTML comments inside HTML tags - this breaks HTML parsing.

```html
<!-- ❌ WRONG - Breaks HTML parsing -->
<button aria-label={$t('Save file')} <!-- i18n: Save button --> >

<!-- ✅ CORRECT - Comment before element -->
<!-- i18n: Primary save action button -->
<button aria-label={$t('Save file')}>
```

## Comment Format

Use HTML comment syntax with `i18n:` prefix:

```html
<!-- i18n: Brief, clear description of context -->
```

## Content Guidelines

### Focus on Clarity

- Explain **what the string does** in the UI
- Describe **functional context**, not visual appearance
- Note **usage constraints** (character limits, accessibility requirements)
- Avoid tone guidance - focus on clarity and accuracy

### Keep Comments Brief

- One line preferred
- 2-3 lines maximum for complex context
- Use precise, descriptive language

## Comment Categories

### UI Element Types

```html
<!-- i18n: Section heading for user workspace management -->
<h2>{$t('Workspaces')}</h2>

<!-- i18n: Primary action button - creates new EPUB project -->
<button>{$t('Create New')}</button>

<!-- i18n: Navigation link to metadata editing interface -->
<a href="/metadata">{$t('Edit Metadata')}</a>

<!-- i18n: Form field label for EPUB title input -->
<label>{$t('Title')}</label>

<!-- i18n: Help text explaining file format requirements -->
<p>{$t('Supported formats: EPUB, ZIP')}</p>

<!-- i18n: Error message when file upload fails -->
<div class="error">{$t('Upload failed')}</div>

<!-- i18n: Loading state text while processing -->
<span>{$t('Loading…')}</span>
```

### Accessibility Labels

Provide extra context for screen reader users:

```html
<!-- i18n: Accessibility label explaining the complete button action -->
<button aria-label={$t('Create a new minimal EPUB project')}>
  <!-- i18n: Button text - keep under 15 characters -->
  {$t('Create New')}
</button>

<!-- i18n: Screen reader label for workspace search field -->
<input aria-label={$t('Search workspaces')} />
```

### Character Limits

Note when UI space constrains text length:

```html
<!-- i18n: Button text - keep under 15 characters -->
<button>{$t('Export')}</button>

<!-- i18n: Tab label - very brief, max 8 characters -->
<tab>{$t('Files')}</tab>

<!-- i18n: Status badge - single word preferred -->
<span class="badge">{$t('Active')}</span>
```

### Technical Context

Explain technical strings that need context:

```html
<!-- i18n: File format name - keep as technical term -->
<option>{$t('EPUB')}</option>

<!-- i18n: Media type identifier for file uploads -->
<span>{$t('application/epub+zip')}</span>

<!-- i18n: Programming language name in code editor -->
<select value="javascript">
  {$t('JavaScript')}
</select>
```

## Placement Guidelines

### Single String

Place comment immediately before the element:

```html
<!-- i18n: Primary navigation menu -->
<nav>{$t('Menu')}</nav>
```

### Multiple Related Strings

**Use individual comments for each translatable string.** Group comments only apply to the first string encountered by the extraction system.

```html
<!-- ❌ WRONG - Only "Save" gets the comment context -->
<!-- 
i18n: File operation buttons
- "Save": Saves current changes
- "Cancel": Discards changes and closes  
- "Delete": Permanently removes file
-->
<div class="file-actions">
  <button>{$t('Save')}</button>
  <!-- Gets the comment -->
  <button>{$t('Cancel')}</button>
  <!-- No comment -->
  <button>{$t('Delete')}</button>
  <!-- No comment -->
</div>

<!-- ✅ CORRECT - Each string gets context -->
<div class="file-actions">
  <!-- i18n: Saves current changes to file -->
  <button>{$t('Save')}</button>
  <!-- i18n: Discards changes and closes dialog -->
  <button>{$t('Cancel')}</button>
  <!-- i18n: Permanently removes file - destructive action -->
  <button>{$t('Delete')}</button>
</div>
```

### When Group Comments Work

Group comments are only effective for **single strings** that reference multiple concepts:

```html
<!-- i18n: Status message listing available file operations -->
<p>{$t('Available actions: Save, Cancel, Delete')}</p>

<!-- i18n: Help text explaining button group functionality -->
<span>{$t('Use these buttons to save, cancel, or delete your work')}</span>
```

### Script Variables

For translations assigned to variables:

```svelte
<script>
  // i18n: Success message when EPUB export completes
  const exportSuccessMessage = $t('EPUB exported successfully');

  // i18n: Confirmation dialog when deleting workspace
  const deleteConfirmMessage = $t('Delete this workspace?');
</script>
```

## Special Cases

### Multi-line Strings

For complex strings, explain the overall purpose:

```html
<!-- i18n: Instructions for uploading EPUB files -->
<p>{$t('Drag and drop an EPUB file here, or click to browse…')}</p>
```

## Agent Processing Instructions

When adding translator comments across the codebase:

1. **Scan for** `$t('...')`, `{$t('...')}`, `t('...')`, and `translate('...')` calls
2. **Check if comment exists** within 3 lines before the translation
3. **Add individual comment** for each string that needs context (not group comments)
4. **Focus on** accessibility labels, UI actions, and technical terms
5. **When in doubt, add a comment** - better to provide context than leave translators guessing
6. **Validate** HTML syntax - never place comments inside tags
7. **Test** that comments are extracted by running `npm run build-scripts/i18n-extract.js`

**Remember**: Each translatable string needs its own comment. Group comments only apply to the first string found.

## Validation

After adding comments, verify extraction works:

```bash
node build-scripts/i18n-extract.js
```

Check that comments appear in `locales/messages.pot` as extracted comments:

```po
#. Primary action button - creates new EPUB project
#: src/components/Button.svelte:15
msgid "Create New"
msgstr ""
```
