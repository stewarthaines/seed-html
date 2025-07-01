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
.text-start {
  text-align: start;
}
.text-end {
  text-align: end;
}
.float-start {
  float: inline-start;
}
.float-end {
  float: inline-end;
}
```

#### Updated Utility Classes

Extend `src/styles/utilities/layout.css` with RTL-aware utilities:

```css
/* Directional positioning */
.inset-inline-0 {
  inset-inline: 0;
}
.inset-block-0 {
  inset-block: 0;
}
.start-0 {
  inset-inline-start: 0;
}
.end-0 {
  inset-inline-end: 0;
}

/* Margin utilities */
.m-inline-auto {
  margin-inline: auto;
}
.ms-4 {
  margin-inline-start: var(--space-4);
}
.me-4 {
  margin-inline-end: var(--space-4);
}

/* Padding utilities */
.ps-4 {
  padding-inline-start: var(--space-4);
}
.pe-4 {
  padding-inline-end: var(--space-4);
}
```

### Phase 2: Component Accessibility Patterns (2-3 days)

No custom components, just document good practice.

### Phase 3: Internationalization Framework (3-4 days)

#### Gettext-based Translation System

**Overview**: Professional translation workflow with ZIP compression for EPUB embedding.

**Languages**: `[en, de, ka, ar, he, zh-Hant, ja]` - Covers multiple writing systems including RTL support.

**Architecture**:
- **Translation calls**: `t('text')` function-based approach throughout components
- **File structure**: Flat .po files in `locales/` directory for translator simplicity
- **Build workflow**: npm-based tools for extraction and conversion
- **Runtime optimization**: ZIP-compressed translations for minimal EPUB embedding overhead

#### Technical Implementation

**Package Dependencies**:
```bash
npm install --save-dev gettext-extractor po2json
```

**npm Scripts**:
```json
{
  "i18n:extract": "node build-scripts/i18n-extract.js",
  "i18n:convert": "node build-scripts/i18n-convert.js", 
  "i18n:compress": "node build-scripts/i18n-compress.js",
  "i18n:build": "npm run i18n:extract && npm run i18n:convert && npm run i18n:compress"
}
```

**File Structure**:
```
locales/
├── en.po      # Source (English)
├── de.po      # German
├── ka.po      # Georgian  
├── ar.po      # Arabic (RTL)
├── he.po      # Hebrew (RTL)
├── zh-Hant.po # Traditional Chinese
└── ja.po      # Japanese

build-scripts/
├── i18n-extract.js   # Extract t() calls from Svelte files
├── i18n-convert.js   # Convert .po to .json files
└── i18n-compress.js  # Create translations.zip

src/lib/i18n/
├── index.ts     # Main translation runtime
├── loader.ts    # ZIP extraction & storage integration
├── types.ts     # TypeScript definitions
└── stores/
    └── locale.ts # Svelte stores for locale management
```

**Runtime Loading Strategy**:
- **ZIP approach**: All translations compressed at build time (`translations.zip`)
- **First-run extraction**: Extract all locales to storage with 'locales' workspace ID
- **Version-based updates**: Re-extract when app version changes
- **English fallback**: Bundled English for immediate availability
- **Storage integration**: Uses existing OPFS/IndexedDB storage system

**Translation Usage Pattern**:
```svelte
<script>
  import { t } from '$lib/i18n';
</script>

<!-- Basic translation -->
<button>{t('Save file')}</button>

<!-- With interpolation -->
<span>{t('Found {count} items', {count: items.length})}</span>

<!-- With pluralization (gettext-extractor features) -->
<span>{t('{count} item', '{count} items', count)}</span>
```

**Locale Direction Detection**:
```typescript
// Automatic RTL detection for Arabic, Hebrew
const localeConfig = {
  'ar': { direction: 'rtl', name: 'العربية' },
  'he': { direction: 'rtl', name: 'עברית' },
  'en': { direction: 'ltr', name: 'English' },
  // ... other locales
};
```

**Key Benefits for EPUB Embedding**:
- **Size optimization**: Only ~20-30KB compressed vs 100-200KB raw for all 7 languages
- **Professional workflow**: Standard .po files for translator tools (Poedit, etc.)
- **Runtime efficiency**: No reactive store overhead, simple function calls
- **Standard tooling**: Works with existing gettext ecosystem
- **Offline-first**: All translations available without network dependency

## API Design

### RTL Layout Manager

```typescript
// src/lib/stores/direction.ts
import { derived } from 'svelte/store';
import { currentLocale, locales } from '../i18n';

export const documentDirection = derived([currentLocale, locales], ([$currentLocale, $locales]) => {
  const locale = $locales[$currentLocale];
  return locale?.direction || 'ltr';
});

export const applyDirectionToDocument = (direction: 'ltr' | 'rtl') => {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = direction;
    document.documentElement.setAttribute('data-direction', direction);
  }
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

   <button aria-label={ariaLabel} class="btn" on:click>
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

- Install and configure gettext npm packages (`gettext-extractor`, `po2json`)
- Create build scripts for string extraction and .po/.json conversion  
- Set up .po file structure for all 7 languages
- Implement translation runtime system with `t()` function
- Create ZIP-based translation loader with storage integration
- Add locale direction detection for RTL languages
- Integrate with existing storage system using 'locales' workspace ID
- Add app version-based cache invalidation

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
