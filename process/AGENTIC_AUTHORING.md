# Agentic authoring — findings, ergonomics and bridge hand-over

Status: proposed, for review. Written 2026-11-17 after a full day of an agent (Claude in Chrome) building the "Coming Out" family-history book at readitinabook.com with no seed-bridge; reworked the same day after the decision (`process/DECISIONS.md`, 2026-11-17) that the hosted site offers no agent automation surface. Companion to `process/AGENT_BRIDGE.md` (the localhost bridge, design of record) and `process/BROWSER_AGENT_INTEGRATION_2026.md` (the browser survey behind the decision).

## Scope after the decision

Agent authoring is a developer workflow: Claude in Chrome and Claude Code both need a subscription, and the npm package (`npx seed-html`) is in scope for that developer. So books handed to an agent live on localhost, where the seed-bridge reaches them; a book started on readitinabook.com moves there the usual way, by downloading its EPUB and opening it in the localhost copy (OPFS belongs to its origin). The hosted site gets nothing agent-specific beyond accessible UI, which consumer browser agents (Gemini auto browse, the ChatGPT extension) will use anyway. In scope: the app's own ergonomics and correctness for anyone driving it, and expanding the bridge until a whole-book hand-over to Claude Code needs nothing from Claude in Chrome (proposal 1).

## Background: how an agent can work with the app

Ordered from most visible to the author to least. Methods 3 and 4 were used on 2026-11-17 only because the hosted book had no bridge; with books on localhost they should not be needed, and when one is used anyway the agent names it as it happens and lists it at the end.

1. **The seed-bridge.** Consent by gesture, every write through app services, an activity record. Localhost only.
2. **Driving the UI as a person would:** clicks, typing, screenshots. The app sees ordinary actions; slow and fragile (coordinates, hidden panels, dialogs).
3. **Page scripting through the UI's own inputs:** setting the editor textarea with the native setter and dispatching `input`, so the app treats it as an edit (preview, save and track changes work). Nothing records that an agent made it.
4. **Direct storage writes** to OPFS or IndexedDB. Fast and invisible to the app: preview, manifest, track changes and undo all miss them. Used on 2026-11-17 for `page.css`, `transformDom.js` and `SOURCE/plugins/photo-regions/regions.json`, without telling the author at the time.
5. **Direct storage reads.** Harmless to the book, and the most reliable way to check generated XHTML, plugin stores and validation JSON.
6. **The browser upload tool on a file input,** limited to files in the agent's session scratchpad. The app handles the import normally, including the conflict dialog.
7. **Playwright with its own profile.** Cannot see the author's books, since storage belongs to each profile and origin; useful for testing the app, not for authoring a real book.

## What went wrong on 2026-11-17, by kind

### Pipeline and extension bugs (fix regardless of agents)

- **Explicit djot heading ids are overwritten.** Djot's syntax for an explicit id is a block attribute on the line above the heading (`{#emma-arrival}` then `## Emma's arrival`); djot puts it in the section's `attributes.id`, and SEED's `idFilter` in `extensions/djot/transformDjot.js` replaces it with a slug of the heading text, so every `#emma-arrival` link fails epubcheck (RSC-012). Separately, the pandoc-style trailing form used on 2026-11-17 (`## Emma's arrival {#emma-arrival}`) is not djot syntax at all: djot drops it silently. Fix: the filter keeps an explicit id (normalised only if it is not a legal XML id, with links normalised the same way) and slugs only djot's automatic ids (`autoAttributes.id`); the djot SYNTAX.md says where an explicit id goes.
- **A footnote cited twice yields duplicate `fnref` ids** (RSC-005). The djot extension should number the second reference, as the djot reference implementation does.
- **Photo-regions crops are skipped silently when the panel's store lacks the image size.** Regions authored as text (copied from another book, or by an agent) never get a size, so `:portrait:` renders nothing, with only a console warning. The transform could read the size from the image itself, or the app could record sizes when an image is added.
- **Place-maps panel keeps the previous place selected after a free-typed add,** so the next typed search offers "Replace map" for the earlier place. One click would have overwritten Melksham with Manchester.
- **The validation report dialog collapses** when there are no destinations (already noted for a min-height fix).
- **Packaging does not re-render.** After a transform or stylesheet change, every chapter must be re-rendered by hand (we nudged each editor), or the EPUB carries stale XHTML.
- **The preview caches stylesheets.** A `page.css` written straight to OPFS never reached the preview until it was re-saved through the editor.

### Starting-point gaps (project type and starter files)

- **The family-history project type omits the figures extension,** although every family book uses `{.figure title=…}` captions. The photographs page rendered captionless until it was added from Settings → Content transforms.
- **The place-maps plugin quietly depends on family-history** (already noted).
- **The starter `page.css` uses a bare `serif`,** which Books renders as San Francisco; the Allen and Wells stack had to be copied in.
- **Defaults that every book then reinvents:** the footnote backlink label and size (small and crowded in Books), and `break-inside: avoid` on table rows.

### Discoverability and state (hard for agents, confusing for people)

- **Panels live in an "Insert" select.** Place Maps, Photo Regions, Images and Generators are not visible until the select is opened; the agent hunted through the pane toggle and opened a stray split pane first.
- **The editor's file is invisible to the accessibility tree.** The editor staying on `page.css` while chapters switch is a feature (styling or scripting while checking the layout across chapters), but each textarea's accessible name is "Pane 1 content" rather than the file it holds, so an agent driving the UI cannot tell which file it is about to write. Only a file-name guard stopped a chapter's text being written into the stylesheet.
- **Findings have no readable home.** family-history findings print only inside a `:family:` panel or to the transform console; the records-only introduction had no panel, so the records were checked offline against the schema instead.
- **The preview iframe's paged views nest documents,** so checks went through the generated XHTML in OPFS rather than the preview.

### Moving things in

- **No way to hand the page a file.** The browser upload tool only accepts files from the session scratchpad; the cropped newspaper page went in through Book → Files → "Add files…", which then raised the import-conflict dialog (Overwrite was right). Over the bridge this becomes a tool (proposal 1).
- **Imported file names change case** (`.JPG` → `.jpg`), so references copied from another book break.

## Proposals

### 1. Bridge parity for a whole-book hand-over

The first three gaps are designed in `process/BRIDGE_HANDOVER_TOOLS.md` (draft for review).

Goal: the author can hand Claude Code a full book project over the bridge, as was done in Chrome on 2026-11-17, with Claude in Chrome offering no advantage for book work. Today's bridge reads anything, measures the preview, reports checks, and overwrites existing non-generated files under a per-write or session grant (code always reviewed as a diff). What the day needed that it cannot do, roughly in order of how much it blocked:

- **Create things.** New chapters (with spine position, title and linear flag) through the app's spine service, and new files under the writable roots. The day added two chapters and a regions store.
- **Add media from disk.** The bridge process runs locally, so a tool can take a local path (limited to a directory the author names when starting the bridge) and import it through the app's media service, manifest included, with the app's file-name rules reported back. No base64 through the agent's context, no 2 MB write cap for images.
- **Render, package and validate on request,** returning when settled: render one chapter or all, package, run epubcheck, and return the report JSON. `seed_get_checks` already reads the report and its freshness; this closes the loop without asking the author to click. Any chapter's output can already be read with `seed_read_file` on `OEBPS/Text/`, but it is the last render, stale after a transform or stylesheet change until re-rendered.
- **Show a chapter in the preview,** returning once the render settles. `seed_inspect_elements`, the axe half of `seed_get_checks` and `seed_get_rendered_xhtml` all work on whichever chapter is previewed; in a hand-over the author is not there to open it, so measuring and checking every chapter needs the agent to choose.
- **Settings and extensions** through a narrow tool (enable an extension, order transforms), reviewed like code since it changes what executes. The day added the figures extension.
- **Plugin stores as documented formats, plugin actions later.** Place Maps adds a place by searching Nominatim and writing a register entry with coordinates and provenance (`plugins/place-maps/src/nominatim.ts`, `register.ts`); today an agent can only do that by clicking through the panel. The bridge already allows writes under `SOURCE/plugins/`, so the cheap step is documenting each plugin store (the place register, the photo-regions store) as an agent-writable format, and fixing photo-regions to read image sizes itself (proposal 4). The general step, worth it once several plugins do real work behind their panels: a plugin declares actions in its manifest (name, description, input shape), the bridge lists enabled plugins' actions as tools, and a call wakes the plugin headless and passes the request over the plugin postMessage API, so each plugin's knowledge stays in the plugin. Plugins are UI iframes launched with their panel today, so this needs a headless mode and request/response actions in `src/lib/plugins/API.md`.
- **Patch writes** (`process/BRIDGE_PATCH_WRITE.md`), so a long chapter is not resent whole for a one-line change.
- **Metadata, rename, delete and spine moves,** each through app services and shown in the feed; delete always confirmed.
- **A hand-over grant.** A session grant that covers prose writes and creation for the whole hand-over; code and settings keep their per-change review. Not track changes: review mode blocks spine changes and tracks only prose and script files, so it cannot hold a session that creates chapters or adds media.

What stays with Claude in Chrome even then: seeing pixels. `seed_inspect_elements` measures layout, but "does the map sit well beside the paragraph" was judged from screenshots. `AGENT_BRIDGE.md` records capture as phase 3; a preview-only capture the author starts once per session (`getDisplayMedia` on the preview surface) would close most of it. Research on sites where the author is signed in (Trove, Ancestry, FamilySearch) also stays a browser job, separate from editing the book.

Which agent: a hand-over with image work needs a shell (cropping, size checks), so it runs in the main Claude Code context rather than the restricted `book-editor` agent. For the author's own books that is fine; for a book from someone else, the `book-editor` agent and its missing tools remain the right choice, and the AGENTS.md trust rules (proposal 7) apply.

### 2. Findings any surface can read

Transforms and extensions report through `ctx` to one place in app state (decided 2026-11-17: findings are app state, not a file in the book), which the Write view and the bridge both read: family-history findings, photo-regions crops skipped and why, maps with no register entry, unresolved `of=` ids. The Write view shows a count; the agent reads the list through `seed_get_checks` (`BRIDGE_CHECKS.md`), widened to extension findings.

### 3. Re-render on request when packaging

Decided 2026-11-18: no staleness detection. Packaging still zips the chapters as last saved by default, because normal use is editing chapter content, and saving a chapter already renders it. A "Re-render all chapters first" checkbox in the Share view's package card applies to every package action there (EPUB, without sources, READ.html, SEED.html). Ticking it is the author's call: the app does not tick it after a transform or settings change, since transform work is a design phase the author knows they are in. The agent gets the same through `seed_render` before `seed_package` (and the authoring guide says so after transform or settings edits).

Measured 2026-11-18 with `seed_render` (per-chapter timing, dd3cc8b) in Firefox: about 0.2 s per chapter as a floor, about 1.2 s (up to 1.8 s) for a family-history person chapter, about 2 s (up to 3.3 s) for a Bricks page. Whole book: "Coming Out" 28 chapters 20 s, Haines 49 chapters 48 s, "hello, world!" 16 chapters 29 s. The render pass belongs inside the package progress bar.

Considered and set aside: per-chapter staleness by timestamps, by edit events, or by fingerprinting each render's inputs (the broker sees every `ctx` read); the fingerprint was the best of them but its cost in design and false-stale edge cases outweighed an author-ticked full render.

### 4. Fixes and defaults from the list above

Done on branch `agent-ergonomics` (2026-11-17), not merged: heading ids and repeat footnote ids (djot), photo-regions reading image sizes, the place-maps selection, the editors' accessible names, and the starter serif stack; also the in-page confirm dialog from proposal 5. Still open: the report dialog, the preview stylesheet refresh, the backlink and table-row defaults.

Heading ids, duplicate footnote refs, photo-regions sizes, the place-maps selection, the report dialog, the editors' accessible names (each textarea labelled by its visible file name through `aria-labelledby`, instead of "Pane 1 content"; the editor staying on a stylesheet or script while chapters switch is a feature, for checking layout across chapters, and stays), the preview stylesheet refresh, a named serif stack in the starter `page.css`, and the backlink and table-row defaults in the djot and responsive extensions. Where figures belongs is review question 5.

### 5. Stable, labelled controls and in-page dialogs

Every panel reachable by an accessible name, not only through the Insert select; the Validate action and its result exposed as text, not a badge alone. Good for screen-reader users and for agents alike. The survey found the accessibility tree is the one input every browser agent shares (Playwright MCP, Claude in Chrome, Stagehand), so this is the change with the widest reach, including consumer agents on the hosted site.

Replace the seven native `confirm()` calls with in-page dialogs like the review dialogs: they stall Claude in Chrome and block automation generally. They are in `src/App.svelte` (three), `src/lib/navigation/views/PublishView.svelte`, `src/lib/components/SpineSidebar.svelte`, `src/lib/components/manifest/ManifestContainer.svelte` and `src/lib/components/spine/EditorPane.svelte`.

### 6. Hand-over: a readable record

The working copy is not precious: the author backs up by downloading the book's EPUB before handing it over, the same way books move between browsers, so undoing bulk changes in place is of little value. What the author needs is to see what happened, not only read the agent's summary. The bridge's activity feed already shows each write; it would group them by session and include creations and spine changes. Track changes is not the tool for a hand-over, because review mode blocks spine changes and tracks only prose and script files; it fits a different session, a prose or script revision pass on a book whose structure is settled, where per-change review beats a feed.

While an agent session is active, the preview should not fetch remote images, fonts or CSS from book content: rendered remote images are how the 2025 EchoLeak and CamoLeak attacks exfiltrated data, and a hostile imported book could do the same.

### 7. A hand-over brief in the book

A short file in SOURCE (for example `SOURCE/AGENTS.md`) holding the book's conventions: record ids and where they live, where research and citations go, the footnote and caption style, what not to touch. It travels with the book, the author sees and edits it in Files, and any agent or later session starts from the same contract. On 2026-11-17 those conventions lived in the agent's memory and the plan document. `AGENT_BRIDGE.md` already lists "`AGENTS.md` generated into SOURCE/" among its follow-ups. The filename has wide support (stewarded by the Linux Foundation's Agentic AI Foundation since December 2025), which favours it over a SEED.html-specific name. The bridge would serve it from `seed_get_project_setup`, inside the untrusted-content envelope like every other project read.

The survey's guidance on trust, carried over from how coding tools treat repository instructions (no vendor covers instruction files inside documents): the file is data until the author trusts the project; trust is per project, revocable, off by default for imported books, and reset when an import or sync changes the file; the author's own prompt overrides the brief; and writes to AGENTS.md (and CLAUDE.md, transform scripts and stylesheets) always need confirmation with a visible diff, because hijacked agents have persisted by rewriting these files. How far an agent follows a trusted brief is review question 4.

## A working process for agent-authored books

- **Hand-over books live on localhost,** reached over the bridge; a hosted book moves by downloading its EPUB and opening it there.
- **Download the EPUB before handing over;** that is the backup.
- **The app's copy is the source of truth.** Local drafts are staging; before writing, compare against the current file and patch it, never overwrite from a draft (the author hand-edits in between).
- **Guard every write:** confirm the target file, confirm the expected text is present, change only the intended span. The bridge's `expected_hash` enforces the second.
- **Go through the bridge or the app;** if a direct storage write is ever the only way, say so before or with the write and list it at the end of the task.
- **One place per call:** do not chain several panel actions in one step; each step's result decides the next.
- **Verify from output, not the preview:** read the generated XHTML for counts and structure, and look at the page only for appearance.
- **Re-render after any transform or stylesheet change, then package and validate at each milestone,** reading the validation report for error and warning counts.
- **Keep decisions in the plan document and in memory,** including which copy is ahead.

## Review questions

1. Bridge parity order: agreed 2026-11-17 — create chapter, add media from disk, then render/package/validate.
2. Findings: decided 2026-11-17 — app state.
3. Packaging stale chapters: decided 2026-11-18 — no staleness test; an author-ticked "Re-render all chapters first" checkbox on packaging (section 3).
4. A book's `SOURCE/AGENTS.md`: conventions the agent follows within the task the author gave, once the project is trusted (agreed in principle 2026-11-17); parked for now.
5. Figures: for the next session. Useful beyond family history and beyond djot, so the question is where it belongs as a general feature, not which project type gets it.
