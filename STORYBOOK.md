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

- **Simple components**: Use args with controls
- **Complex features**: Use a demo component plus a play function
- **Backend features**: Use the backend demo pattern with real APIs
- **Author workflows**: Seed a project and mount the full app (see Workflow stories, below)

### 3. **Test and Capture**

```bash
npm run screenshots  # Capture component screenshots
```

## Quick Reference: the current story idiom

All stories are `.stories.svelte` files using **Svelte CSF v5** — `defineMeta` from `@storybook/addon-svelte-csf` plus `<Story>` elements. Interaction helpers come from the unified **`storybook/test`** package. Do not use the legacy CSF-TS idioms (`Meta`/`StoryObj` from `@storybook/svelte`, `new Component({ target })` render functions, `@storybook/test`) — the Svelte-4 constructor form does not run under Svelte 5 at all.

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import ComponentDemo from './ComponentDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/Category/ComponentName',
    component: ComponentDemo,
    parameters: { layout: 'centered' },
  });
</script>

<Story name="Default" args={{ title: 'Hello World' }} />

<Story
  name="Driven"
  play={async ({ canvas, userEvent }) => {
    const button = await canvas.findByRole('button', { name: 'Save' });
    await userEvent.click(button);
  }}
>
  <ComponentDemo />
</Story>
```

- Use `args` for simple prop-controlled components; give the `<Story>` element children when the demo needs markup or composition.
- Use `play` for interaction demos; `canvas`/`userEvent` arrive in the play context.
- Complex backend demos wrap the feature in a demo component (see Component Separation, below) and render it as the story component — never via a constructor call.

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

**3. Story (MyComponent.stories.svelte)**

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MyComponentDemo from './MyComponentDemo.svelte';

  const { Story } = defineMeta({
    title: 'Components/UI/MyComponent',
    component: MyComponentDemo,
  });
</script>

<Story name="Interactive" />
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

- **Seeded workflow story**: `src/stories/workflows/EditAndPackage.stories.svelte`
- **Seeded app tour**: `src/stories/NavigationRouter.stories.svelte`
- **Full-app visual states**: `src/stories/App.visual.stories.svelte` (first-run + seeded project)
- **Real-component states**: `src/stories/preview/ContentPreview.stories.svelte` (device/responsive matrix)

## Division of labour (settled 2026-07)

Unit tests in `src/lib/**/*.test.ts` are the coverage of record for backend behavior. Storybook is for what unit tests can't show: **visual states of real components**, **seeded end-to-end workflows** (the `seedProject` harness + full App), and **capture** (screenshots/videos of `capture`-tagged stories). The nine mock-driven backend demos were retired on these grounds — they passed their tests but duplicated unit-tested behavior against mocks that drift. Don't reintroduce mock-backed backend demos; write a unit test, or a seeded story that drives the real thing.

## Manual screenshots (docs illustrations)

The manuals' app screenshots are regenerated from stories. `scripts/manual-shots.json` maps each image path under `docs/*/Images/` to a story in `src/stories/manual-shots/` (the state recipe: seed, navigate, open the dialog/pane), the element to clip to, and the app **mode** the shot documents — every recipe forces Basic or Advanced Mode explicitly, since the manual illustrates both. `npm run manual-shots` (with Storybook running) rewrites the images in place at a fixed viewport and 2× scale; review the docs diff like any other change. Recipes run in `test:stories` too, so a screenshot that can no longer be produced fails loudly instead of going stale.

## Workflow stories: seeding real projects, screenshots, and videos

Workflow stories exist to capture screenshots and videos of real author workflows. They seed a **real project in the real storage backend**, mount the **full `App`**, and drive it with `play()`.

The key: `App.svelte` has no injection seam, but it restores persisted state on boot. `src/stories/utils/seed-project.ts` builds the same service graph App wires itself (`FileStorageAPI` → `WorkspaceService` → `SpineService`), creates a project with chapters, and sets the persisted `editme_app_workspace_id` — so when the story mounts `App`, it opens on the seeded book exactly as a reload would.

```svelte
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import App from '../../App.svelte';
  import { seedProject } from '../utils/seed-project';

  const { Story } = defineMeta({
    title: 'Workflows/My Workflow',
    component: App,
    parameters: { layout: 'fullscreen' },
    tags: ['capture'],
  });
</script>

<Story
  name="Do the thing"
  loaders={[
    async () => ({ seeded: await seedProject({ title: 'My Seeded Book', view: 'spine' }) }),
  ]}
  play={async ({ canvas, userEvent }) => {
    await canvas.findByText('My Seeded Book', {}, { timeout: 15000 });
    // …drive the workflow with userEvent…
  }}
>
  <App />
</Story>
```

Notes:

- `seedProject` deletes earlier seeds with the same title first, so reruns are idempotent; its returned `cleanup()` removes the workspace and keys if a story wants a tidy teardown.
- Sidebar chapter entries display **chapter ids** (`chapter01`), not titles — target those in `play()`.
- Real storage is asynchronous — use `findBy*` queries with generous timeouts, not `getBy*`.
- Tag workflow stories `capture`: `npm run screenshots` and `npm run videos` discover stories from the running Storybook's `index.json` and capture everything with that tag (`--all` or `--tag <name>` to override). Screenshots land in `__screenshots__/`, videos in `__videos__/` (both gitignored).

## Advanced patterns

The earlier revision of this section taught Svelte-4-era idioms (`new Component({ target })` render functions, `on:click`, `export let`) that no longer run in this project. The guidance below is the current-form distillation; for working code, read the reference examples listed above.

### Backend feature demos

Backend features with no dedicated UI (storage, packaging, transforms) get a **demo component** that exercises the real implementation and renders its state — buttons to trigger operations, a log pane for results. The story renders the demo component like any other; `play()` can drive it for the docs page. Prefer the real backend over mocks (the Storybook browser has working IndexedDB/OPFS); reach for `src/stories/utils/mock-storage-factory.ts` only when a story needs deterministic in-memory behaviour.

### Component separation

Keep three layers per demo: the **product component** (runes, in `src/lib/`), a **demo wrapper** (in `src/stories/`, owns demo state and fixtures), and the **story file** (metadata, args, play). Never put demo-only state in the product component, and never import fixtures from `src/lib`.

### Accessibility

The a11y addon runs on every story (report-only, `test: 'todo'`). Treat its panel as a development aid; the enforced scan is `npm run test:a11y`, which drives the real dev app. Stories should still be keyboard-walkable — if `play()` can't reach a control with `userEvent.keyboard`, neither can a keyboard user.

### Performance

- Keep loaders fast: seed the smallest project the workflow needs.
- Real-storage stories should await `findBy*` conditions, never fixed sleeps longer than the debounce they wait out.
- One workflow per story; long multi-stage tours make slow, brittle captures.

### Troubleshooting

- **Story renders nothing and the app never mounts**: a crash inside an addon or story `$effect` aborts Svelte 5's whole effect flush. Check the browser console for the first thrown error, not the last.
- **"Failed to fetch dynamically imported module"**: usually a stale Vite optimize cache after dependency changes — restart Storybook.
- **Play can't find seeded content**: the sidebar lists chapter ids, and real storage is async; use `findBy*` with timeouts.
- **Cross-story contamination**: the storage backend persists across stories in one browser session. Seed under unique titles and rely on `seedProject`'s reseed-cleanup.
