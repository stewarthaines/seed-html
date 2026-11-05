# Reference

The earlier chapters teach the pipeline; this one is for looking things up — the entry-point signatures, the `ctx` surface, and the generator option schema, with recipes at the end.

## Transform entry points

A script is picked up by the function it defines. The file can be called anything; the entry function's name is fixed.

```js
function transformText(text, idref, ctx) { /* return an HTML string */ }
function transformDOM(htmlDocument, idref, ctx) { /* return the Document */ }
function generateText(ctx, options) { /* return source text */ }
```

`ctx` is optional in the transforms: a transform that ignores it behaves exactly as before. Any function that **calls** a `ctx` method must be `async` (or otherwise return a Promise), because file access is asynchronous and the host awaits the result.

## The transform context (`ctx`)

Transforms run in a sandbox with no direct access to storage, the network, or the file system. `ctx` doesn't hand a script a file handle: each method sends a request to the host application, which performs the I/O on the script's behalf and scopes every request —

- **manifest reads** are limited to files declared in the book's manifest;
- **source reads** are limited to the project's `SOURCE/` tree;
- **source writes** are limited to `SOURCE/data/`.

A script can't read an arbitrary path by guessing at it, and can't overwrite settings, transform scripts, or extensions. Paths are validated — no `..` traversal, no absolute paths.

### Data fields

| Field | Type | Description |
| --- | --- | --- |
| `ctx.idref` | `string \| undefined` | The id of the chapter currently being transformed. Same value as the second argument. |
| `ctx.basePath` | `string` | The EPUB content base path (e.g. `"OEBPS"`). Manifest `href`s are relative to it. |
| `ctx.manifest` | `ManifestItem[]` | The parsed manifest — every file declared in the book. |
| `ctx.language` | `string` | The book's primary language tag from the metadata (e.g. `"en"`, `"ka"`). Empty when the project has no language set. Use it for locale-aware output, such as `Intl` date formatting. |

A `ManifestItem`:

```js
{
  id: 'cover-image',            // manifest item id
  href: 'Images/cover.png',     // path relative to ctx.basePath
  mediaType: 'image/png',       // MIME type
  properties: ['cover-image'],  // optional properties, e.g. 'nav', 'cover-image'
  fallback: undefined,          // optional fallback item id
}
```

Use `ctx.manifest` as a lookup table: find the item you want, then pass its exact `href` to a read method. An `<img src>` in chapter markup is *XHTML*-relative (`../Images/cover.png`) while the manifest `href` is `Images/cover.png` — match on the item, don't pass the raw `src`.

### Methods

All methods return a Promise and reject with an `Error` if the request is out of scope (an `href` that isn't a manifest item, a write outside `SOURCE/data/`) or if file access is unavailable in the current context.

#### `readManifestText(href) → Promise<string>`

Read a declared manifest item as UTF-8 text. For text resources — XHTML, CSS, SVG, JSON.

```js
const svg = await ctx.readManifestText('Images/diagram.svg');
```

#### `readManifestDataURL(href) → Promise<string>`

Read a declared manifest item as a `data:` URL using the item's media type. For binary resources — raster images, fonts — you want to embed inline.

```js
img.src = await ctx.readManifestDataURL('Images/photo.png');
// → "data:image/png;base64,iVBORw0KGgo…"
```

#### `readSourceText(path) → Promise<string>`

Read a text file from the project's `SOURCE/` tree. `path` may start with `SOURCE/` or be relative to it.

```js
const glossary = JSON.parse(await ctx.readSourceText('data/glossary.json'));
```

#### `writeSourceText(path, text) → Promise<string>`

Write text into `SOURCE/data/` and resolve with the stored path. A bare `path` lands under `SOURCE/data/`; an explicit path must already be under it. Files written here are part of the project source and are repackaged into `SEED.zip`.

```js
await ctx.writeSourceText(`wordcount-${idref}.json`, JSON.stringify({ words }));
// stored at SOURCE/data/wordcount-<idref>.json
```

### Performance

Each `ctx` call is a round-trip to the host, and a chapter's transforms run on every (debounced) preview render as well as on export. Reach for them deliberately:

- Read a shared file once and reuse the parsed result, rather than per element.
- Avoid `ctx` calls inside large `querySelectorAll` loops where one batched read would do.
- Treat writes as occasional — caching derived data, not per-keystroke output.

## Generator declarations

A generator declared in an extension's `extension.json` (app-internal; see _Extensions_) carries these fields. A generator you define by hand under **Project Settings → Generators** declares the same name, script, and options.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes | Stable identifier for the generator. |
| `name` | `string` | yes | Shown in the generator picker. |
| `description` | `string` | no | Shown under the picker when selected. |
| `script` | `string` | yes | Script filename within the extension dir. Defines `generateText(ctx, options)`. |
| `license` | `string` | no | License file for the script, bundled into `SOURCE/`. |
| `options` | `GeneratorOption[]` | yes | Form fields presented before running (may be empty `[]`). |

The generator's `ctx` is the read-only half of the surface above — `manifest` and the read methods; no writes.

### Options

Every option becomes one form field. The user's entry is passed to the script under `options[name]`, so **`name` is the key your script reads** — keep it script-friendly (no spaces). `label` is the human text shown beside the field.

| Field | Type | Applies to | Description |
| --- | --- | --- | --- |
| `type` | `'string' \| 'number' \| 'boolean' \| 'select'` | all | The field kind (see below). |
| `name` | `string` | all | Key in the `options` object passed to the script. |
| `label` | `string` | all | Field label in the form. |
| `default` | `string \| number \| boolean` | all | Initial value (see _Defaults_). |
| `placeholder` | `string` | `string`, `number` | Greyed hint text in the input. |
| `options` | `{ value: string; label: string }[]` | **`select`** | The dropdown choices. **Required for `select`.** |

Field types:

- **`string`** → a text input. The script receives the string (`''` if empty).
- **`number`** → a numeric input. The script receives a `number` (or `''` if the field is cleared, so coerce defensively, e.g. `Number(options.count) || 0`).
- **`boolean`** → a checkbox. The script receives `true` / `false`.
- **`select`** → a dropdown. **Must** include an `options` array of `{ value, label }` choices; the script receives the selected **`value`** string, not the label. Omitting `options` renders an empty, unusable dropdown — the most common mistake.

Defaults: when the panel opens, each field is seeded with its `default`, then overlaid with the values the user last ran this generator with. If you omit `default`, the fallback is `false` for booleans, the first choice's `value` for selects, and `''` for string/number. For a `select`, make sure `default` equals one of your `value`s — otherwise the dropdown shows the first choice and `default` is ignored.

A `select` plus a `boolean`, as declared and as read:

```json
"options": [
  {
    "type": "select",
    "name": "format",
    "label": "Plain text wrapper",
    "default": "markdown",
    "options": [
      { "value": "markdown", "label": "Markdown" },
      { "value": "textile", "label": "Textile" }
    ]
  },
  {
    "type": "boolean",
    "name": "include_scales",
    "label": "Include multiple scale classes",
    "default": false
  }
]
```

```js
function generateText(ctx, options) {
  const opts = options || {};
  const format = opts.format || 'markdown';        // the select's value, not its label
  const includeScales = Boolean(opts.include_scales);
  const fence = format === 'textile' ? 'bc.' : '```';
  // … build and return the sample source text …
}
```

## Recipes

The recipes up to the last one are build-time transforms — they run in the sandbox while you edit. The final one is a reading-system script: it ships in the manifest and runs in the reading app.

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
  return doc;
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
  return doc;
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
  return doc;
}
```

### Persist derived data back into the project

```js
async function transformDOM(doc, idref, ctx) {
  const words = doc.body.textContent.trim().split(/\s+/).length;
  await ctx.writeSourceText(`wordcount-${idref}.json`, JSON.stringify({ words }));
  return doc;
}
```

### Use the manifest itself

```js
async function transformDOM(doc, idref, ctx) {
  const chapters = ctx.manifest.filter(m => m.mediaType === 'application/xhtml+xml');
  // e.g. append a "Chapter X of N" footer, or audit images for missing alt text
  return doc;
}
```

### Responsive-width fallback (reading-system script)

The worked example of _Reading System JavaScript_: where a reader runs JavaScript but doesn't understand `@container`, measure the text's width in `em` and label the body so CSS has something to key on. The `CSS.supports` guard keeps it a fallback — it does nothing where container queries work.

```js
function classifyWidth() {
  const p = document.querySelector('p');
  if (!p) return;
  const ems = p.clientWidth / parseFloat(getComputedStyle(p).fontSize);
  const band = ems < 30 ? 'narrow' : ems < 50 ? 'wide' : 'full';
  document.body.classList.remove('narrow', 'wide', 'full');
  document.body.classList.add(band);
}

if (!CSS.supports('container-type: inline-size')) {
  addEventListener('DOMContentLoaded', classifyWidth);
  addEventListener('resize', classifyWidth);
}
```

The container-query rule and its fallback twin, side by side:

```css
@container (width >= 50em) {
  figure { float: inline-end; inline-size: 40%; }
}

body.full figure { float: inline-end; inline-size: 40%; }
```
