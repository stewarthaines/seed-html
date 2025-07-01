# CSS Accessibility Guidelines

This guide documents how to use the design system's accessibility tokens and utilities for consistent, accessible styling.

## Accessibility Tokens

The design system provides built-in accessibility tokens in `src/styles/tokens/`. Here's how to use them effectively:

### Focus Indicators

Located in `tokens/focus.css`:

```css
/* Available tokens */
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
--focus-ring-style: solid;
--color-focus: var(--blue-500);
--color-focus-ring: var(--color-focus);
```

**Usage:**

```css
/* Consistent focus styles across all interactive elements */
.interactive-element:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}

/* Remove default outline, replace with design system version */
button:focus {
  outline: none;
}

button:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

### Touch Targets

Minimum touch target size for mobile accessibility:

```css
/* Token */
--touch-target-min: 44px;

/* Usage */
.icon-button {
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

### High Contrast Mode

The design system includes forced-colors tokens for Windows High Contrast Mode:

```css
/* Available forced-color tokens */
--color-forced-primary: CanvasText;
--color-forced-bg: Canvas;
--color-forced-border: CanvasText;

/* Usage */
@media (prefers-contrast: high) {
  .card {
    border: 2px solid var(--color-forced-border);
    background: var(--color-forced-bg);
    color: var(--color-forced-primary);
  }
}
```

### Screen Reader Only Content

For content that should only be available to screen readers:

```css
/* Utility class */
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

/* Usage in Svelte */
<span class="sr-only">Opens in new window</span>
```

## Color Contrast

Use semantic color tokens that maintain proper contrast ratios:

```css
/* Text colors with guaranteed contrast */
color: var(--color-text-primary);    /* High contrast with backgrounds */
color: var(--color-text-secondary);  /* Medium contrast, not for small text */
color: var(--color-text-muted);      /* Low contrast, use sparingly */

/* Interactive states */
.button {
  background: var(--color-primary);  /* Meets contrast requirements */
  color: var(--color-primary-text); /* Guaranteed readable on primary bg */
}
```

## Motion Preferences

Respect user motion preferences:

```css
/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Safe transitions that respect preferences */
.element {
  transition: transform 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .element {
    transition: none;
  }
}
```

## Focus Management Patterns

### Skip Links

Style skip links to be hidden until focused:

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-4);
  text-decoration: none;
  border-radius: var(--radius-md);
}

.skip-link:focus {
  top: var(--space-2);
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

### Focus Within

For showing focus state on parent elements:

```css
.form-group:focus-within {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 1px var(--color-focus);
}
```

## Component Examples

### Accessible Button Styles

```css
.button {
  /* Minimum touch target */
  min-height: var(--touch-target-min);
  padding: var(--space-2) var(--space-4);
  
  /* Remove default focus, add custom */
  &:focus {
    outline: none;
  }
  
  &:focus-visible {
    outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus-ring);
    outline-offset: var(--focus-ring-offset);
  }
  
  /* Disabled state */
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border: 2px solid;
  }
}
```

### Accessible Form Fields

```css
.input {
  /* Minimum height for touch */
  min-height: var(--touch-target-min);
  
  /* Focus styles */
  &:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: 0 0 0 1px var(--color-focus);
  }
  
  /* Error state with ARIA */
  &[aria-invalid="true"] {
    border-color: var(--color-danger);
  }
}

.input-error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}
```

## Testing Your Styles

1. **Keyboard Navigation**: Tab through your interface - can you see focus clearly?
2. **Touch Targets**: On mobile, are all interactive elements easy to tap?
3. **Color Contrast**: Use browser DevTools to check contrast ratios
4. **High Contrast Mode**: Test in Windows High Contrast Mode
5. **Motion**: Test with `prefers-reduced-motion` enabled

## Don'ts

### ❌ Don't Remove Focus Indicators

```css
/* Never do this */
* {
  outline: none !important;
}
```

### ❌ Don't Use Color Alone

```css
/* Bad: Only color indicates state */
.error { color: red; }

/* Good: Multiple indicators */
.error {
  color: var(--color-danger);
  font-weight: var(--font-semibold);
  &::before { content: "⚠️ "; }
}
```

### ❌ Don't Forget Touch Targets

```css
/* Bad: Too small */
.tiny-button {
  padding: 2px 4px;
  font-size: 10px;
}

/* Good: Meets minimum */
.small-button {
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
}
```

Remember: The design system tokens are there to help! Use them consistently for an accessible experience.