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

/** Root path of the editor build inside a workspace and a packaged EPUB. */
export const SEED_HTML_NAME = 'SEED.html';

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
