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
import type { WorkspaceService, WorkspaceState } from '../services/workspace/workspace.service.js';
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

/**
 * JSON.stringify a string for embedding inside an inline <script> that will be
 * re-parsed as XHTML (processXHTMLForPreview). JSON.stringify alone is NOT
 * XHTML-safe — it leaves `&` and `<` raw, so a translated label containing
 * either would abort the XML parse and fail the whole export. Escape them (and
 * `>`) as \uXXXX inside the JS string literal, which the XML parser never sees.
 */
function jsonForXhtml(value: string): string {
  return JSON.stringify(value).replace(
    /[<>&]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
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
 * Advanced-mode `custom_size` / `custom_margin` strings pass through verbatim
 * and take precedence over the presets.
 */
function printPageCss(print: PrintSettings | undefined): string {
  const size = print?.custom_size?.trim() || print?.page_size || 'A4';
  const mm = MARGIN_MM[print?.margin ?? 'normal'] ?? MARGIN_MM.normal;
  const margin = print?.custom_margin?.trim() || `${mm}mm`;
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
  margin: ${margin};${topCenter}${bottomCenter}
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
  .pdf-export-close { margin-left: auto; background: #3f3f3f; }
  .pdf-export-close:active { background: #2f2f2f; }
}
@media print {
  .pdf-export-bar { display: none !important; }
}`;

/**
 * Cross-chapter links in the combined print document. In the EPUB each chapter is
 * its own file, so internal links are cross-FILE (`other.xhtml#id`); concatenated
 * into one master document those hrefs resolve against the app origin and the
 * saved PDF gets useless external URL annotations. Rewritten to same-document
 * fragments (`#id`) they become internal go-to-page links (Chrome and Firefox
 * print-to-PDF both emit them). Fragment ids only had to be unique per FILE in
 * the EPUB, so a fragment is a safe direct target only when its id appears once
 * across the whole book — otherwise the browser would jump to the first
 * occurrence, possibly in the wrong chapter, and the link falls back to the
 * owning chapter's section anchor (right chapter, first page).
 */
export interface InternalLinkMap {
  /** Chapter file name (href's last path segment) → its pdf-chapter anchor id. */
  anchorByFile: Map<string, string>;
  /** Element ids that appear exactly once across all exported chapters. */
  uniqueIds: Set<string>;
}

/** The combined document's anchor id for a chapter's `pdf-chapter` section. */
export function pdfChapterAnchor(idref: string): string {
  return `pdf-chapter-${idref}`;
}

/**
 * Every element id in one chapter's XHTML (empty for a malformed chapter) — the
 * export's first pass over the book, feeding `InternalLinkMap.uniqueIds`.
 */
export function collectChapterIds(xhtml: string): string[] {
  const doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) return [];
  return Array.from(doc.querySelectorAll('[id]'), el => el.id);
}

/**
 * Parse one chapter's XHTML and return its `<body>` inner serialized inside a
 * `<section class="pdf-chapter">` (so it starts on a fresh page under print.css,
 * carrying its idref as an anchor id for rewritten internal links), plus the
 * stylesheet hrefs the chapter links and the source `<html>` language (so a
 * single-chapter preview can carry it onto its own `<html>`). When `links` is
 * given (the full-book export), hrefs that point at other chapters are rewritten
 * to same-document fragments so the printed PDF gets internal navigation.
 * Returns null for a malformed chapter or one without a `<body>`. Shared by the
 * PDF export and the print preview so both build identical Paged.js input.
 */
export function chapterToSection(
  xhtml: string,
  idref?: string,
  links?: InternalLinkMap
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
  if (links) {
    const ownAnchor = idref ? pdfChapterAnchor(idref) : null;
    body.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) return; // external/protocol
      const [path, frag] = href.split('#');
      if (!path) {
        // Same-chapter fragment: already document-internal, but if the id repeats
        // in another chapter the combined document resolves it to the FIRST
        // occurrence — retarget the owning chapter's anchor instead.
        if (frag && !links.uniqueIds.has(frag) && ownAnchor) {
          a.setAttribute('href', `#${ownAnchor}`);
        }
        return;
      }
      const file = path.split('/').pop();
      const anchor = file ? links.anchorByFile.get(file) : undefined;
      if (!anchor) return; // not a linear spine chapter — leave untouched
      const direct = frag && links.uniqueIds.has(frag);
      a.setAttribute('href', direct ? `#${frag}` : `#${anchor}`);
    });
  }
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
  // head > title only: a bare 'title' selector would also match an inline SVG's
  // accessibility <title> in the body, promoting it to the running header.
  const titleText = doc.querySelector('head > title')?.textContent?.trim() || '';
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
  // The chapter anchor rewritten internal links target. Paged.js keeps an id on
  // the first fragment when it splits a section, so the anchor lands on the
  // chapter's first page.
  const idAttr = idref ? ` id="${xmlEscape(pdfChapterAnchor(idref))}"` : '';
  return {
    section: `<section class="pdf-chapter"${idAttr}${langAttr}${dirAttr}>${titleEl}${inner}</section>`,
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
    /**
     * In-app preview only: install the `window.seed` bridge (see
     * process/PREVIEW_BRIDGE.md) and, in the Paged.js `after` hook, call the
     * project's `seed.hooks.paginated({ idref, document })` with the paginated
     * document. Absent for the export (no head.xml there, and the export window
     * is not the preview pane). Carries the `idref` of the previewed chapter.
     */
    previewBridge?: { idref: string };
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
    previewBridge,
  } = opts;
  // Escape hrefs: getAttribute returns the DECODED value, so a chapter linking
  // "a&b.css" would otherwise embed a raw & and abort the XHTML re-parse.
  const links = stylesheetHrefs
    .map(href => `<link rel="stylesheet" href="${xmlEscape(href)}" />`)
    .join('\n');
  // Carry the book/chapter language onto <html> so the paginated document (and
  // the print preview that shares this builder) is accessible — without it,
  // axe/EPUBCheck flag a missing lang. Both lang and xml:lang for XHTML.
  const langAttr = lang ? ` lang="${xmlEscape(lang)}" xml:lang="${xmlEscape(lang)}"` : '';
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
  // NB: this document is re-parsed as XHTML (processXHTMLForPreview) before it
  // is written out, so the inline script must avoid raw &, < and > — built
  // entirely via the DOM API, with labels embedded via jsonForXhtml (which,
  // unlike bare JSON.stringify, escapes & and < so any translated label
  // survives the XML parse).
  const afterTail =
    afterMode === 'print-button'
      ? // Inject the toolbar (and its CSS) here, in the `after` hook, not in <head>:
        // Paged.js's polisher consumes the head stylesheet and drops @media screen
        // rules, so anything added before pagination loses its styling.
        `try{var s=document.createElement('style');s.textContent=${jsonForXhtml(PRINT_TOOLBAR_CSS)};document.head.appendChild(s);` +
        `var b=document.createElement('div');b.className='pdf-export-bar';` +
        `var k=document.createElement('button');k.type='button';k.className='pdf-export-btn';` +
        `k.textContent=${jsonForXhtml(translate('Save as PDF'))};` +
        `k.addEventListener('click',function(){window.print();});b.appendChild(k);` +
        `var h=document.createElement('span');h.className='pdf-export-hint';` +
        `h.textContent=${jsonForXhtml(translate("Opens your device's print dialog."))};` +
        `b.appendChild(h);` +
        // Close: this window is always script-opened, so window.close() is
        // permitted. Essential in installed-PWA contexts (iOS standalone) where
        // the window renders without browser chrome — no tab bar, no way back.
        `var c=document.createElement('button');c.type='button';c.className='pdf-export-btn pdf-export-close';` +
        `c.textContent=${jsonForXhtml(translate('Close'))};` +
        `c.addEventListener('click',function(){window.close();});b.appendChild(c);` +
        `document.body.insertBefore(b,document.body.firstChild);}catch(e){}`
      : `parent.postMessage('${doneMessage}','*');`;
  // Preview-only: after pagination (page boxes + data-page-number now exist),
  // hand the paginated document to the project's `paginated` hook if it
  // registered one via the `seed` bridge below. Wrapped so a throwing project
  // script never breaks the preview or the done ping.
  const paginatedCall = previewBridge
    ? `try{var _h=window.seed&&window.seed.hooks;if(_h&&typeof _h.paginated==='function')` +
      `_h.paginated({idref:${jsonForXhtml(previewBridge.idref)},document:document});}catch(e){}`
    : '';
  const inject =
    `<script>window.PagedConfig={auto:true,after:function(){` +
    `try{document.querySelectorAll('.pagedjs_margin').forEach(function(el){el.setAttribute('aria-hidden','true');});}catch(e){}` +
    `${paginatedCall}${afterTail}}};</script>` +
    `<script src="${pagedSrc}"></script>`;
  // The `window.seed` preview bridge (process/PREVIEW_BRIDGE.md): a scoped writer
  // to SOURCE/data/ plus a `hooks` bag the project's head.xml assigns. The
  // chapter idref is stamped into the realm here, at injection time, and every
  // saveData message echoes it back — the handler drops messages whose echo
  // doesn't match the chapter currently previewed, so a late message from a
  // replaced render can never be filed under the wrong chapter. Injected
  // BEFORE headExtra so head.xml can use it as soon as it runs. Preview only —
  // omitted from the export.
  const seedBridge = previewBridge
    ? `<script>(function(){var idref=${jsonForXhtml(previewBridge.idref)};` +
      `window.seed={idref:idref,saveData:function(slot,text){` +
      `try{parent.postMessage({type:'seed-save-data',idref:idref,slot:slot,text:text},'*');}catch(e){}},` +
      `hooks:{}};})();</script>`
    : '';
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
${seedBridge}
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
    throw new Error(
      translate('Could not open the print window. Allow pop-ups for this site to save as PDF.')
    );
  }
  const preparing = xmlEscape(translate('Preparing your PDF…'));
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${preparing}</title></head>` +
      `<body style="font:16px system-ui,sans-serif;color:#444;padding:2rem">${preparing}</body></html>`
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
    win.document.open();
    win.document.write(finalDoc);
    win.document.close();
    // Ownership passes to the close-watcher only once it exists. Clearing
    // blobManager any earlier meant a throw during the write above (e.g. the
    // user closed the window during the slow asset pass) skipped both cleanup
    // paths and leaked every blob URL.
    const manager = blobManager;
    blobManager = undefined;
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
 * flow. Resolves once the document is handed to the print window. Returns the
 * ids of chapters that could not be parsed and were left out of the PDF — the
 * caller must surface them, or the user gets a complete-looking PDF silently
 * missing chapters.
 */
export async function exportPdf(
  workspace: WorkspaceState,
  fileStorage: FileStorageAPI,
  workspaceService: WorkspaceService,
  print?: PrintSettings
): Promise<{ skippedChapterIds: string[] }> {
  const win = openPdfWindow();
  try {
    const chapters = await workspaceService.loadAllLinearChapterContents(workspace);
    if (chapters.length === 0) throw new Error(translate('No chapters to export.'));

    // First pass: map each chapter's file name to its section anchor and count
    // element ids across the book, so cross-chapter hrefs can be rewritten to
    // same-document fragments (internal PDF links) with a safe fallback when a
    // fragment id repeats between chapters. Parses each chapter a second time —
    // negligible next to the export's asset pass.
    const manifestHrefById = new Map(workspace.opf.manifest.map(m => [m.id, m.href]));
    const anchorByFile = new Map<string, string>();
    const idCounts = new Map<string, number>();
    for (const chapter of chapters) {
      const href = manifestHrefById.get(chapter.id) ?? `${chapter.id}.xhtml`;
      const file = href.split('/').pop();
      if (file) anchorByFile.set(file, pdfChapterAnchor(chapter.id));
      for (const id of collectChapterIds(chapter.xhtmlContent)) {
        idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
      }
    }
    const links: InternalLinkMap = {
      anchorByFile,
      uniqueIds: new Set([...idCounts].filter(([, n]) => n === 1).map(([id]) => id)),
    };

    // Concatenate each chapter's <body> (wrapped so it starts on a new page) and
    // collect the stylesheet links the chapters reference (deduped) so the book's
    // own styling carries through — works for app-created and imported EPUBs.
    const stylesheetHrefs = new Set<string>();
    const sections: string[] = [];
    const skippedChapterIds: string[] = [];
    for (const chapter of chapters) {
      const wrapped = chapterToSection(chapter.xhtmlContent, chapter.id, links);
      if (!wrapped) {
        // Malformed chapter / no <body> — excluded from the PDF, reported back.
        skippedChapterIds.push(chapter.id);
        continue;
      }
      wrapped.hrefs.forEach(href => stylesheetHrefs.add(href));
      sections.push(wrapped.section);
    }
    if (sections.length === 0) throw new Error(translate('No readable chapter content.'));

    const meta = workspace.opf.metadata;

    // Prepend the project's cover image as a full-bleed first page (Print setting,
    // default on). The cover's relative href is resolved to a blob URL by the asset
    // pass below alongside the chapter images.
    const coverHref = coverImageHref(workspace.opf.manifest, print);
    if (coverHref) {
      // The cover's text alternative is the book title (its own language, so no i18n) —
      // a cover isn't decorative: it carries the book's identity, and a generated cover
      // renders the title as image text that's otherwise invisible to assistive tech.
      const coverAlt = meta.title?.trim() || 'Cover';
      sections.unshift(
        `<section class="pdf-cover"><img src="${xmlEscape(coverHref)}" alt="${xmlEscape(coverAlt)}" /></section>`
      );
    }

    // The print dialog suggests "<document title>.pdf", so name it after the book.
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
    return { skippedChapterIds };
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
    if (!chapter) throw new Error(translate('Chapter not found.'));
    const wrapped = chapterToSection(chapter.xhtmlContent, chapter.id);
    if (!wrapped) throw new Error(translate('No readable chapter content.'));

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
