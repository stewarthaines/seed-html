# SEED.html — project instructions

SEED.html (Simple EPUB Editor) is a Svelte 5 app that turns plain-text sources into EPUBs in the browser. Call the product **SEED.html** or **Simple EPUB Editor**, never bare "SEED"; the pre-2026 name must not reappear (`npm run validate` enforces this; the one sanctioned exception is `src/lib/storage/legacy-migration.ts`). The public face is https://readitinabook.com; the public source is https://github.com/stewarthaines/seed-html.

The user is the architect and runs the dev server, Storybook and deploys. Read the code before asking about it. For open design questions, discuss in prose and ask one question at a time; save option lists for genuine either/or forks.

## Invariants

- **Runes only.** `$props`, `$state`, `$derived`, `$effect`, callback props, snippets, `onclick` attributes. No `export let`, top-level `$:`, `createEventDispatcher`, `<slot>` or `on:` directives; convert any you touch (conversion table in `docs/DEVELOPMENT.md`).
- **Done means `npm run validate` passes**: zero TypeScript errors, lint under the warning cap, tests green, build succeeds. Fix what it reports; never raise the `--max-warnings` cap, and lower it when you remove warnings. Details in `docs/QUALITY.md`.
- **Tokens, not literals.** Every colour, size and radius in a component comes from `src/styles/tokens`; never a hex in a component `<style>`. `src/styles/design-language.md` is the visual reference. Buttons use the `.btn` utility classes.
- **Logical CSS properties** (`margin-inline`, `padding-inline-start`, …) and full keyboard operability with ARIA labels are house style; RTL locales are scaffolded and must keep working.
- **Do not enable aggressive Rollup treeshaking** (`moduleSideEffects: false` and friends): Svelte 5's signal registration is a runtime side effect and the build breaks at runtime.
- **In-app copy is not documentation.** UI strings are one or two short sentences saying what the user gains; no usage hints, attribute names or option values. Every string is translated in every catalog. `locales/*.po` is the translation source; the JSON files are generated (`docs/LOCALIZATION.md`).
- **No fallback-style code** (auto-creating files or content) unless the user approves it.

## Conventions

- **Plans and design records** go in `process/` as markdown, one line per paragraph (the user reviews in Obsidian). Decisions already taken are in `process/DECISIONS.md`; read it before proposing something that may have been declined.
- **Branches and commits.** Multi-phase or structural work goes on a feature branch and merges per shippable phase; `main` is what ships. One commit per concern, staging named files only; the working tree carries long-standing untracked noise that stays out of every commit. Commit only when asked.
- **Changelog** lines say what the user will notice, one line each; the mechanism belongs in the commit message.
- **Delegation.** Mechanical, fully specified work (scaffolding, bulk edits, transcription) can go to a cheaper-model agent with the conventions in the prompt; review its output before committing. Judgment stays in the main context.
- **Book content over the seed-bridge** is edited with the `book-editor` agent, which has no shell, network or browser by design; the bridge's authoring guide is the contract for that work.
- **User manuals** follow `docs/user/CLAUDE.md`.

## Where things are

- `docs/ARCHITECTURE.md` — how the app fits together; `docs/DEVELOPMENT.md` — feature workflow and API doc standards; `docs/TESTING.md`, `docs/LINTING.md`, `docs/STORYBOOK.md`, `docs/DEPLOYMENT.md`, `docs/EPUB_EMBEDDING.md`.
- `src/styles/DESIGN_SYSTEM.md` — tokens, utilities, themes. `src/lib/*/API.md` — module contracts. `src/lib/zip/API.md` — the ZIP library used for `SEED.zip`.
- Pipeline: plain text → `transformText.js` → `transformDom.js` → XHTML → preview. Parse XML and HTML with `DOMParser` and `querySelector`, not regular expressions.
- Storage is OPFS with an IndexedDB fallback, one project per id; browser-reload state follows the `navigationStore` pattern (`src/lib/navigation/navigation-store.ts`).
