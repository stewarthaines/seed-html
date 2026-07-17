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

/** The empty payload slot exactly as the reader's build guarantees ship it. */
export const PAYLOAD_SLOT =
  '<script type="application/epub+zip;base64" id="readhtml-payload"></' + 'script>';

const SLOT_CLOSE = '</' + 'script>';
const SLOT_OPEN = PAYLOAD_SLOT.slice(0, PAYLOAD_SLOT.length - SLOT_CLOSE.length);

/**
 * Base64-encode bytes chunk-wise: btoa needs a binary string, and building one
 * with a single fromCharCode call overflows the argument stack for book-sized
 * payloads.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Insert the EPUB payload into the reader shell. Throws unless the empty slot
 * appears exactly once — anything else means the vendored reader and this code
 * have drifted, and the fix is re-reading the payload-slot contract, not
 * loosening the match.
 */
export function injectEpubPayload(shellHtml: string, epubBytes: Uint8Array): string {
  const parts = shellHtml.split(PAYLOAD_SLOT);
  if (parts.length < 2) {
    throw new Error('READ.html payload slot not found — vendored reader out of sync');
  }
  if (parts.length > 2) {
    throw new Error('READ.html payload slot is not unique — vendored reader out of sync');
  }
  return parts[0] + SLOT_OPEN + bytesToBase64(epubBytes) + SLOT_CLOSE + parts[1];
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
