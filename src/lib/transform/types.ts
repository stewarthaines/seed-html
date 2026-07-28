/**
 * Transform Pipeline Type Definitions
 *
 * Canonical home of `ChapterMetadata`, the chapter-level contract shared by the
 * XHTML template and the spine editor. Other transform contracts live next to
 * their implementations (transform-error.ts, transform-manager.ts,
 * transform-executor.ts).
 */

export interface ChapterMetadata {
  title: string;
  language: string;
  stylesheets: string[];
  scripts: string[];
  /** Arbitrary author-supplied <head> passthrough. */
  customHead?: string;
  /**
   * Fixed-layout viewport, as the `content` value of a <meta name="viewport">
   * (e.g. "width=1200, height=600"). Synthesised for preview from the package's
   * rendition:viewport; omitted for reflowable content.
   */
  viewport?: string;
}
