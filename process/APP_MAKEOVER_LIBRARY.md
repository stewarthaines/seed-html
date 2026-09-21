# App makeover: the Library model

Status: design settled on the canvas, 21 September 2026. Implementation not started.

Canvas: https://claude.ai/artifact/GUiwcGUbX9KdkmuovT7DRK (page "Library" is the direction being built; "Directions" holds the two rejected alternatives; "Today" holds the 0.21 screens for reference).

## Brief

The app has an accumulated look rather than a designed one. The first run does not say what the app is, and because the layout follows no established browser-app model, first-time users do not know what they are looking at. Settings puts unrelated sections side by side. The editor's file dropdown lists chapter text, stylesheets, scripts and transforms together; the preview-view and checks dropdowns do the same. The publish plugin's package and storage lists assume you already know what you are doing.

Two constraints came with the brief. Instructional text stays minimal: screens carry labels and values, never explanations, both for the reading and for localisation. And the editor stays a plain textarea: the app does not know the format's conventions, so there is no syntax colouring.

## What must not be lost

These are properties of the current app that the makeover inherits. Each phase is reviewed against them before it merges.

- **Full keyboard navigation.** Every control reachable and operable by keyboard, with a visible focus ring, in a sensible order. New components introduced here are the ones to watch: the shelf's `···` menu is reached by tabbing past the cover; the tabs are a `tablist` with arrow-key movement; the segmented controls are radio groups; the Settings sheet and the delete confirm are dialogs that trap focus and return it on close; the files menu is a `menu` with arrow keys and Escape.
- **ARIA labels and live regions as they exist today.** Icon-only controls (the `···` button, previous and next chapter, the layout control, the text-size buttons) carry `aria-label`s. Status lines that change (checks, transform timing, "Updated just now") stay in polite live regions. The announcements the Chapters view makes for multi-select and placement move with it into Contents.
- **Right-to-left readiness.** The stylesheets use logical properties (`margin-inline`, `padding-inline-start`, `inset-inline`) and the i18n system supports RTL, though no RTL locale ships yet. New CSS follows the same rule: no `left`/`right`, no `margin-left`; the shelf grid, the top bar, the sub-nav and the sheet all flip without special-casing. The mocks were drawn with physical properties for speed and are not a reference for this.
- **Localisable strings.** Every new label goes through the catalogs; none is composed from fragments; the "Used as" column and the device names are strings, not derived text.
- **The agent bridge.** The bridge connect control that appears next to Package EPUB in dev mode and under the npx runner keeps that place: in the top bar with Settings and Package EPUB, shown under the same conditions.

## The model

The app is a shelf of books, and inside a book there are three tabs.

- **Books** is the opening screen: a Start row (sample, blank, open an EPUB) and the shelf, covers largest. Clicking a cover opens the book in Write. Duplicate and Delete sit in a `···` menu beside each title and behind the book's title inside the book.
- **Write** keeps today's editor-left, preview-right split. The chapter list is on the left. The editor shows chapter text only; everything else about the chapter is one step in, behind "Also in this chapter". The preview has a device switch with Fill as the default and READ.html as one of the devices, a Reader toggle that opens the reading-system overrides panel (light, sepia, dark; text size), and a checks status line.
- **Book** has four screens on one sub-nav: Cover, Contents, Details, Files.
- **Share** has three outcome cards (EPUB, browser page, PDF), a "Publish to the web" card that becomes the plugin's remote list once storage is connected, and the packaged files as a table.
- **Settings** is a sheet over whatever you were doing, a list on the left split into You and This book, one section at a time.

On a phone the same tabs move to the bottom with Preview added, since the editor and preview cannot sit side by side.

The generated cover is the app's identity: the OKLCH hue ribbon, light on dark or dark on light, Georgia title, the open-book mark, italic author. Covers are the largest thing on the shelf.

## Decisions taken on the canvas

Recorded so they are not re-argued during the build.

- **First run opens a sample book that teaches by being edited.** Five short chapters: Start here, Your first chapter, Pictures and captions, Read it on a phone, Package and share. The manual and reference stay in the catalog.
- **Djot is the documented default.** The sample uses only the intersection of formats (heading, paragraphs, one picture, one comment) and never teaches syntax. Each text-format extension's own syntax example is a chapter in the files menu under "Format · <name>".
- **No Read tab on desktop.** It was drafted and rejected; the split pane is the convention. Preview is a tab only on the phone.
- **Fill is the default preview.** Dragging the split pane walks the breakpoints in one gesture. Device size variants (Standard/Plus, Compact/Extra Large, Pages/Proofs) appear as a second row only once a device is picked.
- **The second editor pane stacks.** The files-menu entry is "Open in a second pane", never "side by side".
- **The chapter title leaves the editor toolbar.** Rename lives in Book › Contents beside each chapter.
- **The cover has one home.** Files shows "Used as: Cover · Change in Cover" rather than a cover-image checkbox.
- **No project name apart from the book's title.** The shelf, the sidebar and the top bar all show the metadata title, so there is no Rename in the book menu; it is Details › Title, and the cover then shows as out of date with an Update button.
- **Source is never exported on its own.** It travels inside the packaged EPUB. The "without source" EPUB replaces the wording "without SEED", which was ambiguous.
- **Front matter stays inside the chapter source.** A chapter is one plain-text file; a leading `---` block is YAML front matter that the pipeline extracts and hands to the text and DOM transforms. The files menu does not list it as a separate file. An early mock did; it was corrected.
- **Checks is one panel.** Checks, Accessibility and Screen reader are tabs of the same panel, opened from the status line. The Reader panel is separate: it is the simulation of a reading system's theme and text size, toggled from the preview bar, and it is not the READ.html renderer, which is a device.

## Token spec

Most of the design is the existing token set. The palette, the 2px radius and Helvetica are unchanged; the design language note in `src/styles/design-language.md` still applies. The values below are what the mocks use, expressed against `src/styles/tokens`.

| Element | Value in the mocks | Token or change |
| --- | --- | --- |
| Ground, ink | `#ffffff`, `#222222` | `--color-bg-primary`, `--color-text-primary` |
| Hairlines | `#cccccc`, `#e0e0e0` | `--color-border-default`, `--color-border-subtle` |
| Secondary text | `#666666`, `#444444` | `--color-text-secondary`, `--color-neutral-700` |
| Link and primary action | `#0000ee` | `--color-text-link`, `--color-interactive-primary` |
| Selected surface | `#f0f0f0`, `#f0f0ff` | `--color-bg-secondary`, `--color-bg-accent` |
| Danger | `#dc2626` | `--color-error-600` |
| Success status line | `#166534` | `--color-success-text` |
| Warning status line | `#b45309` | new `--color-warning-text` is `#92400e`; use it |
| Top bar | 52px, hairline below | new `--bar-height`; replaces the 44px sidebar header |
| Write sidebar, Book sub-nav | 240px | `--sidebar-width` goes from 250 to 240 |
| Section labels | 11px, 700, 0.12em, uppercase | `--text-xs`, `--font-bold`; the existing "PRICE/BEDROOMS" pattern |
| Page title (Books) | 30px, 700 | `--text-4xl` |
| Screen title (Details, Share) | 22px, 700 | use `--text-3xl` (24px) |
| Tabs | 14px, active 700 with a 3px black underline | `--text-base`; new `.tabs` component |
| Buttons | 32px, 2px radius, `.btn` | existing button system; `.btn-primary` becomes blue fill, white text |
| Segmented control | 26–32px, 1px border, pressed black fill | new `.seg` component; used for devices, cover text style, text format |
| Sheet (Settings, Delete) | 1px border, `0 14px 40px rgba(0,0,0,.18)` | `--shadow-lg` from `tokens/elevation.css` |
| Menus | 1px border, `0 8px 24px rgba(0,0,0,.14)` | `--shadow-md` |
| Cover thumbnails | 30×45 (list), 44×66 (dialog), 96×144 (Cover preview), 140×210 (Start card), shelf 2:3 fluid | one `.cover` component with a size modifier; always 2:3 |
| Shelf grid | four a row, 40px column gap, 32px row gap | new; collapses to two a row under 900px, one under 500px |
| Editor and preview text | unchanged | `--font-mono` in the textarea; preview is the book's own CSS |

Dark theme: every value above is a token, so `data-theme="dark"` continues to work. The mocks were drawn in light only; the Settings sheet's Appearance section keeps the current theme choice.

## View map

Today's navigation store has nine views and the plugin. The new shell has four, plus a sheet.

| Today (`ViewType`) | New home |
| --- | --- |
| `about` | A link in the Books top bar to a short About dialog: licence, version, download |
| `workspace` (Projects) | **Books**: `WorkspaceList` and `WorkspaceItem` become the shelf; `WorkspaceActionBar` becomes the Start row; `CreateProjectDialog` is "New book"; `OPDSImportDialog` is "Sample books…" |
| `spine` (editor) | **Write**: `SpineSidebar` stays as the chapter list; `EditorPane`'s file select becomes the "Also in this chapter" menu; `PreviewPane`'s view select becomes the device switch (Fill, Phone, Tablet, E-reader, READ.html, Print, with size variants as a second row); its panel select becomes the Reader toggle plus the checks status line, with Checks, Accessibility and Screen reader as tabs of one panel |
| `chapters` | **Book › Contents** together with `navigation` |
| `navigation` | **Book › Contents**: the generated TOC on the right; the authored nav file under "Write the contents by hand" |
| `metadata` | **Book › Details**: `BasicInfoFields` as the page; `AdvancedFields` and `AccessibilityFields` behind "Advanced details"; `OPFPreview` reachable from Files |
| `manifest` | **Book › Files**: the table with a "Used as" column; source and app files hidden unless shown |
| (cover controls in `SimpleMetadataView`) | **Book › Cover**: the same controls as a screen, plus the shelf and list previews |
| `publish` and the publish-to-remote plugin | **Share**: outcome cards, the plugin inside "Publish to the web", packaged files as a table |
| `settings` | **Settings sheet**: `SettingsView`'s sections become list entries; the accordion goes |
| `Sidebar.svelte` | Replaced by the top bar (title menu, tabs, Settings, Package EPUB) and the Write chapter list |

The top bar's "Package EPUB" keeps today's behaviour; the outputs it can make (with source, without source, READ.html, SEED.html, PDF) are what the Share screen lists.

Advanced mode stays an app-level preference. It shows the file groups "every chapter" and "how chapters are made" everywhere, the Advanced sections in Settings and Details, and the hidden rows in Files. In Basic mode those appear only where the book's source already uses them.

## Phases

Each phase is a branch that merges when it can ship on its own, with the old view still reachable until its replacement lands.

1. **Shell and shelf.** The top bar with tabs, the Books screen with covers and the Start row, the title menu with Duplicate and Delete, the sample book in the Start row. The navigation store learns the four views. Everything under the tabs is the existing view, unchanged, so this phase changes the model without touching the editors.
2. **Write.** The "Also in this chapter" menu replaces the file select. The device switch replaces the view select, with Fill first and the variant row. The checks status line and the single checks panel replace the panel select. The chapter title leaves the toolbar. The layout control gathers hide-preview and second-pane.
3. **Book.** The sub-nav and the four screens, in the order Contents, Details, Files, Cover. Contents merges the Chapters and Navigation views; Details splits the metadata tabs into page and Advanced; Files adds the "Used as" column and hides app files; Cover moves the generator controls out of Metadata.
4. **Share and Settings.** Share replaces the Publish view and hosts the plugin. Settings becomes the sheet. The About view shrinks to a dialog.
5. **Phone.** Bottom tabs, the chapter strip, Preview as a tab. Breakpoints for the shelf.

Alongside, not in a phase: the sample book, five chapters in Djot, authored as a SEED EPUB and added to the sample catalog; and the strings, which are new and go through the usual catalogs.

Not touched by any phase: the transform pipeline, storage, the plugin contract, the bridge, the packaging code.

## Open questions

- **Share is per book in the mock; today's packaged list is global.** Packaged files live in the shared `publish` workspace, and the sidecar carries a title but no workspace id. Per-book Share needs the sidecar to record which book made the file, or Share needs a "from other books" section. Decide before phase 4.
- **What the sample book opens into.** The mock opens the sample from the Start row; auto-importing it on the very first visit was discussed and not decided.
- **The About page.** Reduced to a dialog in the map above; confirm that the download-the-app and licence content does not need a page of its own.
- **Loose screens not yet drawn.** Share with storage connected, the New book dialog, the Sample books picker, dark theme. All derivable from what is on the canvas; draw when a phase reaches them.
