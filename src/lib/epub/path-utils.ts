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
 * Validate EPUB path format
 *
 * @param path - Path to validate
 * @returns true if path follows EPUB conventions
 */
export function isValidEPUBPath(path: string): boolean {
  // Empty paths are invalid
  if (!path || path.trim() === '') {
    return false;
  }

  // Paths should not start with / (absolute paths not recommended in EPUB)
  if (path.startsWith('/')) {
    return false;
  }

  // Check for invalid characters
  const invalidChars = /[<>"|*?]/;
  if (invalidChars.test(path)) {
    return false;
  }

  return true;
}

/**
 * Get directory from EPUB path
 *
 * @param path - Full EPUB path
 * @returns Directory portion or empty string if no directory
 *
 * @example
 * getEPUBDirectory("Styles/page.css") → "Styles"
 * getEPUBDirectory("../Scripts/reader.js") → "../Scripts"
 * getEPUBDirectory("cover.jpg") → ""
 */
export function getEPUBDirectory(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) {
    return '';
  }
  return path.substring(0, lastSlash);
}

/**
 * Get filename from EPUB path
 *
 * @param path - Full EPUB path
 * @returns Filename portion
 *
 * @example
 * getEPUBFilename("Styles/page.css") → "page.css"
 * getEPUBFilename("../Scripts/reader.js") → "reader.js"
 * getEPUBFilename("cover.jpg") → "cover.jpg"
 */
export function getEPUBFilename(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) {
    return path;
  }
  return path.substring(lastSlash + 1);
}
