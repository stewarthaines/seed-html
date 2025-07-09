# Internationalization (i18n) Documentation

## Overview

The EDITME EPUB editor supports 7 languages with reactive internationalization using Svelte stores and gettext-based translation workflow. The system provides automatic RTL layout support and compressed translation bundles optimized for EPUB embedding.

## Supported Languages

- **English** (en) - Primary development language
- **German** (de) - Deutsch
- **Arabic** (ar) - العربية (RTL)
- **Hebrew** (he) - עברית (RTL)
- **Japanese** (ja) - 日本語
- **Georgian** (ka) - ქართული
- **Chinese Traditional** (zh-TW) - 中文 (繁體)

## Usage in Components

### Basic Translation

```svelte
<script>
  import { t } from '$lib/i18n';
</script>

<!-- Simple text translation -->
<h1>{$t('Welcome')}</h1>
<button>{$t('Save')}</button>
<p>{$t('File saved successfully')}</p>
```

### Translation with Variables

```svelte
<script>
  import { t } from '$lib/i18n';

  export let filename = 'document.epub';
  export let fileCount = 5;
</script>

<!-- Variable interpolation -->
<p>{$t('Saving {filename}...', { filename })}</p>
<span>{$t('Found {count} files', { count: fileCount })}</span>
```

### Pluralization

```svelte
<script>
  import { t } from '$lib/i18n';

  export let itemCount = 3;
</script>

<!-- Gettext-style pluralization -->
<span>{$t('{count} item', '{count} items', itemCount)}</span>
```

## Translation Key Conventions

Follow these patterns for consistent, organized translation keys:

### General Patterns

- Use **dot notation** for nested organization
- Use **camelCase** for action/state descriptors
- Use **lowercase** for simple nouns
- Keep keys **descriptive but concise**

### Component-Specific Keys

#### Navigation & Layout

```
navigation.workspace.title
navigation.metadata.label
navigation.spine.manage
sidebar.toggle.open
sidebar.toggle.close
```

#### Actions & Buttons

```
action.save
action.cancel
action.generate
action.addAuthor
action.removeItem
action.exportEpub
```

#### Form Fields & Labels

```
field.title
field.language
field.identifier
field.description
field.author.name
field.publication.date
```

#### Error Messages

```
error.required
error.invalidFormat
error.saveFailed
error.titleRequired
error.invalidDate
error.languageInvalid
```

#### Status & Feedback

```
status.saving
status.saved
status.error
feedback.operationComplete
feedback.validationPassed
```

#### Metadata Editor Example

```
metadata.tab.basic
metadata.tab.advanced
metadata.tab.publication
metadata.tab.accessibility
metadata.field.title
metadata.field.language
metadata.action.generate
metadata.error.titleRequired
```

## Non-Reactive Translation Function

For use outside of Svelte components (utilities, classes, workers):

```typescript
import { translate } from '$lib/i18n';

// Non-reactive function for use in classes/utilities
export class ValidationManager {
  validateField(field: string, value: string): string | null {
    if (!value.trim()) {
      return translate('error.required');
    }
    return null;
  }
}
```

## RTL Layout Support

### Automatic Direction Detection

```svelte
<script>
  import { documentDirection } from '$lib/i18n';
</script>

<!-- Reactive direction detection -->
<div class="container" dir={$documentDirection}>
  <!-- Content automatically flows RTL for Arabic/Hebrew -->
  <p>{$t('This text flows correctly in any direction')}</p>
</div>
```

### Manual Direction Handling

```typescript
import { documentDirection } from '$lib/i18n';
import { get } from 'svelte/store';

// Check direction in component logic
const isRTL = get(documentDirection) === 'rtl';
const textAlign = isRTL ? 'right' : 'left';
```

## Development Patterns

### Component Internationalization

```svelte
<script>
  import { t, documentDirection } from '$lib/i18n';

  export let title = '';
  export let isRequired = false;
</script>

<div class="form-field" dir={$documentDirection}>
  <label for="field-input">
    {$t('field.title')}
    {#if isRequired}
      <span class="required" aria-label={$t('field.required')}>*</span>
    {/if}
  </label>

  <input
    id="field-input"
    bind:value={title}
    placeholder={$t('field.title.placeholder')}
    aria-describedby={isRequired ? 'field-help' : undefined}
  />

  {#if isRequired}
    <div id="field-help" class="help-text">
      {$t('field.required.description')}
    </div>
  {/if}
</div>

<style>
  .form-field {
    /* Use logical properties for RTL support */
    margin-inline: 1rem;
    padding-inline-start: 0.5rem;
    text-align: start;
  }

  .required {
    color: var(--color-error);
    margin-inline-start: 0.25rem;
  }
</style>
```

### Error Message Patterns

```svelte
<script>
  import { t } from '$lib/i18n';

  export let errors = [];
</script>

{#if errors.length > 0}
  <div class="error-list" role="alert">
    <h3>{$t('validation.errors.title')}</h3>
    <ul>
      {#each errors as error}
        <li>
          {#if error.field && error.message}
            {$t('validation.fieldError', {
              field: $t(`field.${error.field}`),
              message: $t(`error.${error.message}`),
            })}
          {:else}
            {$t(`error.${error.code}`, error.params)}
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
```

## Best Practices

### ✅ Do

- Use `$t()` for all user-visible text
- Follow consistent key naming conventions
- Use descriptive variable names in interpolation
- Test with RTL languages during development
- Use logical CSS properties (`margin-inline-start` vs `margin-left`)
- Include context in translation keys when meaning is ambiguous

### ❌ Don't

- Hardcode any user-facing text
- Use physical CSS properties (`left`, `right`) for layout
- Assume text direction in component logic
- Split sentences across multiple translation keys
- Use generic keys like `text1`, `message2`
- Translate the same concept with different keys

## Translation Workflow

### For Developers

1. **Add translation calls**: Use `$t('key')` in components
2. **Extract strings**: Run `npm run i18n:extract` to update .po files
3. **Test with pseudo-locale**: Verify UI handles longer text
4. **Build translations**: Run `npm run i18n:build` before deployment

### For Translators

1. **Use standard tools**: Poedit, Lokalize, or other gettext editors
2. **Edit .po files**: Located in `locales/` directory
3. **Test context**: Review strings in actual application
4. **Maintain consistency**: Use project glossary for terminology

## Storage & Performance

### Translation Loading

- **ZIP compression**: All 7 languages compressed to ~20-30KB
- **First-run extraction**: Extracts to storage with 'locales' workspace ID
- **Offline-first**: No network dependency after initial load
- **Version-based updates**: Re-extracts when app version changes

### Caching Strategy

- **Storage integration**: Uses existing OPFS/IndexedDB system
- **Automatic fallback**: English bundled for immediate availability
- **Locale persistence**: User selection stored across sessions

## Accessibility Integration

All translation patterns are designed to work seamlessly with screen readers and keyboard navigation:

```svelte
<!-- Proper ARIA labeling with translations -->
<button aria-label={$t('action.save.description')} aria-describedby="save-status">
  {$t('action.save')}
</button>

<div id="save-status" aria-live="polite">
  {#if saving}
    {$t('status.saving')}
  {:else if saved}
    {$t('status.saved')}
  {/if}
</div>
```

## Testing Internationalization

### Component Testing

```typescript
import { render } from '@testing-library/svelte';
import { setLocale } from '$lib/i18n';
import MyComponent from './MyComponent.svelte';

test('renders in German', async () => {
  await setLocale('de');
  const { getByText } = render(MyComponent);
  expect(getByText('Speichern')).toBeInTheDocument();
});
```

### RTL Testing

```typescript
test('handles RTL layout correctly', async () => {
  await setLocale('ar');
  const { container } = render(MyComponent);
  expect(container.firstChild).toHaveAttribute('dir', 'rtl');
});
```

This system ensures consistent, maintainable internationalization across the entire EDITME application while providing excellent performance and user experience in all supported languages.
