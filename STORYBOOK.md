# Storybook Development Guide

## Overview

This project uses Storybook for component development, testing, and documentation. Beyond traditional UI components, we use Storybook to demonstrate and test backend features that don't have their own dedicated UI.

## Backend Feature Demonstration Pattern

### When to Use This Pattern

Use this approach for features that:

- Are primarily backend/API focused (storage, parsing, transformation)
- Don't have their own dedicated UI components
- Need interactive demonstration during development
- Require testing with real browser APIs
- Benefit from visual documentation

### Example: File Storage API Demo

The File Storage API (`src/stories/StorageDemo.svelte`) demonstrates this pattern:

#### 1. **Demo Component Structure**

```typescript
// src/stories/FeatureDemo.svelte
<script lang="ts">
  import { SomeAPI } from '../lib/feature';

  // Component state
  let api: SomeAPI;
  let logs: LogEntry[] = [];
  let isLoading = false;

  // Initialize API
  onMount(async () => {
    try {
      api = new SomeAPI();
      await api.init();
      addLog('success', 'API initialized');
    } catch (error) {
      addLog('error', `Failed to initialize: ${error.message}`);
    }
  });

  // Demo operations
  async function performOperation() {
    if (!api || isLoading) return;
    isLoading = true;
    addLog('action', 'Performing operation...');

    try {
      const result = await api.someMethod();
      addLog('success', `Operation complete: ${result}`);
    } catch (error) {
      addLog('error', `Operation failed: ${error.message}`);
    } finally {
      isLoading = false;
    }
  }

  // Reset for clean demos
  async function resetDemo() {
    // Clear any persistent state
    // Reset component state
    addLog('success', 'Demo reset complete');
  }

  function addLog(type: 'info' | 'success' | 'error' | 'action', message: string) {
    const timestamp = new Date().toLocaleTimeString();
    logs = [...logs, { timestamp, type, message }];
  }
</script>

<!-- UI with controls and real-time logging -->
<div class="feature-demo">
  <div class="controls">
    <button on:click={performOperation} disabled={isLoading}>
      Perform Operation
    </button>
    <button on:click={resetDemo} disabled={isLoading}>
      Reset Demo
    </button>
  </div>

  <div class="console-log">
    {#each logs as log}
      <div class="log-entry log-{log.type}">
        <span class="log-time">{log.timestamp}</span>
        <span class="log-message">{log.message}</span>
      </div>
    {/each}
  </div>
</div>
```

#### 2. **Story Definition with Play Functions**

```javascript
// src/stories/FeatureDemo.stories.svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import FeatureDemo from './FeatureDemo.svelte';

  const { Story } = defineMeta({
    title: 'Backend/Feature Name',
    component: FeatureDemo,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: `
# Feature API Demo

Interactive demonstration of the feature's capabilities.

## Usage Instructions

1. **Initialize**: Feature automatically initializes on load
2. **Perform Operations**: Click buttons to test functionality
3. **Monitor Progress**: View real-time logging
4. **Reset**: Clean state for repeated testing
          `
        }
      }
    }
  });
</script>

<!-- Basic interactive demo -->
<Story name="Interactive Demo">
  <FeatureDemo />
</Story>

<!-- Automated demo with sample data -->
<Story
  name="Demo with Sample Data"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');

    const canvas = within(canvasElement);
    const user = userEvent.setup();

    try {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reset to clean state
      const resetButton = canvas.getByText('Reset Demo');
      await user.click(resetButton);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Perform demo operations
      const operationButton = canvas.getByText('Perform Operation');
      await user.click(operationButton);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Additional operations as needed

    } catch (error) {
      console.log('Play function failed:', error);
    }
  }}
>
  <FeatureDemo />
</Story>
```

#### 3. **Key Implementation Principles**

##### **Real-Time Logging Console**

- Show all operations with timestamps
- Use different log types (info, success, error, action)
- Clear, descriptive messages
- Scrollable console area

##### **State Management**

- Track loading states
- Disable buttons during operations
- Reset functionality for clean demos
- Error handling with user feedback

##### **Play Function Best Practices**

```typescript
// Use proper testing library imports
const { within } = await import('@testing-library/dom');
const { default: userEvent } = await import('@testing-library/user-event');

// Always include error handling
try {
  // Demo operations
} catch (error) {
  console.log('Play function failed:', error);
  // Continue anyway to show current state
}

// Use realistic timing
await new Promise(resolve => setTimeout(resolve, 500));

// Reset before demonstrating
const resetButton = canvas.getByText('Reset Demo');
await user.click(resetButton);
```

##### **CSS Styling Guidelines**

```css
/* Console-like appearance */
.console-log {
  background: #2d2d2d;
  color: #f0f0f0;
  font-family: 'Courier New', monospace;
  padding: 1rem;
  height: 300px;
  overflow-y: auto;
}

/* Color-coded log types */
.log-success {
  color: #4ade80;
}
.log-error {
  color: #f87171;
}
.log-action {
  color: #fbbf24;
}
.log-info {
  color: #60a5fa;
}

/* Responsive button layout */
.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
```

## Integration with Screenshot Automation

### Automated Screenshot Capture

The project includes automated screenshot capture for all stories:

```javascript
// scripts/capture-screenshots.js
const stories = [
  { name: 'feature-demo-interactive', url: 'http://localhost:6006/iframe.html?...' },
  { name: 'feature-demo-with-data', url: 'http://localhost:6006/iframe.html?...' },
];

// For stories with play functions, allow extra time
if (story.name.includes('demo')) {
  await page.waitForTimeout(8000); // Wait for play function to complete
}
```

Run screenshots: `npm run screenshots`

### Benefits for Documentation

- **Visual Documentation**: Screenshots show the feature working
- **Automated Testing**: Play functions test the actual feature
- **Consistent Examples**: Same demo state every time
- **Real Browser Testing**: Uses actual browser APIs, not mocks

## File Organization

```
src/stories/
├── ComponentName.stories.svelte     // UI component stories
├── FeatureDemo.svelte               // Backend feature demo component
├── FeatureDemo.stories.svelte       // Backend feature stories
├── feature-demo.css                 // Demo-specific styling
└── components/                      // Reusable demo components
    ├── ConsoleLog.svelte           // Reusable console component
    └── DemoControls.svelte         // Reusable control panel
```

## Story Categories

### Component Stories

- `title: 'Components/ComponentName'`
- Traditional UI component documentation
- Props, events, slots demonstration

### Application Stories

- `title: 'Application/ComponentName'`
- Layout and structural components
- Full application state demonstration
- Cross-component interaction testing

### Backend Feature Stories

- `title: 'Backend/FeatureName'`
- API demonstration and testing
- Real browser integration
- Interactive documentation

### Integration Stories

- `title: 'Integration/WorkflowName'`
- End-to-end workflow demonstration
- Multiple feature coordination
- User journey testing

## Development Workflow

### 1. **Create Demo Component**

```bash
# Create demo component for new feature
touch src/stories/FeatureDemo.svelte
touch src/stories/FeatureDemo.stories.svelte
touch src/stories/feature-demo.css
```

### 2. **Implement Interactive Demo**

- Real API integration (not mocked)
- Console logging for transparency
- Reset functionality for repeatability
- Error handling with user feedback

### 3. **Add Story with Play Function**

- Basic interactive story for manual testing
- Automated story with sample data for screenshots
- Comprehensive documentation in story description

### 4. **Test and Capture**

```bash
npm run storybook           # Start Storybook
npm run screenshots         # Capture automated screenshots
npm run test:stories        # Run story-based tests
```

### 5. **Update Documentation**

- Add story to main Storybook navigation
- Include screenshots in feature documentation
- Reference interactive demos in technical specs

## Story Syntax Guidelines

### ✅ **Correct Story Patterns**

```svelte
<!-- Simple story - RECOMMENDED -->
<Story name="Basic Demo">
  <ComponentName prop={value} />
</Story>

<!-- Story with play function -->
<Story
  name="Interactive Demo"
  play={async ({ canvasElement }) => {
    // Interaction logic
  }}
>
  <ComponentName />
</Story>
```

### ❌ **Problematic Patterns**

```svelte
<!-- AVOID: args and parameters props cause compilation errors -->
<Story name="Demo" args={{ prop: value }} parameters={{ docs: { description: '...' } }}>
  <ComponentName />
</Story>
```

**Issue**: Using `args` and `parameters` props directly on `<Story>` components causes Storybook compilation failures with "Failed to fetch dynamically imported module" errors.

**Solution**: Pass props directly to the component and use the `defineMeta` configuration for story-level parameters.

## Best Practices

### ✅ **Do**

- Use real APIs, not mocks, for authentic testing
- Include comprehensive error handling
- Provide reset functionality for clean demos
- Use descriptive logging with timestamps
- Make demos self-contained and reproducible
- Include both manual and automated story variants

### ❌ **Don't**

- Mock critical browser APIs (defeats the purpose)
- Skip error handling (demos should be robust)
- Forget reset functionality (leads to state accumulation)
- Overload a single demo (keep focused on one feature)
- Skip documentation in story descriptions
- Use `args` and `parameters` props directly on `<Story>` components (causes compilation errors)

## Advanced Patterns

### **Multi-Step Workflows**

```typescript
// Demonstrate complex workflows
async function performComplexWorkflow() {
  addLog('action', 'Starting complex workflow...');

  const step1 = await api.stepOne();
  addLog('success', `Step 1 complete: ${step1}`);

  const step2 = await api.stepTwo(step1);
  addLog('success', `Step 2 complete: ${step2}`);

  const result = await api.stepThree(step2);
  addLog('success', `Workflow complete: ${result}`);
}
```

### **Real-Time Updates**

```typescript
// Show progress for long-running operations
async function longRunningOperation() {
  const operation = api.startLongOperation();

  operation.onProgress(progress => {
    addLog('info', `Progress: ${progress}%`);
  });

  const result = await operation.complete();
  addLog('success', `Operation complete: ${result}`);
}
```

### **State Comparison**

```typescript
// Show before/after states
async function demonstrateTransformation() {
  const before = await api.getCurrentState();
  addLog('info', `Before: ${JSON.stringify(before)}`);

  await api.performTransformation();

  const after = await api.getCurrentState();
  addLog('success', `After: ${JSON.stringify(after)}`);
}
```

This pattern enables rich, interactive documentation for backend features while maintaining the benefits of automated testing and visual documentation through Storybook.

## Layout and Application Story Patterns

### Fullscreen Layout Stories

For layout components and complete application demonstrations, use the fullscreen pattern:

```svelte
<!-- LayoutComponent.stories.svelte -->
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import LayoutComponent from '../lib/LayoutComponent.svelte';

  const { Story } = defineMeta({
    title: 'Application/LayoutComponent',
    component: LayoutComponent,
    parameters: {
      layout: 'fullscreen', // Essential for layout stories
      docs: {
        description: {
          component: 'Layout component documentation...',
        },
      },
    },
    tags: ['autodocs'],
  });
</script>
```

### Interactive Layout Demonstrations

#### **Sidebar Toggle Pattern**

```svelte
<Story
  name="Collapsed Sidebar"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButton = canvas.getByLabelText('Toggle sidebar');
    await userEvent.click(toggleButton);
  }}
>
  <LayoutComponent />
</Story>
```

#### **Section Navigation Pattern**

```svelte
<Story
  name="Section Tour"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Navigate through sections with timing
    const sections = ['Metadata', 'Manifest', 'Navigation'];
    for (const sectionName of sections) {
      const button = canvas.getByTitle(sectionName);
      await userEvent.click(button);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }}
>
  <LayoutComponent />
</Story>
```

#### **Responsive Layout Testing**

```svelte
<Story
  name="Mobile View"
  parameters={{
    viewport: {
      name: 'tablet',
    },
    docs: {
      description: {
        story: 'Layout behavior on tablet-sized screens',
      },
    },
  }}
>
  <LayoutComponent />
</Story>
```

### Application State Documentation

#### **Complete App Demonstration**

```svelte
<!-- App.stories.svelte -->
<Story
  name="Interactive Demo"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 500));

    // Demonstrate key interactions
    const sections = ['Metadata', 'Manifest', 'Settings'];
    for (const section of sections) {
      const button = canvas.getByTitle(section);
      await userEvent.click(button);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Toggle layout
    const toggleButton = canvas.getByLabelText('Toggle sidebar');
    await userEvent.click(toggleButton);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return to default state
    await userEvent.click(toggleButton);
  }}
>
  <AppComponent />
</Story>
```

### Layout Story Best Practices

#### **✅ Essential Patterns**

**Fullscreen Parameter:**

```javascript
parameters: {
  layout: 'fullscreen'; // Required for layout components
}
```

**Realistic Timing in Play Functions:**

```javascript
// Allow time for animations and state changes
await new Promise(resolve => setTimeout(resolve, 1500));
```

**Accessibility-Focused Selectors:**

```javascript
// Use accessible selectors
const toggleButton = canvas.getByLabelText('Toggle sidebar');
const sectionButton = canvas.getByTitle('Metadata');
const roleButton = canvas.getByRole('button', { name: /settings/i });
```

**Robust Error Handling:**

```javascript
play={async ({ canvasElement }) => {
  try {
    // Interaction logic
  } catch (error) {
    console.log('Layout demo interaction failed:', error);
    // Continue to show current state
  }
}}
```

#### **🎯 Layout-Specific Considerations**

**State Persistence:**

- Layout stories may retain localStorage state between runs
- Include reset mechanisms or account for previous state
- Test both fresh and restored state scenarios

**Animation Timing:**

- CSS transitions need time to complete
- Use realistic delays (500-1500ms) for visual clarity
- Match timing to actual CSS transition durations

**Viewport Constraints:**

- Test minimum and maximum layout sizes
- Verify responsive breakpoint behavior
- Include mobile/tablet viewport variants

**Cross-Story State:**

- Layout state persists across story navigation
- Consider this when designing demo sequences
- Reset state explicitly if clean demos are required

### Content-Rich Layout Demos

#### **Placeholder Content Pattern**

```svelte
<!-- Rich demo content for layout stories -->
<LayoutManager>
  <svelte:fragment slot="sidebar-workspace">
    <div class="demo-content">
      <h3>📁 Workspace</h3>
      <p>Current project: <strong>My EPUB</strong></p>
      <ul>
        <li>✅ Setup complete</li>
        <li>🔄 Content in progress</li>
      </ul>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="left-content">
    <div class="editor-demo">
      <h3>Text Editor</h3>
      <textarea rows="20" placeholder="Content here...">
        # Chapter 1: Introduction Welcome to EPUB creation...
      </textarea>
    </div>
  </svelte:fragment>
</LayoutManager>
```

#### **Styled Demo Components**

```css
/* Layout story specific styling */
.demo-content {
  padding: 1rem;
  font-family: system-ui, sans-serif;
}

.demo-content h3 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 1rem;
}

.editor-demo textarea {
  width: 100%;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
}

.preview-content {
  padding: 2rem;
  max-width: 650px;
  margin: 0 auto;
  font-family: Georgia, serif;
  line-height: 1.6;
}
```

### Performance in Layout Stories

#### **Efficient Play Functions**

```javascript
// Batch DOM queries for better performance
const buttons = {
  toggle: canvas.getByLabelText('Toggle sidebar'),
  metadata: canvas.getByTitle('Metadata'),
  manifest: canvas.getByTitle('Manifest'),
};

// Use consistent timing patterns
const INTERACTION_DELAY = 800;
const ANIMATION_DELAY = 500;

for (const [name, button] of Object.entries(buttons)) {
  await userEvent.click(button);
  await new Promise(resolve => setTimeout(resolve, INTERACTION_DELAY));
}
```

#### **Memory Management**

```javascript
// Clean up after complex demos if needed
onDestroy(() => {
  // Reset any global state
  // Clear any timers
  // Remove event listeners
});
```

This pattern ensures layout and application stories provide comprehensive visual documentation while maintaining good performance and accessibility standards.

## Storybook Story Development Guidelines

### ✅ DO: Follow Component Separation Pattern

**Correct Structure:**

```
src/stories/
├── FeatureDemo.stories.svelte    # Story definitions only
├── FeatureDemo.svelte            # Component logic
└── feature-demo.css              # Component styles
```

**Stories File (`*.stories.svelte`):**

- Use `defineMeta` from `@storybook/addon-svelte-csf`
- Import component from separate `.svelte` file
- Keep story definitions minimal and focused
- NO component logic or large `<script>` blocks

**Component File (`*.svelte`):**

- Contains all component logic, state, and interactions
- Import dedicated CSS file for styles
- Follow TypeScript patterns with proper type annotations
- Handle all business logic and API calls

**CSS File (`*.css`):**

- Dedicated styling following project design system
- Responsive design patterns
- Accessibility-focused styles

### ❌ DON'T: Common Anti-Patterns

**Never mix export default with defineMeta:**

```svelte
<!-- ❌ WRONG -->
<script context="module">
  export default { title: '...' }; // Don't do this
</script>
```

**Never put component logic in stories file:**

```svelte
<!-- ❌ WRONG -->
<script>
  let complexState = {};
  async function handleComplexLogic() {
    /* ... */
  }
  // 100+ lines of component code
</script>
```

**Never embed large style blocks:**

```svelte
<!-- ❌ WRONG -->
<style>
  /* 500+ lines of CSS */
</style>
```

### 🔧 Backend Feature Demo Pattern

For backend feature demonstrations, use this proven pattern:

1. **Create Component First:**

   ```bash
   src/stories/BackendFeatureDemo.svelte  # Component logic
   src/stories/backend-feature-demo.css   # Styles
   ```

2. **Then Create Story:**

   ```svelte
   <!-- BackendFeatureDemo.stories.svelte -->
   <script module>
     import { defineMeta } from '@storybook/addon-svelte-csf';
     import BackendFeatureDemo from './BackendFeatureDemo.svelte';

     const { Story } = defineMeta({
       title: 'Backend Features/Feature Name',
       component: BackendFeatureDemo,
       tags: ['autodocs'],
       parameters: {
         docs: {
           description: {
             component: `# Feature Documentation...`,
           },
         },
       },
     });
   </script>

   <Story name="Interactive Demo">
     <BackendFeatureDemo />
   </Story>
   ```

### 🧪 Testing Your Story

Before committing, verify:

```bash
npm run storybook                    # Should start without parsing errors
npm run build-storybook             # Should build successfully
npm run test:stories                # Should pass story tests
```

### 🚀 Performance Best Practices

- **Lazy load** heavy backend operations in `onMount`
- **Debounce** user interactions that trigger API calls
- **Error boundaries** for backend failures
- **Loading states** for async operations
- **Memory cleanup** in component destruction

### 📚 Reference Examples

- ✅ `StorageDemo.stories.svelte` - Correct backend demo pattern
- ✅ `EPUBUnpackerDemo.stories.svelte` - Complex feature demo
- ✅ `WorkspaceOPFDemo.stories.svelte` - Comprehensive backend showcase
- ✅ `LayoutManager.stories.svelte` - Fullscreen layout with interactive demos
- ✅ `App.stories.svelte` - Complete application state demonstration
- ❌ Avoid mixing patterns from different CSF versions

### 🔍 Common Failure Scenarios & Solutions

#### **Problem: "Failed to fetch dynamically imported module"**

**Cause**: Mixed CSF patterns or component/reference mismatches
**Solution**:

1. Use `defineMeta` consistently
2. Ensure component file exists before referencing
3. Check import paths are correct

#### **Problem: "Storybook stories indexer parser threw an unrecognized error"**

**Cause**: Component logic embedded in stories file
**Solution**:

1. Extract component logic to separate `.svelte` file
2. Keep stories file minimal with only `defineMeta` and `<Story>` components
3. Import component from separate file

#### **Problem: Validation errors in Storybook demo**

**Cause**: Backend features showing false positive errors
**Solution**:

1. Implement proper path resolution in validation logic
2. Exclude system files (cache files, etc.) from validation
3. Use dynamic container.xml parsing for robust path handling

### 📋 Development Checklist

When creating a new Storybook story:

**Pre-Development:**

- [ ] Identify if this is a UI component or backend feature demo
- [ ] Plan component separation (stories/component/css files)
- [ ] Review existing similar patterns for consistency

**Component Creation:**

- [ ] Create component file first (`FeatureDemo.svelte`)
- [ ] Add TypeScript types and proper error handling
- [ ] Create dedicated CSS file (`feature-demo.css`)
- [ ] Test component independently

**Story Creation:**

- [ ] Use `defineMeta` from `@storybook/addon-svelte-csf`
- [ ] Import component from separate file
- [ ] Add comprehensive documentation in story description
- [ ] Keep story definition minimal and focused

**Verification:**

- [ ] `npm run storybook` starts without errors
- [ ] Story loads and displays correctly
- [ ] Interactive features work as expected
- [ ] No console errors or warnings
- [ ] Responsive design works across screen sizes

**Integration:**

- [ ] Add to appropriate story category
- [ ] Update documentation if needed
- [ ] Run screenshot capture if applicable
- [ ] Test automated story interactions (play functions)

### 🎯 Key Prevention Strategies

1. **Always start with component creation first, then story**
2. **Follow existing successful patterns** (StorageDemo, EPUBUnpackerDemo, WorkspaceOPFDemo)
3. **Keep stories minimal** - just configuration and story definitions
4. **Separate concerns**: Component logic ≠ Story configuration
5. **Test early and often** with `npm run storybook` during development
6. **Use TypeScript** for better error detection and IDE support
7. **Plan for error states** - backend demos should handle failures gracefully
