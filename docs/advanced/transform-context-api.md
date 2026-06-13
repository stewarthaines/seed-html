# Transform context API (`ctx`)

Transform scripts receive a third argument, `ctx`, that lets them reach beyond the
chapter text they're given — to read other files declared in the EPUB manifest and
to read and write the project's `SOURCE/` working data.

```js
function transformText(text, idref, ctx) { /* … */ }
function transformDOM(htmlDocument, idref, ctx) { /* … */ }
```

`ctx` is optional: a transform that ignores it behaves exactly as before. But any
transform that **calls** a `ctx` method must be `async` (or otherwise return a
Promise), because file access is asynchronous and the host `await`s the result.

```js
async function transformDOM(doc, idref, ctx) {
  const css = await ctx.readManifestText('Styles/main.css');
  // …
}
```

## Why it works this way

Transform scripts run in a sandbox with no direct access to storage, the network,
or the file system (no `fetch`, `indexedDB`, `localStorage`, …). `ctx` does **not**
hand a script a file handle. Instead, each method sends a request to the host
application, which performs the I/O on the script's behalf and returns the result.
The host scopes every request:

- **manifest reads** are limited to files actually declared in the OPF manifest;
- **source reads** are limited to the project's `SOURCE/` tree;
- **source writes** are limited to `SOURCE/data/`.

A script can't read an arbitrary path by guessing at it, and can't overwrite
`settings.json`, transform scripts, or extensions. Paths are validated (no `..`
traversal, no absolute paths).

## Data fields

| Field | Type | Description |
| --- | --- | --- |
| `ctx.idref` | `string \| undefined` | The id of the spine item (chapter) currently being transformed. Same value as the second argument. |
| `ctx.basePath` | `string` | The EPUB content base path (e.g. `"OEBPS"`). Manifest `href`s are relative to it. |
| `ctx.manifest` | `ManifestItem[]` | The parsed OPF manifest — every file declared in the book. |

A `ManifestItem`:

```js
{
  id: 'cover-image',            // manifest item id
  href: 'Images/cover.png',     // path relative to ctx.basePath
  mediaType: 'image/png',       // MIME type
  properties: ['cover-image'],  // optional OPF properties, e.g. 'nav', 'cover-image'
  fallback: undefined,          // optional fallback item id
}
```

Use `ctx.manifest` as a lookup table: find the item you want, then pass its **exact
`href`** to a read method. (Note an `<img src>` in chapter markup is *XHTML*-relative,
e.g. `../Images/cover.png`, whereas the manifest `href` is `Images/cover.png` — so
match on the item, don't pass the raw `src`.)

## Methods

All methods return a Promise and reject with an `Error` if the request is out of
scope (e.g. an `href` that isn't a manifest item, or a write outside `SOURCE/data/`)
or if file access is unavailable in the current context.

### `readManifestText(href) → Promise<string>`

Read a declared manifest item as UTF-8 text. For text resources (XHTML, CSS, SVG,
JSON, …).

```js
const svg = await ctx.readManifestText('Images/diagram.svg');
```

### `readManifestDataURL(href) → Promise<string>`

Read a declared manifest item as a `data:` URL using the item's media type. For
binary resources (raster images, fonts) you want to embed inline.

```js
img.src = await ctx.readManifestDataURL('Images/photo.png');
// → "data:image/png;base64,iVBORw0KGgo…"
```

### `readSourceText(path) → Promise<string>`

Read a text file from the project's `SOURCE/` tree. `path` may start with `SOURCE/`
or be relative to it.

```js
const glossary = JSON.parse(await ctx.readSourceText('data/glossary.json'));
```

### `writeSourceText(path, text) → Promise<string>`

Write text into `SOURCE/data/` and resolve with the stored path. A bare `path` lands
under `SOURCE/data/`; an explicit path must already be under it. Files written here
are part of the project source and are repackaged into `SEED.zip`.

```js
await ctx.writeSourceText(`wordcount-${idref}.json`, JSON.stringify({ words }));
// stored at SOURCE/data/wordcount-<idref>.json
```

## Examples

### Inline an SVG so the chapter is self-contained

```js
async function transformDOM(doc, idref, ctx) {
  for (const img of doc.querySelectorAll('img')) {
    const file = img.getAttribute('src').split('/').pop();           // "diagram.svg"
    const item = ctx.manifest.find(
      m => m.mediaType === 'image/svg+xml' && m.href.endsWith(file)
    );
    if (!item) continue;
    const tmp = doc.createElement('div');
    tmp.innerHTML = await ctx.readManifestText(item.href);           // raw SVG markup
    img.replaceWith(tmp.firstElementChild);
  }
}
```

### Embed raster images as data URLs

```js
async function transformDOM(doc, idref, ctx) {
  for (const img of doc.querySelectorAll('img[src]')) {
    const file = img.getAttribute('src').split('/').pop();
    const item = ctx.manifest.find(
      m => m.href.endsWith(file) && m.mediaType.startsWith('image/')
    );
    if (item) img.src = await ctx.readManifestDataURL(item.href);
  }
}
```

### Apply a shared glossary stored in `SOURCE/`

```js
async function transformDOM(doc, idref, ctx) {
  let glossary = {};
  try {
    glossary = JSON.parse(await ctx.readSourceText('data/glossary.json'));
  } catch {
    /* no glossary yet */
  }
  for (const [term, def] of Object.entries(glossary)) {
    doc.querySelectorAll('p').forEach(p => {
      p.innerHTML = p.innerHTML.replaceAll(term, `<abbr title="${def}">${term}</abbr>`);
    });
  }
}
```

### Persist derived data back into the project

```js
async function transformDOM(doc, idref, ctx) {
  const words = doc.body.textContent.trim().split(/\s+/).length;
  await ctx.writeSourceText(`wordcount-${idref}.json`, JSON.stringify({ words }));
}
```

### Use the manifest itself

```js
async function transformDOM(doc, idref, ctx) {
  const chapters = ctx.manifest.filter(m => m.mediaType === 'application/xhtml+xml');
  // e.g. append a "Chapter X of N" footer, or audit images for missing alt text
}
```

## Performance

Each `ctx.read*` / `ctx.write*` call is a single round-trip to the host, and a
chapter's transforms run on **every (debounced) preview render** as well as on
export. Reach for these deliberately:

- Read a shared file **once** and reuse the parsed result, rather than per element.
- Avoid `ctx` calls inside large `querySelectorAll` loops where one batched read
  would do.
- Treat writes as occasional (caching derived data), not per-keystroke output.
