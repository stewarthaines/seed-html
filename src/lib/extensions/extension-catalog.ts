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
export interface ExtensionAsset {
  /** File within the extension dir to copy. */
  file: string;
  /** OEBPS-relative destination, also the manifest href (e.g. 'Styles/highlight.css'). */
  target: string;
  /** Manifest media type; auto-detected from the target extension when omitted. */
  media?: string;
  /** License file (within the extension dir) for this asset; bundled into SOURCE/. */
  license?: string;
}

/** A catalog extension as published in extensions/manifest.json. */
export interface ExtensionCatalogEntry {
  id: string;
  name: string;
  description?: string;
  /** Project/homepage URL for the 3rd-party library. */
  url?: string;
  /** Extension-wide license file (e.g. 'LICENSE.txt'). */
  license?: string;
  /** 3rd-party lib files loaded into the transform iframe as globals (filenames). */
  scripts: string[];
  /** Suggested DOM-transform scripts (candidates for the dom_transforms list). */
  domTransforms: string[];
  /** Suggested text-transform scripts (candidates for the single text_transform). */
  textTransforms: string[];
  /** EPUB assets copied into OEBPS/ and registered in the manifest (e.g. CSS). */
  assets: ExtensionAsset[];
  /** All license files to bundle into SOURCE/ (extension-wide + per-script + per-asset). */
  licenses: string[];
}

/**
 * A `scripts` entry is either a bare filename or `{ file, license? }`. The license
 * association is recorded on disk (the copied extension.json); the catalog entry
 * flattens scripts to filenames and aggregates licenses separately.
 */
export function scriptFile(entry: unknown): string | null {
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

/** Every license file to bundle: extension-wide + per-script + per-asset, deduped, order-stable. */
function collectLicenses(scripts: unknown, license: unknown, assets: ExtensionAsset[]): string[] {
  const out: string[] = [];
  const add = (l: unknown) => {
    if (typeof l === 'string' && l && !out.includes(l)) out.push(l);
  };
  add(license);
  if (Array.isArray(scripts)) {
    for (const s of scripts) {
      // Only a well-formed script entry (one with a file) contributes its license.
      if (s && typeof s === 'object' && scriptFile(s)) add((s as Record<string, unknown>).license);
    }
  }
  for (const a of assets) add(a.license);
  return out;
}

/** Validate + normalize an entry (coercing missing transform arrays to []). */
function normalizeCatalogEntry(value: unknown): ExtensionCatalogEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length === 0) return null;
  if (typeof e.name !== 'string' || e.name.length === 0) return null;
  if (!Array.isArray(e.scripts)) return null;
  const assets = asAssetArray(e.assets);
  return {
    id: e.id,
    name: e.name,
    description: asString(e.description),
    url: asString(e.url),
    license: asString(e.license),
    scripts: asScriptArray(e.scripts),
    domTransforms: asStringArray(e.domTransforms),
    textTransforms: asStringArray(e.textTransforms),
    assets,
    licenses: collectLicenses(e.scripts, e.license, assets),
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
