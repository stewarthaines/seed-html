/**
 * PDF export — paginate the book by CSS Paged Media and open the browser's
 * "Save as PDF" dialog.
 *
 * Browser constraint: faithful @page pagination with selectable vector text is
 * only available via the browser's own renderer (window.print()); there is no
 * API to capture print output as a Blob. So this builds one document from the
 * chapters (in spine order), resolves OPFS assets to blob URLs, and opens it in a
 * new same-origin window that paginates with the vendored Paged.js polyfill and
 * offers a "Save as PDF" button the user taps to print. (A child iframe can't be
 * printed reliably on Android, and a programmatic print() fails on Android Chrome,
 * so the user's tap drives it.) HTTP-only (Paged.js is fetched from the app
 * origin), like the axe-core a11y check.
 */

import { BlobURLManager } from '../blob-url/blob-url-manager.js';
import type { FileStorageAPI } from '../storage/index.js';
import type {
  WorkspaceService,
  WorkspaceState,
} from '../services/workspace/workspace.service.js';
import type { PrintSettings } from '../services/settings/settings.service.js';
import type { ManifestItem } from '../epub/opf-utils.js';
import { isRtlLanguage } from '../epub/language-direction.js';
import { translate } from '../i18n/index.js';
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
  // Running header: the chapter title, captured into the `chapter-title` named
  // string by print.css (string-set on the injected .pdf-chapter-title element).
  const topCenter = print?.running_header
    ? `
  @top-center {
    content: string(chapter-title);
    font-family: system-ui, sans-serif;
    font-size: 9pt;
    color: #555;
  }`
    : '';
  return `@page {
  size: ${size};
  margin: ${mm}mm;${topCenter}${bottomCenter}
}`;
}

/**
 * The OPF-relative href of the cover image to render as the PDF's full-bleed first
 * page, or null when there's no cover to show. Returns null when the print setting
 * has cover_page explicitly off (default is on). Prefers a vector SVG sibling of
 * the cover-image item (generated covers persist `cover.svg` beside `cover.png`)
 * for a crisp full-page render; falls back to the cover-image item itself (e.g. an
 * imported raster). The href resolves to a blob URL via the same asset pass the
 * chapters use, so no extra plumbing is needed.
 */
export function coverImageHref(
  manifest: ManifestItem[],
  print: PrintSettings | undefined
): string | null {
  if (print && print.cover_page === false) return null;
  const cover = manifest.find(m => m.properties?.includes('cover-image'));
  if (!cover) return null;
  const svgHref = cover.href.replace(/\.[^.]+$/, '.svg');
  const svg = manifest.find(m => m.href === svgHref && m.mediaType === 'image/svg+xml');
  return svg ? svgHref : cover.href;
}

/**
 * Screen-only chrome for the in-app "Print" device preview: float each paginated
 * page on a neutral backdrop with a drop shadow, like the mobile/tablet device
 * previews. Included ONLY in the preview document (never the export), so it uses
 * plain rules with no `@media` — Paged.js strips `@media screen` blocks, and the
 * preview is never the thing that gets printed. Values mirror the app's
 * `--color-bg-tertiary` backdrop and `--shadow-lg` device-frame shadow (hard-coded
 * because the iframe document has no app CSS variables).
 */
const PREVIEW_CHROME_CSS = `
html { background: #f0f0f0; }
.pagedjs_pages { padding: 16px 0; }
.pagedjs_page {
  margin-bottom: 16px;
  background: #fff;
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
}`;

/**
 * Screen-only chrome for the PDF export window: a fixed bar with the "Save as PDF"
 * button the user taps to print. Hidden in `@media print` so it never appears in
 * the output, and the body is padded down so the bar doesn't cover the first page.
 * Colours are hard-coded — this standalone window has no app CSS variables.
 */
const PRINT_TOOLBAR_CSS = `
@media screen {
  body { padding-top: 56px; }
  .pdf-export-bar {
    position: fixed; inset: 0 0 auto 0; z-index: 2147483647;
    display: flex; align-items: center; gap: 12px;
    padding: 8px 16px; box-sizing: border-box;
    background: #1a1a1a; color: #fff;
    font: 14px system-ui, -apple-system, sans-serif;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }
  .pdf-export-btn {
    font: inherit; font-weight: 600;
    padding: 8px 18px; border: 0; border-radius: 6px;
    background: #2563eb; color: #fff; cursor: pointer;
  }
  .pdf-export-btn:active { background: #1d4ed8; }
  .pdf-export-hint { opacity: 0.85; }
}
@media print {
  .pdf-export-bar { display: none !important; }
}`;

/**
 * Parse one chapter's XHTML and return its `<body>` inner serialized inside a
 * `<section class="pdf-chapter">` (so it starts on a fresh page under print.css),
 * plus the stylesheet hrefs the chapter links and the source `<html>` language
 * (so a single-chapter preview can carry it onto its own `<html>`). Returns null
 * for a malformed chapter or one without a `<body>`. Shared by the PDF export and
 * the print preview so both build identical Paged.js input.
 */
export function chapterToSection(
  xhtml: string,
  idref?: string
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
  // A guaranteed per-chapter title element for the optional running header. The
  // pipeline fills <title> with the chapter's metadata title or, absent one, the
  // idref — so a <title> that equals the idref is a fallback, not an authored title.
  // Priority: an explicit (non-idref) <title> wins; otherwise the first in-content
  // heading; otherwise the idref fallback. Always emitted (visually hidden via
  // print.css), even when empty, so a heading-less chapter resets the named string
  // rather than inheriting the previous chapter's title.
  const titleText = doc.querySelector('title')?.textContent?.trim() || '';
  const heading =
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      .map(tag => doc.querySelector(tag)?.textContent?.trim())
      .find(Boolean) || '';
  const explicitTitle = !!titleText && titleText !== idref;
  const title = explicitTitle ? titleText : heading || titleText;
  const titleEl = `<span class="pdf-chapter-title" aria-hidden="true">${xmlEscape(title)}</span>`;
  // Carry the chapter's own language onto its section so a multi-language book's
  // combined export tags each chapter correctly, overriding the book-default
  // <html lang>. Single-language books just repeat the default (harmless).
  const langAttr = lang ? ` lang="${xmlEscape(lang)}" xml:lang="${xmlEscape(lang)}"` : '';
  // Carry RTL direction onto the section too, so a multi-language book's RTL
  // chapters render right-to-left even under an LTR book default.
  const dirAttr = isRtlLanguage(lang) ? ' dir="rtl"' : '';
  return {
    section: `<section class="pdf-chapter"${langAttr}${dirAttr}>${titleEl}${inner}</section>`,
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
    /** Add the on-screen page drop-shadow chrome (in-app preview only, not export). */
    previewChrome?: boolean;
    /**
     * Extra raw markup appended inside <head> (after the book's stylesheets). Used
     * by the in-app print preview to inject the project's authoring-time
     * `preview/head.xml` fragment; never set for the exported PDF.
     */
    headExtra?: string;
    /**
     * What the document does once Paged.js finishes:
     * - 'message' (default): post `doneMessage` to the parent (in-app preview).
     * - 'print-button': add a screen-only "Save as PDF" toolbar whose button calls
     *   window.print(). The PDF export opens this as its own top-level window; the
     *   user's tap drives the print. We do NOT auto-print: a programmatic print
     *   fails on Android Chrome ("There was a problem printing the page"), and a
     *   single user-driven path is consistent across desktop, Android and iOS.
     */
    afterMode?: 'message' | 'print-button';
  } = {}
): string {
  const {
    title = 'Book',
    doneMessage = 'pdf-paged',
    stylesheetHrefs = [],
    lang,
    print,
    previewChrome = false,
    headExtra = '',
    afterMode = 'message',
  } = opts;
  const links = stylesheetHrefs
    .map(href => `<link rel="stylesheet" href="${href}" />`)
    .join('\n');
  // Carry the book/chapter language onto <html> so the paginated document (and
  // the print preview that shares this builder) is accessible — without it,
  // axe/EPUBCheck flag a missing lang. Both lang and xml:lang for XHTML.
  const langAttr = lang
    ? ` lang="${xmlEscape(lang)}" xml:lang="${xmlEscape(lang)}"`
    : '';
  // Right-to-left books need the base direction in markup on <html> (a lang
  // declaration doesn't imply direction), so the paginated PDF reads correctly.
  const dirAttr = isRtlLanguage(lang) ? ' dir="rtl"' : '';
  // PagedConfig must be set before the polyfill script runs; auto-paginates on
  // DOM load and pings the parent when done. Paged.js is vendored at the app
  // origin (resolves under any base path).
  //
  // In the `after` hook (margin boxes now exist) mark every .pagedjs_margin box
  // aria-hidden so Chrome's tagged-PDF export treats the repeated page numbers /
  // running heads as artifacts — otherwise a screen reader announces the page
  // number on every page. aria-hidden cascades to the .pagedjs_margin-content.
  const pagedSrc = new URL('paged.polyfill.js', document.baseURI).href;
  // What runs at the end of the `after` hook (margin boxes now exist).
  // - 'print-button': build the screen-only "Save as PDF" toolbar (its button calls
  //   window.print() on this top-level window — the user's tap is the gesture
  //   Android Chrome requires; we never call print() programmatically).
  // - 'message': tell the parent preview iframe pagination is done.
  // NB: this document is re-parsed as XHTML (processXHTMLForPreview) before it is
  // written out, so the inline script must avoid raw &, < and > — built entirely
  // via the DOM API, with labels embedded as JSON strings, for exactly that reason.
  const afterTail =
    afterMode === 'print-button'
      ? // Inject the toolbar (and its CSS) here, in the `after` hook, not in <head>:
        // Paged.js's polisher consumes the head stylesheet and drops @media screen
        // rules, so anything added before pagination loses its styling. Built via the
        // DOM API (no raw < > &) for the XHTML re-parse, labels embedded as JSON.
        `try{var s=document.createElement('style');s.textContent=${JSON.stringify(PRINT_TOOLBAR_CSS)};document.head.appendChild(s);` +
        `var b=document.createElement('div');b.className='pdf-export-bar';` +
        `var k=document.createElement('button');k.type='button';k.className='pdf-export-btn';` +
        `k.textContent=${JSON.stringify(translate('Save as PDF'))};` +
        `k.addEventListener('click',function(){window.print();});b.appendChild(k);` +
        `var h=document.createElement('span');h.className='pdf-export-hint';` +
        `h.textContent=${JSON.stringify(translate("Opens your device's print dialog."))};` +
        `b.appendChild(h);document.body.insertBefore(b,document.body.firstChild);}catch(e){}`
      : `parent.postMessage('${doneMessage}','*');`;
  const inject =
    `<script>window.PagedConfig={auto:true,after:function(){` +
    `try{document.querySelectorAll('.pagedjs_margin').forEach(function(el){el.setAttribute('aria-hidden','true');});}catch(e){}` +
    `${afterTail}}};</script>` +
    `<script src="${pagedSrc}"></script>`;
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"${langAttr}${dirAttr}>
<head>
<meta charset="utf-8" />
<title>${xmlEscape(title)}</title>
<style>
${printPageCss(print)}
${printCss}
${previewChrome ? PREVIEW_CHROME_CSS : ''}
</style>
${links}
${headExtra}
</head>
<body>
${sections.join('\n')}
${inject}</body>
</html>`;
}

/**
 * Open the top-level print window synchronously — must be called inside the click
 * gesture so it isn't blocked as a pop-up. We paginate in this window and give it a
 * "Save as PDF" button the user taps, rather than a hidden iframe we print for them:
 * a parent printing a child iframe fails on Android, and a programmatic print() fails
 * on Android Chrome too — a user-driven tap is the one path that works everywhere.
 * Shows a placeholder while the caller builds the document. Throws if blocked.
 */
function openPdfWindow(): Window {
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Could not open the print window. Allow pop-ups for this site to save as PDF.');
  }
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Preparing…</title></head>' +
      '<body style="font:16px system-ui,sans-serif;color:#444;padding:2rem">Preparing your PDF…</body></html>'
  );
  return win;
}

/**
 * Resolve the document's OPFS-relative assets to blob URLs and write it into the
 * already-open print window. The window is same-origin with this opener (about:blank
 * inherits our origin), so it can load our blob URLs. Hands off: keeps the blob URLs
 * alive until the user closes the print window (detached watcher), so the app isn't
 * blocked and the user can print/retry until they close it. Shared by the full-book
 * and per-chapter exports. On a pre-hand-off error the blobs are freed and the error
 * propagates (the caller closes the window).
 */
async function writePaginatedDocument(
  win: Window,
  master: string,
  ctx: { fileStorage: FileStorageAPI; basePath: string; workspaceId: string }
): Promise<void> {
  let blobManager: BlobURLManager | undefined = new BlobURLManager({
    fileStorage: ctx.fileStorage,
    basePath: ctx.basePath,
    maxBlobURLs: 2000,
  });
  blobManager.setActiveWorkspace(ctx.workspaceId);
  try {
    const finalDoc = await blobManager.processXHTMLForPreview(master);
    const manager = blobManager;
    blobManager = undefined; // ownership passes to the close-watcher below
    win.document.open();
    win.document.write(finalDoc);
    win.document.close();
    const poll = setInterval(() => {
      if (win.closed) {
        clearInterval(poll);
        manager.cleanup();
      }
    }, 1000);
  } finally {
    // Only fires on the error path; a successful hand-off transfers ownership of the
    // blob URLs to the close-watcher (blobManager is undefined by then).
    blobManager?.cleanup();
  }
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
  const win = openPdfWindow();
  try {
    const chapters = await workspaceService.loadAllLinearChapterContents(workspace);
    if (chapters.length === 0) throw new Error('No chapters to export.');

    // Concatenate each chapter's <body> (wrapped so it starts on a new page) and
    // collect the stylesheet links the chapters reference (deduped) so the book's
    // own styling carries through — works for app-created and imported EPUBs.
    const stylesheetHrefs = new Set<string>();
    const sections: string[] = [];
    for (const chapter of chapters) {
      const wrapped = chapterToSection(chapter.xhtmlContent, chapter.id);
      if (!wrapped) continue; // skip a malformed chapter / one with no <body>
      wrapped.hrefs.forEach(href => stylesheetHrefs.add(href));
      sections.push(wrapped.section);
    }
    if (sections.length === 0) throw new Error('No readable chapter content.');

    // Prepend the project's cover image as a full-bleed first page (Print setting,
    // default on). The cover's relative href is resolved to a blob URL by the asset
    // pass below alongside the chapter images.
    const coverHref = coverImageHref(workspace.opf.manifest, print);
    if (coverHref) {
      sections.unshift(`<section class="pdf-cover"><img src="${xmlEscape(coverHref)}" alt="" /></section>`);
    }

    // The print dialog suggests "<document title>.pdf", so name it after the book.
    const meta = workspace.opf.metadata;
    const author = meta.creator?.[0]?.name;
    const docTitle = [meta.title?.trim() || 'Book', author?.trim()].filter(Boolean).join(' - ');

    const master = buildPagedDocument(sections, {
      title: docTitle,
      stylesheetHrefs: [...stylesheetHrefs],
      lang: meta.language?.[0],
      print,
      afterMode: 'print-button',
    });

    await writePaginatedDocument(win, master, {
      fileStorage,
      basePath: workspace.pathInfo.basePath,
      workspaceId: workspace.id,
    });
  } catch (error) {
    try {
      win.close();
    } catch {
      // window already gone
    }
    throw error;
  }
}

/**
 * Build a single chapter's paginated document and open the same "Save as PDF" window
 * as the full export — just this chapter, no cover. Page size / margin / page numbers
 * honour the project's print settings. Backs the spine preview's per-chapter
 * "Chapter PDF" footer. Must be invoked synchronously from a click (it opens the window).
 */
export async function exportChapterPdf(
  workspace: WorkspaceState,
  fileStorage: FileStorageAPI,
  workspaceService: WorkspaceService,
  chapterId: string,
  print?: PrintSettings
): Promise<void> {
  const win = openPdfWindow();
  try {
    const [chapter] = await workspaceService.loadChapterContents(workspace, [chapterId]);
    if (!chapter) throw new Error('Chapter not found.');
    const wrapped = chapterToSection(chapter.xhtmlContent, chapter.id);
    if (!wrapped) throw new Error('No readable chapter content.');

    // Suggested PDF filename: book title + chapter id (no cover for a single chapter).
    const meta = workspace.opf.metadata;
    const docTitle = [meta.title?.trim() || 'Book', chapterId].filter(Boolean).join(' - ');

    const master = buildPagedDocument([wrapped.section], {
      title: docTitle,
      stylesheetHrefs: wrapped.hrefs,
      lang: wrapped.lang ?? meta.language?.[0],
      print,
      afterMode: 'print-button',
    });

    await writePaginatedDocument(win, master, {
      fileStorage,
      basePath: workspace.pathInfo.basePath,
      workspaceId: workspace.id,
    });
  } catch (error) {
    try {
      win.close();
    } catch {
      // window already gone
    }
    throw error;
  }
}
