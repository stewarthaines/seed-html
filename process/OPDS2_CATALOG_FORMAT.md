# OPDS 2.0 Catalog Format for publish-to-remote

## Why

Cantook by Aldiko (Readium Mobile based) displays accessibility metadata only from OPDS 2.0 feeds, where each publication carries a Readium Web Publication Manifest metadata object with a first-class `accessibility` member. Readium's OPDS 1 (Atom) parser extracts only Atom/DC/OPDS elements and drops foreign vocabularies, so the speculative `schema:*` elements added to the 1.2 generator are never read by any known client. OPDS 2.0 therefore becomes the plugin's default catalog format; OPDS 1.2 remains selectable so existing published catalogs stay updateable.

## Format decision

- New catalogs default to **OPDS 2.0** (JSON, media type `application/opds+json`, default filename `catalog.json`).
- **OPDS 1.2** (Atom XML, `catalog.xml`) remains fully supported: loading an existing `.xml` catalog selects 1.2 in the editor, and Update regenerates it in place.
- A format dropdown sits beside the _Catalog file_ field in the catalog editor. Format is a per-catalog-edit choice (like title/name/uri), not a remote config setting.
- The `schema:*` accessibility elements stay in the 1.2 generator (already written and tested): spec-legal, zero cost, and future Atom clients may read them.

## OPDS 2.0 feed shape

```json
{
  "metadata": {
    "title": "My Catalog",
    "author": { "name": "SEED.html", "identifier": "https://readitinabook.com" }
  },
  "links": [{ "rel": "self", "href": "https://…/catalog.json", "type": "application/opds+json" }],
  "publications": [
    {
      "metadata": {
        "@type": "http://schema.org/Book",
        "title": "Bulletin 39",
        "author": [{ "name": "…" }],
        "identifier": "urn:uuid:…",
        "language": "en",
        "publisher": "…",
        "published": "2026-07-01",
        "description": "…",
        "subject": ["…"],
        "accessibility": {
          "conformsTo": "https://www.w3.org/TR/epub-a11y-11#wcag-2.1-aa",
          "accessMode": ["textual", "visual"],
          "accessModeSufficient": [["textual", "visual"], ["textual"]],
          "feature": ["alternativeText", "structuralNavigation"],
          "hazard": ["none"],
          "summary": "…",
          "certification": { "certifiedBy": "…" }
        }
      },
      "links": [
        {
          "rel": "http://opds-spec.org/acquisition",
          "href": "https://…/book.epub",
          "type": "application/epub+zip"
        }
      ],
      "images": [{ "href": "https://…/book.thumb.png", "type": "image/png" }]
    }
  ]
}
```

Notes on the mapping from the sidecar (`CatalogEntryMeta`):

- `accessModeSufficient`: the sidecar keeps one comma-joined string per sufficient combination (verbatim from the OPF); the OPDS 2 builder splits each on commas into a string array, giving RWPM's list-of-lists.
- `certifiedBy` (flat in the sidecar) nests under `certification.certifiedBy`.
- `conformsTo`: the OPF stores the EPUB Accessibility 1.1 conformance strings from `CONFORMANCE_OPTIONS` (`src/lib/epub/accessibility-vocab.ts`). The builder maps these known strings to the canonical W3C profile URIs Readium recognizes (`EPUB Accessibility 1.1 - WCAG 2.1 Level AA` → `https://www.w3.org/TR/epub-a11y-11#wcag-2.1-aa`, etc.); unknown values pass through verbatim. The OPF itself keeps the string form — mapping happens only at feed generation.
- Feed-level identity: OPDS 2.0 defines no catalog author slot, so the editor's Name/URI pair is emitted as an RWPM contributor object at `metadata.author` (`name` + `identifier`) — harmless to clients, and it round-trips when the catalog is loaded back.
- Thumbnails use OPDS 2.0's `images` collection (no rel needed); the existing thumbnail-hosting flow is unchanged.

## Work plan

### 1. `plugins/publish-to-remote/src/opds2.ts` (new)

- `generateOpds2Feed(creds, objects, feedUrl, metaByKey, selectedKeys, catalog): string` — same signature as `generateOpdsFeed`, reusing `acquisitionUrl` and `defaultCatalogTitle` from `opds.ts`; returns pretty-printed JSON (2-space; small, human-inspectable files).
- `CONFORMANCE_URIS` map from the OPF conformance strings to profile URIs (mirrors `CONFORMANCE_OPTIONS` values; the plugin builds separately, so the table is redeclared here like `CatalogEntryMeta` is).
- `parseOpds2Feed(json): ParsedOpdsFeed` — reads `metadata.title`, `metadata.author.name` / `.identifier`, and the acquisition `href`s, returning the same `ParsedOpdsFeed` shape as the Atom parser (type moves to a shared export or is imported from `opds.ts`).

### 2. `App.svelte` — format state, dropdown, filename defaults

- `let catalogFormat = $state<'opds2' | 'opds1'>('opds2')`; add `format` to `currentCatalog`, the snapshot, and the dirty comparison.
- Dropdown: a new `.catalog-field` with a `<select>` (label `{$t('Format')}`, options `OPDS 2.0` / `OPDS 1.2` — proper names, left untranslated) placed before the _Catalog file_ field inside the existing flex-wrapping `.catalog-fields` row.
- Filename coupling: `DEFAULT_CATALOG_FILE` becomes format-dependent (`catalog.json` / `catalog.xml`). When the user switches format and the current filename ends in the other format's extension, swap the extension; otherwise leave their input alone.
- `initCatalogForRemote`: probe the configured `catalogFilename` first; when unset, try `catalog.json`, then fall back to `catalog.xml` (so remotes with an existing 1.2 catalog load it and select 1.2). Set `catalogFormat` from what loaded; brand-new catalogs get opds2 + `catalog.json`.
- `onLoadCatalog`: pick the parser by extension (`.json` → OPDS 2, else Atom) and set the dropdown to match.
- `onUpdateCatalog`: branch on `catalogFormat` to the matching generator, and pass an explicit content type to `uploadTextFile` — `application/opds+json` for 2.0, `application/atom+xml;profile=opds-catalog;kind=acquisition` for 1.2 (today it silently relies on the uploaders' `text/xml` default).
- Switching an existing catalog's format then updating writes a new file (e.g. `catalog.json` beside the old `catalog.xml`); the old file stays on the remote until deleted manually — no migration logic.

### 3. `RemoteFileList.svelte`

- Catalog detection widens from `.xml` to `.xml` or `.json` (grouping under _Catalogs_, loadable-row behavior, epub-list exclusion). Sidecar `.json` files never reach the remote (only `.thumb.png` does), so remote JSON is overwhelmingly a catalog; `onLoadCatalog` already error-paths on unparseable content.

### 4. Config surface

- `ConfigureForm.svelte`: `Catalog Filename (optional)` placeholder becomes `catalog.json` (S3 + WebDAV forms).
- `types.ts`: update the `catalogFilename` doc comments to describe the json-then-xml default probe.

### 5. Tests — `plugins/publish-to-remote/src/opds2.test.ts`

- Feed structure: `metadata.title`, self link rel/type, publication metadata fields, acquisition link, `images` from `thumbnailUrl`, selectedKeys filtering (mirroring `opds.test.ts`).
- Accessibility mapping: comma-combo splitting into list-of-lists, `certification` nesting, conformance string → URI mapping (and verbatim pass-through for unknown values), absent block emits no `accessibility` member.
- Round-trip: `parseOpds2Feed` recovers title, author name/identifier, and epub hrefs from a generated feed.

### 6. Docs

- `CHANGELOG.md`: one user-facing line (catalogs can now publish in the format library apps read accessibility details from).
- Plugin `README.md`: note the two formats and the default.

## Follow-up work

- **DONE (2026-08-09) — Core app "Import from Catalog" dialog**: `src/lib/opds/parse-opds-feed.ts` (behind `OPDSImportDialog.svelte`) parsed Atom feeds only. `parseOpdsFeed` now sniffs the document (leading `{` → OPDS 2.0 JSON, else Atom) and maps `metadata.title`, `publications[].metadata` (title/author/modified), acquisition links, and `images` into the existing `OpdsFeed`/`OpdsBook` shape — including RWPM's localized-string and contributor-object variants.

## Decisions

1. **Settled (2026-08-09)**: extension auto-swap on format switch (swap only when the filename carries the other format's extension). Converting an existing catalog leaves the old-format file on the remote — coexistence is fine; the user cleans up manually if that's intended.
2. Feed identity as `metadata.author` `{ name, identifier }` — alternative is dropping Name/URI for 2.0 catalogs entirely, losing round-trip parity with 1.2.
3. Keeping the `schema:*` elements in the 1.2 output (recommended: keep).
