# Quality gates

A change is done when `npm run validate` passes. It runs the four gates below; run it before saying a task is complete, and run the individual commands while you work.

| Gate | Command | Passes when |
| --- | --- | --- |
| Types | `npm run check` | zero TypeScript and svelte-check errors |
| Lint | `npm run lint` | zero errors and warnings under the `--max-warnings` cap |
| Tests | `npm test` | all unit tests pass |
| Build | `npm run build` | the single-file build succeeds |

`npm run format` (Prettier) keeps formatting consistent; run it before committing.

## The lint warning ratchet

`--max-warnings` in `package.json` only goes down. A change must not add warnings; when a change removes warnings, lower the cap to the new count in the same commit. The remaining warnings are `@typescript-eslint/no-explicit-any`, typed debt paid down opportunistically: when you touch a file, type its `any`s (several carry comments naming the intended type).

## Rule policies

- **`any`.** New or edited code uses `unknown` plus narrowing, or the real type. Existing `any`s are the tracked debt above.
- **Console.** `console.warn` and `console.error` are fine on failure paths (the persistence-pattern try/catch). `console.log` never ships; a deliberate diagnostic needs an inline `eslint-disable-next-line no-console` with a comment saying why.
- **Empty functions.** Empty arrow functions are allowed (a swallowed `.catch(() => {})`); empty named functions and methods warn.
- **Imports.** Use `$lib/` paths in new code even where older code does not.

## Svelte components

Runes only. Prohibited: `export let`, top-level `$:`, `createEventDispatcher` and `dispatch`, `<slot>`, `on:` event directives. Use `$props()` and `$bindable()`, `$state()`, `$derived()` and `$effect()`, callback props, snippets and `onclick`-style attributes. Convert any legacy syntax in a file you touch; the conversion table is in [DEVELOPMENT.md](./DEVELOPMENT.md). `npm run check` errors on mixed runes and legacy syntax.

## Tests

Tests assert the documented contract, not incidental behaviour. When a test fails, decide whether the test or the code diverges from the contract, say which, and fix that one; "make the test pass" and "make the test match the code" are both wrong until that call is made. Unit tests cover logic; Storybook tests cover browser APIs. Mock external dependencies only. Patterns and environment limits are in [TESTING.md](./TESTING.md); shared mocks are in `src/lib/test/mocks/`.

## Build constraints

- Do not enable aggressive Rollup treeshaking (`moduleSideEffects: false`, `propertyReadSideEffects: false`, `unknownGlobalSideEffects: false`). Svelte 5 registers signals and context through runtime side effects; removing them fails at runtime with errors like `can't access property 'r1', t.l is null`. Vite's default treeshaking is tuned for Svelte.
- Modern browsers only; the app runs from a web server and from `file://`. No external library dependencies in the core app; Vite inlines every static resource into the single file.

## Where the rest lives

Feature workflow and the required outcomes for non-trivial work are in [DEVELOPMENT.md](./DEVELOPMENT.md). ESLint configuration and environment-specific rules are in [LINTING.md](./LINTING.md). Storybook patterns are in [STORYBOOK.md](./STORYBOOK.md). Other documents reference this one rather than restating the gates.
