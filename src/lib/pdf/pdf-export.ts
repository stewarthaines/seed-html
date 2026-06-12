/**
 * PDF export — paginate the book by CSS Paged Media and open the browser's
 * "Save as PDF" dialog.
 *
 * Browser constraint: faithful @page pagination with selectable vector text is
 * only available via the browser's own renderer (window.print()); there is no
 * API to capture print output as a Blob. So this builds one document from the
 * chapters (in spine order), resolves OPFS assets to blob URLs, paginates it
 * with the vendored Paged.js polyfill in a hidden same-origin iframe, then
 * prints that iframe. HTTP-only (Paged.js is fetched from the app origin), like
 * the axe-core a11y check.
 */

import { BlobURLManager } from '../blob-url/blob-url-manager.js';
import type { FileStorageAPI } from '../storage/index.js';
import type {
  WorkspaceService,
  WorkspaceState,
} from '../services/workspace/workspace.service.js';
import printCss from '../../assets/universal/print.css?raw';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the combined, paginated document and trigger the print → Save as PDF
 * flow. Resolves once the print dialog has been dismissed.
 */
export async function exportPdf(
  workspace: WorkspaceState,
  fileStorage: FileStorageAPI,
  workspaceService: WorkspaceService
): Promise<void> {
  const chapters = await workspaceService.loadAllLinearChapterContents(workspace);
  if (chapters.length === 0) throw new Error('No chapters to export.');

  // Concatenate each chapter's <body> (wrapped so it starts on a new page) and
  // collect the stylesheet links the chapters reference (deduped) so the book's
  // own styling carries through — works for app-created and imported EPUBs.
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const stylesheetHrefs = new Set<string>();
  const sections: string[] = [];

  for (const chapter of chapters) {
    const doc = parser.parseFromString(chapter.xhtmlContent, 'application/xhtml+xml');
    if (doc.querySelector('parsererror')) continue; // skip a malformed chapter
    doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(link => {
      const href = link.getAttribute('href');
      if (href) stylesheetHrefs.add(href);
    });
    const body = doc.querySelector('body');
    if (!body) continue;
    const inner = Array.from(body.childNodes)
      .map(node => serializer.serializeToString(node))
      .join('');
    sections.push(`<section class="pdf-chapter">${inner}</section>`);
  }
  if (sections.length === 0) throw new Error('No readable chapter content.');

  const links = [...stylesheetHrefs]
    .map(href => `<link rel="stylesheet" href="${href}" />`)
    .join('\n');

  // The print dialog suggests "<document title>.pdf", so name it after the book.
  const meta = workspace.opf.metadata;
  const author = meta.creator?.[0]?.name;
  const docTitle = xmlEscape(
    [meta.title?.trim() || 'Book', author?.trim()].filter(Boolean).join(' - ')
  );

  // Print defaults first (the overridable baseline: page geometry, page numbers,
  // chapter breaks), then the book's own stylesheets — so a project that defines
  // @page / @media print rules overrides the defaults per-property, while a book
  // with no print rules still gets the sane baseline.
  const master = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<title>${docTitle}</title>
<style>${printCss}</style>
${links}
</head>
<body>
${sections.join('\n')}
</body>
</html>`;

  // Resolve OPFS-relative assets (images, stylesheets, fonts) to blob URLs so
  // they render in the print iframe. A fresh manager so the live preview's
  // registry is untouched; cleaned up after printing.
  const blobManager = new BlobURLManager({
    fileStorage,
    basePath: workspace.pathInfo.basePath,
    maxBlobURLs: 2000,
  });
  blobManager.setActiveWorkspace(workspace.id);
  const resolved = await blobManager.processXHTMLForPreview(master);

  // Inject Paged.js (vendored, app-origin) plus a completion ping. PagedConfig
  // must be set before the polyfill script runs.
  const pagedSrc = new URL('paged.polyfill.js', document.baseURI).href;
  const inject =
    `<script>window.PagedConfig={auto:true,after:function(){parent.postMessage('pdf-paged','*');}};</script>` +
    `<script src="${pagedSrc}"></script>`;
  const finalDoc = resolved.replace('</body>', `${inject}</body>`);

  // Hidden but laid-out (opacity:0, not display:none) so Paged.js can measure.
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;pointer-events:none;z-index:-1;';
  iframe.srcdoc = finalDoc;

  try {
    await new Promise<void>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow || event.data !== 'pdf-paged') return;
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        // print() blocks until the Save-as-PDF dialog is dismissed.
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      };
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error('PDF generation timed out.'));
      }, 60000);
      window.addEventListener('message', onMessage);
      document.body.appendChild(iframe);
    });
  } finally {
    iframe.remove();
    blobManager.cleanup();
  }
}
