# CSS Design System for EDITME.html EPUB Editor

## Overview

This document describes a comprehensive CSS architecture designed to maximize style reuse while minimizing CSS bundle size. The system is optimized for Svelte's component model and provides a scalable foundation for the EPUB editor interface.

## Design Philosophy

### Core Principles

1. **Design Tokens First** - All design decisions flow from centralized CSS custom properties
2. **Component Scoped by Default** - Leverage Svelte's built-in CSS scoping for component styles
3. **Utilities for Common Patterns** - Atomic utility classes for frequent layout and styling needs
4. **Theme-Aware Everything** - Light/dark mode and extensible theming built into the foundation
5. **Performance Optimized** - Minimal CSS through strategic organization and tooling

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
│   ├── spacing.css        # Spacing scale and layout tokens
│   ├── typography.css     # Font families, sizes, weights, line heights
│   ├── elevation.css      # Shadows and z-index layers
│   ├── motion.css         # Animation durations and easings
│   └── index.css          # Exports all tokens
├── themes/                # Theme implementations
│   ├── light.css          # Light theme variable overrides
│   ├── dark.css           # Dark theme variable overrides
│   ├── theme-base.css     # Theme switching mechanism
│   └── index.css          # Theme system exports
├── utilities/             # Atomic utility classes
│   ├── layout.css         # Display, position, flexbox, grid
│   ├── spacing.css        # Margin, padding utilities
│   ├── typography.css     # Text styling utilities
│   ├── colors.css         # Color and background utilities
│   ├── borders.css        # Border and border-radius utilities
│   ├── interactive.css    # Focus, hover, disabled states
│   └── index.css          # All utilities export
├── components/            # Shared component patterns
│   ├── buttons.css        # Button style patterns
│   ├── forms.css          # Form element patterns
│   ├── panels.css         # Panel and card patterns
│   ├── navigation.css     # Navigation component patterns
│   └── index.css          # Component pattern exports
└── index.css              # Main stylesheet (imports all systems)
```

## Design Token System

### Token Categories

#### 1. Color Tokens

```css
/* Primitive colors - neutral palette */
--color-neutral-50: #fafafa;
--color-neutral-100: #f5f5f5;
/* ... full neutral scale ... */
--color-neutral-950: #0a0a0a;

/* Brand colors */
--color-primary-50: #eff6ff;
/* ... primary scale ... */
--color-primary-950: #1e3a8a;

/* Semantic colors - derived from primitives */
--color-bg-primary: var(--color-neutral-50);
--color-bg-secondary: var(--color-neutral-100);
--color-text-primary: var(--color-neutral-900);
--color-text-secondary: var(--color-neutral-600);
--color-border-default: var(--color-neutral-200);
--color-accent: var(--color-primary-600);
```

#### 2. Spacing Tokens

```css
/* Spacing scale (0.25rem base unit) */
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */
--space-10: 2.5rem; /* 40px */
--space-12: 3rem; /* 48px */
--space-16: 4rem; /* 64px */
--space-20: 5rem; /* 80px */
--space-24: 6rem; /* 96px */

/* Layout-specific spacing */
--layout-sidebar-width: 250px;
--layout-sidebar-collapsed: 40px;
--layout-content-padding: var(--space-6);
--layout-panel-gap: var(--space-4);
```

#### 3. Typography Tokens

```css
/* Font families */
--font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

/* Font sizes (modular scale) */
--text-xs: 0.75rem; /* 12px */
--text-sm: 0.875rem; /* 14px */
--text-base: 1rem; /* 16px */
--text-lg: 1.125rem; /* 18px */
--text-xl: 1.25rem; /* 20px */
--text-2xl: 1.5rem; /* 24px */
--text-3xl: 1.875rem; /* 30px */

/* Line heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* Font weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

#### 4. Elevation Tokens

```css
/* Shadow levels */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);

/* Z-index layers */
--z-base: 0;
--z-raised: 10;
--z-dropdown: 1000;
--z-modal: 1100;
--z-tooltip: 1200;
--z-toast: 1300;
```

#### 5. Accessibility Tokens

```css
/* Focus indicators - WCAG 2.1 AA compliant */
--color-focus: var(--color-primary-600);
--color-focus-ring: var(--color-primary-500);
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
--focus-ring-style: solid;

/* High contrast mode support */
--color-forced-bg: Canvas;
--color-forced-text: CanvasText;
--color-forced-border: ButtonBorder;
--color-forced-link: LinkText;

/* Motion preferences */
--duration-instant: 0ms;
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;

/* Reduced motion overrides */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
  }
}

/* Screen reader utilities */
--sr-only: {
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
```

#### 6. Internationalization Tokens

```css
/* Direction-aware layout */
--layout-direction: ltr; /* Default, overridden by [dir="rtl"] */

/* RTL-aware spacing (automatically flipped in RTL) */
--space-inline-start: var(--space-4);
--space-inline-end: var(--space-2);

/* Typography for international scripts */
--font-arabic: 'Noto Sans Arabic', 'Arabic UI Text', sans-serif;
--font-hebrew: 'Noto Sans Hebrew', 'Hebrew UI Text', sans-serif;
--font-cjk: 'Noto Sans CJK', 'PingFang SC', 'Hiragino Sans GB', sans-serif;

/* Line height adjustments for different scripts */
--leading-arabic: 1.75; /* Accommodates diacritics */
--leading-cjk: 1.6; /* Optimal for CJK characters */
--leading-latin: 1.5; /* Standard for Latin scripts */

/* Text direction utilities */
--text-align-start: left; /* Overridden in RTL */
--text-align-end: right; /* Overridden in RTL */

/* RTL layout overrides */
[dir="rtl"] {
  --layout-direction: rtl;
  --text-align-start: right;
  --text-align-end: left;
}
```

## Theme System

### Theme Architecture

The theme system uses CSS custom properties and data attributes for switching:

```css
/* Base theme variables in :root */
:root {
  --color-bg-primary: var(--color-neutral-50);
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

- **Atomic Classes** - Single responsibility utilities (`.text-sm`, `.p-4`)
- **Responsive Variants** - Breakpoint-specific utilities (`.md:text-lg`)
- **State Variants** - Hover, focus, disabled states (`.hover:bg-primary`)
- **Minimal Set** - Only include utilities that are frequently used

### Common Utility Patterns

#### Logical Properties for RTL Support

```css
/* Spacing utilities - RTL-aware using logical properties */
.p-4 {
  padding: var(--space-4);
}

/* Inline (horizontal) spacing - automatically flips in RTL */
.px-4 {
  padding-inline: var(--space-4);
}
.ps-4 {
  padding-inline-start: var(--space-4);
}
.pe-4 {
  padding-inline-end: var(--space-4);
}

/* Block (vertical) spacing - consistent in all directions */
.py-4 {
  padding-block: var(--space-4);
}
.pt-4 {
  padding-block-start: var(--space-4);
}
.pb-4 {
  padding-block-end: var(--space-4);
}

/* Margin utilities with logical properties */
.mx-auto {
  margin-inline: auto;
}
.ms-4 {
  margin-inline-start: var(--space-4);
}
.me-4 {
  margin-inline-end: var(--space-4);
}

/* Legacy physical properties for backward compatibility */
.px-4-legacy {
  padding-left: var(--space-4);
  padding-right: var(--space-4);
}
```

#### Layout Utilities

```css
/* Flexbox utilities */
.flex {
  display: flex;
}
.flex-col {
  flex-direction: column;
}
.items-center {
  align-items: center;
}
.justify-between {
  justify-content: space-between;
}

/* Direction-aware positioning */
.inset-inline-0 {
  inset-inline: 0;
}
.start-0 {
  inset-inline-start: 0;
}
.end-0 {
  inset-inline-end: 0;
}

/* Text alignment using logical properties */
.text-start {
  text-align: start;
}
.text-end {
  text-align: end;
}
.text-center {
  text-align: center;
}
```

#### Typography Utilities

```css
/* Font size utilities */
.text-sm {
  font-size: var(--text-sm);
}
.font-medium {
  font-weight: var(--font-medium);
}
.leading-normal {
  line-height: var(--leading-normal);
}

/* International typography */
.font-arabic {
  font-family: var(--font-arabic);
  line-height: var(--leading-arabic);
}
.font-hebrew {
  font-family: var(--font-hebrew);
  line-height: var(--leading-arabic);
}
.font-cjk {
  font-family: var(--font-cjk);
  line-height: var(--leading-cjk);
}
```

#### Accessibility Utilities

```css
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

.sr-only-focusable:focus,
.sr-only-focusable:active {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: inherit;
}

/* Focus utilities */
.focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus);
  outline-offset: var(--focus-ring-offset);
}

/* High contrast mode utilities */
@media (prefers-contrast: high) {
  .high-contrast-border {
    border: 2px solid;
  }
  .high-contrast-text {
    color: var(--color-forced-text);
    background-color: var(--color-forced-bg);
  }
}

/* Motion utilities */
.motion-reduce {
  animation: none !important;
  transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .motion-safe {
    animation: none !important;
    transition: none !important;
  }
}
```

#### Color Utilities

```css
/* Color utilities */
.text-primary {
  color: var(--color-text-primary);
}
.bg-secondary {
  background-color: var(--color-bg-secondary);
}

/* Focus-aware color utilities */
.focus\:text-primary:focus-visible {
  color: var(--color-text-primary);
}
.focus\:bg-primary:focus-visible {
  background-color: var(--color-bg-primary);
}
```

## Component CSS Patterns

### Accessible & International Component Patterns

#### Accessibility-First Button Component

```svelte
<!-- AccessibleButton.svelte -->
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
  class="btn btn--{variant} btn--{size}"
  class:btn--disabled={disabled}
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedBy}
  on:click
>
  <slot />
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
    background-color: var(--color-accent);
    color: var(--color-text-inverse);
    
    &:hover:not(.btn--disabled) {
      background-color: var(--color-primary-700);
    }
  }

  .btn--secondary {
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-default);
    
    &:hover:not(.btn--disabled) {
      background-color: var(--color-bg-tertiary);
    }
  }

  .btn--danger {
    background-color: var(--color-danger-600);
    color: var(--color-text-inverse);
    
    &:hover:not(.btn--disabled) {
      background-color: var(--color-danger-700);
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
    box-shadow: var(--shadow-md);
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
  export let direction: 'ltr' | 'rtl' | 'auto' = 'auto';
  export let title: string;
  export let collapsible = false;
  export let collapsed = false;
</script>

<div 
  class="panel" 
  dir={direction}
  class:panel--rtl={direction === 'rtl'}
>
  <header class="panel__header">
    <h2 class="panel__title">{title}</h2>
    {#if collapsible}
      <button 
        class="panel__toggle"
        aria-expanded={!collapsed}
        aria-controls="panel-content"
      >
        <span class="sr-only">
          {collapsed ? 'Expand' : 'Collapse'} {title}
        </span>
        <svg class="panel__icon" class:panel__icon--rotated={collapsed}>
          <!-- Chevron icon -->
        </svg>
      </button>
    {/if}
  </header>
  
  <div 
    id="panel-content"
    class="panel__content"
    class:panel__content--collapsed={collapsed}
  >
    <slot />
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

## Integration with Layout System

### Layout Component CSS

The Layout System (Feature 06) will use this design system:

```svelte
<!-- LayoutManager.svelte -->
<style>
  .app-layout {
    display: grid;
    grid-template-columns: var(--layout-sidebar-width) 1fr;
    height: 100vh;
    background-color: var(--color-bg-primary);
  }

  .sidebar {
    background-color: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border-default);
    transition: width var(--duration-normal) ease;
  }

  .sidebar--collapsed {
    width: var(--layout-sidebar-collapsed);
  }

  .main-content {
    display: flex;
    min-width: 0;
  }

  .resize-handle {
    width: 4px;
    background-color: var(--color-border-default);
    cursor: col-resize;
    transition: background-color var(--duration-fast) ease;
  }

  .resize-handle:hover {
    background-color: var(--color-accent);
  }
</style>
```

## Development Workflow

### 1. Adding New Components (Accessibility & i18n First)

1. **Create component** in appropriate directory under `src/lib/components/`
2. **Include accessibility props** following standard conventions:
   ```typescript
   export let ariaLabel: string | undefined = undefined;
   export let ariaDescribedBy: string | undefined = undefined;
   export let role: string | undefined = undefined;
   ```
3. **Use logical properties** in Svelte `<style>` blocks with design tokens
4. **Add focus management** using accessibility design tokens
5. **Test with screen readers** and keyboard navigation
6. **Validate RTL layout** by temporarily setting `dir="rtl"`
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
- [ ] **RTL layout** - Use logical properties, test with `dir="rtl"`

### 2. Adding New Utilities (Logical Properties First)

1. **Identify frequently repeated CSS patterns**
2. **Use logical properties** for directional utilities (prefer `margin-inline` over `margin-left/right`)
3. **Add atomic utility classes** to appropriate file in `src/styles/utilities/`
4. **Follow naming conventions** (prefer Tailwind-style naming with logical property awareness)
5. **Include accessibility variants** (focus states, high contrast support)
6. **Update utility exports** in `src/styles/utilities/index.css`

#### Utility Development Guidelines

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
2. **Test with RTL languages** by setting `dir="rtl"` on root element
3. **Include appropriate font families** for target languages
4. **Adjust line heights** for different scripts (Arabic, CJK, etc.)
5. **Validate icon positioning** in RTL layouts
6. **Test text expansion** with longer translated strings

#### i18n Testing Checklist

- [ ] **RTL Layout** - Test with `dir="rtl"` attribute
- [ ] **Text Expansion** - Test with 150% longer text strings
- [ ] **Font Rendering** - Verify international fonts load correctly
- [ ] **Icon Mirroring** - Directional icons flip appropriately
- [ ] **Number Formatting** - Respect locale-specific number formats

## File Import Strategy

### Main App CSS (`src/app.css`)

```css
/* Import design system */
@import './styles/index.css';

/* Global styles */
body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  line-height: var(--leading-normal);
}

/* Ensure all elements use border-box */
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

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

1. **Tree Shaking** - Only import utilities that are actually used
2. **Critical CSS** - Inline critical styles, load non-critical asynchronously
3. **PostCSS Pipeline** - Minimize and optimize CSS during build
4. **Scoped Styles** - Svelte automatically scopes component CSS

### Runtime Performance

1. **CSS Custom Properties** - Efficient theme switching without re-parsing
2. **Hardware Acceleration** - Use `transform` and `opacity` for animations
3. **Minimal Repaints** - Structure CSS to minimize layout thrashing
4. **Efficient Selectors** - Avoid deep nesting and complex selectors

## Tool Integration

### PostCSS Configuration

```javascript
// postcss.config.js
export default {
  plugins: {
    'postcss-import': {},
    'postcss-custom-properties': {},
    autoprefixer: {},
    cssnano: process.env.NODE_ENV === 'production' ? {} : false,
  },
};
```

### Vite CSS Processing

```javascript
// vite.config.ts CSS configuration
export default defineConfig({
  css: {
    postcss: './postcss.config.js',
    preprocessorOptions: {
      scss: {
        additionalData: `@import './src/styles/tokens/index.css';`,
      },
    },
  },
});
```

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

- **RTL Layout Testing**: Visual regression testing for RTL layouts using `dir="rtl"`
- **Text Expansion Testing**: UI handles 150% text expansion without breaking
- **Font Rendering**: International fonts (Arabic, Hebrew, CJK) render correctly
- **Icon Direction**: Directional icons and layouts flip appropriately in RTL
- **Number & Date Formatting**: Locale-specific formatting works correctly

### Performance Testing

- CSS bundle size monitoring
- Runtime CSS performance profiling
- Memory usage testing for large component trees

## Migration Strategy

### From Current CSS

1. **Audit Current Styles** - Identify patterns and duplications
2. **Extract Tokens** - Convert hardcoded values to design tokens
3. **Create Utilities** - Replace common patterns with utility classes
4. **Refactor Components** - Move to new CSS architecture gradually
5. **Theme Integration** - Add theme support to existing components

### Backwards Compatibility

- Keep existing CSS files during migration
- Gradually replace old patterns with new system
- Ensure no visual regressions during transition

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

This CSS design system provides a solid foundation for building consistent, maintainable, and performant styles in the EDITME.html EPUB editor while leveraging Svelte's strengths and supporting the application's theming and layout requirements.
