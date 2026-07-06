/**
 * HTTP catalog source: fetches per-locale translation catalogs on demand from the
 * locales/ sidecar the build publishes next to the hosted app (mirroring the
 * extensions catalog pattern). Unavailable on file:// — the single-file build
 * relies on embedded/injected catalogs and the storage cache instead.
 *
 * Every function is failure-tolerant: a host without the sidecar (or offline)
 * behaves exactly like file://, it never throws.
 */

import type { LocalesManifest, LocalesManifestEntry } from './types.js';

const MANIFEST_PATH = 'locales/manifest.json';

/** Injectable environment so tests never have to mutate globals */
export interface CatalogFetchEnv {
  /** Document protocol, e.g. 'https:' or 'file:'. Defaults to location.protocol. */
  protocol?: string;
  /** Fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

function resolveEnv(env: CatalogFetchEnv = {}): Required<CatalogFetchEnv> {
  return {
    protocol: env.protocol ?? (typeof location !== 'undefined' ? location.protocol : 'file:'),
    fetch: env.fetch ?? globalThis.fetch.bind(globalThis),
  };
}

/**
 * Whether this deployment can fetch catalogs over http at all
 */
export function isHttpSourceAvailable(env: CatalogFetchEnv = {}): boolean {
  return resolveEnv(env).protocol !== 'file:';
}

/**
 * Fetch and validate the locales manifest sidecar. Returns null on any failure —
 * missing sidecar, network error, or malformed content.
 */
export async function fetchLocalesManifest(
  env: CatalogFetchEnv = {}
): Promise<LocalesManifest | null> {
  const resolved = resolveEnv(env);
  if (resolved.protocol === 'file:') return null;

  try {
    const response = await resolved.fetch(MANIFEST_PATH, { cache: 'no-cache' });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray((data as LocalesManifest).locales)) {
      return null;
    }

    const locales = (data as LocalesManifest).locales.filter(
      (entry: unknown): entry is LocalesManifestEntry =>
        !!entry &&
        typeof (entry as LocalesManifestEntry).code === 'string' &&
        typeof (entry as LocalesManifestEntry).file === 'string' &&
        typeof (entry as LocalesManifestEntry).name === 'string'
    );

    return {
      version: String((data as LocalesManifest).version ?? ''),
      locales,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch one catalog file as raw text (the loader owns parsing/validation).
 * Returns null on any failure.
 */
export async function fetchCatalogFile(
  entry: LocalesManifestEntry,
  env: CatalogFetchEnv = {}
): Promise<string | null> {
  const resolved = resolveEnv(env);
  if (resolved.protocol === 'file:') return null;

  try {
    const response = await resolved.fetch(`locales/${entry.file}`, { cache: 'no-cache' });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
