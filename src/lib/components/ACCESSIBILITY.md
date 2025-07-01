# Component Accessibility Guidelines

This guide documents accessibility patterns for EDITME components, leveraging Svelte's built-in a11y features and native browser behavior.

## Core Principles

1. **Use Semantic HTML** - Let the browser do the heavy lifting
2. **Trust Svelte's A11y Warnings** - The compiler catches common issues
3. **Keep It Simple** - Avoid over-engineering ARIA
4. **Follow Existing Patterns** - Learn from ThemeToggle and Sidebar components

## Patterns by Example

### Button Accessibility

**Pattern from ThemeToggle.svelte:**

```svelte
<button
  type="button"
  class="theme-toggle"
  aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
  on:click={toggleTheme}
>
  <!-- Icon content -->
</button>
```

**Key Points:**
- Use real `<button>` elements (not divs with click handlers)
- Add `aria-label` for icon-only buttons
- Include `type="button"` to prevent form submission
- Focus styles handled by CSS (see below)

### Navigation Accessibility

**Pattern from Sidebar.svelte (View-Based SPA Navigation):**

```svelte
<script>
  import { layoutStore } from '$lib/stores/layout';
  
  $: activeSection = $layoutStore.sidebar.activeSection;
  
  const setSidebarSection = (sectionId) => {
    layoutStore.setSidebarSection(sectionId);
  };
</script>

<nav class="sidebar-nav" aria-label="Main navigation">
  {#each SIDEBAR_SECTIONS as section}
    <button
      class="sidebar-section"
      class:active={activeSection === section.id}
      on:click={() => setSidebarSection(section.id)}
      aria-current={activeSection === section.id ? 'page' : undefined}
      title={section.label}
    >
      {section.label}
    </button>
  {/each}
</nav>
```

**Key Points:**
- Use `<nav>` with descriptive `aria-label`
- Use `aria-current="page"` for active view (not URL-based)
- Buttons for view switching (not links with href)
- State managed through stores, not URL routing
- Active state determined by `layoutStore.sidebar.activeSection`

**Note:** This app uses view-based navigation (SPA), not URL routing. For traditional routing apps, use `<a>` elements with proper href attributes.

### Form Accessibility

**Basic Pattern:**

```svelte
<label for="email">Email Address</label>
<input
  id="email"
  type="email"
  required
  aria-describedby={error ? 'email-error' : undefined}
/>
{#if error}
  <span id="email-error" class="error">{error}</span>
{/if}
```

**Key Points:**
- Always associate labels with inputs
- Use native HTML5 validation where possible
- Connect error messages with `aria-describedby`
- Let the browser handle focus management

### Focus Indicators

**Pattern from existing components:**

```css
button:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

**Key Points:**
- Use `:focus-visible` for keyboard-only focus
- Apply design system tokens for consistency
- Ensure sufficient contrast with background

## Common Patterns

### Icon-Only Interactive Elements

Always provide text alternatives:

```svelte
<button aria-label="Close dialog">
  <Icon name="close" aria-hidden="true" />
</button>
```

### Loading States

Use native HTML patterns:

```svelte
<button disabled={loading}>
  {loading ? 'Saving...' : 'Save'}
</button>
```

### Expandable Content

Simple ARIA states:

```svelte
<button
  aria-expanded={isOpen}
  aria-controls="content-id"
>
  Toggle Content
</button>

<div id="content-id" hidden={!isOpen}>
  <!-- Content -->
</div>
```

## What NOT to Do

### ❌ Don't Recreate Native Elements

```svelte
<!-- Bad -->
<div class="button" on:click={handleClick}>Click me</div>

<!-- Good -->
<button on:click={handleClick}>Click me</button>
```

### ❌ Don't Over-Use ARIA

```svelte
<!-- Bad: Redundant ARIA -->
<button role="button" aria-label="Submit" tabindex="0">Submit</button>

<!-- Good: Native semantics -->
<button>Submit</button>
```

### ❌ Don't Hide Focus Indicators

```css
/* Bad */
*:focus { outline: none; }

/* Good */
button:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
}
```

## Testing Checklist

Before considering a component complete:

1. **Tab Navigation** - Can you reach all interactive elements with Tab key?
2. **Semantic HTML** - Are you using the right elements for the job?
3. **Svelte Warnings** - Does the component compile without a11y warnings?
4. **Focus Visible** - Can keyboard users see where they are?
5. **Touch Targets** - Are interactive elements at least 44x44 pixels?

## Resources

- [Svelte Accessibility Warnings](https://svelte.dev/docs/accessibility-warnings)
- [MDN ARIA Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Guides)
- [WebAIM Quick Reference](https://webaim.org/resources/quickref/)

Remember: The best accessibility is often the simplest. Use semantic HTML, let Svelte help you, and test with your keyboard!