# Transform scripts and the `ctx` capability API

This documents the contract an **extension author** writes against — the transform script functions and the `ctx` (transform context) object passed to them. It is the runtime view from _inside_ a transform, complementary to [API.md](./API.md), which documents the internal `TransformPipeline` orchestration classes. If you are writing a `transformText`/`transformDOM`/`generateText` for an extension under `extensions/`, this is the file you want.

## Where transform scripts run

Transform scripts do **not** run in the app. They run sandboxed inside a persistent `<iframe>` whose harness is `src/assets/iframe/editor.js`. The app side (`src/lib/infrastructure/transform-engine.ts`) posts the chapter text/DOM in, and the iframe posts the result back.

Two consequences follow from the sandbox, and they are the whole reason `ctx` exists:

- A transform **cannot touch storage** (OPFS/IndexedDB) and has **no direct `fetch`/`XMLHttpRequest`** to the workspace. It sees only the document, standard JS/DOM built-ins, and the globals listed below. Any file access goes through `ctx`, which brokers the request out to the parent (see "The broker" below).
- An extension's `scripts[]` libraries (declared in `extension.json`) are loaded into the **same iframe as globals before the transform runs**. That is how `prettier` + `prettierPlugins`, `hljs`, `katex`, `jsyaml`, `abc2svg` etc. become available to their transforms — you reference them as bare globals, you do not import them.

## The script contract

An extension transform file defines one or more of these top-level functions. Each may be **sync or async** — return a Promise (or use `async`) whenever you `await` a `ctx` method.

```js
// Text transform: plain-text source -> HTML string.
// Declared in extension.json "textTransforms".
function transformText(plainText, idref, ctx) {
  /* return html string */
}

// DOM transform: mutate (and return) the chapter document.
// Declared in extension.json "domTransforms".
function transformDOM(document, idref, ctx) {
  /* return document */
}

// Generator: project-wide source producer, no chapter input.
// Declared in extension.json "generators[].script"; one generateText per file.
async function generateText(ctx, options) {
  /* return string */
}
```

Notes:

- `document` for a DOM transform is the chapter's **rendered DOM, parsed as HTML** (not XHTML). Use the global `document.createElement(...)` — no namespaces. (For SVG/MathML you still build elements via the same HTML document; the packager serialises to XHTML downstream.)
- `idref` is the spine item id for the current chapter. It is also available as `ctx.idref`.
- `ctx` is the third argument. It may be **absent** for older/secondary callers, so a transform that needs it should guard: `if (!ctx) return document;`. Existing transforms that ignore `ctx` (e.g. `katex`, `abc2svg`) simply omit the third parameter.

## The `ctx` object

Built per-invocation by `createTransformContext` in `src/assets/iframe/editor.js`. Shape:

| Field                                   | Type              | Notes                                                                                                                           |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.idref`                             | `string`          | Current spine item id.                                                                                                          |
| `ctx.basePath`                          | `string`          | OPF content base path (e.g. `"OEBPS"`). Manifest hrefs are relative to this; you pass the bare href, the broker joins the base. |
| `ctx.manifest`                          | `ManifestItem[]`  | The OPF manifest: `{ id, href, mediaType, properties?, fallback? }` per item. Read-only snapshot.                               |
| `ctx.frontmatter`                       | `unknown \| null` | The chapter's parsed frontmatter (see below), or `null` when it has none.                                                       |
| `await ctx.readManifestText(href)`      | `Promise<string>` | Decoded UTF-8 text of a **declared** manifest item.                                                                             |
| `await ctx.readManifestDataURL(href)`   | `Promise<string>` | `data:` URL of a manifest item — use for binary assets (images, fonts).                                                         |
| `await ctx.readSourceText(path)`        | `Promise<string>` | Read a file from the editor's `SOURCE/` tree as text.                                                                           |
| `await ctx.writeSourceText(path, text)` | `Promise<string>` | Persist text; **scoped to `SOURCE/data/`**. Returns the resolved path.                                                          |

All four methods are async and reject (throw) on failure — wrap in `try/catch` and degrade gracefully (leave the DOM untouched) rather than letting the whole transform fail.

### What `href`/`path` to pass

- **Manifest reads** key off the OPF `href` exactly as it appears in `ctx.manifest` (relative to `basePath`). For an asset an extension shipped via `assets[].target` (see below), that href **is** the `target` string, e.g. `ctx.readManifestText('Images/fleuron.svg')`.
- **Source reads** accept either a `SOURCE/`-prefixed path or one relative to it; e.g. `ctx.readSourceText('SOURCE/settings.json')`. Traversal/absolute paths are rejected.
- **Source writes** land under `SOURCE/data/`: a bare name is placed there, an explicit path must already be under it. Anything else is rejected.

## Chapter frontmatter

A chapter source may begin with a YAML block fenced by `---` on line 1 and a closing `---` line. The **app** owns that block, not the text format: `SpineTransformPipeline` splits it off before the text transform runs (a leading `---` would otherwise be a thematic break to djot or Markdown), parses it with js-yaml's JSON schema (dates stay strings), and passes the result as `ctx.frontmatter`. The transform receives the body only. A block that fails to parse is stripped anyway, reported on the console, and arrives as `null`.

The frontmatter is a transport, not a schema: core imposes no keys. A transform validates the keys it owns and ignores the rest, so one block can carry nav metadata and, say, a person record for a family-history extension together. YAML comments never reach the store; a block that is only comments is `null`.

Every chapter's record is also kept as JSON at `SOURCE/data/frontmatter/<idref>.json` (written by the app on render; deleted when the chapter loses its block, and never written for a chapter that has none), so a transform can read another chapter's record with `ctx.readSourceText('data/frontmatter/<idref>.json')` and combine records across the spine. Records exist for chapters that have rendered since the block was added — package the book once to fill the store for every chapter. Design: `process/CHAPTER_FRONTMATTER.md`.

## How an extension delivers a file its transform reads

This is the canonical pattern for "the transform needs to read/modify a bundled asset" (SVG, CSS, JSON, font, …). Ship the file as an **EPUB asset**, then read it back through the manifest:

1. Declare it in `extension.json`:
   ```json
   "assets": [{ "file": "fleuron.svg", "target": "Images/fleuron.svg", "media": "image/svg+xml" }]
   ```
2. On install, the file is written to `OEBPS/Images/fleuron.svg` and registered as an OPF manifest item with `href: "Images/fleuron.svg"` (`extension-manager.ts` → `App.svelte` `handleExtensionAssets` → `addManifestItem`). It now ships _inside_ the book.
3. At render time the transform reads it back:
   ```js
   async function transformDOM(document, idref, ctx) {
     if (!ctx) return document;
     let svg;
     try {
       svg = await ctx.readManifestText('Images/fleuron.svg');
     } catch {
       return document;
     } // asset missing — leave the chapter as-is
     // …parse, modify (e.g. force fill/stroke to currentColor), inline…
     return document;
   }
   ```

Contrast the three `extension.json` delivery mechanisms:

- `scripts[]` — JS libraries injected as **iframe globals** (not readable as files; you call them).
- `assets[]` — files **copied into the EPUB** and registered in the OPF manifest; readable via `ctx.readManifest*`.
- `domTransforms[]` / `textTransforms[]` / `generators[]` — the transform scripts themselves.

A raw asset is **not** reachable by guessing a path: `readManifest*` only resolves hrefs that are actually declared in the OPF manifest (the read-scoping guarantee). That is why the asset must be a real manifest item, which the install flow guarantees.

## The broker (why this is safe, and where it lives)

`ctx`'s methods are thin `postMessage` bridges. The flow:

1. Transform calls `await ctx.readManifestText(href)` → `callBroker('readManifestText', { href })` posts a `BROKER_REQUEST` to the parent (`editor.js`).
2. `TransformEngine.handleBrokerRequest` (`transform-engine.ts`) receives it, performs the I/O through the path-based `FileStorageAPI`, and posts a `BROKER_RESPONSE` back.
3. The promise in the iframe resolves with the result.

Crucially, the parent **ignores any workspace id the script claims** and trusts only its own `brokerContext`. Every request is scoped by the pure helpers in [`transform-broker.ts`](./transform-broker.ts):

- `resolveManifestStoragePath` — manifest reads limited to **declared OPF items** (no arbitrary workspace paths by guessing an href).
- `resolveSourceReadPath` — source reads limited to the `SOURCE/` tree (no traversal/absolute escape).
- `resolveSourceWritePath` — source writes limited to **`SOURCE/data/`** so a script can persist derived data without clobbering `settings.json`, transform scripts, or extensions.

These helpers are pure string functions and unit-tested without a storage backend; the security model lives there, so read them before changing any path handling.

## Worked references in the tree

- `extensions/impressum/transformImpressum.js` — reads `SOURCE/settings.json` and per-extension `extension.json` via `ctx.readSourceText`, and filters `ctx.manifest` for embedded fonts. The clearest end-to-end `ctx` user.
- `extensions/katex/transformKaTeX.js`, `extensions/abc2svg+jsyaml/transformABC.js` — use injected `scripts[]` globals (`katex`, `abc2svg`/`jsyaml`) and ignore `ctx`.
- `extensions/highlight/extension.json` — `assets[]` shipping a CSS theme into `OEBPS/Styles/` (asset-as-manifest-item, though its transform doesn't read it back).
