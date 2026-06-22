# Design language

EDITME's visual identity references **Craigslist**: flat colour, a white ground, hairline
borders, blue links as the primary affordance, and hierarchy that comes from grouping,
weight, and size — not from cards, shadows, or chrome. The palette still reflects this
(`--color-primary-600` is `#0000ee` on white + neutral greys), but the reference had faded
into scattered code comments. This guide writes it down so styling decisions stay coherent.

The app deliberately **extends** the reference in two ways: a slightly larger, more
comfortable **scale** for modern large screens, and a **dark theme**. The goal is to keep
Craigslist's restraint and density _within_ that modern scale — not to reproduce
craigslist.org pixel-for-pixel.

> Reference: craigslist.org — note the dense filter sidebars (uppercase section labels like
> `PRICE`/`BEDROOMS`, paired min/max inputs, single-column tight checkbox lists, small
> reset/apply buttons) and the near-total absence of icons.

## The four decisions

1. **Scale — keep modern, but pack denser where space is wasted.** Page-level spacing is
   fine; repetitive, dense UI (forms, lists) should tighten up. The metadata editors are the
   cited example of too much space.
2. **Icons — near-zero.** Remove decorative emoji. Lean on text and clear hierarchy instead.
3. **Form controls — keep our custom dropdown.** We're happy with the existing custom
   select/dropdown styling; don't swap to native browser controls.
4. **Dark mode — stays, made consistent.** It's part of the app; the job is to make every
   component honour it.

## Colour & hierarchy

- Flat fills, **hairline light borders**, square-ish corners (`--radius-sm`). Avoid
  drop-shadows, gradients, and hover-lift except on genuinely elevated surfaces (modals).
- **Blue links** carry secondary actions; primary actions are buttons (see
  [button-design-system.md](./button-design-system.md)).
- Build hierarchy from **grouping, weight, and size**, not from boxing every section in a
  card.
- All colour comes from **semantic tokens** (`src/styles/tokens/`, themed in
  `src/styles/themes/`). Never hardcode a hex in a component.

## Typography & scale

- Use the existing type scale (`src/styles/tokens/typography.css`): `--text-xs` 11px,
  `--text-sm` 13px, `--text-base` 14px, `--text-lg` 16px, `--text-xl` 18px, `--text-2xl` 20px.
- Keep headings **restrained** — a heading is rarely more than a step or two above body.
- For dense forms, label groups with **small uppercase section labels** (the
  `PRICE`/`BEDROOMS` pattern) rather than large headings.

## Spacing & density

- Default spacing is acceptable at page level. **Tighten repetitive UI**: list rows, form
  rows, and metadata editors.
- Concrete targets when tightening:
  - Compact row gaps — `--space-1` / `--space-2`, not `--space-3`/`--space-4`.
  - **Pair related inputs inline** (e.g. min/max) instead of stacking.
  - Checkbox/option lists: single column, tight vertical rhythm, small labels.
  - Action buttons in dense contexts use `.btn-sm`.
- Model: the Craigslist housing-filter sidebar — a lot of controls in a little space, still
  legible.

## Icons

- **Near-zero.** Remove decorative emoji (e.g. ➕ 📁 in `WorkspaceActionBar`, the `➕` add
  buttons in `src/lib/components/metadata/*`, `📋` in `RemoteFileList`, `💡`/`📚` in panels
  and empty states).
- Keep only **functional** glyphs that convey something text can't, and prefer monochrome.
- Status marks (✓ / ✕ / ⚠) are borderline — **standardise** their use, don't proliferate
  them. Prefer a word where a word is clearer.

## Form controls

- Keep the app's **custom dropdown** styling (e.g.
  `src/lib/components/metadata/fields/SelectMetadataField.svelte`) — do not switch to native
  `<select>`.
- Inputs, selects, and checkboxes draw their colours/spacing from tokens, not bespoke
  per-component CSS.

## Dark mode (the consistency rule)

Dark mode breaks when components hardcode colours. The rule:

> **Every** surface, text, and border colour **must** come from a semantic token
> (`--color-bg-*`, `--color-text-*`, `--color-border-*`, `--color-button-*`, …). Never write
> a literal colour in a component `<style>`.

The theme is selected via `data-theme="light|dark"` on `<html>`; token values resolve per
theme in `src/styles/themes/{light,dark}.css`. If a component reads only tokens, both themes
just work. Components that currently hardcode colours are the dark-mode bugs to sweep.

## How to apply / status

This guide is the reference; applying it is a series of small, individually-reviewable passes.

- **Done:** the button system — [button-design-system.md](./button-design-system.md).
- **Backlog (in priority order):**
  1. **Metadata-form density** — tighten `src/lib/components/metadata/*` per _Spacing &
     density_ (the cited example; natural first pass).
  2. **De-emoji** decorative icons per _Icons_.
  3. **Dark-mode token sweep** — replace hardcoded component colours with semantic tokens.
  4. Finish the **button migration** long tail.

Don't add new ad-hoc styling that contradicts the above; fold fixes in opportunistically when
you touch a file.
