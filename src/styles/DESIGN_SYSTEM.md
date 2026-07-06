# CSS Design System for SEED.html EPUB Editor

## Overview

This document describes a comprehensive CSS architecture designed to maximize style reuse while minimizing CSS bundle size. The system is optimized for Svelte's component model and provides a scalable foundation for the EPUB editor interface.

> **Related design docs (same folder):** [design-language.md](./design-language.md) (visual identity & principles) and [button-design-system.md](./button-design-system.md) (the `.btn-*` utility classes).

> **Lean by design:** the token and utility inventory is intentionally small — entries that nothing references are pruned at the source level (see [process/ICON_CSS_SIZE_REDUCTION.md](../../process/ICON_CSS_SIZE_REDUCTION.md)).
> Before referencing a token in new code, check it actually exists in `src/styles/` (grep for its declaration); if you need something that was pruned, re-add it deliberately rather than assuming a whole family exists.
> A real bug once shipped from referencing primary-scale color steps that were never defined — for accents, the safe tokens are `--color-interactive-primary` and `--color-bg-accent`.

## Design Philosophy

### Core Principles

1. **Design Tokens First** - All design decisions flow from centralized CSS custom properties
2. **Component Scoped by Default** - Leverage Svelte's built-in CSS scoping for component styles
3. **Utilities for Common Patterns** - Atomic utility classes for frequent layout and styling needs
4. **Theme-Aware Everything** - Light/dark mode and extensible theming built into the foundation
5. **Performance Optimized** - Minimal CSS through strategic organization and source-level pruning

### Svelte-Specific Optimizations

- Use Svelte's `<style>` blocks for component-specific CSS (automatically scoped)
- Use `class:` directives for conditional styling (better than string interpolation)
- Use `style:` directives for dynamic CSS properties
- Import utilities globally once, components handle their own styling

## Architecture Overview

```
src/styles/
├── tokens/                 # Design tokens (CSS custom properties)
│   ├── colors.css         # Color palette and semantic colors
│   ├── spacing.css        # Spacing scale, radii, focus/touch-target measurements
│   ├── typography.css     # Font families, sizes, weights, line heights
│   ├── elevation.css      # Shadows and z-index layers
│   ├── motion.css         # Animation durations, easings, transitions
│   └── index.css          # Imports all tokens
├── themes/                # Theme implementations
│   ├── theme-base.css     # Theme switching mechanism and global theme behaviors
│   ├── light.css          # Light theme variable overrides
│   ├── dark.css           # Dark theme variable overrides
│   └── index.css          # Theme system imports
├── utilities/             # Atomic utility classes
│   ├── layout.css         # Display, position, container, accessibility utilities
│   └── forms.css          # Form element styles and the .btn-* button classes
├── global.css             # Base element resets and global styles
├── app.css                # App shell styles (#app container, viewport)
└── index.css              # Main stylesheet (imports all of the above, in order)
```

## Design Token System

### Token Categories

#### 1. Color Tokens

```css
/* Primitive colors - neutral palette (Craigslist-inspired) */
--color-neutral-50: #ffffff;
--color-neutral-100: #f8f8f8;
/* ... full neutral scale through ... */
--color-neutral-900: #222222;

/* Brand primary (Craigslist link blue) - partial scale */
--color-primary-600: #0000ee;
--color-primary-700: #0000cc;

/* Semantic colors - derived from primitives */
--color-bg-primary: var(--color-white);
--color-bg-secondary: var(--color-craigslist-bg);
--color-text-primary: var(--color-neutral-900);
--color-text-secondary: var(--color-neutral-600);
--color-border-default: var(--color-craigslist-border);
--color-interactive-primary: var(--color-primary-600);

/* Brand accent - azure highlight for interactive affordances */
--color-accent: #0074d9;
--color-hover-accent: #0074d9; /* button-hover fill; AA with white text in both themes */
--color-on-accent: var(--color-white);
```

The primitive scales (`neutral`, `primary`, `success`, `warning`, `error`) are **partial** — only the steps something actually references exist, so never assume a step is defined without checking `tokens/colors.css`.
Always prefer semantic tokens over primitives: the surviving families cover backgrounds, text, borders, interactive states and surfaces (e.g. `--color-bg-primary`, `--color-text-secondary`, `--color-border-default`, `--color-interactive-primary`, `--color-surface-elevated` and their siblings), plus component tokens for buttons, inputs and the sidebar (e.g. `--color-button-primary-bg`, `--color-input-border`, `--color-sidebar-bg`), status colors (`--color-status-warning`, `--color-status-error`) and WCAG-AA validation colors (`--color-error-text`/`--color-error-bg`, `--color-success-text`/`--color-success-bg`, `--color-warning-text`/`--color-warning-bg`).
A block of compatibility aliases in `tokens/colors.css` (e.g. `--color-accent-primary`, `--color-bg-hover`, `--color-error`, `--color-warning`) maps legacy names onto the canonical tokens — don't extend it, use the canonical names in new code.

#### 2. Spacing Tokens

```css
/* Spacing scale (0.25rem base unit) - the scale stops at --space-8 */
--space-0-5: 0.125rem; /* 2px */
--space-1: 0.25rem; /* 4px */
--space-1-5: 0.375rem; /* 6px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */

/* Border radius */
--radius-xs: 0.0625rem; /* 1px */
--radius-sm: 0.125rem; /* 2px */
--radius-md: 0.1875rem; /* 3px */
--radius-lg: 0.25rem; /* 4px */
--radius-full: 9999px;
--radius-button: var(--radius-sm);
--radius-input: var(--radius-xs);

/* Component spacing */
--button-padding-inline: var(--space-2);
--button-padding-block: var(--space-1);
--button-gap: var(--space-1);
--form-field-spacing: var(--space-2);
```

There are no layout-dimension tokens (the old sidebar/panel width tokens are gone) — layout components size themselves in their own scoped styles.

#### 3. Typography Tokens

```css
/* Font families */
--font-sans: Helvetica, Arial, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;

/* Font sizes (14px base) */
--text-xs: 0.6875rem; /* 11px */
--text-sm: 0.8125rem; /* 13px */
--text-base: 0.875rem; /* 14px - base size */
--text-lg: 1rem; /* 16px */
--text-xl: 1.125rem; /* 18px */
--text-2xl: 1.25rem; /* 20px */
--text-3xl: 1.5rem; /* 24px */
--text-4xl: 1.875rem; /* 30px */

/* Line heights */
--leading-tight: 1.2;
--leading-normal: 1.4;
--leading-relaxed: 1.5;

/* Font weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

Semantic combinations map onto the size scale: `--text-heading-2xl` … `--text-heading-xs` (used by `global.css` for `h1`–`h6`), `--text-body-md`, and `--text-label-md`.
Component typography tokens: `--button-text-md`, `--button-text-sm`, `--button-font-weight`, `--input-text-size`, `--input-font-weight`, `--input-placeholder-weight`, and `--code-text-size`.
Link styling tokens: `--link-text-decoration`, `--link-text-decoration-hover`, `--link-underline-offset`; letter spacing has a single token, `--tracking-wide`.

#### 4. Elevation Tokens

```css
/* Shadow levels - sm and lg only */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-focus-primary: 0 0 0 3px rgba(59, 130, 246, 0.1);

/* Z-index layers */
--z-modal: 1300;
--z-toast: 1500;

/* Semantic elevation */
--elevation-card-raised: var(--shadow-sm);

/* Border width */
--border-width-1: 1px;
```

#### 5. Accessibility Tokens

```css
/* Focus indicators - WCAG 2.1 AA compliant */
--color-focus: var(--color-primary-600);
--color-focus-ring: var(--color-primary-500);
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
--focus-ring-style: solid;

/* High contrast mode support (system colors) */
--color-forced-bg: Canvas;
--color-forced-text: CanvasText;
--color-forced-border: ButtonBorder;
--color-forced-link: LinkText;
--color-forced-active: ActiveText;

/* Touch targets and screen readers */
--touch-target-min: 44px; /* WCAG AA minimum */
--sr-only-clip: rect(0, 0, 0, 0);
```

#### 6. Motion Tokens

```css
/* Durations */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-button-hover: var(--duration-fast);
--duration-theme-switch: var(--duration-normal);

/* Easing */
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-ui-out: var(--ease-out); /* for elements entering */
```

Pre-defined transition combinations: `--transition-colors`, `--transition-shadow`, `--transition-button`, and `--transition-theme` (see `tokens/motion.css` for the full values).
Under `prefers-reduced-motion: reduce` the durations shorten and `global.css`/`theme-base.css` disable transitions and animations outright.

#### 7. RTL Support

There are no dedicated i18n tokens.
RTL support comes from using CSS logical properties throughout (`padding-inline`, `margin-block-end`, `border-inline-start`, …) plus a `data-dir` attribute on the root element:

```css
/* global.css */
:root[data-dir='rtl'] {
  direction: rtl;
}
```

Direction-specific details override under `[data-dir='rtl']` — for example the `.select` dropdown arrow position in `utilities/forms.css`.

## Theme System

### Theme Architecture

The theme system uses CSS custom properties and data attributes for switching:

```css
/* Base theme variables in :root */
:root {
  --color-bg-primary: var(--color-white);
  --color-text-primary: var(--color-neutral-900);
}

/* Dark theme overrides */
[data-theme='dark'] {
  --color-bg-primary: var(--color-neutral-900);
  --color-text-primary: var(--color-neutral-50);
}
```

### Theme Integration with Svelte

```svelte
<!-- App.svelte or Layout component -->
<script>
  import { themeStore } from '$lib/stores/theme';
</script>

<div class="app" data-theme={$themeStore.current}>
  <!-- App content -->
</div>
```

## Utility Class System

### Utility Philosophy

- **Atomic Classes** - Single responsibility utilities (`.flex`, `.hidden`)
- **Minimal Set** - Only utilities that components actually reference exist; unreferenced classes are pruned
- **No variant system** - There are no responsive (`md:`) or state (`hover:`) utility variants; put those styles in component `<style>` blocks

### Utility Inventory

Everything below is defined in `src/styles/utilities/` — this is the complete set.

`layout.css`:

- **Display**: `.block`, `.inline-block`, `.inline`, `.flex`, `.inline-flex`, `.grid`, `.table`, `.hidden`
- **Position**: `.static`, `.fixed`, `.absolute`, `.relative`, `.sticky`
- **Flexbox**: `.flex-wrap`, `.flex-shrink`
- **Container**: `.container` (centered, responsive max-widths from 640px to 1536px)
- **Stacking**: `.isolate`
- **Accessibility**: `.sr-only`, `.focus-visible`, `.touch-target`

`forms.css`:

- **Form controls**: `.input`, `.textarea`, `.select`, `.checkbox`, `.radio`, `.label`, `.form-group`, `.field-error`, `.form-inline` (plus element styles for `fieldset`/`legend`)
- **Buttons**: `.btn` and its variants (`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-link`, `.btn-icon`, `.btn-icon-sm`, `.btn-icon-lg`, `.btn-sm`) — see [button-design-system.md](./button-design-system.md)

### Accessibility Utilities

```css
/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: var(--sr-only-clip);
  white-space: nowrap;
  border: 0;
}

/* Focus management */
.focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
  outline-offset: var(--focus-ring-offset);
}

/* Touch target sizing (WCAG AA compliance) */
.touch-target {
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
}
```

## Component CSS Patterns

### Toast notifications (fleeting messages)

For brief, non-blocking feedback ("Saved", "Nothing to import", "Copied") prefer a **toast** over an inline banner — it doesn't reflow layout and disappears on its own. This is the core style for fleeting information notices (originally prototyped by the publish-to-remote plugin).

- Show one with `showToast(text, type?, durationMs?)` from `$lib/stores/toast.svelte.ts` (`type` = `'info' | 'success' | 'error'`; auto-dismisses, default 4s).
- `<Toast />` is mounted once near the app root (`App.svelte`); don't add per-view copies.
- Style: fixed, bottom-centred, `z-index: var(--z-toast)`, a coloured `border-inline-start` accent using `--color-success-text`/`--color-success-bg` and `--color-error-text`/`--color-error-bg` (info uses `--color-interactive-primary` on `--color-surface-primary`), `--shadow-lg`.

Use inline banners/messages only for persistent state that must stay visible (e.g. the read-only EPUB banner), not for transient confirmations.

### Accessible & International Component Patterns

#### Accessibility-First Button Component

```svelte
<!-- AccessibleButton.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    ariaLabel?: string;
    ariaDescribedBy?: string;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    ariaLabel,
    ariaDescribedBy,
    type = 'button',
    onclick,
    children,
  }: Props = $props();
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="btn btn--{variant} btn--{size}"
  class:btn--disabled={disabled}
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedBy}
>
  {@render children?.()}
</button>

<style>
  /* Base button styles with accessibility */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-weight: var(--font-medium);
    cursor: pointer;

    /* RTL-aware spacing using logical properties */
    padding-inline: var(--space-4);
    padding-block: var(--space-2);

    /* Accessible transitions */
    transition: all var(--duration-fast) ease;

    /* Default size */
    font-size: var(--text-sm);

    /* Accessible focus indicators */
    &:focus-visible {
      outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
      outline-offset: var(--focus-ring-offset);
    }

    /* High contrast mode support */
    @media (prefers-contrast: high) {
      border: 2px solid var(--color-forced-border);
    }

    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      transition: none;
      &:hover:not(.btn--disabled) {
        transform: none;
      }
    }
  }

  /* Variants with WCAG contrast compliance */
  .btn--primary {
    background-color: var(--color-button-primary-bg);
    color: var(--color-button-primary-text);

    &:hover:not(.btn--disabled) {
      background-color: var(--color-button-primary-bg-hover);
    }
  }

  .btn--secondary {
    background-color: var(--color-button-secondary-bg);
    color: var(--color-button-secondary-text);
    border: 1px solid var(--color-button-secondary-border);

    &:hover:not(.btn--disabled) {
      background-color: var(--color-bg-tertiary);
    }
  }

  .btn--danger {
    background-color: var(--color-button-danger-bg);
    color: var(--color-button-danger-text);

    &:hover:not(.btn--disabled) {
      background-color: var(--color-button-danger-bg-hover);
    }
  }

  /* Sizes using logical properties */
  .btn--sm {
    padding-inline: var(--space-3);
    padding-block: var(--space-1);
    font-size: var(--text-xs);
  }

  .btn--lg {
    padding-inline: var(--space-6);
    padding-block: var(--space-3);
    font-size: var(--text-base);
  }

  /* States */
  .btn:hover:not(.btn--disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .btn--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

#### RTL-Aware Layout Component

```svelte
<!-- RTLAwarePanel.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    direction?: 'ltr' | 'rtl' | 'auto';
    title: string;
    collapsible?: boolean;
    collapsed?: boolean;
    children?: Snippet;
  }

  let {
    direction = 'auto',
    title,
    collapsible = false,
    collapsed = false,
  }: Props = $props();
</script>

<div class="panel" dir={direction} class:panel--rtl={direction === 'rtl'}>
  <header class="panel__header">
    <h2 class="panel__title">{title}</h2>
    {#if collapsible}
      <button class="panel__toggle" aria-expanded={!collapsed} aria-controls="panel-content">
        <span class="sr-only">
          {collapsed ? 'Expand' : 'Collapse'}
          {title}
        </span>
        <svg class="panel__icon" class:panel__icon--rotated={collapsed}>
          <!-- Chevron icon -->
        </svg>
      </button>
    {/if}
  </header>

  <div id="panel-content" class="panel__content" class:panel__content--collapsed={collapsed}>
    {@render children?.()}
  </div>
</div>

<style>
  .panel {
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);

    /* RTL-aware shadow */
    box-shadow: var(--shadow-sm);
  }

  .panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    /* RTL-aware padding */
    padding-inline: var(--space-4);
    padding-block: var(--space-3);

    border-block-end: 1px solid var(--color-border-default);
  }

  .panel__title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text-primary);

    /* RTL-aware text alignment */
    text-align: start;
  }

  .panel__toggle {
    display: flex;
    align-items: center;
    justify-content: center;

    /* RTL-aware positioning */
    margin-inline-start: auto;

    width: var(--space-8);
    height: var(--space-8);
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm);

    &:focus-visible {
      outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
      outline-offset: var(--focus-ring-offset);
    }
  }

  .panel__icon {
    width: var(--space-4);
    height: var(--space-4);
    transition: transform var(--duration-fast) ease;

    /* RTL-aware rotation */
    transform-origin: center;
  }

  .panel__icon--rotated {
    transform: rotate(180deg);
  }

  /* RTL-specific adjustments */
  .panel--rtl .panel__icon {
    transform: scaleX(-1);
  }

  .panel--rtl .panel__icon--rotated {
    transform: scaleX(-1) rotate(180deg);
  }

  .panel__content {
    padding-inline: var(--space-4);
    padding-block: var(--space-4);

    transition: all var(--duration-normal) ease;
  }

  .panel__content--collapsed {
    height: 0;
    padding-block: 0;
    overflow: hidden;
  }

  /* Screen reader utilities */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
```

## Development Workflow

### 1. Adding New Components (Accessibility & i18n First)

1. **Create component** in appropriate directory under `src/lib/components/`
2. **Include accessibility props** following standard conventions:
   ```typescript
   interface Props {
     ariaLabel?: string;
     ariaDescribedBy?: string;
     role?: string;
   }
   let { ariaLabel, ariaDescribedBy, role }: Props = $props();
   ```
3. **Use logical properties** in Svelte `<style>` blocks with design tokens
4. **Add focus management** using accessibility design tokens
5. **Test with screen readers** and keyboard navigation
6. **Validate RTL layout** by temporarily setting `data-dir="rtl"` on the root element
7. **Document component API** and accessibility features

#### Component Accessibility Checklist

- [ ] **Semantic HTML** - Use appropriate HTML elements (`button`, `nav`, `main`, etc.)
- [ ] **ARIA attributes** - Include necessary `aria-*` props
- [ ] **Focus indicators** - Use `--color-focus` and `--focus-ring-width` tokens
- [ ] **Keyboard navigation** - Support Tab, Enter, Space, Arrow keys as appropriate
- [ ] **Screen reader text** - Include `.sr-only` content where needed
- [ ] **Color contrast** - Ensure 4.5:1 ratio (3:1 for large text)
- [ ] **Motion preferences** - Respect `prefers-reduced-motion`
- [ ] **High contrast** - Test in high contrast mode
- [ ] **RTL layout** - Use logical properties, test with `data-dir="rtl"`

### 2. Adding New Utilities (Logical Properties First)

1. **Identify frequently repeated CSS patterns**
2. **Use logical properties** for directional utilities (prefer `margin-inline` over `margin-left/right`)
3. **Add atomic utility classes** to appropriate file in `src/styles/utilities/`
4. **Follow naming conventions** (prefer Tailwind-style naming with logical property awareness)
5. **Include accessibility variants** (focus states, high contrast support)
6. **Register new utility files** in the `@import` list in `src/styles/index.css`
7. **Make sure the utility is actually referenced** — unreferenced utilities get pruned in the next cleanup pass

#### Utility Development Guidelines

The classes below are illustrative patterns for utilities you might add — they are not part of the current inventory.

```css
/* ✅ Good: RTL-aware utility */
.ms-4 {
  margin-inline-start: var(--space-4);
}

/* ❌ Avoid: Physical property utility */
.ml-4 {
  margin-left: var(--space-4);
}

/* ✅ Good: Accessibility-aware utility */
.focus-ring:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
  outline-offset: var(--focus-ring-offset);
}
```

### 3. Extending Themes (Accessibility Compliant)

1. **Add new color tokens** to `src/styles/tokens/colors.css`
2. **Validate contrast ratios** meet WCAG 2.1 AA standards (4.5:1 normal, 3:1 large text)
3. **Create theme variant file** in `src/styles/themes/`
4. **Include high contrast mode** overrides
5. **Update theme switching logic** in theme store
6. **Test all components** with new theme
7. **Validate focus indicators** remain visible in all themes

#### Theme Accessibility Requirements

- **Contrast Ratios**: All text must meet WCAG 2.1 AA contrast requirements
- **Focus Indicators**: Must be visible against all background colors
- **High Contrast**: Support Windows High Contrast mode
- **Color Independence**: No information conveyed by color alone

### 4. Internationalization Integration

1. **Use logical properties** for all directional CSS
2. **Test with RTL languages** by setting `data-dir="rtl"` on the root element
3. **Include appropriate font families** for target languages
4. **Adjust line heights** for different scripts (Arabic, CJK, etc.)
5. **Validate icon positioning** in RTL layouts
6. **Test text expansion** with longer translated strings

#### i18n Testing Checklist

- [ ] **RTL Layout** - Test with `data-dir="rtl"` attribute
- [ ] **Text Expansion** - Test with 150% longer text strings
- [ ] **Font Rendering** - Verify international fonts load correctly
- [ ] **Icon Mirroring** - Directional icons flip appropriately
- [ ] **Number Formatting** - Respect locale-specific number formats

## File Import Strategy

### Application Entry Point (`src/main.ts`)

The design system is imported exactly once, in `src/main.ts`:

```typescript
import './styles/index.css';
```

`src/styles/index.css` imports the layers in order: tokens → themes → utilities → `global.css` (element resets, base typography, links, tables, code) → `app.css` (app shell).
Global element defaults (`body` font, `box-sizing`, headings, etc.) live in `src/styles/global.css` — there is no separate `src/app.css`.

### Component CSS Imports

```svelte
<!-- For components that need external CSS -->
<script>
  import './component-specific-styles.css';
</script>

<!-- But prefer inline <style> blocks for component styles -->
<style>
  /* Component styles using design tokens */
</style>
```

## Performance Considerations

### CSS Bundle Optimization

1. **Source-Level Pruning** - Unreferenced utilities and tokens are deleted from the source, not stripped at build time (see [process/ICON_CSS_SIZE_REDUCTION.md](../../process/ICON_CSS_SIZE_REDUCTION.md))
2. **Scoped Styles** - Svelte automatically scopes component CSS and prunes unused scoped selectors at compile time
3. **Single-File Build** - All CSS is inlined into `dist/index.html`; Vite minifies it during build

### Runtime Performance

1. **CSS Custom Properties** - Efficient theme switching without re-parsing
2. **Hardware Acceleration** - Use `transform` and `opacity` for animations
3. **Minimal Repaints** - Structure CSS to minimize layout thrashing
4. **Efficient Selectors** - Avoid deep nesting and complex selectors

## Testing Strategy

### Visual Regression Testing

- Storybook stories for all components with different themes
- Automated screenshot testing for component variants
- Cross-browser testing for CSS support

### Accessibility Testing

- **Automated Testing**: Integration with `@axe-core/playwright` for component accessibility validation
- **Color contrast testing**: All theme combinations must meet WCAG 2.1 AA standards (4.5:1 normal, 3:1 large text)
- **Focus state testing**: Interactive elements must have visible focus indicators using design tokens
- **Screen reader testing**: Validate with NVDA, JAWS, and VoiceOver
- **Keyboard navigation**: All functionality accessible via keyboard only
- **High contrast mode**: Components work in Windows High Contrast mode
- **Motion preferences**: Respect `prefers-reduced-motion` settings

### Internationalization Testing

- **RTL Layout Testing**: Visual regression testing for RTL layouts using `data-dir="rtl"`
- **Text Expansion Testing**: UI handles 150% text expansion without breaking
- **Font Rendering**: International fonts (Arabic, Hebrew, CJK) render correctly
- **Icon Direction**: Directional icons and layouts flip appropriately in RTL
- **Number & Date Formatting**: Locale-specific formatting works correctly

### Performance Testing

- CSS bundle size monitoring
- Runtime CSS performance profiling
- Memory usage testing for large component trees

## Future Considerations

### Extensibility

- Plugin system for additional theme variants
- Custom utility class generation
- Component library for common patterns
- Design token synchronization with design tools

### Advanced Features

- CSS-in-JS integration for complex dynamic styles
- Runtime theme generation
- Advanced animation systems
- Responsive design token system

## Documentation

### For Developers

- Component style guidelines in component README files
- Design token reference documentation
- Utility class documentation with examples
- Theme creation guide

### For Designers

- Design token values and usage guidelines
- Color palette and accessibility guidelines
- Typography scale and usage recommendations
- Spacing system documentation

This CSS design system provides a solid foundation for building consistent, maintainable, and performant styles in the SEED.html EPUB editor while leveraging Svelte's strengths and supporting the application's theming and layout requirements.
