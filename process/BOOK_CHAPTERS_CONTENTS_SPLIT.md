# Book sidebar: split Chapters from Contents

## Problem

Book › Contents mixes two tasks on one screen. The left pane, headed "Chapters", picks chapters to move, set aside or delete, and holds Import from files and Link a folder. The right pane draws the move schematic, and below it a "Contents" block shows the contents page as generated, the "Reading starts at" choice, and (Advanced mode only) a "Write the contents by hand" link to the navigation editor. Writing the contents by hand is the common reason to come to the contents at all, and it sits at the bottom of a pane about something else, behind a setting.

## Change

The Book sidebar lists five sections instead of four: Cover, Chapters, Contents, Details, Files.

- **Chapters** is the existing `chapters` view, unchanged except that the contents block leaves its right pane: the schematic fills it. The sidebar line stays "{count} chapters". The Write sidebar's chapter heading still opens it.
- **Contents** is the existing `navigation` view (the outline editor on the left, the navigation preview on the right), now listed in the sidebar and no longer reached only through the Advanced link. It shows to everyone, not only in Advanced mode. "Reading starts at" moves here, into the editor pane above the editor, because it writes a landmark into the same nav. No sidebar line.

The view ids stay as they are (`chapters`, `navigation`); only the labels and the sidebar list change. `BookSection` and `BOOK_SECTIONS` already include `navigation`, so persistence of the last section already works.

## Edits

1. `src/lib/components/shell/BookSidebar.svelte`: sections become Cover (`cover`), Chapters (`chapters`, icon `Rows`), Contents (`navigation`, icon `ListNumbers`), Details, Files. Update the header comment.
2. `src/lib/components/shell/TopBar.svelte`: the phone row of sections gets the same five entries.
3. `src/App.svelte`:
   - BookSidebar's `currentView` passes `contentView` straight through (drop the `navigation → chapters` mapping).
   - ChaptersView loses `onEditContents`, `startReading` and `onStartReadingChange`.
   - OutlineView gains `startReading` and `onStartReadingChange`, wired as ChaptersView's were.
4. `src/lib/navigation/views/ChaptersView.svelte`: remove the contents-page block, the start-reading select, `contentsItems`, the three props and their CSS. Update the header comment.
5. `src/lib/components/outline/OutlineView.svelte`: add the "Reading starts at" select (same markup, strings and hint as now) between the PaneHeader and the editor.
   - `startReading` becomes a prop, and the internal `startReading()` loader that reads `settingsService` (:135) goes, leaving one source of truth. The write stays in App through `onStartReadingChange`, so `appState.epubSettings` (which packaging reads) stays current.
   - The select lists the linear spine items. OutlineView has no spine list today, so it loads one with `spineService.loadSpineItems` on the same spine signature ChaptersView uses, with the same `title ?? id` label.
   - After a change, call the existing `handleContentChange($outlineStore.isEmpty)`, gated on `contentLoaded`. It regenerates a generated nav and re-renders a hand-written one (both already take `startReading`), it respects `readOnly`, and it keeps the `nav.txt` clobber guard on one path.
   - The select is disabled by `structureLocked`, as now (a new `structureLocked` prop), not by `readOnly`, so review mode keeps it locked.
   - The file-selector `<select>` with one option stays as it is.
6. `src/lib/LayoutManager.svelte`: no change (`navigation` already keeps the preview pane; `chapters` already has none).
7. Update `src/lib/outline/API.md` (OutlineView props).
8. Strings: no new msgids. "Write the contents by hand" drops out on the next extract. "Chapters" and "Contents" already exist.
9. Docs: `docs/user/seed.html-how-to/Text/write-in-your-own-editor.dj` step 2 becomes "click the [Book]{.ui} tab, then [Chapters]{.ui}". No screenshot shows this screen. Check the other how-to pages for "Reading starts at" (none found) and add a how-to only if asked.
10. Tests and stories: update anything that clicks `nav-chapters` expecting the contents block, and any story of ChaptersView or OutlineView that needs the new props (none found by grep; confirm when building).

## Out of scope

- Renaming the view ids or the OutlineView component.
- The Contents editor's single-option file selector.
- A sidebar summary for Contents ("generated" vs "written by hand"); App would need to read `nav.txt` to know.

## Decisions (user, 2026-11-25)

- **Labels inside the Contents view** say "Contents": "Contents editor", "Contents preview", "Read-only contents", and a placeholder saying the contents are made from the chapters until you write your own.
- **The silent switch between generated and hand-written contents** stays for now; a line showing which mode is in use comes later.
- **Phone:** Contents without its preview is fine.

## Risks

- Five entries in the phone section row may scroll; the row already scrolls.
- The navigation view becomes visible outside Advanced mode for the first time. Its read-only EPUB notice and generation path are already used by packaging, so no new behaviour, but check a fresh book, a book with a hand-written `nav.txt`, and an imported read-only EPUB.
- The `nav.txt` clobber guard in OutlineView (`contentLoaded`) matters more now the view is visited often: verify that opening Contents on a book with a hand-written nav leaves it untouched.

## Done

`npm run validate` passes; Chapters and Contents each work from the sidebar and the phone row; reading-start still lands in the packaged nav's landmarks.
