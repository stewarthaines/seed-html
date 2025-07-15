# Storybook Development Guide

## Overview

This project uses Storybook for component development, testing, and documentation. Beyond traditional UI components, we use Storybook to demonstrate and test backend features that don't have their own dedicated UI.

## Documentation Structure

This guide is split into focused documents:

- **📖 [STORYBOOK.md](./STORYBOOK.md)** (this file) - Main overview, organization, and general patterns
- **🔧 [STORYBOOK_backend.md](./STORYBOOK_backend.md)** - Backend feature demonstration patterns and API testing
- **🎯 [STORYBOOK_feature.md](./STORYBOOK_feature.md)** - Feature development patterns and accessibility integration

## Global Storybook Features

### Internationalization (i18n) Locale Switcher

The Storybook toolbar includes a 🌍 globe icon for testing internationalization features:

- **7 Languages**: English, German, Arabic, Hebrew, Japanese, Georgian, Chinese Traditional
- **Instant Switching**: All components update reactively when locale changes
- **RTL Support**: Automatic layout direction switching for Arabic and Hebrew
- **Flag Indicators**: Demo translations show country flag prefixes for visual confirmation
- **Testing**: Use to verify all UI text is properly internationalized

**Usage**: Click the 🌍 globe icon in the toolbar and select any language to see live translation updates throughout all components.

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

## Story Categories & Patterns

### Application Stories: `title: 'Application/ComponentName'`

**Purpose**: Layout components, full-app demos, and cross-component interaction testing
**Pattern**: Use `args` pattern with mock data providers
**Examples**: `App.visual.stories.svelte`, `LayoutManager.stories.svelte`

```svelte
<Story name="Demo" args={{ workspaceManager: mockManager, data: mockData }}>
  <ComponentName />
</Story>
```

### Component Stories: `title: 'Components/Category/ComponentName'`

**Purpose**: Reusable UI components with configurable props
**Pattern**: Use `args` pattern for prop demonstrations
**Examples**: `WorkspaceComponents.stories.svelte`, `MetadataEditor.stories.svelte`

```svelte
<Story name="Demo" args={{ prop1: value1, prop2: value2 }}>
  <ComponentName />
</Story>
```

### Backend Stories: `title: 'Backend/FeatureName'`

**Purpose**: API demonstration and testing with real browser integration
**Pattern**: Direct component instantiation (no args)
**Examples**: `StorageDemo.stories.svelte`, `EPUBUnpackerDemo.stories.svelte`
**See [STORYBOOK_backend.md](./STORYBOOK_backend.md) for detailed patterns**

```svelte
<Story name="Demo">
  <DemoComponent />
</Story>
```

### Feature Stories: `title: 'Features/FeatureName'`

**Purpose**: Component development with real backend integration
**Pattern**: Direct component instantiation with backend initialization
**Examples**: Feature demos with full API integration
**See [STORYBOOK_feature.md](./STORYBOOK_feature.md) for detailed patterns**

```svelte
<Story name="Demo">
  <FeatureDemoWrapper />
</Story>
```

## Development Workflow

### 1. **Create Demo Component**

```bash
# Create demo component for new feature
touch src/stories/FeatureDemo.svelte
touch src/stories/FeatureDemo.stories.svelte
touch src/stories/feature-demo.css
```

### 2. **Choose Your Pattern**

- **Backend Feature**: Follow [STORYBOOK_backend.md](./STORYBOOK_backend.md) patterns for API demonstrations
- **Component Feature**: Follow [STORYBOOK_feature.md](./STORYBOOK_feature.md) patterns for component development
- **UI Component**: Follow traditional component story patterns

### 3. **Test and Capture**

```bash
npm run storybook           # Start Storybook
npm run screenshots         # Capture automated screenshots
npm run test:stories        # Run story-based tests
```

## Quick Reference: Story Pattern Selection

### When to Use Args Pattern
- **Application Stories**: Components that accept mock data providers
- **Component Stories**: Traditional UI components with configurable props
- **Layout Components**: Complex components with multiple configuration options

### When to Use Direct Instantiation
- **Backend Stories**: API demos with real backend initialization
- **Feature Stories**: Components with complex setup and state management
- **Demo Wrappers**: Components that manage their own initialization

## Story Syntax Guidelines

### ✅ **Correct Story Patterns**

**Args Pattern (Application/Component Stories):**
```svelte
<Story name="Demo" args={{ workspaceManager: mockData, showEmpty: true }}>
  <ComponentName />
</Story>
```

**Direct Instantiation (Backend/Feature Stories):**
```svelte
<Story name="Demo">
  <DemoWrapper />
</Story>
```

**Play Functions (All Types):**
```svelte
<Story
  name="Interactive Demo"
  play={async ({ canvasElement }) => {
    const { within } = await import('@testing-library/dom');
    const { default: userEvent } = await import('@testing-library/user-event');
    // Interaction logic
  }}
>
  <ComponentName />
</Story>
```

### ❌ **Problematic Patterns**

```svelte
<!-- WRONG: Mixed patterns -->
<Story name="Demo" args={{ prop: value }}>
  <DemoWrapper />  <!-- Should use direct props or no args -->
</Story>

<!-- WRONG: Complex logic in stories file -->
<script>
  let complexState = {};
  // 100+ lines of component logic - move to separate component
</script>
```

## Component Separation Pattern

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

## Best Practices

### ✅ **Do**

- Use real APIs, not mocks, for authentic testing
- Include comprehensive error handling
- Provide reset functionality for clean demos
- Use descriptive logging with timestamps
- Make demos self-contained and reproducible
- Include both manual and automated story variants
- Follow accessibility-first development patterns

### ❌ **Don't**

- Mock critical browser APIs (defeats the purpose)
- Skip error handling (demos should be robust)
- Forget reset functionality (leads to state accumulation)
- Overload a single demo (keep focused on one feature)
- Skip documentation in story descriptions
- Use `args` and `parameters` props directly on `<Story>` components (causes compilation errors)

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

## Testing Your Story

Before committing, verify:

```bash
npm run storybook                    # Should start without parsing errors
npm run build-storybook             # Should build successfully
npm run test:stories                # Should pass story tests
```

### Playwright Verification

**For AI Coding Agents**: Use Playwright to verify that stories actually work in the browser. The user will have Storybook running at http://localhost:6006 for this purpose.

## Reference Examples

- ✅ `StorageDemo.stories.svelte` - Backend feature demo pattern
- ✅ `EPUBUnpackerDemo.stories.svelte` - Complex backend feature demo
- ✅ `WorkspaceOPFDemo.stories.svelte` - Comprehensive backend showcase
- ✅ `SpineManagerDemo.stories.svelte` - Feature development with real backend
- ✅ `LayoutManager.stories.svelte` - Fullscreen layout with interactive demos
- ✅ `App.stories.svelte` - Complete application state demonstration

## Common Failure Scenarios & Solutions

### **Problem: "Failed to fetch dynamically imported module"**

**Cause**: Wrong story pattern for category or missing component files
**Solution**:
1. **Check Pattern**: Use args for Application/Component, direct instantiation for Backend/Feature
2. **Verify Files**: Ensure component file exists before importing
3. **Fix Imports**: Check all import paths are correct

### **Problem: "Storybook stories indexer parser threw an unrecognized error"**

**Cause**: Complex logic in stories file or mixed patterns
**Solution**:
1. **Move Logic**: Extract all component logic to separate `.svelte` file (< 500 lines)
2. **Minimal Stories**: Keep stories file to < 100 lines (just `defineMeta` and `<Story>`)
3. **Consistent Pattern**: Don't mix args and direct instantiation

### **Problem: Story loads but interactions don't work**

**Cause**: Wrong testing library imports or timing issues
**Solution**:
1. **Standard Imports**: `const { within } = await import('@testing-library/dom')`
2. **Proper Timing**: Add `await new Promise(resolve => setTimeout(resolve, ms))` for real operations
3. **Error Handling**: Wrap interactions in try/catch blocks

### **Problem: Story category doesn't match functionality**

**Cause**: Unclear pattern selection
**Solution**:
1. **Application**: Use for layout/full-app demos with args pattern
2. **Component**: Use for reusable UI with configurable props
3. **Backend**: Use for API demos with direct instantiation
4. **Feature**: Use for complex demos with backend integration

## Development Checklist

### **Pre-Development:**

- [ ] **Choose Story Type**: Application | Component | Backend | Feature
- [ ] **Select Pattern**: Args pattern or Direct instantiation (see Quick Reference)
- [ ] **Plan Files**: `Story.stories.svelte` + `DemoComponent.svelte` + `demo.css`
- [ ] **Review Examples**: Find similar story in the same category

### **Component Creation:**

- [ ] **Create Component First**: `FeatureDemo.svelte` (< 500 lines)
- [ ] **TypeScript Types**: Proper interfaces and error handling
- [ ] **Dedicated CSS**: `feature-demo.css` with design system tokens
- [ ] **Test Independently**: Component works without story

### **Story Creation:**

- [ ] **Use defineMeta**: `import { defineMeta } from '@storybook/addon-svelte-csf'`
- [ ] **Follow Pattern**: Args vs Direct instantiation based on story type
- [ ] **Minimal Stories File**: < 100 lines, no complex logic
- [ ] **Rich Documentation**: Comprehensive component and story descriptions

### **Play Functions (if needed):**

- [ ] **Standard Imports**: `await import('@testing-library/dom')`
- [ ] **Error Handling**: Try/catch with meaningful logs
- [ ] **Timing**: Appropriate waits for real operations
- [ ] **Testing Purpose**: Verify specific user interactions

### **Verification:**

- [ ] **Storybook Starts**: `npm run storybook` (no parsing errors)
- [ ] **Story Loads**: No "Failed to fetch" errors
- [ ] **Playwright Verification**: Use Playwright to confirm stories actually work in browser
- [ ] **Interactions Work**: Play functions complete successfully
- [ ] **No Console Errors**: Clean browser console
- [ ] **Pattern Compliance**: Follows category conventions

### **Quality Assurance:**

- [ ] **Category Correct**: Title matches purpose and pattern
- [ ] **Documentation Complete**: Features, usage, technical details
- [ ] **Responsive Design**: Works across screen sizes
- [ ] **Accessibility**: Keyboard navigation and screen readers

## Key Prevention Strategies

1. **Always start with component creation first, then story**
2. **Follow existing successful patterns** (StorageDemo, EPUBUnpackerDemo, WorkspaceOPFDemo, SpineManagerDemo)
3. **Keep stories minimal** - just configuration and story definitions
4. **Separate concerns**: Component logic ≠ Story configuration
5. **Test early and often** with `npm run storybook` during development
6. **Use TypeScript** for better error detection and IDE support
7. **Plan for error states** - demos should handle failures gracefully
8. **Choose the right pattern** - backend vs feature development approaches
