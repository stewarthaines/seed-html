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
