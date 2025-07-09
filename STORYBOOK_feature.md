# Feature Development Patterns in Storybook

## Overview

This document captures patterns discovered during feature development, particularly from the spine item component development process. These patterns focus on accessibility-first development, real backend integration for UX development, and Promise-based interaction patterns.

## When to Use Feature Development Patterns

Use these patterns when:

- Developing components that need real backend integration for proper UX testing
- Building features with complex accessibility requirements (keyboard navigation, focus management)
- Creating components with async operations that need precise timing
- Implementing features that evolve during development (changing interfaces)
- Developing components that need authentic performance characteristics

## Real Backend Integration for Feature Development

### Pattern: Replace Mocks with Real Implementation

During spine item development, we discovered that using real backend implementations (instead of mocks) provides superior UX development:

```typescript
// ✅ RECOMMENDED: Real Backend Integration
<script lang="ts">
  import { WorkspaceManager } from '../../lib/workspace';
  import SpineSidebar from '../../lib/components/SpineSidebar.svelte';

  // State
  let workspaceManager: WorkspaceManager;
  let initialized = false;
  let error: string | null = null;
  let workspaceId = 'demo-workspace';

  // Real backend initialization
  async function initializeDemo() {
    try {
      workspaceManager = new WorkspaceManager();
      await workspaceManager.init();

      // Clean up any existing demo workspace
      try {
        await workspaceManager.deleteWorkspace(workspaceId);
      } catch {
        // Workspace doesn't exist, which is fine
      }

      // Create new demo workspace with real content
      workspaceId = await workspaceManager.createEPUBWorkspace(demoMetadata);

      // Add realistic demo content that shows real validation scenarios
      for (const chapter of demoChapters) {
        await workspaceManager.addManifestItem(workspaceId, {
          id: chapter.id,
          href: `Text/${chapter.id}.xhtml`,
          mediaType: 'application/xhtml+xml',
        });

        await workspaceManager.addSpineItem(workspaceId, {
          idref: chapter.id,
          linear: chapter.id !== 'epilogue', // Demo validation scenarios
        });

        // Create real source files (skip some for error demos)
        if (chapter.id !== 'chapter2') {
          await workspaceManager.writeTextFile(
            workspaceId,
            `SOURCE/text/${chapter.id}.txt`,
            chapter.content
          );
        }
      }

      initialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  // Initialize on mount - key pattern for real backend integration
  onMount(() => {
    initializeDemo();
  });
</script>
```

### Benefits of Real Backend Integration

- ✅ **Authentic Performance**: Real async timing and browser API behavior
- ✅ **Actual Error Scenarios**: Genuine error conditions and handling
- ✅ **True UX Testing**: Real loading states and user feedback
- ✅ **Integration Validation**: Ensures components work with actual backends
- ✅ **Development Confidence**: Proves the feature works in real conditions

## Promise-Based Accessibility Patterns

### Problem: Timing-Based Focus Management

During development, we discovered that using `requestAnimationFrame` or `setTimeout` for focus management after async operations is unreliable:

```typescript
// ❌ PROBLEMATIC: Timing-based guessing
function handleMoveDown() {
  onMoveDown();
  // Guessing timing with requestAnimationFrame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const button = document.querySelector('...');
      if (button) button.focus();
    });
  });
}
```

### Solution: Promise-Based Coordination

Use `await` to ensure operations complete before focus restoration:

```typescript
// ✅ RECOMMENDED: Promise-based coordination
export let onMoveUp: () => Promise<void>;
export let onMoveDown: () => Promise<void>;

async function handleMoveUpKeyboard(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    await onMoveUp(); // Wait for operation to complete
    // Focus restoration happens immediately after Promise resolves
    const newUpButton = document.querySelector(`[aria-label="Move ${item.id} up"]`);
    if (newUpButton) {
      newUpButton.focus();
    }
  }
}

async function handleMoveDownKeyboard(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    await onMoveDown(); // Wait for operation to complete
    // Focus restoration with fallback logic
    const newDownButton = document.querySelector(`[aria-label="Move ${item.id} down"]`);
    if (newDownButton && !newDownButton.disabled) {
      newDownButton.focus();
    } else {
      // Fallback: focus the move up button if down button is disabled
      const newUpButton = document.querySelector(`[aria-label="Move ${item.id} up"]`);
      if (newUpButton) {
        newUpButton.focus();
      }
    }
  }
}
```

### Parent Component Promise Integration

```typescript
// In parent component (SpineSidebar.svelte)
async function handleMoveUp(index: number) {
  if (isReordering || index === 0) return;
  isReordering = true;
  try {
    spineItems = await spineManager.moveChapterUp(workspaceId, index);
    // Function naturally returns Promise due to await
  } finally {
    isReordering = false;
  }
}

// Pass as Promise-returning functions
<SpineItem
  onMoveUp={async () => await handleMoveUp(index)}
  onMoveDown={async () => await handleMoveDown(index)}
/>
```

## Accessibility-First Development Patterns

### Comprehensive Keyboard Navigation

Build keyboard accessibility during development, not as an afterthought:

```typescript
// Full keyboard event handling for move buttons
<button
  class="move-button"
  on:click|stopPropagation={onMoveUp}
  on:keydown|stopPropagation={handleMoveUpKeyboard}
  disabled={isFirstItem}
  aria-label={`Move ${item.id} up`}
  title={`Move ${item.id} up`}
>
  ↑
</button>
```

### ARIA Integration Best Practices

Discovered patterns for proper ARIA usage:

```typescript
// ✅ RECOMMENDED: Use appropriate ARIA attributes for button roles
<div
  role="button"
  tabindex="0"
  aria-pressed={isSelected}  // Not aria-selected for button role
  aria-label={`${item.id}${!item.hasSourceFile ? ', has validation error' : ''}`}
>
```

### Fallback Focus Strategies

Handle edge cases where target elements become unavailable:

```typescript
// Smart focus fallback when buttons become disabled
if (newDownButton && !newDownButton.disabled) {
  newDownButton.focus();
} else {
  // Fallback: focus alternative button
  const newUpButton = document.querySelector(`[aria-label="Move ${item.id} up"]`);
  if (newUpButton) {
    newUpButton.focus();
  }
}
```

## Component Interface Evolution During Development

### Pattern: Iterative Interface Refinement

Components often need interface changes during development. Document and plan for this:

```typescript
// Initial interface (synchronous)
export let onMoveUp: () => void;
export let onMoveDown: () => void;

// Evolved interface (asynchronous for focus management)
export let onMoveUp: () => Promise<void>;
export let onMoveDown: () => Promise<void>;
```

### Managing Props During Development

Handle unused props during development:

```typescript
// Mark external reference props appropriately
export const index: number = 0; // External reference only
```

## Demo Reset and State Management

### Clean Workspace Initialization Pattern

For features that need consistent demo environments:

```typescript
async function initializeDemo() {
  try {
    // Always clean up existing state first
    try {
      await workspaceManager.deleteWorkspace(workspaceId);
    } catch {
      // Workspace doesn't exist, which is fine
    }

    // Create fresh demo environment
    workspaceId = await workspaceManager.createEPUBWorkspace(demoMetadata);

    // Add predictable demo content
    // ...
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }
}

// Expose reset for Storybook play functions
if (typeof window !== 'undefined') {
  (window as Record<string, unknown>).resetDemo = initializeDemo;
}
```

### State Isolation Between Stories

Ensure stories don't interfere with each other:

```typescript
// In each story's play function
try {
  // Reset to clean state first
  if (window.resetDemo) {
    await window.resetDemo();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Then perform demo operations
} catch (error) {
  console.log('Story demo failed:', error);
}
```

## Advanced Feature Development Patterns

### Real-Time Loading States

Show authentic loading behavior during development:

```typescript
{#if error}
  <div class="demo-error">
    <h2>Error</h2>
    <p>{error}</p>
    <button on:click={initializeDemo}>Retry</button>
  </div>
{:else if !initialized}
  <div class="demo-loading">
    <h2>Loading...</h2>
    <p>Initializing real backend...</p>
  </div>
{:else}
  <!-- Feature component with real data -->
  <FeatureComponent {realData} {realBackend} />
{/if}
```

### Error Scenario Testing

Create realistic error conditions for development:

```typescript
// Demo specific error scenarios
if (simulateError) {
  throw new Error('Simulated error for testing');
}

// Skip some files to create validation errors
if (chapter.id !== 'chapter2') {
  await workspaceManager.writeTextFile(/* ... */);
}
```

### Component Status Indicators

Show backend integration status in demos:

```svelte
<div class="demo-status">
  <h4>Backend Status</h4>
  <p>✅ Using real WorkspaceManager</p>
  <p>✅ Using real SpineItemManager</p>
  <p>✅ Using real FileStorageAPI backend</p>
</div>
```

## Feature Development Checklist

### Pre-Development

- [ ] Plan for real backend integration (not mocks)
- [ ] Design accessibility requirements upfront
- [ ] Consider Promise-based async patterns for timing precision
- [ ] Plan for component interface evolution

### During Development

- [ ] Use real backend APIs in Storybook demos
- [ ] Implement keyboard navigation alongside mouse interactions
- [ ] Use Promise coordination for focus management
- [ ] Test with realistic error scenarios

### Component Integration

- [ ] Ensure parent components return Promises for async operations
- [ ] Implement fallback focus strategies
- [ ] Add comprehensive ARIA labeling
- [ ] Create demo reset functionality

### Story Development

- [ ] Initialize real backend in `onMount`
- [ ] Create both loading and error states
- [ ] Add realistic demo content with validation scenarios
- [ ] Expose reset functions for play function testing

## Reference Examples

- ✅ `SpineManagerDemo.stories.svelte` - Real backend integration pattern
- ✅ `SpineItem.svelte` - Promise-based accessibility pattern
- ✅ `SpineSidebar.svelte` - Component interface evolution example

## Key Learnings

1. **Real backends** provide superior UX development experience over mocks
2. **Promise coordination** is more reliable than timing-based guesses for focus management
3. **Accessibility patterns** should be built during development, not added later
4. **Component interfaces** naturally evolve during development - plan for this
5. **Demo reset functionality** is essential for consistent testing experiences
6. **Error scenarios** should be realistic and testable in development environment

These patterns ensure feature development produces robust, accessible components with authentic behavior and performance characteristics.
