/**
 * EPUB Path Utilities
 *
 * Handles path conversions between manifest-relative paths (used in OPF files)
 * and XHTML-file-relative paths (used in content files for asset references).
 */

/**
 * Convert manifest-relative path to XHTML-file-relative path
 *
 * In EPUB structure:
 * - Manifest paths are relative to the OPF file location (e.g., "Styles/page.css")
 * - XHTML paths are relative to the XHTML file location (e.g., "../Styles/page.css")
 *
 * @param manifestHref - Path from manifest relative to OPF file
 * @param xhtmlDir - Directory of XHTML file relative to OPF (default: "Text")
 * @returns XHTML-relative path suitable for use in href/src attributes
 *
 * @example
 * // For XHTML files in OEBPS/Text/ directory:
 * convertManifestPathToXHTMLPath("Styles/page.css") → "../Styles/page.css"
 * convertManifestPathToXHTMLPath("Scripts/reader.js") → "../Scripts/reader.js"
 * convertManifestPathToXHTMLPath("Images/cover.jpg") → "../Images/cover.jpg"
 */
export function convertManifestPathToXHTMLPath(
  manifestHref: string,
  xhtmlDir: string = 'Text'
): string {
  // Already has relative path prefix - return as is
  if (manifestHref.startsWith('../') || manifestHref.startsWith('./')) {
    return manifestHref;
  }

  // Absolute URLs or special protocols - return as is
  if (
    manifestHref.startsWith('http') ||
    manifestHref.startsWith('data:') ||
    manifestHref.startsWith('blob:') ||
    manifestHref.startsWith('/')
  ) {
    return manifestHref;
  }

  // For files in subdirectories (like Text/), need to go up to parent
  if (xhtmlDir && xhtmlDir !== '') {
    return `../${manifestHref}`;
  }

  // Files at same level as OPF - no change needed
  return manifestHref;
}

/**
 * Convert XHTML-relative path back to manifest-relative path
 *
 * Reverse operation of convertManifestPathToXHTMLPath for cases where
 * manifest paths need to be extracted from XHTML references.
 *
 * @param xhtmlHref - XHTML-relative path from href/src attribute
 * @param xhtmlDir - Directory of XHTML file relative to OPF (default: "Text")
 * @returns Manifest-relative path suitable for manifest href attributes
 *
 * @example
 * convertXHTMLPathToManifestPath("../Styles/page.css") → "Styles/page.css"
 */
export function convertXHTMLPathToManifestPath(
  xhtmlHref: string,
  xhtmlDir: string = 'Text'
): string {
  // Already manifest-relative or special protocol - return as is
  if (
    !xhtmlHref.startsWith('../') ||
    xhtmlHref.startsWith('http') ||
    xhtmlHref.startsWith('data:') ||
    xhtmlHref.startsWith('blob:')
  ) {
    return xhtmlHref;
  }

  // For files in subdirectories, remove the ../ prefix
  if (xhtmlDir && xhtmlDir !== '' && xhtmlHref.startsWith('../')) {
    return xhtmlHref.substring(3); // Remove "../"
  }

  return xhtmlHref;
}

/**
 * Collapse `.` and `..` segments in a container path. `..` at the root is
 * dropped rather than escaping the container (EPUB references never leave
 * the container; a stray one is a broken link, not a way out).
 */
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

/** The directory part of a container path: `EPUB/xhtml/raw/ch1.xhtml` → `EPUB/xhtml/raw`; `ch1.xhtml` → ``. */
export function dirOfPath(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/**
 * Resolve a relative reference the way EPUB and URLs do: against the
 * directory it is written in, with dot segments collapsed and any fragment
 * or query dropped. `resolveRelativePath('EPUB/xhtml/raw', '../../css/a.css')`
 * → `EPUB/css/a.css`; `resolveRelativePath('EPUB', '../_kmeta/x.js')` →
 * `_kmeta/x.js`. A leading slash means the container root.
 */
export function resolveRelativePath(fromDir: string, href: string): string {
  const bare = href.split('#')[0].split('?')[0];
  if (bare.startsWith('/')) return normalizePath(bare);
  return normalizePath(fromDir ? `${fromDir}/${bare}` : bare);
}

/**
 * A manifest href as a container path: resolved against the package
 * document's directory (`basePath`, '' when the OPF sits at the root). An
 * href that already carries the base is returned as is, since some callers
 * hold full paths.
 */
export function manifestHrefToPath(basePath: string, href: string): string {
  if (!basePath) return normalizePath(href.split('#')[0]);
  if (href.startsWith(basePath + '/')) return href;
  return resolveRelativePath(basePath, href);
}

/**
 * A container path as an href relative to `dir` (the package document's
 * directory, or a chapter's): `relativePathFrom('EPUB', '_kmeta/x.js')` →
 * `../_kmeta/x.js`; `relativePathFrom('EPUB', 'EPUB/css/a.css')` → `css/a.css`.
 */
export function relativePathFrom(dir: string, path: string): string {
  const from = dir ? dir.split('/') : [];
  const to = path.split('/');
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) common++;
  const ups = from.length - common;
  return [...Array(ups).fill('..'), ...to.slice(common)].join('/');
}
