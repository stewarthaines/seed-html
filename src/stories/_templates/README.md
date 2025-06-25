# Backend Feature Demo Templates

This directory contains templates for creating Storybook demos of backend features that don't have their own dedicated UI components.

## Quick Start

1. **Copy the template files:**

   ```bash
   cp BackendFeatureDemo.template.svelte ../YourFeatureDemo.svelte
   cp BackendFeatureDemo.template.stories.svelte ../YourFeatureDemo.stories.svelte
   cp backend-feature-demo.css ../your-feature-demo.css
   ```

2. **Update the files:**
   - Replace `YourFeature` with your actual feature name
   - Update import paths and API calls
   - Customize operations and state management
   - Update story descriptions and play functions

3. **Test your demo:**

   ```bash
   npm run storybook
   # Navigate to Backend/Your Feature Name
   ```

4. **Capture screenshots:**
   ```bash
   # Add your stories to scripts/capture-screenshots.js
   npm run screenshots
   ```

## Template Files

### `BackendFeatureDemo.template.svelte`

- **Purpose**: Main demo component with interactive controls
- **Features**: Real-time logging, state management, reset functionality
- **Customization**: Replace API calls, add feature-specific operations

### `BackendFeatureDemo.template.stories.svelte`

- **Purpose**: Storybook story definitions with play functions
- **Features**: Interactive and automated demos, comprehensive documentation
- **Customization**: Update play function logic, story descriptions

### `backend-feature-demo.css`

- **Purpose**: Consistent styling for demo components
- **Features**: Console-like appearance, responsive design, loading states
- **Customization**: Update colors, layout, component-specific styles

## Key Patterns

### 1. **Real API Integration**

```typescript
// Don't mock - use real APIs for authentic testing
let api: YourFeatureAPI;

onMount(async () => {
  api = new YourFeatureAPI();
  await api.init();
  addLog('success', 'Feature initialized');
});
```

### 2. **Interactive Operations**

```typescript
async function performOperation() {
  if (!api || isLoading) return;
  isLoading = true;
  addLog('action', 'Starting operation...');

  try {
    const result = await api.operation();
    addLog('success', `Complete: ${result}`);
  } catch (error) {
    addLog('error', `Failed: ${error.message}`);
  } finally {
    isLoading = false;
  }
}
```

### 3. **Clean Demo State**

```typescript
async function resetDemo() {
  await api.clearState();
  // Reset component state
  addLog('success', 'Demo reset complete');
}
```

### 4. **Automated Testing**

```typescript
// In stories file
play: async ({ canvasElement }) => {
  const { within } = await import('@testing-library/dom');
  const user = userEvent.setup();

  // Reset first
  await user.click(canvas.getByText('Reset Demo'));

  // Perform operations
  await user.click(canvas.getByText('Operation Button'));
};
```

## Best Practices

### ✅ **Do**

- Use real APIs, not mocks
- Include comprehensive error handling
- Provide reset functionality
- Use descriptive logging with timestamps
- Make demos self-contained
- Include both manual and automated stories

### ❌ **Don't**

- Mock critical APIs (defeats the purpose)
- Skip error handling
- Forget reset functionality
- Overload single demo (keep focused)
- Skip story documentation

## Example Usage

See `../StorageDemo.svelte` and `../StorageDemo.stories.svelte` for a complete implementation of this pattern for the File Storage API.

## Integration

### Screenshot Automation

Add your stories to `scripts/capture-screenshots.js`:

```javascript
{ name: 'your-feature-demo', url: 'http://localhost:6006/iframe.html?...' }
```

### Documentation

Reference your demo in feature documentation:

```markdown
## Interactive Demo

See the [Storybook demo](http://localhost:6006/?path=/story/backend-your-feature--demo-with-sample-data)
for a complete interactive demonstration of this feature.
```

For more details, see `../../../STORYBOOK.md`.
