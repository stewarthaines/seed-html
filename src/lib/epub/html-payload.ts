/**
 * Embedded-EPUB payload slots — the shared mechanics behind "Package as
 * READ.html" and "Package as SEED.html" (process/SEED_HTML_PACKAGE.md).
 *
 * A payload slot is an empty, uniquely-marked script element in a single-file
 * HTML app. A publishing step fills it with one EPUB's bytes as base64 (which
 * cannot form `</script>` or any HTML-significant sequence, so plain text
 * substitution is safe); at boot the app reads its own slot back. Everything
 * here is markup-string mechanics — the consuming modules own which slot,
 * which shell, and what a payload means.
 */

const SLOT_CLOSE = '</' + 'script>';

/** The empty slot element for `id`, exactly as builds must ship it. */
export function payloadSlot(id: string): string {
  return `<script type="application/epub+zip;base64" id="${id}">` + SLOT_CLOSE;
}

/** The slot SEED.html publishes about itself in index.html. */
export const SEED_PAYLOAD_ID = 'seedhtml-payload';

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

/** Decode a slot's base64 text back to bytes (throws on malformed base64). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Insert an EPUB payload into a shell document at `slotMarker` (an empty slot
 * from payloadSlot()). Throws unless the slot appears exactly once — anything
 * else means the shell and this code have drifted, and the fix is re-reading
 * the payload-slot contract, not loosening the match.
 */
export function injectPayload(
  shellHtml: string,
  slotMarker: string,
  epubBytes: Uint8Array
): string {
  const parts = shellHtml.split(slotMarker);
  if (parts.length < 2) {
    throw new Error('payload slot not found — shell out of sync with the payload-slot contract');
  }
  if (parts.length > 2) {
    throw new Error(
      'payload slot is not unique — shell out of sync with the payload-slot contract'
    );
  }
  const open = slotMarker.slice(0, slotMarker.length - SLOT_CLOSE.length);
  return parts[0] + open + bytesToBase64(epubBytes) + SLOT_CLOSE + parts[1];
}
