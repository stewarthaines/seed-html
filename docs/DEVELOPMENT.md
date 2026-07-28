# Development Workflow Guide

## Overview

This document owns the feature development process, API documentation standards, file naming, and component guidelines. Quality gates and validation requirements live in [QUALITY.md](./QUALITY.md) — the single source of truth for those — and are not restated here.

## How process rules are layered

Process rules carry different force, and conflating them is how ritual accumulates. Three layers:

1. **Invariants** — mandatory always, no judgment involved: the quality gates in [QUALITY.md](./QUALITY.md) (zero TypeScript errors, lint ratchet, tests green, successful build), runes-only components, the naming conventions below, design-system tokens over hardcoded values. These are enforced by tooling wherever possible.
2. **Required outcomes** — every non-trivial feature must end with the artifacts listed in the next section, produced in whatever order the work makes natural.
3. **Intent statements** — guidance followed in spirit. When following the letter of an intent statement conflicts with doing the work well, the implementer does the work well and says so, rather than silently complying or silently deviating.

The previous strictly-ordered 5-step process (plan → API doc → tests → implementation → story) is retired as a sequence mandate. Its steps survive as the required outcomes below; the ordering was a proxy for discipline, and the outcomes are the discipline.

## Feature development outcomes

### Design decision record

Non-trivial design is captured in a markdown doc under `process/` (per the CLAUDE.md convention). Its core duty is not description — it is the **decision record**: judgment calls (behavior changes, trade-offs, things a user would want to rule on) are surfaced explicitly before they are implemented, and the ruling plus its rationale is written back once made ("Outcome: kept two delays, because…"). When implementation diverges from the doc for good reason, the reason goes into the doc in the same change — a design doc that drifts silently is debt, not documentation.

### Contract fixed before implementation

The public contract — API surface plus behavioral guarantees — is settled before implementation begins, in the design doc or the API.md, whichever the work produces first. Implementation then validates that the contract is practical; if it isn't, the contract changes *in the document*, not just in the code.

### Contract-level tests

Tests assert the documented contract, not the implementation's incidental behavior. Whether the test code is typed before, alongside, or after the implementation is free; the anchoring to the contract is not.

**Adjudication rule:** when a test fails, decide explicitly whether the *test* or the *code* diverges from the documented contract, state which (in the commit message or work summary), and fix that one. "Make the test pass" and "make the test match the code" are both wrong moves until that call has been made. Modifying a test is legitimate exactly when the test is the thing that diverges from the contract.

Use existing shared mocks where available in `src/lib/test/mocks/`. See [TESTING.md](./TESTING.md) for testing patterns and environment constraints.

### API documentation

Create `src/lib/{feature}/API.md` for modules that other features (or agents) consume, and update it whenever a documented interface changes. Standards below.

### Storybook coverage

Per [STORYBOOK.md](./STORYBOOK.md), coverage is **workflow-first**: workflow stories demonstrate behavior end-to-end; isolated component stories exist only for the small set of purely presentational components. A headless policy module needs no story of its own — its behavior is covered by unit tests and exercised through existing workflow stories; note that in the feature summary instead of forcing a story into existence.

### Artifact retirement

Design-time artifacts the implementation does not adopt are deleted in the same change, not kept as aspiration. Unadopted contracts read as documentation and mislead every later reader; the unused designed-up-front type surface found in the July 2026 architecture health check (`process/ARCHITECTURE_HEALTH.md`, workstream 4) is the accumulated cost of skipping this.

## API Documentation Standards

### Required Sections

1. **Overview** - Brief description of main classes and purpose
2. **Class Documentation** - Each public class with constructor and methods
3. **Method Documentation** - Input/Output/Side Effects/Usage examples for each method
4. **Type Definitions** - All publicly useful interfaces and types
5. **Common Integration Patterns** - Real-world usage examples
6. **Error Handling** - Exception types and error handling patterns

### Documentation Style

````typescript
#### methodName()

```typescript
methodName(param: Type): Promise<ReturnType>
```

**Input:**
- `param: Type` - Description of parameter

**Output:** `Promise<ReturnType>` - Description of return value

**Side Effects:** List any side effects (file creation, state changes, etc.)

**Usage:**

```typescript
const example = new ClassName();
const result = await example.methodName(value);
console.log('Result:', result);
```
````

### Key Guidelines

- **Document what was specified** — only the requested methods and behavior; do not invent features
- **Focus on Integration**: Show how the API integrates with other features
- **Practical Examples**: Include real-world usage patterns, not toy examples
- **Error Scenarios**: Document common error cases and handling
- **Browser Compatibility**: Note any browser-specific behavior or limitations

### Reference Examples

- `src/lib/epub/API.md` - Comprehensive EPUB library documentation
- `src/lib/storage/API.md` - File Storage API with backend detection details
- `src/lib/editor/API.md` - Pending-saves manager: a contract-plus-invariants document paired with a `process/` design doc

## File Naming Conventions

### TypeScript Files

Use **kebab-case** for all TypeScript filenames to maintain consistency across the codebase.

### Svelte Files

Use **PascalCase** for Svelte component filenames following Svelte conventions.

```bash
# ✅ Correct naming conventions
outline-generator.ts      # TypeScript - kebab-case
ContentPreview.svelte     # Svelte - PascalCase

# ❌ Incorrect naming conventions
OutlineGenerator.ts       # TypeScript should be kebab-case
content-preview.svelte    # Svelte should be PascalCase
```

**Exceptions**:

- Documentation files: `API.md`, `README.md`, `TESTING.md` (UPPERCASE)
- Configuration files: Follow their respective conventions (`package.json`, `tsconfig.json`, etc.)

## Component Development Guidelines

### Svelte 5 Runes (mandatory — no legacy syntax)

**All components use runes mode. Legacy Svelte 4 syntax is not permitted** and must be converted whenever you touch a file that still contains it (don't match its old style). Conversion reference:

| Legacy (Svelte 4)                                | Runes (Svelte 5)                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `export let x = d`                               | `let { x = d } = $props()`                                                     |
| `export let x` (two-way bound)                   | `let { x = $bindable() } = $props()`                                           |
| `$: y = f(a)` (pure)                             | `let y = $derived(f(a))` / `$derived.by(...)`                                  |
| `$: { …side effects… }`                          | `$effect(() => { … })`                                                         |
| `createEventDispatcher()` + `dispatch('foo', d)` | callback prop `onFoo?.(d)`                                                     |
| parent `on:foo={h}`                              | parent `onFoo={h}`                                                             |
| `<slot name="x" />`                              | `Snippet` prop + `{@render x?.()}` (parent passes `{#snippet x()}…{/snippet}`) |
| `on:click` / `on:input`                          | `onclick` / `oninput`                                                          |

`svelte-check` (`npm run check`) flags mixed runes/legacy in one component as an error, so migrate a file fully in one pass.

### Components must not own policy

Views and components hold wiring and presentation. Scheduling, persistence, identity, and lifecycle-crossing logic (anything involving `setTimeout`, epochs, or state that must survive a navigation) belongs in a plain-TS module with its own tests — a component that accumulates policy gets that policy extracted, not tested in place. `src/lib/editor/pending-saves.ts` is the reference example, and `process/ARCHITECTURE_HEALTH.md` records why (component coverage is deliberately not ratcheted, so policy living in a component is policy living untested).

### Accessibility Requirements

Before considering a component complete:

- ✅ **Use Semantic HTML**: Use proper elements (`<button>`, `<nav>`, `<input>`) instead of `<div>` with event handlers
- ✅ **Add ARIA Labels**: Include `aria-label` for icon-only buttons and controls
- ✅ **Include Focus Styles**: Apply `:focus-visible` styles using design system tokens
- ✅ **Test Keyboard Navigation**: All interactive elements accessible via Tab/Enter/Space
- ✅ **Screen Reader Testing**: Test with screen reader software when possible

### Development Patterns

- **Import Paths**: Use `$lib` alias for new code (`import { createPendingSaves } from '$lib/editor/pending-saves'`). Relative imports are acceptable for local files within the same feature directory.
- **CSS & Styling**: Use the design system in `src/styles/` (see `src/styles/DESIGN_SYSTEM.md`)
- **Browser APIs**: Prefer browser-native APIs (`DOMParser`, `querySelector`) over regex for structured data handling
- **Reference components**: `src/lib/components/metadata/MetadataEditor.svelte` (forms/validation), `src/lib/components/manifest/ManifestTable.svelte` (data display), `src/lib/navigation/views/WorkspaceView.svelte` (complex state)
