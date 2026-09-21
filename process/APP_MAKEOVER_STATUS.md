# App makeover — build status

Working log for the build described in `process/APP_MAKEOVER_LIBRARY.md`. Read this first when resuming: it says what is done, what is in progress, and the exact next step. Keep it current after every commit.

Branch: `makeover/phase-1-shell` (from `main` at cf1f33a, 21 September 2026). Merge to `main` only when the phase ships; `main` is what deploys.

Working rules for this build (the user is away; no questions can be asked):

- `npm run validate` before every commit; a commit per concern; stage named files only.
- Old views stay reachable until their replacement lands. Nothing is deleted in phase 1.
- Every new string goes through `$t()`, then `npm run i18n:extract`, a German line in `locales/de.po`, and `npm run i18n:convert`.
- Every new control is keyboard operable with an `aria-label` where it has no text; CSS uses logical properties only.
- Visual checks run against the dev server already listening on http://localhost:5173 (the user's), via Playwright, at 1440×900 and 390×844.
- When in doubt, do the smaller change and note the doubt below under "Decisions taken while the user was away".

## Phase 1 — shell and shelf

Scope (from the plan): top bar with tabs; Books screen with covers and the Start row; title menu with Duplicate and Delete; the sample book in the Start row; navigation store learns the new views. Everything under the tabs is the existing view.

### Steps

1. [ ] Map the current shell (App.svelte, LayoutManager, Sidebar, navigation store, WorkspaceView) — in progress via an Explore agent.
2. [ ] Design note: how the four new views map onto the nine old ones without breaking tests (write into this file before coding).
3. [ ] Navigation store: add the new view ids and a mapping from old ids; keep old ids working.
4. [ ] Top bar component (`src/lib/components/shell/TopBar.svelte`): back to Books, title with menu, tabs, bridge, Settings, Package EPUB.
5. [ ] Books screen (`src/lib/navigation/views/BooksView.svelte`): Start row + shelf; reuse WorkspaceList's data loading; new BookCard component with the cover, title, author, last edited, `···` menu.
6. [ ] Wire App.svelte: Books shows no top bar and no sidebar; inside a book the top bar replaces the sidebar nav; the Chapters list stays for Write only.
7. [ ] Book tab sub-nav (Cover, Contents, Details, Files) routing to the existing metadata / chapters / manifest views (Cover → metadata for now).
8. [ ] Strings: extract, German, convert.
9. [ ] Tests updated; `npm run validate` green; Playwright screenshots at both widths compared against the canvas.
10. [ ] Status updated, commits pushed to the branch (not merged).

### Step 2 — how the shell maps onto the nine views

The nine `ViewType` ids stay exactly as they are (`about`, `workspace`, `metadata`, `manifest`, `navigation`, `spine`, `chapters`, `publish`, `settings`). They are listed in six places, mirrored between the navigation store and the layout store, and asserted by `navigation.test.ts`, `layout.test.ts` and five Storybook plays. The new shell is a layer above them:

- **Books** = the `workspace` view, redrawn as the shelf. No sidebar, no top bar; a slim brand bar with About and the theme toggle.
- **Inside a book** (every other view) a 52px `TopBar` replaces the sidebar's nav: `← Books` (→ `workspace`), the book title with a menu (Duplicate, Delete), tabs Write (→ `spine`), Book (→ the last Book sub-view, default `metadata`), Share (→ `publish`), then the bridge toggle, Settings (→ `settings`) and Package EPUB. The active tab is derived from `currentView`.
- **Book tab** shows a sub-nav row under the bar: Contents (`chapters`), Navigation (`navigation`), Details (`metadata`), Files (`manifest`). Cover is not listed until phase 3 builds its screen; the generator stays where it is today, in Details.
- **Write** keeps the chapter list on the left: a new `WriteSidebar` holds the Chapters header, the `+` button, the collapse toggle and the existing `SpineSidebar`. The other views are full width. `Sidebar.svelte` stops being rendered but is not deleted.
- **The four export buttons** (PDF, without source, READ.html, SEED.html) move from the Projects page to the top of the Publish view, which is what the Share tab shows. Share is therefore always visible; the `publishVisible` gate goes.
- **Opening a book** from the shelf loads it and navigates to `spine` (or `metadata` when it has no chapters, as import and create already do). Duplicate and Delete work on any book, not only the current one; Delete uses a dialog instead of `window.confirm`.
- **Test ids** `nav-<id>` move to the controls that stand for those views: `nav-workspace` on the back link, `nav-settings` on Settings, `nav-publish` on Share, `nav-metadata` / `nav-manifest` / `nav-navigation` / `nav-chapters` on the sub-nav, `nav-about` on the About link. `package-epub` stays on the Package button. `scripts/a11y-scan.mjs` and the testid table in `docs/STORYBOOK.md` are updated to the new labels.

### Decisions taken while the user was away

- The Start row is New book · Open an EPUB… · Sample books… (the "with books" state of the mock). The sample-first card waits for the sample book to exist.
- Cover is absent from the Book sub-nav in phase 1 (its screen is phase 3); Navigation is present until Contents absorbs it.
- Share is always visible, since it now carries the export actions that were on the Projects page.

### Progress (phase 1)

Written, not yet validated or committed:

- `src/lib/components/shell/TopBar.svelte`, `WriteSidebar.svelte`, `BrandBar.svelte` (Books, About, Settings links and the theme toggle outside a book).
- `src/lib/LayoutManager.svelte` rewritten: bars as snippets, chapter column only in Write, `--sidebar-width` 240px. `Sidebar.svelte` is no longer rendered (kept on disk).
- `src/lib/navigation/views/BooksView.svelte` replaces `WorkspaceView` in App (the old file stays on disk). It expects `src/lib/components/books/{BookCover,BookMenu,DeleteBookDialog,BooksShelf}.svelte` + `index.ts`, being built by a subagent to a spec (props listed in the spec; if resuming without them, write them to that spec).
- `PublishView.svelte`: export row (PDF, without source, READ.html, SEED.html) above the list; the plugin iframe wrapped in `.plugin-host`.
- `App.svelte`: imports, view titles (Books, Share), book-menu state and handlers (`openDeleteDialog`, `deleteCurrentBook`, `duplicateCurrentBook`, `appendSpineItem`, `openBookView`), the LayoutManager snippets, BooksView and PublishView props, the two dialogs, the old footer CSS removed.
- Tokens: `--bar-height: 52px` in `tokens/spacing.css`; `.btn-primary` is now blue with white text in `utilities/forms.css`.
- Stories and scripts: `NavigationRouter.stories.svelte` clicks `nav-book` before the sections; `docs/STORYBOOK.md` testid table; `scripts/a11y-scan.mjs` walks the new shell.

Shelf components landed (`src/lib/components/books/`): BookCover, BookMenu (accessible menu button), DeleteBookDialog, BooksShelf. `--shadow-md` added to `tokens/elevation.css` for covers and menus. `npm run check` clean; lint at 142 warnings (cap lowered from 144); all 2110 unit tests pass. German added for the 25 new strings; catalogs regenerated. The shelf loads full-size covers after the 256px row thumbnails. Opening a book from the shelf selects its last-open (or first) chapter so Write shows the editor, not the "select a chapter" placeholder.

Seen in the running app (localhost:5173, screenshots under `.playwright-mcp/makeover/dev-*.png`): Books shelf with two covers and the ring on the open book; Write with the chapter column; Book tab with its section row above the existing Metadata tabs; Share with the export row above the plugin. At 390px the bar wraps onto two rows (a stop-gap; the phone layout is phase 5).

Phase 1 committed (236621a…202a75d). After the first four commits: a first visit now lands on Books (an App-level redirect when no view is persisted; the store's default stays About so its tests hold), and the accessibility scan walks the new shell (Books and About scan clean; the About page's two findings, `.license-meta` contrast and the scrollable body, are pre-existing). Story tests (`npm run test:stories`): 16 failures on the branch; `LayoutManager.stories.svelte` (4 of them) was already stale before the makeover; the rest are being triaged against the new shell (see the log in the session scratchpad and the notes below).

## Phase 2 — Write

Branch `makeover/phase-2-write`, stacked on phase 1. The toolbars as they are: EditorPane header 1183–1310, PreviewPane header 1313–1570, options bar 1582–1683, panels 1688–1932; `preview-devices.ts`.

Scope, in commit order, each validated:

1. **Files menu.** Replace the file `<select>` in EditorPane's single-mode header with a menu button (extend `BookMenu` with group headings, a `detail` line and a checked item): groups This chapter (text, locale refs), Format (generators from text-format extensions, e.g. the Djot syntax example), Every chapter (css), How chapters are made (transforms, scripts, head.xml). Basic mode keeps today's gating (`isEditableInBasicMode`). A final item "Open in a second pane" targets pane 2 (SpineView already switches to dual). Pane 2's own select stays for now.
2. **Device switch.** Replace the "Select view" `<select>` with a segmented control Fill · Phone · Tablet · E-reader · READ.html · Print (Source appended in advanced mode); category → family mapping commute→Phone, home→Tablet, travel→E-reader, print→Print. The size variants (Standard/Plus, Compact/Extra Large, Print/Proofs) appear as chips at the start of the existing options bar once a family is chosen. The second select under split stays.
3. **Checks and Reader.** Replace the "Show panel" `<select>` with a Reader toggle button and a checks status button ("✓" or "N to fix", from the epubcheck report for this chapter plus the last axe count). The panel band gets a tab strip Checks (epubcheck) · Accessibility · Screen reader over the existing panels; panels stay mutually exclusive.
4. **Chapter title.** Remove the advanced-mode title input from the editor header; add a Title field to `EditSpineItemDialog` (writes the `SOURCE/text/{id}.json` sidecar via `writeChapterMeta`), so rename lives beside the chapter.

Not in phase 2: the layout control (hide preview and split already exist as pinned buttons), text size, the Insert select, dual-mode pane headers.

Story triage done (phase 1, commit a8209c7): the failures were the shell's, not the views'. The stories asserted the book title in the always-present sidebar and clicked chapters from any view; now the title is the top bar's heading and the chapter column exists only under Write, so the plays return to Write first. The App re-reads the persisted view on mount because the Storybook seed writes it after the store module loaded. `LayoutManager.stories.svelte` (4 failures) was stale before the makeover (Svelte 4 slot syntax against snippet props) and is left as is.

### Phase 2 progress

Step 1 (files menu) built: `BookMenu` now supports group headings, a detail line, a checked item (`menuitemradio`), a text trigger and start alignment; EditorPane's pane-1 picker is a current-file chip plus an "Also in this chapter" menu grouped This chapter / Every chapter / How chapters are made, with "Open a second pane" last. Pane 2 keeps its `<select>`. Decision: generator scripts (the Djot syntax example among them) sit under "How chapters are made", since what the entry opens is the generator's source, not a sample chapter; the plan's "Format · Djot" chapter needs a sample chapter to exist first. Six new strings with German. `TransformPipeline.stories.svelte` drives the menu instead of the select.

Step 1 committed (3c933c3). Step 2 (device switch) built in PreviewPane: a `role="group"` of family buttons Fill · Phone · Tablet · E-reader · READ.html · Print (Source in advanced mode) replaces the primary "Select view" dropdown; a sizes row (Standard / Plus, Compact / Extra Large, Print / Proofs) appears under the header when the family has more than one; the split's second dropdown is unchanged. Families map from the presets' categories (commute → Phone, home → Tablet, travel → E-reader). Four new strings with German. Seen in the app at 1440px: the header wraps to three rows at the default split; step 3 shrinks the Checks dropdown to a button, which should pull it back to two.

Steps 2 and 3 committed together (335524a; one file, PreviewPane): the "Show panel" dropdown is a Reader toggle plus a checks button ("✓", or "N to fix" from epubcheck's chapter count and the last axe count) that opens the last-used check panel; the check panels (EpubCheck, Accessibility, Screen reader) share a tab strip at the top of the band. With the dropdown gone the header fits in two rows again at the default split.

Step 4 (chapter title) built: `EditSpineItemDialog` gains a Title field (first, focused, placeholder = the id) and saves it to the `SOURCE/text/{id}.json` sidecar through the chapter column's edit button; a `chapter-meta-changed` window event makes SpineView re-run the transform so the preview's `<title>` follows. The advanced-mode title input is gone from the editor header, along with its props. No new strings (Title exists).

Step 4 committed (665c7db). Phase 2 is complete on `makeover/phase-2-write` (four commits on top of phase 1), pending review. Seen in the app: the files menu, the device switch with the Standard/Plus row, the checks button opening the Accessibility panel with its tab strip, and the chapter dialog with the title pre-filled.

## Review notes for the user

- Phase 1 (`makeover/phase-1-shell`, 7 commits) and phase 2 (`makeover/phase-2-write`, 4 commits) are stacked; merge phase 1 first or merge phase 2 alone, which carries both.
- Decisions taken alone are listed under each phase above; the ones most worth a look: Share always visible with the export row; Cover absent from the Book sub-nav until phase 3; generator scripts under "How chapters are made"; the first-visit redirect to Books; `Sidebar.svelte` and `WorkspaceView.svelte` left on disk unrendered.
- `LayoutManager.stories.svelte` fails as it did before the makeover (Svelte 4 slot syntax); it describes the old layout and can be deleted or rewritten with phase 3.

### Next step

Phase 3 (Book tab): Cover screen first, then Files, then Contents merging Chapters and Navigation, then Details. Branch `makeover/phase-3-book` stacked on phase 2.
