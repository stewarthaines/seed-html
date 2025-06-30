# 27 Internationalization & Accessibility

## Brainstorming

The EDITME.html app should be accessible for all users and should also be available in languages other than the primary development language of English. This feature is about making the app i18n ready in a Svelte-idiomatic way and providing localisations of the main interface.

## Overview

This feature establishes comprehensive internationalization (i18n) and accessibility (a11y) support for the EDITME EPUB editor. The implementation focuses on:

1. **Right-to-Left (RTL) Language Support** - Proper layout and text direction for Arabic, Hebrew, and other RTL languages
2. **Accessibility Compliance** - WCAG 2.1 AA compliance with proper semantic markup, keyboard navigation, and screen reader support
3. **Multi-language UI** - Internationalization framework for translating the interface to multiple languages
4. **Global Accessibility Foundation** - Patterns and guidelines that make all future components accessible by default

**Implementation Priority**: High - Setting up early prevents expensive retrofitting of complex components and ensures all new features (9-19) are built accessible from the start.

## Requirements

### Accessibility Requirements (WCAG 2.1 AA)

1. **Semantic Markup**
   - Proper heading hierarchy (h1-h6)
   - Meaningful link text and button labels
   - Form labels and error associations
   - Landmark regions (nav, main, aside, footer)

2. **Keyboard Navigation**
   - All interactive elements accessible via keyboard
   - Logical tab order throughout the application
   - Focus indicators visible and high contrast
   - Keyboard shortcuts for common actions

3. **Screen Reader Support**
   - ARIA labels, descriptions, and roles
   - Live regions for dynamic content updates
   - Proper table headers and data relationships
   - Form validation and error announcements

4. **Visual Accessibility**
   - Minimum 4.5:1 contrast ratio for normal text
   - Minimum 3:1 contrast ratio for large text and UI components
   - No information conveyed by color alone
   - Text resizable up to 200% without loss of functionality

### RTL Language Support

1. **Layout Direction**
   - Automatic layout mirroring for RTL languages
   - Proper text alignment and reading flow
   - Icon and UI element positioning adjustment
   - Sidebar and panel direction awareness

2. **Typography**
   - RTL-appropriate font selections
   - Correct text direction inheritance
   - Bidirectional text (bidi) support for mixed content
   - Proper line height and spacing for RTL scripts

### Internationalization

1. **String Externalization**
   - All user-facing text moved to translation files
   - Contextual translation support (singular/plural, gender)
   - Date, time, and number formatting per locale
   - Currency and measurement unit localization

2. **Locale Management**
   - Runtime locale switching without page reload
   - Browser preference detection and fallback
   - Persistent locale selection storage
   - Graceful fallback to default language

## Dependencies

- **CSS Design System** (✅ Complete) - Foundation for semantic tokens and utilities
- **Theme System** (✅ Complete) - Color and design token infrastructure
- **Layout System** (✅ Complete) - Component layout patterns to be made RTL-aware
- **Navigation Router** (✅ Complete) - View management system for accessible navigation

## Technical Approach

### Phase 1: CSS Foundation (1-2 days)

#### Logical Properties Migration

Replace physical properties with logical equivalents throughout the design system:

```css
/* Before (Physical Properties) */
.sidebar {
  margin-left: 1rem;
  border-right: 1px solid #ccc;
  text-align: left;
}

/* After (Logical Properties) */
.sidebar {
  margin-inline-start: 1rem;
  border-inline-end: 1px solid #ccc;
  text-align: start;
}
```

#### RTL-Aware Design Tokens

```css
/* Direction-aware spacing tokens */
--space-inline-start: var(--space-4);
--space-inline-end: var(--space-2);

/* RTL layout utilities */
.layout-rtl {
  direction: rtl;
}
.layout-ltr {
  direction: ltr;
}

/* Bidirectional utilities */
.text-start { text-align: start; }
.text-end { text-align: end; }
.float-start { float: inline-start; }
.float-end { float: inline-end; }
```

#### Updated Utility Classes

Extend `src/styles/utilities/layout.css` with RTL-aware utilities:

```css
/* Directional positioning */
.inset-inline-0 { inset-inline: 0; }
.inset-block-0 { inset-block: 0; }
.start-0 { inset-inline-start: 0; }
.end-0 { inset-inline-end: 0; }

/* Margin utilities */
.m-inline-auto { margin-inline: auto; }
.ms-4 { margin-inline-start: var(--space-4); }
.me-4 { margin-inline-end: var(--space-4); }

/* Padding utilities */
.ps-4 { padding-inline-start: var(--space-4); }
.pe-4 { padding-inline-end: var(--space-4); }
```

### Phase 2: Component Accessibility Patterns (2-3 days)

#### Accessible Component Template

```svelte
<!-- AccessibleButton.svelte -->
<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled: boolean = false;
  export let ariaLabel: string | undefined = undefined;
  export let ariaDescribedBy: string | undefined = undefined;
  export let type: 'button' | 'submit' | 'reset' = 'button';
</script>

<button
  {type}
  {disabled}
  class="btn btn-{variant} btn-{size}"
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedBy}
  on:click
>
  <slot />
</button>

<style>
  .btn {
    /* Accessible focus indicators */
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      border: 2px solid;
    }
  }
</style>
```

#### Form Accessibility Pattern

```svelte
<!-- AccessibleInput.svelte -->
<script lang="ts">
  export let id: string;
  export let label: string;
  export let value: string = '';
  export let error: string | undefined = undefined;
  export let required: boolean = false;
  export let type: string = 'text';
  
  $: errorId = error ? `${id}-error` : undefined;
  $: describedBy = error ? errorId : undefined;
</script>

<div class="form-field">
  <label for={id} class="form-label">
    {label}
    {#if required}<span class="required" aria-label="required">*</span>{/if}
  </label>
  
  <input
    {id}
    {type}
    {required}
    bind:value
    class="form-input"
    class:error={!!error}
    aria-describedby={describedBy}
    aria-invalid={!!error}
  />
  
  {#if error}
    <div id={errorId} class="form-error" role="alert">
      {error}
    </div>
  {/if}
</div>
```

#### Navigation Accessibility

```svelte
<!-- AccessibleNavigation.svelte -->
<nav aria-label="Main navigation" role="navigation">
  <ul class="nav-list" role="menubar">
    {#each navItems as item, index}
      <li role="none">
        <a
          href={item.href}
          class="nav-link"
          role="menuitem"
          aria-current={item.active ? 'page' : undefined}
          tabindex={index === 0 ? 0 : -1}
        >
          {item.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
```

### Phase 3: Internationalization Framework (3-4 days)

#### Svelte i18n Integration

```typescript
// src/lib/i18n/index.ts
import { writable, derived } from 'svelte/store';

export interface Locale {
  code: string;
  name: string;
  direction: 'ltr' | 'rtl';
  translations: Record<string, string>;
}

export const currentLocale = writable<string>('en');
export const locales = writable<Record<string, Locale>>({});

export const t = derived(
  [currentLocale, locales],
  ([$currentLocale, $locales]) => {
    return (key: string, params: Record<string, any> = {}) => {
      const locale = $locales[$currentLocale];
      if (!locale) return key;
      
      let translation = locale.translations[key] || key;
      
      // Simple parameter substitution
      Object.keys(params).forEach(param => {
        translation = translation.replace(`{${param}}`, params[param]);
      });
      
      return translation;
    };
  }
);

export const isRTL = derived(
  [currentLocale, locales],
  ([$currentLocale, $locales]) => {
    const locale = $locales[$currentLocale];
    return locale?.direction === 'rtl';
  }
);
```

#### Translation Files Structure

```json
// src/lib/i18n/locales/en.json
{
  "app.title": "EDITME EPUB Editor",
  "nav.workspace": "Workspace",
  "nav.metadata": "Metadata",
  "nav.manifest": "Manifest",
  "nav.spine": "Spine",
  "nav.navigation": "Navigation",
  "buttons.save": "Save",
  "buttons.cancel": "Cancel",
  "errors.required_field": "This field is required",
  "workspace.create_new": "Create New Workspace",
  "workspace.items_count": "{count} items"
}

// src/lib/i18n/locales/ar.json
{
  "app.title": "محرر الكتب الإلكترونية EDITME",
  "nav.workspace": "مساحة العمل",
  "nav.metadata": "البيانات الوصفية",
  "nav.manifest": "البيان",
  "nav.spine": "العمود الفقري",
  "nav.navigation": "التنقل",
  "buttons.save": "حفظ",
  "buttons.cancel": "إلغاء",
  "errors.required_field": "هذا الحقل مطلوب",
  "workspace.create_new": "إنشاء مساحة عمل جديدة",
  "workspace.items_count": "{count} عناصر"
}
```

## API Design

### Accessibility Store

```typescript
// src/lib/stores/accessibility.ts
import { writable } from 'svelte/store';

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderMode: boolean;
  keyboardNavigationEnabled: boolean;
  focusManagement: 'auto' | 'manual';
}

export const a11ySettings = writable<AccessibilitySettings>({
  reducedMotion: false,
  highContrast: false,
  screenReaderMode: false,
  keyboardNavigationEnabled: true,
  focusManagement: 'auto'
});

export const detectA11yPreferences = () => {
  if (typeof window !== 'undefined') {
    a11ySettings.update(settings => ({
      ...settings,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      highContrast: window.matchMedia('(prefers-contrast: high)').matches
    }));
  }
};
```

### RTL Layout Manager

```typescript
// src/lib/stores/direction.ts
import { derived } from 'svelte/store';
import { currentLocale, locales } from '../i18n';

export const documentDirection = derived(
  [currentLocale, locales],
  ([$currentLocale, $locales]) => {
    const locale = $locales[$currentLocale];
    return locale?.direction || 'ltr';
  }
);

export const applyDirectionToDocument = (direction: 'ltr' | 'rtl') => {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = direction;
    document.documentElement.setAttribute('data-direction', direction);
  }
};
```

### Accessibility Component Conventions

Instead of complex base classes, use simple Svelte conventions for accessibility:

```svelte
<!-- AccessibleButton.svelte - Standard Svelte Pattern -->
<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let ariaLabel: string | undefined = undefined;
  export let ariaDescribedBy: string | undefined = undefined;
  export let type: 'button' | 'submit' | 'reset' = 'button';
</script>

<button
  {type}
  {disabled}
  class="btn btn-{variant} btn-{size}"
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedBy}
  on:click
>
  <slot />
</button>

<style>
  .btn {
    /* Accessible focus indicators */
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      border: 2px solid;
    }
  }
</style>
```

#### Accessibility Prop Conventions

Establish consistent naming across all components:

- `ariaLabel?: string` - Accessible label
- `ariaLabelledBy?: string` - Reference to labeling element
- `ariaDescribedBy?: string` - Reference to description element
- `role?: string` - ARIA role override
- `tabIndex?: number` - Tab order control

#### Focus Management Utilities

Simple utilities for complex focus scenarios:

```typescript
// src/lib/utils/focus.ts
export const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  return () => container.removeEventListener('keydown', handleKeyDown);
};
```

## Testing Considerations

### Accessibility Testing

1. **Automated Testing**
   - Integration with `@axe-core/playwright` for automated a11y testing
   - WAVE browser extension testing in Storybook
   - Color contrast validation in design system

2. **Manual Testing**
   - Screen reader testing (NVDA, JAWS, VoiceOver)
   - Keyboard-only navigation testing
   - High contrast mode testing
   - Zoom/magnification testing (up to 400%)

3. **User Testing**
   - Testing with actual screen reader users
   - Keyboard navigation user testing
   - Cognitive accessibility testing

### RTL Testing

1. **Layout Testing**
   - Visual regression testing for RTL layouts
   - Cross-browser RTL rendering validation
   - Mixed content (LTR/RTL) testing

2. **Content Testing**
   - Bidirectional text rendering
   - Font rendering and line height in RTL languages
   - Icon and image positioning in RTL layouts

### Internationalization Testing

1. **Translation Testing**
   - Pseudo-localization for UI expansion testing
   - Translation completeness validation
   - Context-appropriate translation testing

2. **Locale Testing**
   - Date/time/number formatting validation
   - Currency and measurement display
   - Locale switching without data loss

## Implementation Notes

### Development Guidelines

#### Component Development Standards

1. **Always Include Accessibility**
   ```svelte
   <!-- ✅ Good: Standard Svelte accessibility pattern -->
   <script lang="ts">
     export let ariaLabel: string | undefined = undefined;
   </script>
   
   <button
     aria-label={ariaLabel}
     class="btn"
     on:click
   >
     <slot />
   </button>
   
   <!-- ❌ Bad: No accessibility considerations -->
   <div class="btn" on:click>
     <slot />
   </div>
   ```

2. **Use Logical Properties**
   ```css
   /* ✅ Good: RTL-aware */
   .sidebar {
     margin-inline-start: 1rem;
     border-inline-end: 1px solid #ccc;
   }
   
   /* ❌ Bad: LTR-only */
   .sidebar {
     margin-left: 1rem;
     border-right: 1px solid #ccc;
   }
   ```

3. **Externalize All Text**
   ```svelte
   <!-- ✅ Good: Translatable -->
   <button>{$t('buttons.save')}</button>
   
   <!-- ❌ Bad: Hardcoded -->
   <button>Save</button>
   ```

#### Testing Requirements

1. **Accessibility Tests**: Every component must pass axe-core validation
2. **RTL Tests**: Layout components must be tested in RTL mode
3. **Keyboard Tests**: Interactive components must support keyboard navigation
4. **Screen Reader Tests**: Complex components must be tested with screen readers

#### Browser Support

- **Modern Browsers**: Full support for logical properties and modern a11y features
- **Graceful Degradation**: Fallback patterns for older browsers
- **Progressive Enhancement**: Core functionality works without JavaScript

### Implementation Phases

#### Phase 1: Foundation (Days 1-2)
- Update CSS utilities to use logical properties
- Add RTL-aware design tokens
- Create accessibility utility functions
- Update existing components (LayoutManager, Sidebar, ThemeToggle)

#### Phase 2: Component Patterns (Days 3-5)
- Establish accessibility prop conventions
- Create accessible component templates and examples
- Implement focus management utilities for complex scenarios
- Create accessible form components

#### Phase 3: Internationalization (Days 6-9)
- Set up Svelte i18n framework
- Extract all hardcoded strings
- Create translation files for primary languages
- Implement locale switching

#### Phase 4: Testing & Validation (Days 10-12)
- Set up automated accessibility testing
- Create RTL test suite
- Implement internationalization tests
- Document component development guidelines

### Migration Strategy

1. **Existing Components**: Update gradually with backward compatibility
2. **New Components**: Must follow new patterns from start
3. **Breaking Changes**: Minimal, mostly internal CSS class changes
4. **Documentation**: Update Storybook with accessibility examples

This comprehensive approach ensures that all future components (Features 9-19) are built with accessibility and internationalization as core requirements, preventing expensive retrofitting and ensuring global usability from day one.