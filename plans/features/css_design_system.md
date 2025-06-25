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

```css
/* Spacing utilities */
.p-4 {
  padding: var(--space-4);
}
.px-4 {
  padding-left: var(--space-4);
  padding-right: var(--space-4);
}
.py-4 {
  padding-top: var(--space-4);
  padding-bottom: var(--space-4);
}

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

/* Typography utilities */
.text-sm {
  font-size: var(--text-sm);
}
.font-medium {
  font-weight: var(--font-medium);
}
.leading-normal {
  line-height: var(--leading-normal);
}

/* Color utilities */
.text-primary {
  color: var(--color-text-primary);
}
.bg-secondary {
  background-color: var(--color-bg-secondary);
}
```

## Component CSS Patterns

### Svelte Component CSS Structure

```svelte
<!-- ExampleComponent.svelte -->
<script>
  export let variant = 'primary';
  export let size = 'medium';
  export let disabled = false;
</script>

<button
  class="btn"
  class:btn--primary={variant === 'primary'}
  class:btn--secondary={variant === 'secondary'}
  class:btn--small={size === 'small'}
  class:btn--large={size === 'large'}
  class:btn--disabled={disabled}
  {disabled}
>
  <slot />
</button>

<style>
  /* Base button styles using design tokens */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all 150ms ease;

    /* Default size */
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
  }

  /* Variants */
  .btn--primary {
    background-color: var(--color-accent);
    color: var(--color-text-inverse);
  }

  .btn--secondary {
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-default);
  }

  /* Sizes */
  .btn--small {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
  }

  .btn--large {
    padding: var(--space-3) var(--space-6);
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

### 1. Adding New Components

1. Create component in appropriate directory under `src/lib/components/`
2. Use Svelte `<style>` blocks with design tokens
3. Add component-specific CSS patterns to `src/styles/components/` if reusable
4. Document component API and styling patterns

### 2. Adding New Utilities

1. Identify frequently repeated CSS patterns
2. Add atomic utility classes to appropriate file in `src/styles/utilities/`
3. Follow naming conventions (prefer Tailwind-style naming)
4. Update utility exports in `src/styles/utilities/index.css`

### 3. Extending Themes

1. Add new color tokens to `src/styles/tokens/colors.css`
2. Create theme variant file in `src/styles/themes/`
3. Update theme switching logic in theme store
4. Test all components with new theme

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

- Color contrast testing for all theme combinations
- Focus state testing for interactive elements
- Screen reader testing with semantic HTML + CSS

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
