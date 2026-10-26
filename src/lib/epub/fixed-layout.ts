/**
 * Fixed-layout (pre-paginated) defaults.
 *
 * EPUB does not mandate a viewport size — fixed-layout dimensions are meant to
 * match the intrinsic size of each page's content. These values are only a
 * neutral, modern 3:4 portrait starting point: shown as a placeholder in the
 * metadata editor and used as the preview fallback when a publication declares
 * no rendition:viewport of its own.
 */
export const DEFAULT_FXL_VIEWPORT_WIDTH = 1200;
export const DEFAULT_FXL_VIEWPORT_HEIGHT = 1600;

/** Canonical rendition:viewport string for the defaults above. */
export const DEFAULT_FXL_VIEWPORT = `width=${DEFAULT_FXL_VIEWPORT_WIDTH}, height=${DEFAULT_FXL_VIEWPORT_HEIGHT}`;

export interface FxlViewport {
  width: number;
  height: number;
}

/**
 * Parse a rendition:viewport string ("width=1200, height=1600") into pixel
 * dimensions. Both dimensions are required; if either is missing or invalid
 * the whole value falls back to the defaults — matching the metadata editor's
 * both-or-nothing compose semantics and the preview pipeline's
 * `renditionViewport || DEFAULT_FXL_VIEWPORT` fallback. (A garbled viewport
 * imported from a foreign EPUB therefore previews at the default size while
 * its meta tag keeps the original string — acceptable.)
 *
 * The digits-only patterns reject signed values ("width=-5" falls back).
 */
export function parseFxlViewport(viewport: string | null | undefined): FxlViewport {
  const w = viewport ? /width\s*=\s*(\d+)/i.exec(viewport) : null;
  const h = viewport ? /height\s*=\s*(\d+)/i.exec(viewport) : null;
  const width = w ? parseInt(w[1], 10) : NaN;
  const height = h ? parseInt(h[1], 10) : NaN;
  if (width > 0 && height > 0) return { width, height };
  return { width: DEFAULT_FXL_VIEWPORT_WIDTH, height: DEFAULT_FXL_VIEWPORT_HEIGHT };
}

/**
 * A publication's page size for transform scripts (`ctx.viewport`): its
 * fixed-layout viewport, or null when the book is reflowable. A fixed-layout
 * book without a usable viewport gets the defaults, as the preview does.
 */
export function bookViewport(
  metadata: { renditionLayout?: string; renditionViewport?: string } | null | undefined
): FxlViewport | null {
  if (metadata?.renditionLayout !== 'pre-paginated') return null;
  return parseFxlViewport(metadata.renditionViewport);
}
