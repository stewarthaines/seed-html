# Testing Strategy Guide

## Overview

This document provides comprehensive guidance for writing tests in the seed-html project. It covers our testing strategy, framework configuration, and patterns for unit tests, integration tests, and Storybook tests. For quality standards and validation requirements, see [QUALITY.md](./QUALITY.md).

## Modern Testing Strategy

### Core Testing Philosophy

**Test behavior, not implementation** - Focus on how users interact with features rather than internal code structure. Mock only external boundaries, not internal logic.

### Test Environment Architecture

#### Unit Tests (Vitest + happy-dom)

- **Purpose**: Fast testing of pure business logic and validation
- **Environment**: happy-dom (4x faster than jsdom)
- **Focus**: Algorithms, validation rules, pure functions, error handling
- **What to Mock**: External dependencies only (file system, network)
- **What NOT to Mock**: Internal business logic, state management

#### Integration Tests (Vitest + Real APIs)

- **Purpose**: Test feature boundaries with real dependencies where practical
- **Environment**: Node.js with real file system (for file storage tests)
- **Focus**: End-to-end workflows, data persistence, cross-system integration
- **Preferred over**: Heavy mocking of internal systems

#### Storybook Tests (Real Browser)

- **Purpose**: Visual verification and full browser API testing
- **Environment**: Real browser (Chromium-based)
- **Focus**: User interactions, visual components, browser-specific APIs
- **Strengths**: Real DOM behavior, performance testing, accessibility verification

### When to Use Each Approach

| Scenario              | Unit Tests | Integration Tests | Storybook | Notes                                      |
| --------------------- | ---------- | ----------------- | --------- | ------------------------------------------ |
| **Pure Logic**        | ✅         | ❌                | ❌        | Algorithms, validation, calculations       |
| **API Integration**   | ❌         | ✅                | ❌        | Real file system, backend APIs             |
| **Browser APIs**      | ❌         | ❌                | ✅        | File API, Storage API, complex DOM         |
| **User Interactions** | ❌         | ❌                | ✅        | Click flows, form submissions, navigation  |
| **Error Handling**    | ✅         | ✅                | ✅        | Test at appropriate level for error source |
| **Performance**       | ❌         | ❌                | ✅        | Real browser performance characteristics   |

## Accessibility (a11y)

The app's accessibility is covered at three levels:

- **Compile-time** — Svelte's `a11y-*` compiler warnings, enforced by
  `svelte-check --fail-on-warnings` (part of `npm run check`). Catches missing alt
  text, labels, roles, etc. as a hard gate.
- **Component** — `@storybook/addon-a11y` runs axe-core on every story. In dev,
  `npm run storybook` shows a live **Accessibility** panel per story; headless,
  `npm run test:stories` runs axe across all stories in Chromium + Firefox
  (`preview.ts` sets `a11y.test: 'todo'` — reported, not failed; flip to `'error'` to
  gate).
- **Full page** — `npm run test:a11y` (`scripts/a11y-scan.mjs`) drives the **running
  app** with Playwright and runs axe on each view (Projects, About, Publish, Settings,
  and — after creating a project — Metadata, Manifest, Navigation, Spine). This catches
  whole-page issues (landmarks, focus order, contrast, cross-component) that isolated
  stories miss. Requires the dev server (`npm run dev`, or set `A11Y_URL`). The EPUB
  preview iframe is excluded (it's author content with its own in-preview axe).
  Report-only by default; `npm run test:a11y -- --fail-on=serious` exits non-zero on
  serious/critical violations.

## Testing Framework Configuration

### Vitest Configuration

The project uses Vitest with two distinct test environments:

```typescript
// vite.config.ts test configuration
test: {
  projects: [
    // Unit Tests - happy-dom environment
    {
      test: {
        name: 'unit',
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'happy-dom',
      },
    },
    // Storybook Tests - real browser
    {
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: 'playwright',
          instances: [{ browser: 'chromium', viewport: { width: 800, height: 600 } }],
        },
        setupFiles: ['.storybook/vitest.setup.ts'],
      },
    },
  ];
}
```

### happy-dom Limitations

**What Works:**

- Basic DOM manipulation and queries
- Event dispatch and handling
- CSS selector queries
- Form validation and submission
- Local storage simulation

**What Doesn't Work (Use Storybook Instead):**

- File API operations (`FileReader`, `File` objects)
- Complex CSS layout and positioning
- Real browser storage APIs (OPFS, IndexedDB)
- Performance measurement APIs
- Real browser event timing

## Test Development Patterns

### Unit Test Structure

```typescript
// settings-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsManager } from './settings-manager';

describe('SettingsManager', () => {
  let manager: SettingsManager;

  beforeEach(() => {
    manager = new SettingsManager();
  });

  describe('validateSettings', () => {
    it('should accept valid settings object', () => {
      const validSettings = {
        theme: 'dark',
        language: 'en',
        autoSave: true,
      };

      expect(manager.validateSettings(validSettings)).toBe(true);
    });

    it('should reject invalid theme values', () => {
      const invalidSettings = {
        theme: 'invalid-theme',
        language: 'en',
        autoSave: true,
      };

      expect(() => manager.validateSettings(invalidSettings)).toThrow('Invalid theme');
    });
  });
});
```

### Integration Test Pattern

```typescript
// storage-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStorageAPI } from './file-storage-api';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

describe('FileStorageAPI Integration', () => {
  let storage: FileStorageAPI;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), 'test-temp');
    await fs.mkdir(tempDir, { recursive: true });
    storage = new FileStorageAPI({ basePath: tempDir });
    await storage.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create and read workspace files', async () => {
    const workspaceId = 'test-workspace';
    const fileName = 'test-file.txt';
    const content = 'Hello, World!';

    await storage.writeTextFile(workspaceId, fileName, content);
    const readContent = await storage.readTextFile(workspaceId, fileName);

    expect(readContent).toBe(content);
  });
});
```

### Storybook Test Pattern

```typescript
// Component.stories.ts
import type { Meta, StoryObj } from '@storybook/svelte';
import { expect, within, userEvent } from '@storybook/test';
import ComponentDemo from './ComponentDemo.svelte';

const meta: Meta<ComponentDemo> = {
  title: 'Components/UI/Component',
  component: ComponentDemo,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveTest: Story = {
  render: () => new ComponentDemo({ target: document.body }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test user interactions
    const button = canvas.getByRole('button', { name: 'Submit' });
    await userEvent.click(button);

    // Verify results
    await expect(canvas.getByText('Success')).toBeInTheDocument();
  },
};
```

## Mock Patterns and Testing Utilities

### External Dependency Mocking

```typescript
// Mock file system operations
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock browser APIs in unit tests
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});
```

### Shared Mock Infrastructure

**Check for existing shared mocks before writing custom inline mocks.** The project maintains reusable mock utilities in `src/lib/test/mocks/` to ensure consistency and reduce duplication.

```typescript
// ✅ PREFERRED: Use shared mock infrastructure
import { createVitestMockFileStorage } from '../test/mocks/file-storage-vitest.mock.js';

const mockFileStorageInstance = createVitestMockFileStorage();

vi.mock('../storage/index.js', () => ({
  FileStorageAPI: {
    getInstance: vi.fn(() => mockFileStorageInstance),
  },
}));

// ❌ AVOID: Custom inline mocks when shared alternatives exist
vi.mock('../storage/index.js', () => ({
  FileStorageAPI: {
    getInstance: vi.fn(() => ({
      init: vi.fn(),
      isInitialized: vi.fn(() => true),
      // ... duplicated mock implementation
    })),
  },
}));
```

Available shared mocks:

- `createVitestMockFileStorage()` - Complete FileStorageAPI mock with Vitest spies
- `createMockFileStorage()` - Basic FileStorageAPI mock without Vitest dependencies

### TypeScript Mock Compatibility

When creating new mocks, ensure they provide complete interface implementations to avoid runtime errors. Use TypeScript's interface definitions to guide mock completeness.

### Shared Test Utilities

Create reusable test utilities in `src/lib/test/`:

```typescript
// src/lib/test/utils.ts
export const createMockWorkspace = (id = 'test-workspace') => ({
  id,
  name: 'Test Workspace',
  createdAt: new Date().toISOString(),
  metadata: {},
});

export const waitForCondition = async (condition: () => boolean, timeout = 1000): Promise<void> => {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (!condition()) {
    throw new Error('Condition not met within timeout');
  }
};
```

## Storybook Integration Testing

### Browser API Testing

Use Storybook for testing browser-specific functionality:

```svelte
<!-- FileUploadDemo.svelte -->
<script lang="ts">
  let files: FileList;
  let status = 'idle';

  const handleFileSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    files = input.files;
    status = 'processing';

    try {
      for (const file of files) {
        const content = await file.text();
        console.log(`File ${file.name}: ${content.length} characters`);
      }
      status = 'success';
    } catch (error) {
      status = 'error';
    }
  };
</script>

<div class="file-upload-demo">
  <input type="file" multiple on:change={handleFileSelect} />
  <div class="status">Status: {status}</div>
  {#if files}
    <div class="file-list">
      {#each Array.from(files) as file}
        <div>{file.name} ({file.size} bytes)</div>
      {/each}
    </div>
  {/if}
</div>
```

### Accessibility Testing

```typescript
export const AccessibilityTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test keyboard navigation
    const firstButton = canvas.getByRole('button', { name: 'First' });
    firstButton.focus();

    await userEvent.keyboard('{Tab}');
    const secondButton = canvas.getByRole('button', { name: 'Second' });
    expect(secondButton).toHaveFocus();

    // Test ARIA attributes
    expect(firstButton).toHaveAttribute('aria-label');

    // Test screen reader content
    const heading = canvas.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  },
};
```

## Testing Best Practices

### Test Organization

- **Group related tests** using `describe` blocks
- **Use descriptive test names** that explain the behavior being tested
- **Follow AAA pattern**: Arrange, Act, Assert
- **Keep tests focused** - one behavior per test

### Error Testing

```typescript
it('should handle network errors gracefully', async () => {
  // Arrange
  const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
  global.fetch = mockFetch;

  // Act & Assert
  await expect(api.fetchData()).rejects.toThrow('Network error');

  // Verify error handling behavior
  expect(mockErrorLogger).toHaveBeenCalledWith('Network error');
});
```

### Async Testing

```typescript
it('should handle async operations correctly', async () => {
  const promise = service.asyncOperation();

  // Test intermediate state
  expect(service.isLoading).toBe(true);

  // Wait for completion
  const result = await promise;

  // Test final state
  expect(service.isLoading).toBe(false);
  expect(result).toBeDefined();
});
```

## Development Integration

### With Feature Development

- Unit tests are written based on API specifications before implementation
- Integration tests validate feature boundaries and real dependencies
- Storybook tests provide interactive demonstrations and browser API testing

### With Quality Standards

- All tests must pass TypeScript validation
- Tests are part of the required quality gates defined in [QUALITY.md](./QUALITY.md)
- Test coverage should focus on critical business logic and user interactions

### With Continuous Integration

- Unit tests run on every commit
- Storybook tests validate visual components and interactions
- Integration tests verify system boundaries

## Testing Commands

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run Storybook tests
npm run test:stories

# Run specific test file
npm test -- settings-manager.test.ts
```

## Reference Examples

- **Unit Tests**: `src/lib/storage/file-storage-api.test.ts`
- **Integration Tests**: `src/lib/workspace/workspace-manager.test.ts`
- **Storybook Tests**: `src/stories/Backend/FileStorage.stories.ts`
- **Accessibility Tests**: `src/stories/Components/UI/Button.stories.ts`

This testing strategy ensures comprehensive coverage across different environments while maintaining fast feedback loops and realistic testing conditions.
