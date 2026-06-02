# Manifest table: group entries by path with collapsible headings

## Context

The manifest table (`src/lib/components/manifest/ManifestTable.svelte`) currently
renders a flat, sorted list of rows with a few ad-hoc full-width **separator
rows** (`.source-separator` → `.separator-label`) labelled "SOURCE.zip",
"Source Files" and "Package Files" to loosely delineate sections. There is no
real grouping: a `Fonts/` font and an `Audio/Recordings/` clip sit in one
undifferentiated manifest block.

Goal: present manifest entries **grouped by their top-level path segment**, with
each group introduced by a heading row styled like the existing separator/
SOURCE.zip rows, and made **collapsible** via a disclosure arrow. SOURCE files
collapse into a single `SOURCE.zip` group (no sub-grouping); `content.opf` keeps
its own group. This is a presentation-only change — no service or data-model
changes.

## Current behaviour (what we're replacing)

- `allItems` (≈ lines 27–48) combines: `manifest` items, a synthetic `opf`
  row (content.opf), and either individual `source` items (advanced mode) or a
  single `source-zip` placeholder (non-advanced).
- `sortedItems` (≈ lines 88–145) sorts each `_type` group by the active column
  (`id` / `href` / `size`) and concatenates: manifest, source, opf, source-zip.
- The template (`{#each sortedItems}`, ≈ lines 363–475) emits an ad-hoc
  separator `<tr class="source-separator">` when the `_type` changes, then the
  data `<tr class="manifest-row">`.
- Heading style to mirror: `.source-separator` / `.separator-cell` /
  `.separator-label` (≈ lines 718–739) — a full-width `colspan` row, muted bold
  small-caps label. The non-advanced placeholder uses `.source-zip-item`
  (italic, muted).

## Grouping rules

Group a manifest item by the **full directory path of its `href`** (everything
before the final `/` — i.e. the dirname). Every distinct directory that
_directly_ contains files becomes its own group; nesting is fully honoured and
each level is a distinct group:

- `Fonts/Inter.woff2` → group **`Fonts/`**
- `Scripts/responsive.js` → group **`Scripts/`**
- `Styles/page.css` → group **`Styles/`**
- `Audio/Recordings/track1.mp3` → group **`Audio/Recordings/`**
- `Audio/Live/set1.mp3` → group **`Audio/Live/`** (distinct from `Audio/Recordings/`)
- `Audio/intro.mp3` → group **`Audio/`**
- `nav.xhtml` (no `/`) → **root** items (see decision R1)

Because the group key is the _full_ directory, a directory with no files
directly in it never becomes a group on its own. So if nothing lives directly at
`Audio/` there is **no `Audio/` heading**, yet `Audio/Recordings/` and
`Audio/Live/` still appear as their own groups — exactly the intended behaviour.
(If a direct `Audio/intro.mp3` also exists, an `Audio/` group appears alongside
the two subgroups.)

Headings are **indented by directory depth** (segments in the dir path) so the
hierarchy reads visually even when an intermediate parent has no heading: depth-1
dirs (`Fonts/`, `Audio/`) sit flush; `Audio/Recordings/` is indented one step.
The full path is shown in the label so a deep group is unambiguous on its own.

Non-manifest entries are special-cased, not path-grouped:

- All SOURCE files → one **`SOURCE.zip`** group (kept flat — no sub-grouping by
  path, even though source files have nested paths).
- `content.opf` → one **`Package Files`** group.

Group ordering: root items first, then directory groups sorted alphabetically by
full path (case-insensitive) — which naturally clusters a parent immediately
above its subgroups, e.g. `Audio/` → `Audio/Live/` → `Audio/Recordings/` — then
`SOURCE.zip`, then `Package Files` last. Column sorting (`id`/`href`/`size`)
applies **within** each group; it never reorders or dissolves the groups.

## Proposed design

### 1. Build a grouped model (derived)

Replace the flat `sortedItems` with a derived `groups` array built from
`filteredItems` (so filtering still works):

```ts
type Group = {
  key: string; // stable id, e.g. 'dir:Audio/Recordings' | 'root' | 'source' | 'opf'
  label: string; // 'Audio/Recordings/', 'SOURCE.zip', 'Package Files'
  kind: 'root' | 'dir' | 'source' | 'opf';
  depth: number; // dir path segments (Fonts=1, Audio/Recordings=2) → heading indent
  items: typeof filteredItems; // already sorted by the active column
};
```

- Partition `filteredItems` by `_type`. For `manifest` items derive the
  directory key from `href`: `const segs = href.split('/'); const dir =
segs.slice(0, -1).join('/')` — empty `dir` ⇒ root. One group per distinct
  non-empty `dir`; `depth = segs.length - 1`.
- Reuse the existing `sortGroup(...)` helper to sort each group's items by the
  active column; sort the `dir` groups by `label`.
- Empty directories never appear (no item maps to them), which is what gives us
  the "skip the parent heading, keep the subgroups" behaviour with no special
  casing.

### 2. Render group headings + rows

For each group, emit a heading row in the separator style plus the group's item
rows when expanded:

```svelte
{#each groups as group}
  {#if group.kind !== 'root'}
    <tr class="group-heading" class:collapsed={isCollapsed(group.key)}>
      <td colspan="4" class="separator-cell">
        <button
          type="button"
          class="group-toggle"
          style="padding-inline-start: {group.depth * 1}rem"
          aria-expanded={!isCollapsed(group.key)}
          onclick={() => toggleGroup(group.key)}
        >
          <span class="disclosure" aria-hidden="true">▾</span>
          <span class="separator-label">{group.label}</span>
        </button>
      </td>
    </tr>
  {/if}
  {#if group.kind === 'root' || !isCollapsed(group.key)}
    {#each group.items as item}
      ... existing <tr class="manifest-row"> ...
    {/each}
  {/if}
{/each}
```

- **Disclosure arrow**: a single glyph (`▾` expanded / `▸` collapsed) or a CSS
  chevron rotated by the `.collapsed` class. Applied to **every** heading,
  including `SOURCE.zip` and `Package Files`.
- The heading is a real `<button>` (keyboard + `aria-expanded` for free); it
  toggles collapse only and never dispatches `itemSelect`.
- Reuse `.source-separator` / `.separator-cell` / `.separator-label` styling;
  add `.group-toggle` (full-width, transparent button, flex row, pointer) and
  `.disclosure` (small rotation transition).

### 3. Collapse state

- `let collapsedGroups = $state(new Set<string>())`; `toggleGroup(key)` adds/
  removes; `isCollapsed(key)` reads it. Default: **all expanded** (nothing
  hidden on first view).
- Optional (recommended) persistence per the project's state pattern: store the
  collapsed-key set in `localStorage` under a prefixed key
  (`editme_manifest_collapsed_groups`), restoring on init — see
  `navigation-store.ts` for the try/catch pattern. Keep it best-effort.
- When a filter is active, expand everything regardless of `collapsedGroups`
  (so matches are never hidden behind a collapsed heading).

### 4. SOURCE.zip group specifics

- The `SOURCE.zip` heading toggles the SOURCE contents:
  - **Advanced mode** → children are the individual `source` items (flat, no
    path sub-grouping).
  - **Non-advanced mode** → child is the single existing `source-zip`
    placeholder row, so it stays selectable/previewable exactly as today.
- This keeps "one SOURCE group, no subgroups" while preserving the current
  preview-on-select behaviour and the muted `.source-zip-item` styling.

## Decisions (confirmed)

- **R1 — Root-level items** (`href` with no folder, e.g. `nav.xhtml`): rendered
  **without a heading at the top**, as loose rows above the directory groups.
- **O1 — content.opf**: its own collapsible **`Package Files`** group.
- **P1 — Collapse state**: persisted to `localStorage` (prefixed key
  `editme_manifest_collapsed_groups`) so the table feels stable across reloads;
  restored on init with the navigationStore try/catch pattern, default all
  expanded.
- **C1 — Heading counts/size**: not included.
- **Subgroups**: full nested path grouping (the change captured above), with
  headings indented by depth.

## Scope / files

- Only `src/lib/components/manifest/ManifestTable.svelte`:
  - swap `sortedItems` for the derived `groups` model (keep `sortGroup`),
  - replace the ad-hoc separator logic with heading rows + collapse gating,
  - add `.group-toggle` / `.disclosure` styles; retire the three hard-coded
    `showSource*Separator` blocks.
- No changes to `ManifestContainer`, services, or the OPF model. Selection,
  validation highlighting, filtering, and column sorting are preserved.

## Verification

- `npm run check` → 0 errors; `npm run validate` green; warning ratchet holds.
- Manual (dev server): with a book containing `Fonts/`, `Scripts/`, `Styles/`,
  `Audio/Recordings/…`, `Audio/Live/…`, `Text/…`:
  - distinct headings `Audio/Recordings/` and `Audio/Live/` appear, each
    indented one step; **no `Audio/` heading** unless a file sits directly in
    `Audio/` (in which case it appears flush, above its subgroups),
  - `Fonts/`, `Scripts/`, `Styles/`, `Text/` appear flush (depth 1),
  - each heading's arrow collapses/expands its rows; `SOURCE.zip` and
    `Package Files` headings have arrows too,
  - advanced mode lists SOURCE files under the single `SOURCE.zip` group;
    non-advanced shows the placeholder there,
  - column sort reorders rows within groups without breaking grouping,
  - filtering hides empty groups and reveals matches even under collapsed
    headings.
