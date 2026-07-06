/**
 * SEED.html embedding — capturing the editor's own single-file build and storing
 * it in a workspace so packaging can embed it at the EPUB root (next to SEED.zip),
 * making the EPUB self-editing.
 *
 * The bytes are obtained either by fetching the running page (hosted http only;
 * `fetch` is blocked under file://) or from a file the user provides. They are
 * stored at the workspace root path `SEED.html` — a non-manifest payload that
 * persists and round-trips on EPUB import.
 */

import type { FileStorageAPI } from '../storage/index.js';
import { ZipWriter } from '../zip/index.js';

/** Root path of the editor build inside a workspace and a packaged EPUB. */
export const SEED_HTML_NAME = 'SEED.html';

/** The i18n catalog cache workspace (see src/lib/i18n/loader.ts). */
const LOCALES_WORKSPACE_ID = 'locales';

/**
 * The build-stamped i18n bundle assignment inside a SEED.html. Matches the null
 * anchor (current builds, see vite.config.ts i18n-inline-anchor), a populated
 * data-URL assignment (older builds and already-injected files — makes
 * re-injection idempotent), and tolerates the legacy spaced form.
 */
const BUNDLE_ASSIGNMENT_PATTERN =
  /window\.__EDITME_I18N_BUNDLE__\s*=\s*(?:null|'data:application\/zip;base64,[A-Za-z0-9+/=]*');/;

/**
 * Base64-encode in chunks — String.fromCharCode.apply on a whole catalog bundle
 * would overflow the argument limit.
 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Zip every locale catalog cached in the locales workspace (except English —
 * msgids are the English content) into a data URL byte-compatible with the
 * loader's embedded-bundle path. Returns null when there is nothing to carry.
 */
export async function buildLocaleBundleDataUrl(
  fileStorage: FileStorageAPI
): Promise<string | null> {
  let filePaths: string[];
  try {
    filePaths = await fileStorage.listFiles(LOCALES_WORKSPACE_ID);
  } catch {
    return null; // no locales workspace — nothing to carry
  }

  const catalogFiles = filePaths
    .map(path => path.split('/').pop() || path)
    .filter(name => name.endsWith('.json') && !name.startsWith('.') && name !== 'en.json');

  if (catalogFiles.length === 0) {
    return null;
  }

  const writer = new ZipWriter();
  let added = 0;
  for (const name of catalogFiles) {
    try {
      const content = await fileStorage.readTextFile(LOCALES_WORKSPACE_ID, name);
      JSON.parse(content); // never embed a corrupt catalog
      await writer.addFile(name, content);
      added++;
    } catch {
      // Unreadable/corrupt catalog — skip it, carry the rest.
    }
  }
  if (added === 0) {
    return null;
  }

  const zipBuffer = await writer.build();
  return `data:application/zip;base64,${toBase64(new Uint8Array(zipBuffer))}`;
}

/**
 * Splice a catalog bundle data URL into SEED.html bytes, replacing the build's
 * bundle assignment (null anchor or a previous injection). Pure string surgery
 * on the unique build-stamped token — parsing/reserializing a ~1MB single-file
 * document would risk corrupting inlined scripts and doubles memory.
 *
 * Throws when no assignment is found (a pre-i18n build); callers fall back to
 * the pristine bytes — injection must never block packaging.
 */
export function injectI18nBundle(seedHtmlBytes: ArrayBuffer, dataUrl: string): ArrayBuffer {
  const html = new TextDecoder().decode(seedHtmlBytes);
  const replacement = `window.__EDITME_I18N_BUNDLE__='${dataUrl}';`;

  const match = BUNDLE_ASSIGNMENT_PATTERN.exec(html);
  if (!match) {
    throw new Error('SEED.html has no i18n bundle assignment to inject into');
  }

  const injected =
    html.slice(0, match.index) + replacement + html.slice(match.index + match[0].length);
  return new TextEncoder().encode(injected).buffer as ArrayBuffer;
}

/** Whether the running page can fetch its own HTML (hosted http(s); not file://). */
export function canFetchSelfHtml(): boolean {
  return typeof location !== 'undefined' && location.protocol.startsWith('http');
}

/**
 * Fetch the running app's own single-file HTML. Only works when served over
 * http(s) — `fetch` is sandboxed out under file://. The bytes are the pristine
 * build (unlike document.outerHTML, which is the mutated runtime DOM).
 */
export async function fetchSelfHtml(): Promise<ArrayBuffer> {
  const response = await fetch(location.href, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch the editor page: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

/** Whether a workspace already holds an embedded SEED.html. */
export function hasSeedHtml(fileStorage: FileStorageAPI, workspaceId: string): Promise<boolean> {
  return fileStorage.fileExists(workspaceId, SEED_HTML_NAME);
}

/** Store the editor bytes at the workspace root, ready to be packaged. */
export function storeSeedHtml(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  bytes: ArrayBuffer
): Promise<void> {
  return fileStorage.writeFile(workspaceId, SEED_HTML_NAME, bytes);
}

/** Remove the embedded editor from a workspace. */
export function removeSeedHtml(fileStorage: FileStorageAPI, workspaceId: string): Promise<void> {
  return fileStorage.deleteFile(workspaceId, SEED_HTML_NAME);
}
