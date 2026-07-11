# Folder sync: link a local folder to chapter content

Design for a Chromium-only feature that links a project to a local directory via `showDirectoryPicker()` and pulls its text files into chapters through the existing import review flow. Status: **implemented** (branch `folder-sync`, 2026-07-11); see "As built" below for where the implementation deviates from the sections that follow.

## As built (deviations from the design below)

- **Matching is by `sanitizeChapterId(filename)` → manifest id**, not exact source filename — that is what the import flow actually does, so "collisions as for import" made it the consistent choice ("Chapter 1.md" updates an existing `chapter-1`). A side effect inherited from import: numbered-prefix filenames get ids like `item--second` (leading digit replaced) — deterministic, so re-syncs match.
- **No staging workspace.** The scan reads file text directly into the plan rows (`scan.ts` is pure and takes pre-read inputs); the dialog previews from the plan, and the commit writes from it. The import staging area exists to bridge a File-object hand-off that folder sync doesn't have.
- **`FolderSyncReviewDialog` is a sibling composing the import pieces** (`InlineTextDiff`, list + preview + per-row radios), not an extension of `ImportReviewDialog` — remove rows, footer link-management actions, and the up-to-date state made extension invasive.
- **A fourth connection state, `unavailable`** (permission granted but the directory unreadable — unplugged media, deleted folder), distinguished from `reconnect-required` so the message can name the actual problem.
- **`SettingsService` needed changes in both directions**: `loadWorkspaceSettings` and `saveWorkspaceSettings` pick fields explicitly, so `folder_sync` had to be added to each (found by live verification — the type extension alone silently dropped it).
- Extension filter defaults to the import button's accept list (`.txt/.md/.markdown`), parameterized for per-project formats later.

## Motivation

Authors write in their own editors — Obsidian, VS Code, iA Writer — on plain text files they own. Folder sync makes SEED the packaging end of that pipeline: the linked folder is the source of truth for chapter source text, and a one-click sync brings changes in with review. This is the product thesis (plain text files the author owns) made concrete, and it reuses the trust the Kobo device-destination work established in the same API family.

## Scope

**v1 (this design):** one-way pull, folder → chapters. Manual sync only (a button click). One linked folder per project. Text source files only, top level of the folder only.

**Explicitly out of v1:** writing chapter edits back to the folder (two-way sync needs real merge UX), watching the folder for changes (`FileSystemObserver` is a Chromium-only future nudge, not a v1 dependency), media/image sync, subdirectory recursion, linking on read-only (non-SEED) books.

## UX

### Button in the Chapters sidebar section

A third icon button in the Chapters header (alongside "Import text files as chapters" and "Append Item"), always rendered, capability-gated like the device-destination button (`ConfigureForm.svelte` pattern): on browsers without `showDirectoryPicker` it renders with `aria-disabled` (not `disabled`, so the tooltip stays hoverable/focusable) and a title explaining the File System Access API requirement (Chrome, Edge). Disabled on read-only books regardless of browser.

Three states, one button:

- **Unlinked** — "Link folder…": opens the directory picker, persists the handle, and goes straight into the first sync review.
- **Linked** — "Sync folder": opens the sync review dialog (see below). The folder name appears in the tooltip.
- **Permission lapsed** — "Reconnect folder": after reload/replug, when `queryPermission({mode:'read'})` returns `prompt`, the click re-requests permission then proceeds to the review. Mirrors the device-destination Reconnect button. (With Chrome 122+ persistent permissions, revival is usually silent and this state is rarely seen — verified on real hardware in the device spike.)

### The review dialog is the "intermediate popup"

Sync is never instant — every sync opens the review dialog (reusing `ImportReviewDialog.svelte` composition), which gates all writes. That dialog carries the secondary actions the user asked about, so no extra popover is needed:

- Header: linked folder name, last-synced time.
- Body: the change list (below). When nothing changed: "Everything up to date."
- Footer: Confirm/Cancel as today, plus **Change folder…** (runs the picker again, replaces the stored handle, re-runs the scan) and **Unlink folder** (drops the handle and metadata; chapters are untouched).

Skipped files (wrong extension, hidden, sidecar) are listed in collapsed fine print so "why isn't my file a chapter?" answers itself.

## Sync contract

### Eligible files

Top-level files whose extension matches the project's adopted source format(s) (the per-project text-format choice), excluding hidden files (`.*`) and AppleDouble sidecars (`._*`) — reuse the filter written for the device file list. Everything else is listed as skipped, never imported.

### Matching

A folder file matches an existing chapter by exact source filename (the SOURCE file name). Matched + identical content → no-op (not shown, or shown as unchanged count). Matched + different content → an update row with the inline text diff, default resolution `overwrite`. Unmatched → a new-chapter row; if the _generated_ name would collide with an unrelated existing item, the standard import collision resolutions apply (`overwrite` / `keep-both` / `skip`). Matching by filename is what makes re-sync update the same chapter instead of minting `-1` suffixes.

### Ordering

Spine order is authoritative: the folder owns chapter _content_, the app owns _structure_. Sync never reorders existing chapters — renaming a file in the folder changes nothing about its spine position, and the app's reordering controls remain the one way to arrange the book. New files are appended to the end of the spine, ordered among themselves by numeric-aware natural sort (`localeCompare(..., undefined, { numeric: true, sensitivity: 'base' })`) so `2-title.md` precedes `10-epilogue.md`; a first sync into an empty project therefore lands in folder order. (Considered and rejected: folder-authoritative ordering via filename prefixes — it clobbers the app's authoring controls; and sort-position insertion for new files — less predictable than appending, and the author will position new chapters deliberately anyway.)

### Deletions

A chapter whose source file disappeared from the folder is shown as a **remove-chapter row, default unchecked** (`skip`). Sync never deletes silently — someone will link their vault root by accident.

## Persistence

Two tiers, matching the device-destination split exactly:

- **Directory handle** → a small IndexedDB store (handles are structured-cloneable, not JSON-serializable), keyed by workspace id. Pattern: `plugins/publish-to-remote/src/device-upload.ts` handle store, but this one lives in core (`src/lib/folder-sync/handle-store.ts`).
- **Link metadata** (folder display name, last-synced timestamp) → `WorkspaceSettings` in `.workspace-metadata.json` — the tier that deliberately does **not** travel with the packaged EPUB. A machine-local filesystem link must not ship inside a portable book, and must not survive into a copy of the project opened on another machine (the handle wouldn't either).

Unlinking removes both. Deleting the project removes the handle (same cleanup hook as device handles on remote removal).

## Architecture

New module `src/lib/folder-sync/` (core, not a plugin — it edits chapters, which is core's job; plugins are for publish-side destinations):

- `capability.ts` — `isFolderSyncSupported()` (`'showDirectoryPicker' in window`; shared shape with `isDeviceSupported`).
- `handle-store.ts` — IndexedDB persist/revive/remove keyed by workspace id; `queryPermission`/`requestPermission` lifecycle helpers returning the same tri-state the device code uses (connected / reconnect-required / not-linked).
- `scan.ts` — read the directory, apply the eligibility filter, and diff against the workspace's chapter SOURCE files → a `FolderSyncPlan` of rows: `update | add | remove | skipped` (adds natural-sorted among themselves), expressed as import `ReviewItem`s where possible so the dialog renders them unchanged.
- Staging: reuse `src/lib/import/import-staging.ts` verbatim — folder file bytes are staged into the reserved `importing` workspace, so the review dialog and the commit step keep their single source of truth.
- Commit: reuse the import commit path for add/update/collision rows; chapter removal goes through the existing spine/workspace services, with the workspace reassignment done via the usual `onWorkspaceUpdate` flow (the full-OPF-save clobber pitfall applies here — folder sync touches manifest + spine).

UI: the button lives in `Sidebar.svelte` next to the existing import button; the dialog is `ImportReviewDialog` extended with (a) optional header context (folder name, last synced), (b) optional footer actions (Change folder…, Unlink), (c) a remove row kind defaulting to skip. If extending the dialog gets invasive, a thin `FolderSyncReviewDialog` wrapper composing the same pieces (`InlineTextDiff`, resolution rows) is acceptable — decide during implementation, prefer extension over forking.

i18n via the gettext pipeline (`locales/*.po`, extract → translate de → convert — the JSONs are build artifacts).

## Edge cases

- **Folder on removable media, unplugged**: `getFile()` throws → treat as reconnect-required, not unlink; message names the folder (device unplug pattern).
- **Empty folder / no eligible files**: review opens with "no matching files" + the skipped list — teaches the extension filter.
- **File renamed in the folder**: matching is by filename, so a rename presents as remove (default skip) + add (appended) — the chapter's spine position would be lost if both are accepted. v1 has no rename detection; the review makes the situation visible and the safe default (skip the remove) preserves the old chapter until the author decides. Content-hash rename detection is a possible follow-up.
- **Two projects linked to the same folder**: allowed; handles are per-workspace and syncs are independent.
- **Duplicate filename after EPUB-safe normalization** (e.g. `A b.md` and `a-b.md`): second file surfaces as a collision row; `keep-both` suffixes as today.
- **Huge folders**: scan reads directory entries lazily and only reads file bytes for rows the diff needs; cap the review list before staging is unnecessary at plausible chapter counts.
- **Project duplicated in-app**: the duplicate has no link (handle keyed by workspace id) — correct, and worth a line in the manual.

## Phasing (feature branch, commit per phase)

1. `folder-sync` module: capability, handle store, permission lifecycle + unit tests (handle store is testable against fake IndexedDB; scan/diff logic pure and testable with in-memory directory fixtures).
2. `scan.ts` plan builder + tests (matching, natural sort, deletions, skip filter).
3. Sidebar button (three states, capability gating) + review dialog extension + commit wiring.
4. i18n (en+de), manual note, verification: manual e2e on Chromium (link, edit externally, sync, reorder via rename, delete file, unplug USB folder), disabled-state check on Firefox/Safari, `npm run validate`.

## Resolved during design discussion (2026-07-10)

- Sync direction: one-way pull only in v1.
- Ordering: spine-authoritative (review decision) — the folder owns content, the app owns structure; sync never reorders, new chapters append (natural-sorted among themselves).
- Deletions: reviewable, default skip.
- Reset/unlink UX: inside the review dialog footer, not a separate popup or split button.
- Persistence: handle in IndexedDB per workspace; metadata in `.workspace-metadata.json` (never travels).
- "Each file gets a chapter" refined to "each matching source file"; skipped files visible in review.
