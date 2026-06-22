# Storybook Development Guide

## Overview

This project uses Storybook for component development, testing, and documentation. Beyond traditional UI components, we use Storybook to demonstrate and test backend features that don't have their own dedicated UI.

## Documentation Structure

- **📖 [STORYBOOK.md](./STORYBOOK.md)** (this file) - Main patterns, organization, and quick reference
- **🔧 [Advanced patterns](#advanced-patterns)** (below) - Backend integration, complex patterns, and troubleshooting

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
    disabled: false,
  },
};
```

### When to Use Direct Instantiation

- Complex state management
- Need custom initialization logic
- Backend API integration

```typescript
export const WithBackend: Story = {
  render: () => new ComponentDemo({ target: document.body }),
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
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: 'Hello World' },
};
```

**Direct Instantiation for Complex Features:**

```typescript
export const BackendIntegration: Story = {
  render: () => new FeatureDemo({ target: document.body }),
  parameters: { layout: 'fullscreen' },
};
```

### ❌ **Problematic Patterns**

**Don't use constructor calls in args:**

```typescript
// ❌ This will cause parsing errors
export const Bad: Story = {
  args: {
    manager: new WorkspaceManager(), // Constructor in args
  },
};
```

## Component Separation Pattern

### ✅ DO: Follow Component Separation Pattern

**1. Component (MyComponent.svelte)** — runes only

```svelte
<script lang="ts">
  let { title, onAction }: { title: string; onAction: () => void } = $props();
</script>

<button onclick={onAction}>{title}</button>
```

**2. Demo Component (MyComponentDemo.svelte)**

```svelte
<script lang="ts">
  import MyComponent from './MyComponent.svelte';

  let message = '';
  const handleAction = () => {
    message = 'Clicked!';
  };
</script>

<MyComponent title="Demo Button" onAction={handleAction} />
{#if message}<p>{message}</p>{/if}
```

**3. Story (MyComponent.stories.ts)**

```typescript
import MyComponentDemo from './MyComponentDemo.svelte';

export default {
  title: 'Components/UI/MyComponent',
  component: MyComponentDemo,
};

export const Interactive = {
  render: () => new MyComponentDemo({ target: document.body }),
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

For advanced patterns, backend integration, and troubleshooting, see the [Advanced patterns](#advanced-patterns) section below.

## Advanced patterns

This section covers advanced Storybook patterns including backend integration, complex state management, accessibility development, and performance optimization. For basic patterns, see the sections above.

### Backend Feature Demonstration Patterns

#### When to Use Backend Demo Patterns

Use backend demo patterns for:

- **Non-UI Features**: File storage, data processing, API integrations
- **System Testing**: Testing real implementations vs mocks
- **Development Aid**: Interactive testing of backend features
- **Documentation**: Live demonstration of API capabilities

#### Real Backend Integration Approach

Replace mocks with real implementations for more accurate testing:

```svelte
<!-- BackendFeatureDemo.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { FileStorageAPI } from '../lib/storage';

  let storage = new FileStorageAPI();
  let logs: string[] = [];
  let isReady = false;

  const log = (message: string) => {
    logs = [...logs, `${new Date().toISOString()}: ${message}`];
  };

  onMount(async () => {
    try {
      await storage.init();
      log('✅ Storage initialized successfully');
      isReady = true;
    } catch (error) {
      log(`❌ Initialization failed: ${error.message}`);
    }
  });

  const testOperation = async () => {
    try {
      const result = await storage.createWorkspace('test-workspace');
      log(`✅ Created workspace: ${result.id}`);
    } catch (error) {
      log(`❌ Operation failed: ${error.message}`);
    }
  };
</script>

<div class="demo-container">
  <div class="controls">
    <button disabled={!isReady} on:click={testOperation}> Test Create Workspace </button>
    <button on:click={() => (logs = [])}>Clear Logs</button>
  </div>

  <div class="console">
    {#each logs as logEntry}
      <div class="log-entry">{logEntry}</div>
    {/each}
  </div>
</div>

<style>
  .demo-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .console {
    background: #1e1e1e;
    color: #fff;
    padding: 1rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .log-entry {
    margin-bottom: 0.25rem;
  }
</style>
```

#### Story Definition with Play Functions

```typescript
// BackendFeature.stories.ts
import type { Meta, StoryObj } from '@storybook/svelte';
import BackendFeatureDemo from './BackendFeatureDemo.svelte';
import { expect, within } from '@storybook/test';

const meta: Meta<BackendFeatureDemo> = {
  title: 'Backend/FileStorage',
  component: BackendFeatureDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Interactive demonstration of the File Storage API with real backend integration.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: () => new BackendFeatureDemo({ target: document.body }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for initialization
    await expect(canvas.getByText(/Storage initialized/)).toBeInTheDocument();

    // Test workspace creation
    const createButton = canvas.getByText('Test Create Workspace');
    await createButton.click();

    // Verify success
    await expect(canvas.getByText(/Created workspace/)).toBeInTheDocument();
  },
};
```

### Advanced Component Development Patterns

#### Promise-Based Accessibility Patterns

For components requiring coordination between focus management and async operations:

```svelte
<!-- AdvancedComponent.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ ready: Promise<void> }>();

  let dialogRef: HTMLDialogElement;
  let isLoading = true;

  export const open = async (): Promise<void> => {
    isLoading = true;
    dialogRef.showModal();

    // Simulate async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    isLoading = false;

    // Focus management after loading
    const firstInput = dialogRef.querySelector('input');
    firstInput?.focus();

    // Dispatch promise for parent coordination
    const readyPromise = Promise.resolve();
    dispatch('ready', readyPromise);
    return readyPromise;
  };
</script>

<dialog bind:this={dialogRef}>
  {#if isLoading}
    <div class="loading">Loading...</div>
  {:else}
    <form>
      <input type="text" placeholder="Enter value" />
      <button type="submit">Submit</button>
    </form>
  {/if}
</dialog>
```

#### Parent Component Promise Integration

```svelte
<!-- ParentComponent.svelte -->
<script lang="ts">
  import AdvancedComponent from './AdvancedComponent.svelte';

  let componentRef: AdvancedComponent;
  let isComponentReady = false;

  const handleOpen = async () => {
    try {
      await componentRef.open();
      isComponentReady = true;
      // Component is now ready and focused
    } catch (error) {
      console.error('Failed to open component:', error);
    }
  };

  const handleComponentReady = (event: CustomEvent<Promise<void>>) => {
    event.detail.then(() => {
      console.log('Component fully initialized');
    });
  };
</script>

<button on:click={handleOpen}>Open Advanced Component</button>
<AdvancedComponent bind:this={componentRef} on:ready={handleComponentReady} />
```

### Layout and Application Story Patterns

#### Fullscreen Layout Stories

For testing complete application layouts:

```typescript
// LayoutDemo.stories.ts
export const FullApplication: Story = {
  render: () => new AppLayoutDemo({ target: document.body }),
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'desktop',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test sidebar toggle
    const sidebarToggle = canvas.getByLabelText('Toggle Sidebar');
    await sidebarToggle.click();

    // Verify layout changes
    const sidebar = canvas.getByRole('complementary');
    expect(sidebar).toHaveClass('collapsed');

    // Test responsive behavior
    await expect(canvas.getByRole('main')).toHaveClass('expanded');
  },
};
```

#### Interactive Layout Demonstrations

**Sidebar Toggle Pattern:**

```svelte
<!-- LayoutDemo.svelte -->
<script lang="ts">
  import { layoutStore } from '../stores/layout';

  let sidebarExpanded = true;

  const toggleSidebar = () => {
    sidebarExpanded = !sidebarExpanded;
    layoutStore.setSidebarExpanded(sidebarExpanded);
  };
</script>

<div class="app-layout" class:sidebar-collapsed={!sidebarExpanded}>
  <header class="app-header">
    <button on:click={toggleSidebar} aria-label="Toggle Sidebar"> ☰ </button>
    <h1>Application Layout Demo</h1>
  </header>

  <aside class="app-sidebar" class:collapsed={!sidebarExpanded}>
    <nav>Navigation content</nav>
  </aside>

  <main class="app-main">
    <p>Main content area</p>
  </main>
</div>
```

### Feature Development Patterns

#### Real-Time Loading States

```svelte
<!-- FeatureDemo.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let loadingState: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  let progress = 0;

  const simulateAsyncOperation = async () => {
    loadingState = 'loading';
    progress = 0;

    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        progress = i;
      }
      loadingState = 'success';
    } catch (error) {
      loadingState = 'error';
    }
  };
</script>

<div class="feature-demo">
  <button on:click={simulateAsyncOperation} disabled={loadingState === 'loading'}>
    Start Operation
  </button>

  {#if loadingState === 'loading'}
    <div class="progress">
      <div class="progress-bar" style="width: {progress}%"></div>
      <span>{progress}%</span>
    </div>
  {:else if loadingState === 'success'}
    <div class="success">✅ Operation completed successfully</div>
  {:else if loadingState === 'error'}
    <div class="error">❌ Operation failed</div>
  {/if}
</div>
```

#### Error Scenario Testing

```svelte
<!-- ErrorDemo.svelte -->
<script lang="ts">
  let errorType: 'none' | 'network' | 'validation' | 'permission' = 'none';

  const triggerError = (type: typeof errorType) => {
    errorType = type;
    setTimeout(() => {
      errorType = 'none';
    }, 3000);
  };
</script>

<div class="error-demo">
  <div class="controls">
    <button on:click={() => triggerError('network')}>Network Error</button>
    <button on:click={() => triggerError('validation')}>Validation Error</button>
    <button on:click={() => triggerError('permission')}>Permission Error</button>
  </div>

  {#if errorType !== 'none'}
    <div class="error-display" role="alert">
      {#if errorType === 'network'}
        Network connection failed. Please check your connection.
      {:else if errorType === 'validation'}
        Invalid input provided. Please correct and try again.
      {:else if errorType === 'permission'}
        Access denied. You don't have permission for this action.
      {/if}
    </div>
  {/if}
</div>
```

### Performance Best Practices

#### Efficient Play Functions

```typescript
export const PerformanceOptimized: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Use efficient selectors
    const button = canvas.getByRole('button', { name: 'Submit' });

    // Batch DOM operations
    await Promise.all([button.click(), expect(canvas.getByText('Loading')).toBeInTheDocument()]);

    // Wait for specific state changes instead of arbitrary timeouts
    await canvas.findByText('Success', {}, { timeout: 5000 });
  },
};
```

#### Memory Management

```svelte
<!-- MemoryEfficientDemo.svelte -->
<script lang="ts">
  import { onDestroy } from 'svelte';

  let intervals: number[] = [];
  let listeners: (() => void)[] = [];

  onDestroy(() => {
    // Clear all intervals
    intervals.forEach(clearInterval);

    // Remove all event listeners
    listeners.forEach(cleanup => cleanup());
  });

  const addInterval = (callback: () => void, delay: number) => {
    const id = setInterval(callback, delay);
    intervals.push(id);
    return id;
  };

  const addEventListener = (element: Element, event: string, handler: EventListener) => {
    element.addEventListener(event, handler);
    const cleanup = () => element.removeEventListener(event, handler);
    listeners.push(cleanup);
    return cleanup;
  };
</script>
```

### Component Development Workflow

#### Phase 1: Design & Planning

1. **Create Design Specification**
   - Define component purpose and requirements
   - List props, events, and slots
   - Identify accessibility requirements
   - Plan responsive behavior

2. **Analyze Existing Patterns**
   - Review similar components in the project
   - Identify reusable patterns and utilities
   - Check design system integration points

#### Phase 2: Implementation

3. **Implement Component Hierarchy**
   - Create main component with TypeScript interfaces
   - Implement demo component for Storybook
   - Add comprehensive JSDoc documentation

4. **Component Implementation Guidelines**
   - Use semantic HTML elements
   - Implement ARIA attributes for accessibility
   - Follow project's CSS design system
   - Add proper event handling and cleanup

#### Phase 3: Story Development

5. **Create Demo Component**
   - Separate demo logic from main component
   - Include state management for complex scenarios
   - Add realistic mock data and interactions

6. **Create Story File**
   - Choose appropriate story pattern (args vs direct instantiation)
   - Add comprehensive story variants
   - Include play functions for complex interactions

#### Phase 4: Testing & Documentation

7. **Browser Testing**
   - Test across different browsers and devices
   - Verify accessibility with screen readers
   - Test with different viewport sizes

8. **Performance Verification**
   - Check component render performance
   - Verify memory cleanup in onDestroy
   - Test with large datasets if applicable

### Troubleshooting

#### Common Issues

**Play function timeouts**: Increase timeout for slow operations, use `findBy` queries instead of arbitrary delays.

**Memory leaks in stories**: Ensure proper cleanup in component onDestroy hooks, clear intervals and event listeners.

**Accessibility failures**: Use semantic HTML, add proper ARIA labels, test with keyboard navigation.

**Performance issues**: Use efficient selectors in play functions, avoid unnecessary re-renders, implement proper memoization.

#### Debugging Tips

1. Use browser dev tools to inspect component state
2. Add console logging to track component lifecycle
3. Use Storybook's controls to test edge cases
4. Test with different locales using the i18n switcher

### Advanced Reference Examples

- **Complex Backend Integration**: `src/stories/Backend/WorkspaceManager.stories.ts`
- **Accessibility Development**: `src/stories/Features/AccessibleForm.stories.ts`
- **Performance Testing**: `src/stories/Performance/LargeDataSet.stories.ts`
- **Layout System**: `src/stories/Application/ResponsiveLayout.stories.ts`
