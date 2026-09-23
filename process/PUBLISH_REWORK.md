# Publish rework — Send, Published, Destinations

Design record and build plan for splitting the publish-to-remote plugin's two jobs (sending a packaged EPUB to a destination, and curating the catalog on that destination) into surfaces that fit the Library makeover. Agreed on the design canvas (page "Publish" of the makeover canvas, 23 September 2026): Share's per-destination Send band, the Published page, Settings › You › Destinations, and the import confirm.

## What was wrong

The plugin was one two-pane workbench: every local package on the left, one destination's file listing on the right, with destination setup, upload, catalog curation and epubcheck all sharing the frame. Four workflows in one place, and the local list duplicated the Share page's cards and table.

## The shape now

One plugin build, three surfaces. The host names the surface in the `init` message and the plugin renders only that surface; nothing else about the protocol changes for older plugins, which ignore the field.

**Share › Publish to the web (surface `send`).** A band on the Share page listing your destinations. Each row says what this book's latest package is doing there (sent and current, sent but a newer package is here, not sent, or why it cannot be reached), has one Send button, and, on destinations with a catalog, an "In the catalog" switch. The head of the band names the latest package with its epubcheck state and a Validate or Report button; the report modal stays in the plugin. The foot links to Published and to Destinations.

**Published (surface `published`).** A page beside Books in the brand bar, shown only when the plugin is on. A destination picker, then the catalog's identity (title, format and file, author name and link, updated when, how many books) with Copy feed link and Edit, and a status line saying whether the catalog matches the switches below. Then the destination's shelf: every EPUB on it as a card. A book known on this device shows its cover and "Sent {when}"; a book not on this device shows the cover the catalog knows (or a plain file card) and an Import… button; under a second heading, books on this device that have not been sent here, dimmed, with Send.

**Settings › You › Destinations (surface `destinations`).** The list of destinations with where they point, their catalog file and their state (Connected, Sign in needed, Not plugged in, Needs permission), Edit / Reconnect / Remove, and an "Add a destination" row of the five kinds. The existing configure form is reused; picking a kind opens it at that kind.

**Import confirm.** A dialog in the plugin: cover when known, "Import {title}?", one sentence on what happens, size and source, Cancel / Import. On Import the plugin downloads the file and hands the bytes to the host, which runs its normal EPUB import (the host's own "already a project here" prompt still applies).

## Decisions

- The switch flips the catalog immediately: toggling "In the catalog" on Share or on Published regenerates and uploads the feed. There is no separate Update button unless the catalog on the destination disagrees with what the plugin expects (files gone, edited elsewhere), when Published offers "Update catalog".
- A book first sent to a destination with a catalog goes into the catalog. The switch can take it out again.
- Send uploads the latest package under its own filename and overwrites a same-named file. Older packages with dated names are not hunted down (the user: the dated name only accumulates when the publication date is unset; no special handling).
- Catalog identity (title, author name, author link, format, file) lives on the destination in the feed itself and is read back from there; the file name and format are also kept in the destination's config so a remote that cannot list well still knows which file to write.
- Google Drive cannot host a feed (Google serves it as HTML); Drive rows have no switch and no catalog block. USB readers have no catalog either.
- "Known on this device" means a project with that dc:identifier exists here. The host sends the identifiers of all its books in the `context` message. A remote EPUB's identifier comes from the local packaging sidecar (same filename) or from the catalog entry; without either it is a file card with Import only.
- Validation stays where epubcheck lives (the plugin) and is offered on the latest package at the head of the Send band, not in the Write tab's checks. The checks panel keeps reading the report the plugin mirrors into localStorage.
- Links from inside the plugin to host screens (Published, Destinations) use one new plugin → host message, `open`, so the band's foot and the picker's "+ Destination…" can sit where the canvas put them.

## Contract changes (src/lib/plugins/contract.ts, mirrored in plugins/publish-to-remote/src/types.ts)

- `init` gains `surface?: 'send' | 'published' | 'destinations'` (absent → `send`).
- `context` gains `knownIdentifiers?: string[]`, the dc:identifiers of the books on this device.
- New plugin → host `import-epub { filename, bytes: ArrayBuffer }`: the host imports the bytes as a new book.
- New plugin → host `open { target: 'published' | 'destinations' }`: the host navigates.
- `navigate` and `read-epub` unchanged.

## Host build

1. Contract: types, builders, guards, tests, API.md.
2. `src/lib/components/plugins/PluginFrame.svelte`: one host for `view`-style frames (handshake, failure fallback, init with surface, context with identifiers, message routing to callbacks, content-height via ResizeObserver or fill). PublishView's inline copy of this moves here.
3. Share: the band hosts `surface="send"` at content height; the packaged-files table is always shown (the plugin no longer lists local files).
4. Published: new view id `published`, `PublishedView.svelte` hosting `surface="published"` full height, a Published link in the brand bar when the plugin is on, LayoutManager treats it as outside a book.
5. Settings: a Destinations section under You when the plugin is on, hosting `surface="destinations"` at content height. The remembered section moves to a shared store so the `open` message can land on it.
6. App: `knownIdentifiers` from each workspace's OPF, refreshed with the workspace list; `import-epub` → the existing import-or-reopen path; `open` → navigation.

## Plugin build

1. Modules: `remotes.svelte.ts` (the destinations store, saved to OPFS, synced across frames with a BroadcastChannel), `local-packages.ts` (packages + sidecars from the handed directory), `remote-status.ts` (listing with the auth/device states named, and the pure derivations for the Send row and the Published shelf), `catalog.ts` (read a destination's catalog, write it from a key set and identity, feed URL per remote type), `remote-ops.ts` gains `downloadFile` for every remote type.
2. Parsers return entries (href, identifier, title) as well as the href set.
3. Surfaces: `SendSurface`, `PublishedSurface`, `DestinationsSurface`; shared `DestinationBadge`, `Switch`, `ImportDialog`, `CatalogIdentityForm`, `Toast`. `ConfigureForm`, `ValidationModal`, `FileName` stay. `LocalEpubList`, `RemoteFileList`, `RemoteSelector`, `PaneHeader` and the paneforge dependency go.
4. `App.svelte` routes on the surface; `index.ts` records surface and identifiers.
5. Tests for the derivations and the parsers; German for every new string; docs (`API.md`, plugin `AGENTS.md`, `README.md`, `STORYBOOK.md` test ids), changelog lines.

## Not in this pass

- Reading a catalog feed in the reader tab ("Open in reader" on the canvas): the vendored reader does not take an OPDS feed.
- Batch send to several destinations at once.
- Progress for catalog thumbnail uploads (small files; a status toast suffices).
