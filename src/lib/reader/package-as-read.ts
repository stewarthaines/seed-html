/**
 * "Package as READ.html" — wrap a packaged plain EPUB in the vendored READ.html
 * reader, producing a single .html file that opens the book by double-click, no
 * reading system needed.
 *
 * The vendored single-file reader (public/read/READ.html) publishes an
 * embedded-payload slot — an empty, uniquely-marked script element — as a
 * versioned interface (see public/read/VENDORED.md and the read-html repo's
 * docs/PAYLOAD_SLOT.md). This module fills it: the EPUB bytes as base64 become
 * the element's text content, and nothing else in the file changes. Base64
 * cannot form `</script>` or any other HTML-significant sequence, so plain
 * text substitution is safe.
 *
 * The reader treats an embedded book as trusted by construction (its scripts
 * run without a consent prompt) — which is why only the plain packaging (no
 * SEED.zip / SEED.html) belongs in the payload: this is a one-way destination
 * format, like PDF.
 *
 * HTTP-only, like the Read affordance: fetching the shell needs dist/read/
 * served over HTTP, so gate callers on isHttpContext().
 */

import { payloadSlot, injectPayload, bytesToBase64 } from '../epub/html-payload.js';

export { bytesToBase64 };

/** The empty payload slot exactly as the reader's build guarantees ship it. */
export const PAYLOAD_SLOT = payloadSlot('readhtml-payload');

/**
 * Insert the EPUB payload into the reader shell. Throws unless the empty slot
 * appears exactly once — anything else means the vendored reader and this code
 * have drifted, and the fix is re-reading the payload-slot contract, not
 * loosening the match. (Shared mechanics: src/lib/epub/html-payload.ts.)
 */
export function injectEpubPayload(shellHtml: string, epubBytes: Uint8Array): string {
  return injectPayload(shellHtml, PAYLOAD_SLOT, epubBytes);
}

/** The packaged EPUB's filename with its extension swapped: same slug, .html. */
export function readHtmlFilename(epubFilename: string): string {
  return epubFilename.replace(/\.epub$/i, '') + '.html';
}

/**
 * Fetch the vendored shell and produce the book-carrying file for download.
 */
export async function packageEpubAsReadHtml(
  epub: Blob,
  epubFilename: string
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(new URL('read/READ.html', document.baseURI));
  if (!response.ok) {
    throw new Error(`Could not load the READ.html shell (HTTP ${response.status})`);
  }
  const shell = await response.text();
  const bytes = new Uint8Array(await epub.arrayBuffer());
  const html = injectEpubPayload(shell, bytes);
  return {
    blob: new Blob([html], { type: 'text/html' }),
    filename: readHtmlFilename(epubFilename),
  };
}
