# Container-based width variants: prettier catch-up + inline alternatives

The Responsive extension no longer stamps `narrow` / `wide` / `full` onto `<body>` from a reading-system script; width policy now lives in per-block CSS containers (the three-layer ladder). This plan brings the last body-class-era consumer up to date and adds the inline-alternatives utility the old body classes used to provide for free.

## Where each extension actually stands

- **abc2svg** — already converted (`771ead3`): `abc2svg.css` implements the ladder (base `.is-default` → `@supports not` + `@media` buckets → `@container` buckets), `container-type: inline-size` on the per-block `.abc2svg-container`, transform stamps `.is-default` / `.is-widest` / `.no-wide` / `.no-full`. Switch points 30em / 45em. **No work needed.**
- **abcjs** — already converted (`6bb2f46`), same ladder, same conventions in `abc.css`. **No work needed.**
- **prettier** — NOT converted, and currently broken-by-omission: `transformPrettier.js` emits `div.code-variants` holding three `<pre class="narrow|wide|full">`, but the extension ships no stylesheet (`assets: []`) and no in-repo CSS has ever selected `.code-variants` — display policy was left to the old body classes. Since those died, all three formatted variants render stacked.

## Phase 1 — prettier: ship the ladder

1. **New asset `code-variants.css` → `Styles/code-variants.css`**, the same three layers as `abc2svg.css` / `abc.css` with the same 30em / 45em convention:
   - Layer 1 (works everywhere): `.code-variants > pre.wide, .code-variants > pre.full { display: none; }` — the narrow variant is the universal fallback, matching the abc convention (narrowest column first).
   - Layer 2 (`@supports not (container-type: inline-size)` + `@media` 30em / 45em): approximate viewport buckets.
   - Layer 3 (`@supports` + `@container` 30em / 45em): `.code-variants { container-type: inline-size; }` and precise buckets against the reading column.
   - Simpler than the abc sheets: the transform always produces exactly these three variants, so no `.no-wide` / `.no-full` / `.is-widest` machinery is needed.
2. **`extension.json`**: add the asset entry (`media: text/css`). Description stays one sentence (it already is).
3. **Transform**: unchanged — the markup is already what the stylesheet needs. (Optional hardening, same commit or skipped: bail out of re-processing `pre` elements already inside a `.code-variants`, for pipeline re-entry safety.)
4. Verify: a `js` code block in Responsive view shows exactly one variant and switches at the column buckets; paged preview shows one variant (container queries decide there — the paged rewriter deletes non-print `@media`, so layer 2 is absent in that preview and layer 3 must carry it).

## Phase 2 — inline alternatives (the heading use case)

Authoring stays exactly as it was in the body-class days:

```
## [Narrow]{.narrow}[Wide]{.wide}[Full]{.full} device
```

The container equivalent: the spans can't query anything until an **ancestor** is a container (an element can never query its own size, and `.sr-page` is deliberately not a container — chapter-wide containment breaks pagination). So the element _holding_ the alternatives becomes a small, pagination-safe container, exactly like `.sr-figure`:

1. **`transformResponsive.js`** stamps `sr-switch` on any element that has a child `.narrow` **and** a child `.wide` or `.full` (the two-class requirement avoids false positives on unrelated `.narrow` usage; `classList.add` keeps it idempotent). Authors never write `sr-switch` themselves — same philosophy as the existing wraps: the transform guarantees the markup, the stylesheet owns the policy.
2. **`responsive.css`** adds the ladder, direct-child scoped (the `img.foo` scoping lesson):
   - Layer 1: `.sr-switch > .wide, .sr-switch > .full { display: none; }`
   - Layer 2: `@supports not` + `@media` 30em / 45em swapping which child shows.
   - Layer 3: `@supports` → `.sr-switch { container-type: inline-size; }` + `@container` buckets. A heading is a full-width block, so inline-size containment on it is benign; it joins `.sr-figure` in the "small containers only" rule.
   - Absent alternatives degrade like abc's `.no-wide`: if an author writes only `.narrow` and `.full`, the 30em bucket keeps `.narrow` visible (`.sr-switch:not(:has(.wide))` is NOT available — `:has()` is newer than container queries — so mirror abc: the transform stamps `no-wide` / `no-full` on the `sr-switch` element when a variant is missing).
3. Accessibility falls out correctly: hidden variants are `display: none`, so exactly one alternative is exposed to screen readers and to search.
4. Verify: the heading swaps at 30em / 45em in Responsive view; one variant in paged/device previews; epubcheck clean (spans with classes are inert markup).

## Outcome (2026-08-03)

Both phases built and browser-verified (12/12 fixture cells across 20/35/50em columns × full/no-wide/no-full variant sets, plus 6 unit tests on the stamping in `src/lib/transform/test/responsive-switch.test.ts`).

**One discovery worth keeping**: in a `@container` condition, `em` resolves against the **container's own font-size** — not the root, and not like `@media` em (which is root-based). An `h2` at 1.5em pushed "min-width: 30em" to 45 body-ems and every sr-switch bucket fired late. Both new sheets use `rem` in `@container` conditions (root-tracking, so the reader's font-size preference still moves the buckets; identical semantics to the `@media` fallback layer). The abc sheets keep `em` — their containers are body-font divs, so it's latent there; align them to `rem` if a project ever styles those containers' font-size.

## Retune (2026-08-03, same day)

The wide→full switch moved **45 → 40** (em/rem) across all four sheets, including the abc pair and the Responsive figure breakout. Measured cause: an A4 page with the 18mm preset has a 174mm ≈ 41.1rem content column (US Letter ≈ 42.5rem) — both sat just under 45, so print always got `wide`. At 40, print paper gets the full variants; A5 (~26rem) stays narrow. Verified 16/16 in the harness with a 42em A4-stand-in column.

Two facts found while measuring the live paged preview over the bridge, for future reference:

- **Inside the Responsive extension, `.sr-page`'s 36em measure caps every descendant container** — the full bucket (40+) is unreachable there on any paper size. Projects using abc/prettier without Responsive (e.g. the bulletin) are unaffected. If full variants should appear inside the measure, the element needs a breakout like `.sr-figure`'s 120% — a separate design decision, not taken.
- **The fit-to-width Print preview applies `zoom` (~0.65 at typical pane sizes), which shrinks container layout widths** — the preview can show a narrower variant than the real print/PDF chooses. Print at 100% (or the PDF) is the truth for variant selection.

## Out of scope

- Migrating `.code-variants` to arbitrary variant sets (frontmatter-driven widths like abc's scales) — no current use case.
- A `.sr-switch` authoring shorthand in the generators/manuals — worth a manual paragraph when the advanced reference reaches the Responsive chapter, per its own cadence.
