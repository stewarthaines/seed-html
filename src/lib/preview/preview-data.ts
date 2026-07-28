/**
 * Path scheme for data a preview `head.xml` script persists through
 * `window.seed.saveData` (see process/PREVIEW_BRIDGE.md).
 *
 * The author names only a `slot` (the kind of data); the app owns the rest of
 * the path, keyed by the chapter `idref` the preview is rendering, so it can GC
 * per chapter on a spine rename/delete. Grouping by idref makes that a single
 * directory operation. The scheme is a documented contract: the build-time
 * reader (a DOM transform via `ctx.readSourceText`) reconstructs a path from
 * `(idref, slot)`.
 */

/** Root of preview-bridge-written data, under the `SOURCE/data/` scratch area. */
export const PREVIEW_DATA_PREFIX = 'SOURCE/data/preview/';

/** A slot is a single safe path segment — the only name author code supplies. */
const SLOT_RE = /^[a-z0-9_-]{1,64}$/;
/** An idref is an XML id; hold it to safe path characters (no separators/traversal). */
const IDREF_RE = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * The full SOURCE-relative path for a `(idref, slot)` pair, or `null` when
 * either is unsafe. Shape: `SOURCE/data/preview/<idref>/<slot>.json`.
 */
export function previewDataPath(idref: string, slot: string): string | null {
  if (!IDREF_RE.test(idref) || !SLOT_RE.test(slot)) return null;
  return `${PREVIEW_DATA_PREFIX}${idref}/${slot}.json`;
}

/**
 * The per-chapter directory the app removes (delete) or moves (rename) to GC a
 * chapter's preview data. `null` when the idref is unsafe.
 */
export function previewDataChapterDir(idref: string): string | null {
  if (!IDREF_RE.test(idref)) return null;
  return `${PREVIEW_DATA_PREFIX}${idref}/`;
}

/** A validated `seed-save-data` envelope (see process/PREVIEW_BRIDGE.md). */
export interface PreviewSaveData {
  idref: string;
  slot: string;
  text: string;
}

/**
 * Accept or drop a `seed-save-data` message from the preview iframe.
 *
 * The bridge stamps the chapter idref into the iframe realm at injection time
 * and every message echoes it back. The echo must match the chapter the app is
 * CURRENTLY previewing: the iframe `Window` survives `document.open()` across
 * a chapter switch, so a late message from the previous chapter's capture
 * script passes an `event.source` check — matching the stamped identity is
 * what keeps chapter A's data from being filed under chapter B. A mismatch is
 * dropped, not remapped: the data regenerates the next time its chapter
 * renders.
 *
 * Returns the validated envelope, or `null` to drop (wrong shape, unsafe
 * idref/slot, or identity mismatch).
 */
export function acceptPreviewSaveData(
  data: unknown,
  currentIdref: string | null | undefined
): PreviewSaveData | null {
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as { type?: unknown; idref?: unknown; slot?: unknown; text?: unknown };
  if (msg.type !== 'seed-save-data') return null;
  if (typeof msg.idref !== 'string' || typeof msg.slot !== 'string' || typeof msg.text !== 'string')
    return null;
  if (!currentIdref || msg.idref !== currentIdref) return null;
  if (previewDataPath(msg.idref, msg.slot) === null) return null;
  return { idref: msg.idref, slot: msg.slot, text: msg.text };
}
