/**
 * Host-side plugin discovery.
 *
 * Plugins are an HTTP-only enrichment layer (see plans/api/plugins.md). The core
 * fetches a build-generated `plugins/manifest.json` to learn which plugins are
 * *available*; whether one is *used* additionally depends on the user enabling it
 * (resolved against the settings service by the caller — kept out of here so this
 * module stays a pure availability/URL resolver).
 *
 * Discovery never throws and never invents a manifest: if the app is on a `file:`
 * URL, or the fetch fails, no plugins are available and the core features stand on
 * their own.
 */

import type { PluginManifestEntry, PluginPresentation } from './contract.js';

/** Seams so the browser-mode contract tests can drive discovery deterministically. */
export interface PluginDiscoveryEnv {
  /** Document protocol, e.g. 'https:' or 'file:'. Defaults to location.protocol. */
  protocol?: string;
  /** Base URL the `plugins/` folder is resolved against. Defaults to document.baseURI. */
  baseUrl?: string;
  /** Fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

const MANIFEST_PATH = 'plugins/manifest.json';

function resolveEnv(env: PluginDiscoveryEnv = {}): Required<PluginDiscoveryEnv> {
  return {
    protocol: env.protocol ?? (typeof location !== 'undefined' ? location.protocol : 'file:'),
    baseUrl:
      env.baseUrl ?? (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/'),
    fetch: env.fetch ?? globalThis.fetch.bind(globalThis),
  };
}

/**
 * Plugins load only over HTTP(S). A `file:`-embedded core (the offline single-file
 * artifact) never reaches for plugins.
 */
export function isPluginHostingAvailable(env: PluginDiscoveryEnv = {}): boolean {
  return resolveEnv(env).protocol !== 'file:';
}

const VALID_PRESENTATIONS: readonly PluginPresentation[] = ['panel', 'view'];

function isValidEntry(value: unknown): value is PluginManifestEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    typeof e.name === 'string' &&
    typeof e.entry === 'string' &&
    e.entry.length > 0 &&
    typeof e.presentation === 'string' &&
    VALID_PRESENTATIONS.includes(e.presentation as PluginPresentation)
  );
}

/**
 * Fetch and validate `plugins/manifest.json`. Returns the list of available
 * plugins, or an empty list when hosting is unavailable or anything goes wrong.
 */
export async function loadPluginManifest(
  env: PluginDiscoveryEnv = {}
): Promise<PluginManifestEntry[]> {
  const resolved = resolveEnv(env);
  if (resolved.protocol === 'file:') return [];

  try {
    const url = new URL(MANIFEST_PATH, resolved.baseUrl).href;
    const response = await resolved.fetch(url);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    return data.filter(isValidEntry);
  } catch {
    // No manifest served, or malformed — plugins simply aren't available.
    return [];
  }
}

/**
 * Resolve the iframe `src` for a plugin: `plugins/<entry>`, same-origin with the
 * core. Identical in dev and prod — in dev the core dev server serves the plugin's
 * source at that path (with HMR); in prod it's the built single-file in dist/.
 */
export function resolvePluginEntryUrl(
  entry: PluginManifestEntry,
  env: PluginDiscoveryEnv = {}
): string {
  const resolved = resolveEnv(env);
  return new URL(`plugins/${entry.entry}`, resolved.baseUrl).href;
}

/**
 * A plugin is used only when it is both available (in the manifest) and enabled
 * by the user. Pure helper so callers can combine manifest + settings state.
 */
export function findActivePlugin(
  available: PluginManifestEntry[],
  enabledIds: Iterable<string>,
  id: string
): PluginManifestEntry | null {
  const enabled = new Set(enabledIds);
  if (!enabled.has(id)) return null;
  return available.find(entry => entry.id === id) ?? null;
}
