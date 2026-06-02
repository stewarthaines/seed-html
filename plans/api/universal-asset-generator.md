# Universal Asset Files Documentation

## Overview

The Universal Asset system provides three static files that work identically across all languages and writing systems for sample EPUB content. These files are included in every generated sample EPUB to provide consistent styling and text processing.

### Static Files

- **`page.css`** - Universal CSS using logical properties that adapts to any locale
- **`transformText.js`** - Markdown-to-HTML conversion script
- **`transformDom.js`** - DOM processing script that adds IDs to H2 elements for navigation

### Implementation

These files are imported using Svelte's `?raw` import and included directly in sample EPUB assets during workspace creation.

## Asset Files

### page.css (Universal Styling)

Base stylesheet that adapts automatically to any locale through CSS logical properties and system fonts.

**Features:**

- **System Fonts**: Uses `system-ui` font stack for optimal per-locale rendering
- **Logical Properties**: All spacing and layout uses logical properties with physical fallbacks
- **Direction Inheritance**: Inherits text direction from HTML element
- **Progressive Enhancement**: Modern CSS with fallbacks for older EPUB readers
- **Accessibility**: WCAG 2.1 AA compliant styling with reduced motion and high contrast support

**File Location**: `src/assets/universal/page.css`

### transformText.js (Text Processing)

Converts Markdown to HTML without any locale-specific logic.

**Features:**

- **Markdown Processing**: Handles headers, bold/italic, links, lists, code blocks
- **Universal Compatibility**: Works identically for all scripts and languages
- **No Dependencies**: Pure JavaScript with no external libraries

**File Location**: `src/assets/universal/transformText.js`

**Exported Function**: `transformText(markdown: string): string`

### transformDom.js (DOM Processing)

Adds ID attributes to H2 elements for navigation linking.

**Features:**

- **Navigation Anchors**: Generates IDs from H2 text content for nav.xhtml linking
- **Universal Compatibility**: Works across all languages and scripts
- **Error Handling**: Graceful fallbacks with unique ID generation
- **Collision Prevention**: Ensures unique IDs within document

**File Location**: `src/assets/universal/transformDom.js`

**Exported Function**: `transformDOM(htmlDocument: Document): Document`

## Usage in Application

### Import Pattern

```typescript
import pageCSS from '../assets/universal/page.css?raw';
import transformTextJS from '../assets/universal/transformText.js?raw';
import transformDomJS from '../assets/universal/transformDom.js?raw';
```

### EPUB Integration

These assets are included in sample EPUBs during workspace creation:

```typescript
// In sample EPUB generation
await storage.writeTextFile(workspaceId, 'OEBPS/Styles/page.css', pageCSS);
await storage.writeTextFile(workspaceId, 'SOURCE/scripts/transformText.js', transformTextJS);
await storage.writeTextFile(workspaceId, 'SOURCE/scripts/transformDom.js', transformDomJS);
```

### Transform Pipeline Integration

The JavaScript files integrate with the text processing pipeline:

```
Plain text source → transformText.js → transformDom.js → XHTML → Preview
```

## CSS Logical Properties

The CSS uses a progressive enhancement strategy for maximum compatibility:

### Three-Tier Approach

1. **Physical Properties First**: Basic layout works in all EPUB readers
2. **RTL Fallbacks**: Manual `[dir="rtl"]` rules for systems without logical properties
3. **Feature Queries**: Modern logical properties for capable systems

### Example Pattern

```css
/* Physical properties for compatibility */
margin-left: auto;
margin-right: auto;
padding: 1em;

/* Modern logical properties with feature detection */
@supports (margin-inline: auto) {
  margin-left: unset;
  margin-right: unset;
  margin-inline: auto;
}
```

## EPUB Reader Compatibility

### Compatibility Overview

| Reader                 | Logical Properties | Feature Queries | Notes                      |
| ---------------------- | ------------------ | --------------- | -------------------------- |
| Apple Books            | ✅ Full            | ✅ Yes          | WebKit-based, best support |
| Adobe Digital Editions | ⚠️ Partial         | ❌ Limited      | Requires fallbacks         |
| Kobo                   | ✅ Good            | ✅ Yes          | WebKit-based               |
| Amazon Kindle          | ⚠️ Partial         | ⚠️ Limited      | Custom engine              |
| Google Play Books      | ✅ Good            | ✅ Yes          | Chromium-based             |
| Readium                | ✅ Excellent       | ✅ Yes          | Reference implementation   |

### Testing Strategy

- **Primary**: Adobe Digital Editions (weakest compatibility)
- **Standards**: Apple Books, Readium (best standards support)
- **Mobile**: Kobo, Google Play Books (mobile-focused)

## File Maintenance

### When to Update

- **CSS**: When adding new typography or layout patterns for sample content
- **Transform Scripts**: When extending markdown support or navigation features
- **All Files**: When EPUB standards change or compatibility issues are discovered

### Validation

These files should work universally without modification. Any locale-specific logic should be avoided to maintain their universal nature.

### Dependencies

- **Modern CSS Support**: Logical properties with fallbacks
- **Standard DOM API**: For transform script execution
- **EPUB 3.2 Compliance**: For reading system compatibility
