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
import type { PrintSettings } from '../services/settings/settings.service.js';
import printCss from '../../assets/universal/print.css?raw';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Margin preset → uniform page margin in millimetres. */
export const MARGIN_MM: Record<PrintSettings['margin'], number> = {
  narrow: 12,
  normal: 18,
  wide: 25,
};

/**
 * Build the document's single `@page` rule from the project's minimal print
 * settings. This is the ONLY author `@page` rule (print.css no longer declares
 * one) — Paged.js derives the printed paper size from the first author `@page`
 * with a `size`, so having exactly one keeps Chrome's "Save as PDF" paper size in
 * sync with the paginated page boxes. Without this, two competing `@page` rules
 * left the screen at the chosen size while Chrome printed onto its default paper.
 * It stays overridable by the book's own CSS (linked after this). Undefined
 * settings resolve to the previous defaults (A4 / 18mm / page numbers on).
 */
function printPageCss(print: PrintSettings | undefined): string {
  const size = print?.page_size || 'A4';
  const mm = MARGIN_MM[print?.margin ?? 'normal'] ?? MARGIN_MM.normal;
  const pageNumbers = print ? print.page_numbers !== false : true;
  const bottomCenter = pageNumbers
    ? `
  @bottom-center {
    content: counter(page);
    font-family: system-ui, sans-serif;
    font-size: 9pt;
    color: #555;
  }`
    : '';
  return `@page {
  size: ${size};
  margin: ${mm}mm;${bottomCenter}
}`;
}

/**
 * Parse one chapter's XHTML and return its `<body>` inner serialized inside a
 * `<section class="pdf-chapter">` (so it starts on a fresh page under print.css),
 * plus the stylesheet hrefs the chapter links and the source `<html>` language
 * (so a single-chapter preview can carry it onto its own `<html>`). Returns null
 * for a malformed chapter or one without a `<body>`. Shared by the PDF export and
 * the print preview so both build identical Paged.js input.
 */
export function chapterToSection(
  xhtml: string
): { section: string; hrefs: string[]; lang: string | null } | null {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) return null;
  const body = doc.querySelector('body');
  if (!body) return null;
  const root = doc.documentElement;
  const lang =
    root?.getAttribute('lang') ||
    root?.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang') ||
    null;
  const hrefs: string[] = [];
  doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href) hrefs.push(href);
  });
  const inner = Array.from(body.childNodes)
    .map(node => serializer.serializeToString(node))
    .join('');
  // Carry the chapter's own language onto its section so a multi-language book's
  // combined export tags each chapter correctly, overriding the book-default
  // <html lang>. Single-language books just repeat the default (harmless).
  const langAttr = lang ? ` lang="${xmlEscape(lang)}" xml:lang="${xmlEscape(lang)}"` : '';
  return {
    section: `<section class="pdf-chapter"${langAttr}>${inner}</section>`,
    hrefs,
    lang,
  };
}

/**
 * Build the full Paged.js master document from already-serialized `pdf-chapter`
 * sections: the print.css baseline first (overridable page geometry, page
 * numbers, chapter breaks), then the book's own stylesheets, then the Paged.js
 * polyfill plus a completion ping injected before `</body>`. Does NOT resolve
 * blob URLs — the caller passes section HTML whose asset refs are already
 * resolved (the live preview) or resolves the returned document itself (the PDF
 * export). Shared so the print preview matches the exported PDF.
 */
export function buildPagedDocument(
  sections: string[],
  opts: {
    title?: string;
    doneMessage?: string;
    stylesheetHrefs?: string[];
    lang?: string;
    print?: PrintSettings;
  } = {}
): string {
  const { title = 'Book', doneMessage = 'pdf-paged', stylesheetHrefs = [], lang, print } = opts;
  const links = stylesheetHrefs
    .map(href => `<link rel="stylesheet" href="${href}" />`)
    .join('\n');
  // Carry the book/chapter language onto <html> so the paginated document (and
  // the print preview that shares this builder) is accessible — without it,
  // axe/EPUBCheck flag a missing lang. Both lang and xml:lang for XHTML.
  const langAttr = lang
    ? ` lang="${xmlEscape(lang)}" xml:lang="${xmlEscape(lang)}"`
    : '';
  // PagedConfig must be set before the polyfill script runs; auto-paginates on
  // DOM load and pings the parent when done. Paged.js is vendored at the app
  // origin (resolves under any base path).
  //
  // In the `after` hook (margin boxes now exist) mark every .pagedjs_margin box
  // aria-hidden so Chrome's tagged-PDF export treats the repeated page numbers /
  // running heads as artifacts — otherwise a screen reader announces the page
  // number on every page. aria-hidden cascades to the .pagedjs_margin-content.
  const pagedSrc = new URL('paged.polyfill.js', document.baseURI).href;
  const inject =
    `<script>window.PagedConfig={auto:true,after:function(){` +
    `try{document.querySelectorAll('.pagedjs_margin').forEach(function(el){el.setAttribute('aria-hidden','true');});}catch(e){}` +
    `parent.postMessage('${doneMessage}','*');}};</script>` +
    `<script src="${pagedSrc}"></script>`;
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"${langAttr}>
<head>
<meta charset="utf-8" />
<title>${xmlEscape(title)}</title>
<style>
${printPageCss(print)}
${printCss}
</style>
${links}
</head>
<body>
${sections.join('\n')}
${inject}</body>
</html>`;
}

/**
 * Build the combined, paginated document and trigger the print → Save as PDF
 * flow. Resolves once the print dialog has been dismissed.
 */
export async function exportPdf(
  workspace: WorkspaceState,
  fileStorage: FileStorageAPI,
  workspaceService: WorkspaceService,
  print?: PrintSettings
): Promise<void> {
  const chapters = await workspaceService.loadAllLinearChapterContents(workspace);
  if (chapters.length === 0) throw new Error('No chapters to export.');

  // Concatenate each chapter's <body> (wrapped so it starts on a new page) and
  // collect the stylesheet links the chapters reference (deduped) so the book's
  // own styling carries through — works for app-created and imported EPUBs.
  const stylesheetHrefs = new Set<string>();
  const sections: string[] = [];

  for (const chapter of chapters) {
    const wrapped = chapterToSection(chapter.xhtmlContent);
    if (!wrapped) continue; // skip a malformed chapter / one with no <body>
    wrapped.hrefs.forEach(href => stylesheetHrefs.add(href));
    sections.push(wrapped.section);
  }
  if (sections.length === 0) throw new Error('No readable chapter content.');

  // The print dialog suggests "<document title>.pdf", so name it after the book.
  const meta = workspace.opf.metadata;
  const author = meta.creator?.[0]?.name;
  const docTitle = [meta.title?.trim() || 'Book', author?.trim()].filter(Boolean).join(' - ');

  const master = buildPagedDocument(sections, {
    title: docTitle,
    stylesheetHrefs: [...stylesheetHrefs],
    lang: meta.language?.[0],
    print,
  });

  // Resolve OPFS-relative assets (images, stylesheets, fonts) to blob URLs so
  // they render in the print iframe. A fresh manager so the live preview's
  // registry is untouched; cleaned up after printing.
  const blobManager = new BlobURLManager({
    fileStorage,
    basePath: workspace.pathInfo.basePath,
    maxBlobURLs: 2000,
  });
  blobManager.setActiveWorkspace(workspace.id);
  // The master already carries the Paged.js polyfill inject (an absolute app-origin
  // src that asset resolution leaves alone); this resolves the OPFS-relative assets.
  const finalDoc = await blobManager.processXHTMLForPreview(master);

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
