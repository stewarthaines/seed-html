/**
 * Host-side extension catalog discovery.
 *
 * Extensions are an HTTP-delivered catalog (mirroring plugins): the core fetches a
 * build-generated `extensions/manifest.json` to learn which extensions are
 * available to import into a project. Each entry bundles a 3rd-party lib, an
 * optional license, and zero-or-more suggested DOM-transform scripts.
 *
 * Discovery never throws: on a `file:` URL, or any failure, the catalog is empty
 * and the core stands on its own.
 */

/** Seams so tests can drive discovery deterministically (mirrors plugin-registry). */
export interface ExtensionDiscoveryEnv {
  /** Document protocol, e.g. 'https:' or 'file:'. Defaults to location.protocol. */
  protocol?: string;
  /** Base URL the `extensions/` folder is resolved against. Defaults to document.baseURI. */
  baseUrl?: string;
  /** Fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

/**
 * An EPUB asset an extension brings into the project's OUTPUT (under OEBPS/),
 * registered in the OPF manifest — e.g. a CSS theme a highlighter needs. This is
 * distinct from scripts/transforms, which live in SOURCE/ and are edit-time only.
 */
interface ExtensionAsset {
  /** File within the extension dir to copy. */
  file: string;
  /** OEBPS-relative destination, also the manifest href (e.g. 'Styles/highlight.css'). */
  target: string;
  /** Manifest media type; auto-detected from the target extension when omitted. */
  media?: string;
  /** License file (within the extension dir) for this asset; bundled into SOURCE/. */
  license?: string;
}

/**
 * A form-field descriptor for a generator's `options`. Rendered into the
 * invocation form; the entered value is passed to `generateText(ctx, options)`
 * under `options[name]`.
 */
export interface GeneratorOption {
  type: 'string' | 'boolean' | 'number' | 'select';
  /** Key in the options object passed to the generator. */
  name: string;
  label: string;
  placeholder?: string;
  default?: string | boolean | number;
  /** Choices for `type: 'select'`. */
  options?: { value: string; label: string }[];
}

/**
 * A Generator: a script that *produces* source text inserted into the editor at
 * the caret (vs. transforms, which convert content in the render pipeline). The
 * script exports a fixed `generateText(ctx, options)` (one generator per script).
 * Mirrors the per-generator `generator.json` stored under SOURCE/generators/<id>/.
 */
export interface GeneratorManifest {
  id: string;
  name: string;
  description?: string;
  /** Script filename within the extension dir; exports `generateText(ctx, options)`. */
  script: string;
  /** Optional license file for the generator script (bundled into SOURCE/). */
  license?: string;
  options: GeneratorOption[];
}

/** A catalog extension as published in extensions/manifest.json. */
export interface ExtensionCatalogEntry {
  id: string;
  name: string;
  description?: string;
  /** Editorial sub-group key for the settings catalog (e.g. 'typesetting',
   * 'code-blocks'); presentational only. Text-format extensions omit it. */
  category?: string;
  /** Project/homepage URL for the 3rd-party library. */
  url?: string;
  /** Extension-wide license file (e.g. 'LICENSE.txt'). */
  license?: string;
  /** Human-readable license name (SPDX-style, e.g. 'MIT') — display copy for
      the impressum and catalog UI; the file above carries the legal text. */
  licenseName?: string;
  /** 3rd-party lib files loaded into the transform iframe as globals (filenames). */
  scripts: string[];
  /** Suggested DOM-transform scripts (candidates for the dom_transforms list). */
  domTransforms: string[];
  /** Suggested text-transform scripts (candidates for the single text_transform). */
  textTransforms: string[];
  /** Generators this extension provides (on-demand source producers). */
  generators: GeneratorManifest[];
  /** EPUB assets copied into OEBPS/ and registered in the manifest (e.g. CSS). */
  assets: ExtensionAsset[];
  /** Authoring-time preview-head fragment (a filename in the extension dir): markup
   *  — typically a `<script>` — injected into the previews while this extension is
   *  installed, never into the packaged EPUB. Runs UNSANDBOXED in the preview realm
   *  (unlike transforms); reserved for the app-curated catalog. See
   *  process/PREVIEW_HEAD_EXTENSIONS.md. Fragments should self-guard (e.g.
   *  `if (window.seed) …`) since capabilities like the seed bridge aren't in every preview. */
  previewHead?: string;
  /** Extra files copied into SOURCE/extensions/<id>/ on install and otherwise left
   *  alone — neither loaded into the transform iframe nor packaged. Data a transform
   *  reads back with ctx.readSourceText (a JSON schema, a lookup table). */
  files?: string[];
  /** All license files to bundle into SOURCE/ (extension-wide + per-script + per-asset). */
  licenses: string[];
  /** Sample chapter (plain-text source) used to seed a new project's first chapter. */
  chapter?: string;
  /** Format-specific editor insertion templates (media drop, audio clip directive).
   * Installing a text-format extension overwrites the project's template settings
   * with these; omitted keys reset to the app defaults. */
  templates?: ExtensionTemplates;
}

/** Editor insertion templates a text-format extension ships as its defaults. */
export interface ExtensionTemplates {
  /** Inserted when an image is dropped into a chapter. Placeholders: <href>, <alt>. */
  image?: string;
  /** Inserted when a video is dropped into a chapter. Placeholder: <href>. */
  video?: string;
  /** Audio clip directive. Placeholders: <href>, <begin>, <end>, <label>, <rate>. */
  audioClip?: string;
  /** Photo region directive. Placeholders: <at>, <of>, <as>, <row>, <badge>. */
  photoRegion?: string;
}

/**
 * A `scripts` entry is either a bare filename or `{ file, license? }`. The license
 * association is recorded on disk (the copied extension.json); the catalog entry
 * flattens scripts to filenames and aggregates licenses separately.
 */
function scriptFile(entry: unknown): string | null {
  if (typeof entry === 'string') return entry || null;
  if (entry && typeof entry === 'object') {
    const file = (entry as Record<string, unknown>).file;
    if (typeof file === 'string' && file) return file;
  }
  return null;
}

const MANIFEST_PATH = 'extensions/manifest.json';

function resolveEnv(env: ExtensionDiscoveryEnv = {}): Required<ExtensionDiscoveryEnv> {
  return {
    protocol: env.protocol ?? (typeof location !== 'undefined' ? location.protocol : 'file:'),
    baseUrl:
      env.baseUrl ?? (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/'),
    fetch: env.fetch ?? globalThis.fetch.bind(globalThis),
  };
}

/** The catalog is HTTP-only; a `file:`-embedded core never reaches for it. */
export function isExtensionCatalogAvailable(env: ExtensionDiscoveryEnv = {}): boolean {
  return resolveEnv(env).protocol !== 'file:';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const asStringArray = (v: unknown): string[] => (isStringArray(v) ? v : []);

/** Keep only well-formed asset entries (string file + string target). */
function asAssetArray(v: unknown): ExtensionAsset[] {
  if (!Array.isArray(v)) return [];
  const assets: ExtensionAsset[] = [];
  for (const item of v) {
    if (typeof item !== 'object' || item === null) continue;
    const a = item as Record<string, unknown>;
    if (typeof a.file !== 'string' || typeof a.target !== 'string') continue;
    assets.push({
      file: a.file,
      target: a.target,
      media: asString(a.media),
      license: asString(a.license),
    });
  }
  return assets;
}

/** Flatten a `scripts` array (string | {file}) to filenames, dropping malformed entries. */
function asScriptArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const file = scriptFile(item);
    if (file) out.push(file);
  }
  return out;
}

const OPTION_TYPES = new Set(['string', 'boolean', 'number', 'select']);

/** A select-option choice is `{ value, label }` (both strings); else dropped. */
function asOptionChoice(v: unknown): { value: string; label: string } | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.value !== 'string' || typeof o.label !== 'string') return null;
  return { value: o.value, label: o.label };
}

/** Keep only well-formed option descriptors (string name + label); coerce type/choices. */
function asGeneratorOptionArray(v: unknown): GeneratorOption[] {
  if (!Array.isArray(v)) return [];
  const out: GeneratorOption[] = [];
  for (const item of v) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== 'string' || !o.name) continue;
    if (typeof o.label !== 'string' || !o.label) continue;
    const type = typeof o.type === 'string' && OPTION_TYPES.has(o.type) ? o.type : 'string';
    const choices = Array.isArray(o.options)
      ? o.options.map(asOptionChoice).filter((c): c is { value: string; label: string } => c !== null)
      : undefined;
    const def =
      typeof o.default === 'string' || typeof o.default === 'boolean' || typeof o.default === 'number'
        ? o.default
        : undefined;
    out.push({
      type: type as GeneratorOption['type'],
      name: o.name,
      label: o.label,
      placeholder: asString(o.placeholder),
      default: def,
      options: choices,
    });
  }
  return out;
}

/**
 * Validate + normalize a single generator (id/name/script required; options
 * normalized). Returns null if malformed. Shared by the catalog and the
 * per-generator `generator.json` store.
 */
export function normalizeGenerator(value: unknown): GeneratorManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const g = value as Record<string, unknown>;
  if (typeof g.id !== 'string' || !g.id) return null;
  if (typeof g.name !== 'string' || !g.name) return null;
  if (typeof g.script !== 'string' || !g.script) return null;
  return {
    id: g.id,
    name: g.name,
    description: asString(g.description),
    script: g.script,
    license: asString(g.license),
    options: asGeneratorOptionArray(g.options),
  };
}

/** Keep only well-formed generators in an array; normalize each. */
function asGeneratorArray(v: unknown): GeneratorManifest[] {
  if (!Array.isArray(v)) return [];
  return v.map(normalizeGenerator).filter((g): g is GeneratorManifest => g !== null);
}

/** Every license file to bundle: extension-wide + per-script + per-asset + per-generator, deduped, order-stable.
 *  A manifest built by scripts/generate-extensions-manifest.js (or the dev middleware) has already
 *  flattened object-form scripts to filenames and aggregated their licenses into `licenses`, so
 *  that list is merged in first — without it a per-script license (js-yaml's, the family-history
 *  validator's) would be lost on install. */
function collectLicenses(
  scripts: unknown,
  license: unknown,
  assets: ExtensionAsset[],
  generators: GeneratorManifest[],
  declared?: unknown
): string[] {
  const out: string[] = [];
  const add = (l: unknown) => {
    if (typeof l === 'string' && l && !out.includes(l)) out.push(l);
  };
  add(license);
  if (Array.isArray(declared)) declared.forEach(add);
  if (Array.isArray(scripts)) {
    for (const s of scripts) {
      // Only a well-formed script entry (one with a file) contributes its license.
      if (s && typeof s === 'object' && scriptFile(s)) add((s as Record<string, unknown>).license);
    }
  }
  for (const a of assets) add(a.license);
  for (const g of generators) add(g.license);
  return out;
}

/**
 * Validate the optional per-format insertion templates ({ image?, video?, audioClip? }).
 * Exported for readers of on-disk extension.json copies (extension-manager).
 */
export function asTemplates(value: unknown): ExtensionTemplates | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const t = value as Record<string, unknown>;
  const out: ExtensionTemplates = {};
  if (typeof t.image === 'string' && t.image) out.image = t.image;
  if (typeof t.video === 'string' && t.video) out.video = t.video;
  if (typeof t.audioClip === 'string' && t.audioClip) out.audioClip = t.audioClip;
  if (typeof t.photoRegion === 'string' && t.photoRegion) out.photoRegion = t.photoRegion;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Validate + normalize an entry (coercing missing transform arrays to []). */
function normalizeCatalogEntry(value: unknown): ExtensionCatalogEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length === 0) return null;
  if (typeof e.name !== 'string' || e.name.length === 0) return null;
  const assets = asAssetArray(e.assets);
  const generators = asGeneratorArray(e.generators);
  return {
    id: e.id,
    name: e.name,
    description: asString(e.description),
    category: asString(e.category),
    url: asString(e.url),
    license: asString(e.license),
    scripts: asScriptArray(e.scripts),
    domTransforms: asStringArray(e.domTransforms),
    textTransforms: asStringArray(e.textTransforms),
    generators,
    assets,
    previewHead: asString(e.previewHead),
    files: isStringArray(e.files) && e.files.length > 0 ? e.files : undefined,
    licenses: collectLicenses(e.scripts, e.license, assets, generators, e.licenses),
    chapter: asString(e.chapter),
    templates: asTemplates(e.templates),
  };
}

/**
 * Fetch and validate `extensions/manifest.json`. Returns the catalog, or an empty
 * list when hosting is unavailable or anything goes wrong.
 */
export async function loadExtensionCatalog(
  env: ExtensionDiscoveryEnv = {}
): Promise<ExtensionCatalogEntry[]> {
  const resolved = resolveEnv(env);
  if (resolved.protocol === 'file:') return [];

  try {
    const url = new URL(MANIFEST_PATH, resolved.baseUrl).href;
    const response = await resolved.fetch(url);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    return data
      .map(normalizeCatalogEntry)
      .filter((e): e is ExtensionCatalogEntry => e !== null);
  } catch {
    // No manifest served, or malformed — the catalog simply isn't available.
    return [];
  }
}

/** Resolve the URL of a file within a catalog extension: `extensions/<id>/<file>`. */
export function resolveExtensionFileUrl(
  id: string,
  file: string,
  env: ExtensionDiscoveryEnv = {}
): string {
  const resolved = resolveEnv(env);
  return new URL(`extensions/${id}/${file}`, resolved.baseUrl).href;
}
