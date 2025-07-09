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
- **See [STORYBOOK_backend.md](./STORYBOOK_backend.md) for detailed patterns**

### Feature Development Stories

- `title: 'Features/FeatureName'`
- Component development with real backend integration
- Accessibility-first development patterns
- Promise-based interaction patterns
- **See [STORYBOOK_feature.md](./STORYBOOK_feature.md) for detailed patterns**

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

## Reference Examples

- ✅ `StorageDemo.stories.svelte` - Backend feature demo pattern
- ✅ `EPUBUnpackerDemo.stories.svelte` - Complex backend feature demo
- ✅ `WorkspaceOPFDemo.stories.svelte` - Comprehensive backend showcase
- ✅ `SpineManagerDemo.stories.svelte` - Feature development with real backend
- ✅ `LayoutManager.stories.svelte` - Fullscreen layout with interactive demos
- ✅ `App.stories.svelte` - Complete application state demonstration

## Common Failure Scenarios & Solutions

### **Problem: "Failed to fetch dynamically imported module"**

**Cause**: Mixed CSF patterns or component/reference mismatches
**Solution**:

1. Use `defineMeta` consistently
2. Ensure component file exists before referencing
3. Check import paths are correct

### **Problem: "Storybook stories indexer parser threw an unrecognized error"**

**Cause**: Component logic embedded in stories file
**Solution**:

1. Extract component logic to separate `.svelte` file
2. Keep stories file minimal with only `defineMeta` and `<Story>` components
3. Import component from separate file

## Development Checklist

When creating a new Storybook story:

**Pre-Development:**

- [ ] Identify story type (UI component, backend feature, or feature development)
- [ ] Choose appropriate documentation guide ([backend](./STORYBOOK_backend.md) or [feature](./STORYBOOK_feature.md))
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

## Key Prevention Strategies

1. **Always start with component creation first, then story**
2. **Follow existing successful patterns** (StorageDemo, EPUBUnpackerDemo, WorkspaceOPFDemo, SpineManagerDemo)
3. **Keep stories minimal** - just configuration and story definitions
4. **Separate concerns**: Component logic ≠ Story configuration
5. **Test early and often** with `npm run storybook` during development
6. **Use TypeScript** for better error detection and IDE support
7. **Plan for error states** - demos should handle failures gracefully
8. **Choose the right pattern** - backend vs feature development approaches
