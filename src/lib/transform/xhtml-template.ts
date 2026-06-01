/**
 * XHTML Template Generation
 *
 * Generates valid XHTML documents with proper DOCTYPE, namespaces,
 * stylesheets, scripts, and metadata for EPUB content.
 */

import { convertManifestPathToXHTMLPath } from '../epub/path-utils.js';

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
    .map(href => `    <link rel="stylesheet" type="text/css" href="${escapeHtml(href)}" />`)
    .join('\n');

  const scriptTags = metadata.scripts
    .map(src => `    <script type="text/javascript" src="${escapeHtml(convertManifestPathToXHTMLPath(src))}"></script>`)
    .join('\n');

  const viewportTag = metadata.viewport
    ? `    <meta name="viewport" content="${escapeHtml(metadata.viewport)}" />`
    : '';

  const customHeadContent = metadata.customHead ? `    ${metadata.customHead}` : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeHtml(metadata.language)}" lang="${escapeHtml(metadata.language)}">
  <head>
    <title>${escapedTitle}</title>
${viewportTag}${viewportTag ? '\n' : ''}${stylesheetLinks}${stylesheetLinks ? '\n' : ''}${scriptTags}${scriptTags ? '\n' : ''}${customHeadContent}${customHeadContent ? '\n' : ''}  </head>
  <body>
    ${content}
  </body>
</html>`;
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
