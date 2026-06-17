/**
 * XHTML Template Generation
 *
 * Generates valid XHTML documents with proper DOCTYPE, namespaces,
 * stylesheets, scripts, and metadata for EPUB content.
 */

import { convertManifestPathToXHTMLPath } from '../epub/path-utils.js';
import { isRtlLanguage } from '../epub/language-direction.js';

// ChapterMetadata is defined once in ./types.js (the package's canonical types
// module, re-exported by the barrel). Re-export it here so existing importers of
// this module keep working without a second, drift-prone copy of the interface.
import type { ChapterMetadata } from './types.js';
export type { ChapterMetadata } from './types.js';

/**
 * Generates XHTML documents with proper metadata and structure
 */
export function generateXHTMLDocument(content: string, metadata: ChapterMetadata): string {
  const escapedTitle = escapeHtml(metadata.title);

  const stylesheetLinks = metadata.stylesheets
    .map(
      href =>
        `    <link rel="stylesheet" type="text/css" href="${escapeHtml(convertManifestPathToXHTMLPath(href))}" />`
    )
    .join('\n');

  const scriptTags = metadata.scripts
    .map(
      src =>
        `    <script type="text/javascript" src="${escapeHtml(convertManifestPathToXHTMLPath(src))}"></script>`
    )
    .join('\n');

  const viewportTag = metadata.viewport
    ? `    <meta name="viewport" content="${escapeHtml(metadata.viewport)}" />`
    : '';

  const customHeadContent = metadata.customHead ? `    ${metadata.customHead}` : '';

  // Right-to-left languages need an explicit base direction in markup — a `lang`
  // declaration alone doesn't set direction, and reading systems don't reliably
  // honour CSS for it (per the EPUB/HTML specs and DAISY guidance).
  const dirAttr = isRtlLanguage(metadata.language) ? ' dir="rtl"' : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeHtml(metadata.language)}" lang="${escapeHtml(metadata.language)}"${dirAttr}>
  <head>
    <title>${escapedTitle}</title>
${viewportTag}${viewportTag ? '\n' : ''}${stylesheetLinks}${stylesheetLinks ? '\n' : ''}${scriptTags}${scriptTags ? '\n' : ''}${customHeadContent}${customHeadContent ? '\n' : ''}  </head>
  <body>
    ${ensureMainLandmark(content)}
  </body>
</html>`;
}

/**
 * Wrap chapter content in a single `<main role="main">` landmark for accessibility
 * (axe `landmark-one-main`; WCAG 2.4.1/1.3.1). Idempotent: if the content already
 * contains a `<main>` element — e.g. a project transform script added one — it's
 * left as-is so we never emit two mains (which would be invalid HTML).
 */
export function ensureMainLandmark(content: string): string {
  if (/<main[\s/>]/i.test(content)) {
    return content;
  }
  return `<main role="main">
      ${content}
    </main>`;
}

/**
 * Serialize an element's inner content as XHTML.
 *
 * The transform engine emits valid XHTML (e.g. `<br />`), but reading an
 * HTML-parsed element's `.innerHTML` re-serializes void elements the HTML way
 * (`<br>`, `<hr>`, `<img>`), which is not well-formed once embedded in the
 * `application/xhtml+xml` document that {@link generateXHTMLDocument} builds —
 * the preview's XML parser then rejects it ("mismatched tag. Expected </br>").
 *
 * Using XMLSerializer keeps void elements self-closed. We serialize the whole
 * element and strip its own start/end tags so the top-level children don't each
 * carry a redundant `xmlns` (they inherit it from the wrapper during
 * serialization, and from the `<html xmlns>` of the final document when
 * embedded).
 */
export function serializeInnerXHTML(element: Element): string {
  const xml = new XMLSerializer().serializeToString(element);
  const openEnd = xml.indexOf('>');
  const closeStart = xml.lastIndexOf('</');
  // Fall back to innerHTML if the wrapper was self-closed (no children) or the
  // shape is unexpected.
  if (openEnd === -1 || closeStart === -1 || closeStart < openEnd) {
    return element.innerHTML;
  }
  return xml.slice(openEnd + 1, closeStart);
}

/**
 * Escape HTML entities in text content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
