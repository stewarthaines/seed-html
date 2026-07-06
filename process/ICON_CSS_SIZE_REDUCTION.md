# Icon Subsetting & CSS Reduction — Strategy

Status: approved · July 2026

## Context

The single-file build (`dist/index.html`) is 1,084KB raw / 295KB gzip: 859KB inlined JS, 197KB inlined CSS, ~2KB markup. Two contributors are disproportionate to the value they deliver, and both can be attacked without touching features:

- **Icons.** The app imports 35 unique icons from `phosphor-svelte` (plus 4 files in the publish-to-remote plugin, which builds separately). Every phosphor-svelte icon component embeds path data for **all six weights** (regular, bold, duotone, fill, light, thin); the app renders `regular` everywhere except a `fill` set of ~8 icons — the six sidebar section icons flip `regular` ⇄ `fill` on selection via a dynamic `weight={…}` expression (`Sidebar.svelte:329,363`), plus two literal `fill` usages. Even so, roughly 2/3 of the ~160KB (pre-minify) icon payload is dead. The existing `sveltePhosphorOptimize` vite plugin only fixes dev pre-bundling, not shipped bytes.
- **CSS.** Of 197KB built CSS, ~60KB is the global design-system layer and 137KB is component-scoped styles (live — Svelte prunes unused scoped selectors at compile time). Measured against actual usage in `src/`:
  - **Utilities**: 324 classes defined in `src/styles/utilities/{layout,forms}.css` (27.4KB source); only **30 are referenced** in any component. ~91% dead.
  - **Tokens**: 560 custom properties declared across `src/styles/tokens/` + themes; **327 are never `var()`-referenced** anywhere in `src/` (~16KB of declarations, more counting the dark/light theme redefinitions).

## Goals (measurable)

| # | Goal | Baseline | Target |
|---|------|----------|--------|
| G1 | Icon payload in the built file | ~70KB (est. minified share) | ≤15KB |
| G2 | Global CSS layer (tokens + themes + utilities + global) | ~60KB built | ≤30KB built |
| G3 | `dist/index.html` total | 1,084KB / 295KB gz | ≤990KB / ≤278KB gz |
| G4 | Regressions become visible | none | size budget asserted in `npm run smoke`; icon/CSS drift checked in `npm run check` or `validate` |

Non-goals for this effort: component-scoped CSS reduction (137KB — a separate, riskier refactor of the monolith views), framework/architecture changes, self-extracting compression.

## Part 1 — Icon subset pipeline (regenerable, not ad-hoc)

### Design

A generator script owns a derived, committed icon module; imports in app code **do not change**.

1. **`scripts/generate-icons.js`** (new, Node ESM like the other generators):
   - Scans `src/**/*.{svelte,ts}` and `plugins/*/src/**/*.{svelte,ts}` for `import { … } from 'phosphor-svelte'` (regex over source, same spirit as `build-scripts/i18n-extract.js`) and collects the union of icon names **and** the weights each file uses. Weight detection covers both forms: literal `weight="fill"` attributes AND dynamic `weight={…}` expressions, by extracting every quoted weight keyword (`regular|bold|duotone|fill|light|thin`) inside the expression — this catches the sidebar's `weight={active ? 'fill' : 'regular'}` pattern. Weights are resolved per importing file (every icon that file imports gets that file's weight union), which slightly over-includes but can never under-include. An icon with no weight prop anywhere gets `regular` (phosphor's default). If a `weight` expression contains **no** recognizable literal (a fully dynamic variable), the generator fails `--check` and asks for an explicit pragma comment (`/* icons-weights: fill,regular */` on the line above) rather than guessing — no silent fallback.
   - Reads each icon's path data for exactly those weights by parsing the installed `node_modules/phosphor-svelte/lib/<Name>Icon.svelte` — the installed package is the data source, so the subset can never skew from the phosphor-svelte version in the lockfile. No new dependency.
   - Emits `src/lib/icons/generated/`: one tiny single/dual-weight `.svelte` component per icon (same props contract: `size`, `color`, `weight`, `mirrored`, rest-spread onto `<svg>`), an `index.ts` re-exporting phosphor-compatible names, and the `IconComponentProps` type re-export. A header comment marks files as generated (do not hand-edit).
   - `--check` mode: exits non-zero if the scanned import set ≠ the generated set (missing icon, missing weight, or orphaned generated file). Wired into `npm run check` so bringing in a new icon fails fast with the instruction "run `npm run icons:generate`".
2. **Resolution — vite alias, zero source churn**: `resolve.alias` maps `phosphor-svelte` → `src/lib/icons/generated` in `vite.config.ts` (and the plugin workspace configs when we extend coverage there). Authoring stays `import { House } from 'phosphor-svelte'`; dev and prod resolve identically; `sveltePhosphorOptimize` is retired. `phosphor-svelte` stays in devDependencies as data + types source.
3. **npm scripts**: `icons:generate`, and `--check` participation in `check`/`validate`.

### Why this shape

- Adding an icon is: import it as usual → `check` fails → run `icons:generate` → commit the regenerated module. No manual curation, no drift.
- The alias keeps a one-line escape hatch: delete the alias and the app is back on stock phosphor-svelte.
- Parsing the installed package (rather than a second icon-data dependency) means phosphor upgrades are handled by re-running the generator.

### Risks / mitigations

- Generated components must match phosphor-svelte's runtime API surface (context-based `IconContext` defaults?). Mitigation: check whether the app uses `IconContext` (initial scan says no); the generator fails loudly on any import it doesn't recognize (e.g. non-icon exports).
- Duotone weight needs two paths + opacity — not currently used; generator rejects weights it has no template for.

Estimated impact: 35×6 = 210 weight payloads shipped today vs. 43 needed (35 regular + 8 fill) — about −45–65KB raw, −10–15KB gzip. Re-measure after the pipeline lands.

## Part 2 — CSS reduction (phased, analysis-driven)

Principle: prune at the **source** level, kept honest by a rerunnable analysis script — no build-time PurgeCSS-style stripping (too risky with dynamically composed class names, and it hides the truth from the source tree).

1. **`scripts/analyze-css-usage.js`** (new): reports (a) utility classes defined vs referenced in component markup, (b) tokens declared vs `var()`-referenced/`setProperty`-referenced, (c) totals per `src/styles/` file. Output is a human-reviewed report, not an auto-delete. Re-run any time; optionally a `--check` mode later to prevent re-accumulation.
2. **Phase CSS-1 — utilities (biggest ratio, lowest risk)**: with the report in hand, delete the ~294 unreferenced utility classes; audit the 30 survivors for dynamic-composition false negatives (`class:` directives, template-literal class strings) before trusting the list. Decision point in review: prune the layer vs delete it entirely and fold the 30 survivors into `global.css`.
3. **Phase CSS-2 — tokens**: remove the 327 unreferenced custom properties from `tokens/*.css` **and their dark/light theme redefinitions**. Tokens reference other tokens (`--color-status-success: var(--color-success-500)`), so a single pass leaves orphans: the analysis iterates to a fixpoint — prune, re-analyze, repeat — and runs after the utilities prune (a `var()` reference from a deleted utility no longer counts as usage). Update `src/styles/DESIGN_SYSTEM.md` to match (it currently documents tokens that resolve to nothing, which has already caused bugs — see the `--color-primary*` incident). Precondition to confirm in review: **tokens are not a public API** — extensions inject into the preview iframe (own stylesheet world) and plugins render in their own iframes, so app tokens shouldn't be reachable by third-party code. If any token is deliberately public, we keep an allowlist in the analysis script.
4. **Phase CSS-3 (deferred, separate proposal)**: component-scoped CSS (137KB). Levers are different — splitting monolith views (SettingsView 98KB rendered), deduplicating repeated patterns into shared classes. Out of scope here; revisit with data after CSS-1/2 land.

Estimated impact: −25–35KB built CSS (utilities ~15KB + tokens/themes ~10–20KB), −5–8KB gzip.

## Guardrails

- `scripts/smoke-build.js` gains a budget assertion: fail if `dist/index.html` exceeds a `SIZE_BUDGET_KB` constant (set to the post-change measurement + ~3% headroom; update deliberately when features genuinely grow the app). Report raw + gzip in the smoke output so the trend is visible in every run.
- `generate-icons --check` (and optionally `analyze-css-usage --check`) in `npm run check` prevents silent drift back.
- One CHANGELOG line when shipped (smaller download is user-noticeable).

## Sequencing

1. Icon pipeline (independent, mechanical, easiest to verify: pixel-identical UI).
2. CSS analysis script + utilities prune.
3. Token prune + DESIGN_SYSTEM.md update.
4. Budget assertion in smoke, wired into validate.

Each step lands as its own commit with before/after sizes in the message; whole effort on a feature branch.

## Decisions (reviewed July 2026)

1. **Alias, not codemod** — `phosphor-svelte` import paths stay; `resolve.alias` redirects to the generated module.
2. **Utilities: prune in place** — keep the layer, delete unreferenced classes; do not fold survivors into `global.css`.
3. **Tokens are app-internal** — no public contract; prune unreferenced ones (with the iterative fixpoint below, since tokens can reference each other).
4. **Plugins stay on stock phosphor-svelte** — their builds are untouched. The generator still *scans* `plugins/*/src` so the core dev server (whose alias applies to plugin sources served through it) can resolve every icon; generating a few extra icons is cheap insurance.
