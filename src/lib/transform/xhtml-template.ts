/**
 * XHTML Template Generation
 *
 * Generates valid XHTML documents with proper DOCTYPE, namespaces,
 * stylesheets, scripts, and metadata for EPUB content.
 */

export interface ChapterMetadata {
  title: string;
  language: string;
  stylesheets: string[];
  scripts: string[];
  customHead?: string;
}

/**
 * Generates XHTML documents with proper metadata and structure
 */
export function generateXHTMLDocument(content: string, metadata: ChapterMetadata): string {
  const escapedTitle = escapeHtml(metadata.title);

  const stylesheetLinks = metadata.stylesheets
    .map(href => `    <link rel="stylesheet" type="text/css" href="${escapeHtml(href)}" />`)
    .join('\n');

  const scriptTags = metadata.scripts
    .map(src => `    <script type="text/javascript" src="${escapeHtml(src)}"></script>`)
    .join('\n');

  const customHeadContent = metadata.customHead ? `    ${metadata.customHead}` : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeHtml(metadata.language)}" lang="${escapeHtml(metadata.language)}">
  <head>
    <title>${escapedTitle}</title>
${stylesheetLinks}${stylesheetLinks ? '\n' : ''}${scriptTags}${scriptTags ? '\n' : ''}${customHeadContent}${customHeadContent ? '\n' : ''}  </head>
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
