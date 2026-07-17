/**
 * "Package as SEED.html" — wrap a packaged Active EPUB in the app's own
 * single-file document, producing one double-clickable file that opens as the
 * editor with the book ready to import (process/SEED_HTML_PACKAGE.md).
 *
 * The artifact is an IMPORT VEHICLE plus the editor, never a working copy: a
 * `file://` page cannot overwrite its own file, so opening it imports the
 * project into browser storage (src/lib/import/boot-payload.ts) and edits
 * live there, exactly as today.
 *
 * The payload is the Active EPUB with SEED.zip and WITHOUT an embedded editor
 * copy — the wrapper is the editor; nesting a second one is pure size.
 *
 * HTTP-only: fetching the app's own document needs the app origin. Note the
 * dev-mode caveat — under `vite dev` the fetched document is not the
 * self-contained single-file build, so a dev-generated artifact won't work
 * standalone; verify against `vite preview` or the deployment.
 */

import { payloadSlot, SEED_PAYLOAD_ID, injectPayload } from './html-payload.js';
import { fetchSelfHtml, localizedSeedHtml } from './seed-html.js';
import type { FileStorageAPI } from '../storage/index.js';

/** The empty slot exactly as index.html ships it (asserted by smoke-build). */
export const SEED_PAYLOAD_SLOT = payloadSlot(SEED_PAYLOAD_ID);

/**
 * The packaged EPUB's filename re-extended: same slug, `.SEED.html` — the
 * plain `.html` name belongs to "Package as READ.html", and the double
 * extension makes the artifact type recognizable ("the SEED.html of this
 * book").
 */
export function seedHtmlFilename(epubFilename: string): string {
  return epubFilename.replace(/\.epub$/i, '') + '.SEED.html';
}

/**
 * Fetch the app's own document, splice in the user's cached locale catalogs
 * (same machinery as embedding SEED.html into an EPUB — the artifact speaks
 * the recipient's language offline), and produce the book-carrying file for
 * download.
 */
export async function packageEpubAsSeedHtml(
  fileStorage: FileStorageAPI,
  epub: Blob,
  epubFilename: string
): Promise<{ blob: Blob; filename: string }> {
  const shellBytes = await localizedSeedHtml(await fetchSelfHtml(), fileStorage);
  const shell = new TextDecoder().decode(shellBytes);
  const bytes = new Uint8Array(await epub.arrayBuffer());
  const html = injectPayload(shell, SEED_PAYLOAD_SLOT, bytes);
  return {
    blob: new Blob([html], { type: 'text/html' }),
    filename: seedHtmlFilename(epubFilename),
  };
}
