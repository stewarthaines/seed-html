# Storybook Development Guide

## Overview

This project uses Storybook for component development, testing, and documentation. Beyond traditional UI components, we use Storybook to demonstrate and test backend features that don't have their own dedicated UI.

## Documentation Structure

- **📖 [STORYBOOK.md](./STORYBOOK.md)** (this file) - Main patterns, organization, and quick reference
- **🔧 [STORYBOOK_ADVANCED.md](./STORYBOOK_ADVANCED.md)** - Backend integration, complex patterns, and troubleshooting

## Global Features

### Internationalization (i18n) Locale Switcher

The Storybook toolbar includes a 🌍 globe icon for testing internationalization:

- **7 Languages**: English, German, Arabic, Hebrew, Japanese, Georgian, Chinese Traditional
- **Instant Switching**: All components update reactively when locale changes
- **RTL Support**: Automatic layout direction switching for Arabic and Hebrew
- **Testing**: Use to verify all UI text is properly internationalized

**Usage**: Click the 🌍 globe icon in the toolbar and select any language.

## File Organization

```
src/stories/
├── Application/          # Complete app demonstrations
├── Backend/             # Backend feature demos (non-UI)
├── Components/          # Individual UI components
└── Features/           # Feature development stories
```

## Story Categories & Patterns

### Application Stories: `title: 'Application/ComponentName'`
Complete application demonstrations with layout, navigation, and full functionality.

**Use for**: Layout systems, navigation routers, complete app flows

### Component Stories: `title: 'Components/Category/ComponentName'`
Individual UI components with various states and props.

**Use for**: Buttons, forms, cards, modals - reusable UI components

### Backend Stories: `title: 'Backend/FeatureName'`
Non-UI features that need demonstration and testing.

**Use for**: APIs, file systems, data processing, storage systems

### Feature Stories: `title: 'Features/FeatureName'`
Development-focused stories for building and testing new features.

**Use for**: Work-in-progress features, integration testing, accessibility development

## Development Workflow

### 1. **Create Demo Component**
```bash
# Create demo component for new feature
src/stories/FeatureNameDemo.svelte
```

### 2. **Choose Your Pattern**
- **Simple components**: Use args pattern with controls
- **Complex features**: Use direct instantiation with play functions
- **Backend features**: Use backend demo pattern with real APIs

### 3. **Test and Capture**
```bash
npm run screenshots  # Capture component screenshots
```

## Quick Reference: Story Pattern Selection

### When to Use Args Pattern
- Simple components with clear props
- Need interactive controls in Storybook
- Component state can be controlled via props

```typescript
export const Default: Story = {
  args: {
    title: 'Sample Title',
    disabled: false
  }
};
```

### When to Use Direct Instantiation
- Complex state management
- Need custom initialization logic
- Backend API integration

```typescript
export const WithBackend: Story = {
  render: () => new ComponentDemo({ target: document.body })
};
```

## Story Syntax Guidelines

### ✅ **Correct Story Patterns**

**Args Pattern for Simple Components:**
```typescript
import type { Meta, StoryObj } from '@storybook/svelte';
import ComponentDemo from './ComponentDemo.svelte';

const meta: Meta<ComponentDemo> = {
  title: 'Components/Category/ComponentName',
  component: ComponentDemo,
  parameters: { layout: 'centered' }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: 'Hello World' }
};
```

**Direct Instantiation for Complex Features:**
```typescript
export const BackendIntegration: Story = {
  render: () => new FeatureDemo({ target: document.body }),
  parameters: { layout: 'fullscreen' }
};
```

### ❌ **Problematic Patterns**

**Don't use constructor calls in args:**
```typescript
// ❌ This will cause parsing errors
export const Bad: Story = {
  args: {
    manager: new WorkspaceManager() // Constructor in args
  }
};
```

## Component Separation Pattern

### ✅ DO: Follow Component Separation Pattern

**1. Component (MyComponent.svelte)**
```svelte
<script lang="ts">
  export let title: string;
  export let onAction: () => void;
</script>

<button on:click={onAction}>{title}</button>
```

**2. Demo Component (MyComponentDemo.svelte)**
```svelte
<script lang="ts">
  import MyComponent from './MyComponent.svelte';
  
  let message = '';
  const handleAction = () => { message = 'Clicked!'; };
</script>

<MyComponent title="Demo Button" onAction={handleAction} />
{#if message}<p>{message}</p>{/if}
```

**3. Story (MyComponent.stories.ts)**
```typescript
import MyComponentDemo from './MyComponentDemo.svelte';

export default {
  title: 'Components/UI/MyComponent',
  component: MyComponentDemo
};

export const Interactive = {
  render: () => new MyComponentDemo({ target: document.body })
};
```

### ❌ DON'T: Common Anti-Patterns

**Don't mix demo logic in the main component:**
```svelte
<!-- ❌ MyComponent.svelte -->
<script>
  import { onMount } from 'svelte';
  
  // Don't put demo-specific code in main component
  onMount(() => {
    console.log('Demo initialized'); // Demo-specific
  });
</script>
```

## Best Practices

### ✅ **Do**
- Use descriptive story names that explain the scenario
- Add parameters for layout (`centered`, `fullscreen`, `padded`)
- Include JSDoc comments for complex components
- Use play functions for complex interactions
- Follow the component separation pattern

### ❌ **Don't**
- Put constructor calls or complex object creation in args
- Mix demo-specific code in main components
- Create overly complex stories that test multiple features
- Forget to test with different locales using the i18n switcher

## Testing Your Story

### Basic Verification
1. Story loads without errors
2. Interactive elements work as expected
3. Responsive behavior functions correctly
4. i18n switching works (use 🌍 globe icon)

### Playwright Verification
```bash
npm run test:stories  # Run Storybook tests with Vitest
```

## Common Failure Scenarios & Solutions

### **Problem: "Failed to fetch dynamically imported module"**
**Solution**: Check import paths and ensure all dependencies are properly installed.

### **Problem: "Storybook stories indexer parser threw an unrecognized error"**
**Solution**: Verify story syntax, especially export statements and meta configuration.

### **Problem: Story loads but interactions don't work**
**Solution**: Use play functions for complex interactions, ensure proper event handling.

### **Problem: Story category doesn't match functionality**
**Solution**: Use correct title prefix - `Application/`, `Components/`, `Backend/`, or `Features/`.

## Development Checklist

### **Pre-Development:**
- [ ] Review existing similar stories for patterns
- [ ] Choose appropriate story category and title
- [ ] Plan demo component structure

### **Component Creation:**
- [ ] Create main component with clear props interface
- [ ] Create separate demo component for Storybook
- [ ] Follow component separation pattern

### **Story Creation:**
- [ ] Choose appropriate pattern (args vs direct instantiation)
- [ ] Add descriptive story names and documentation
- [ ] Include proper layout parameters

### **Verification:**
- [ ] Story loads without errors in Storybook
- [ ] Test with different i18n locales
- [ ] Verify responsive behavior
- [ ] Run `npm run test:stories` for automated testing

### **Quality Assurance:**
- [ ] Screenshot capture works (`npm run screenshots`)
- [ ] No console errors during story interaction
- [ ] Story follows established patterns from this guide

## Reference Examples

- **Simple Component**: `src/stories/Components/UI/Button.stories.ts`
- **Backend Feature**: `src/stories/Backend/FileStorage.stories.ts`
- **Application Layout**: `src/stories/Application/Layout.stories.ts`
- **Feature Development**: `src/stories/Features/WorkspaceManagement.stories.ts`

For advanced patterns, backend integration, and troubleshooting, see [STORYBOOK_ADVANCED.md](./STORYBOOK_ADVANCED.md).