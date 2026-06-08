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

/** A catalog extension as published in extensions/manifest.json. */
export interface ExtensionCatalogEntry {
  id: string;
  name: string;
  description?: string;
  license?: string;
  /** 3rd-party lib files loaded into the transform iframe as globals. */
  scripts: string[];
  /** Suggested DOM-transform scripts (candidates for the dom_transforms list). */
  transforms: string[];
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

function isValidCatalogEntry(value: unknown): value is ExtensionCatalogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.name === 'string' &&
    e.name.length > 0 &&
    isStringArray(e.scripts) &&
    isStringArray(e.transforms)
  );
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
    return data.filter(isValidCatalogEntry);
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
