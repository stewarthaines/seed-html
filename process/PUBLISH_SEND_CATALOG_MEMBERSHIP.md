# Send keeps each catalog's membership

Reported 6 October 2026: on a destination with several OPDS 2 catalogs (sample.readitinabook.com with `testing.json` and `sample.json`), Send on a book's new package puts the book into the first catalog in the list even when it was never in that catalog.

## Cause

`sendPackage` (plugins/publish-to-remote/src/send.ts) reads one feed only: `loadCatalog(remote, listing.objects)` with no file, which resolves to the destination's own feed — the configured catalog filename, else `catalog.json`, else `catalog.xml`. That feed sorts first in `catalogFilesOn`, so it is the first switch on the Share row and the first catalog in the Published picker.

It then always runs `keys.add(pkg.name)` on that feed. Nothing asks whether this is the book's first send or an update, and the other feeds on the destination are never read or written by Send.

The design note in process/PUBLISH_REWORK.md says "A first send goes into the destination's own feed only". The code applies that rule to every send, first or not.

Three consequences, all from the same line:

1. An update to a book that is only in `testing.json` adds it to the own feed as well.
2. If the new package has a new filename (a new version), the feed that actually listed the book is not touched, so it still points at the old package. The "older package of this book gives way" replacement only happens in the own feed.
3. If the own feed does not exist (no configured name and no `catalog.json` or `catalog.xml` on the destination), `loadCatalog` returns an `exists: false` catalog named `catalog.json`. Send then writes a new `catalog.json` listing every EPUB on the destination, alongside the existing `testing.json` and `sample.json`.

Which of 1 and 3 you see depends on the destination's configured catalog filename. "First in the list" fits 1, with the configured name being one of the two feeds.

## Fix

Send decides catalog membership from every feed on the destination, not from the own feed alone.

1. List the destination before the upload, so Send knows whether any package of this book was already there. Both callers already hold a listing (the Share row's `row.listing`, the Published surface's `listing`), so `sendPackage` takes it as an optional argument and lists only when it is missing or not `ok`.
2. After the upload, list again and read every feed with `loadCatalogs`.
3. If any feed is unreadable (`error`), write none of them. Membership cannot be known without reading every feed, and an unreadable feed must not be overwritten. Report the error as now.
4. Work out the book's keys on the destination: every EPUB whose identifier, from `identifiersOnRemote` over all feeds' entries, equals the package's identifier, plus `pkg.name`. With no identifier, the book's keys are just `pkg.name`.
5. **An update** is a send where any of the book's keys was on the destination before the upload. For each existing feed that lists any of those keys, remove the book's other keys, add `pkg.name` and rewrite it. Rewrite even when the key set is unchanged (a same-name re-send), so the entry's title, cover thumbnail and modified date follow the new package. Feeds that did not list the book are not written. A book switched out of every feed stays out.
6. **A first send** is a send where none of the book's keys was there before. If any feed exists, add the book to the first one (`catalogFilesOn` order, own feed first), as the design note says. If the destination has no feed at all, create the own feed with every EPUB present, as now.
7. Return `catalogs: CatalogInfo[]` instead of `catalog`, so both surfaces can show every feed after the send without reading them again. Keep the "mark every feed with the error" path, driven by the first unreadable feed.

The decision in 4 to 6 goes into a pure function in send.ts, roughly `catalogWritesForSend(catalogs, bookKeys, pkgName, firstSend, epubKeys) → { file, keys, identity }[]`, so it can be tested without remotes. `sendPackage` just performs the writes it returns.

## Tests

A new `src/send.test.ts` covering `catalogWritesForSend`:

- Update, book only in `testing.json`: only `testing.json` is written, and `sample.json` is untouched.
- Update with a new filename: the old key is replaced by the new one in each feed that held the book, and only there.
- Update, book in both feeds: both are written.
- Update, book in no feed (switched out): no writes.
- Same-name re-send: the holding feed is rewritten with the same keys.
- First send with two feeds: only the first in `catalogFilesOn` order gains it.
- First send on a destination with no feed: one write, the own feed, with every EPUB.
- No identifier: matching by filename alone.

`sendPackage` itself gets one test with `remote-ops`, `remote-status` and `catalog` mocked: an unreadable feed means no writes and an error result.

## Touches

- `plugins/publish-to-remote/src/send.ts`: the pure function, the new signature, the multi-feed writes.
- `SendSurface.svelte` and `PublishedSurface.svelte`: pass the current listing, and use `result.catalogs`.
- `plugins/publish-to-remote/AGENTS.md`, in the send.ts line and the data-flow note: "Send updates every feed that lists the book; a first send goes into the destination's first feed only".
- `process/PUBLISH_REWORK.md`: the same rule, in one sentence.
- Changelog line: "Sending a new version of a book to a destination with several catalogs keeps it in the catalogs it was in, and no others."

No UI strings change, so there's no translation work.
