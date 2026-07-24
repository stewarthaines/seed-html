/**
 * READ.html device preview — wrapper-document builder (process/READ_DEVICE_PREVIEW.md).
 *
 * Builds the HTML document the preview pane writes into its iframe for the
 * "READ.html" device: a module script that imports the vendored foliate-js
 * renderer from the app origin (public/foliate/, see its VENDORED.md), builds a
 * one-section book around a blob URL of the rendered chapter, mounts
 * `foliate-view`, and posts `doneMessage` to the parent when the first render
 * completes. HTTP-only by construction — file:// cannot fetch the modules, and
 * the device is hidden there.
 *
 * The one-section book implements the minimum interface the renderer touches
 * (verified against the vendored code, phase 0/1 of the plan): `sections`
 * (`load()`/`size`/`id`/`linear`), `dir`, `metadata.language`, plus a
 * `resolveHref` stub so intra-chapter fragment links (footnotes) navigate.
 *
 * Teardown contract: the wrapper registers `window.__seedFoliateClose` on the
 * iframe window. The preview pane MUST call it before the next
 * `document.open()` — `view.close()` disconnects the paginator's
 * ResizeObserver; without it, stale observer callbacks fire on the dead view
 * and throw uncaught TypeErrors (measured in the phase 1 spike: 4 without, 0
 * with). A missed call degrades to console noise, not a broken preview.
 */

import { isRtlLanguage } from '../epub/language-direction.js';

/** Reading flow of the foliate paginator ('paginated' = page spreads). */
export type ReadFlow = 'paginated' | 'scrolled';
/** Column cap: '1' forces a single column; '2' is the paginator's own default
 *  (up to two columns where they fit). */
export type ReadColumns = '1' | '2';

/** Name of the teardown hook the wrapper installs on the iframe window. */
export const FOLIATE_CLOSE_HOOK = '__seedFoliateClose';

/**
 * Name of the live-view global the wrapper installs on the iframe window. The
 * preview pane uses it to apply flow/column changes to the running renderer
 * without a re-render: set the attribute, then call `renderer.render?.()` —
 * `max-column-count` only changes a CSS custom property, so the paginator's
 * ResizeObserver may never fire on its own (read-html hit this; harmless where
 * the attribute change does trigger a re-render, render() is idempotent).
 */
export const FOLIATE_VIEW_GLOBAL = '__seedFoliateView';

/** Minimal surface of the live foliate view the preview pane touches. */
export interface FoliateViewLike {
  renderer?: HTMLElement & {
    render?: () => void;
    /** Public jump seam: a numeric anchor is a section fraction; the paginator
     *  maps it to a content page (`Math.round(fraction * (textPages - 1)) + 1`). */
    scrollToAnchor?: (anchor: number, select?: boolean) => Promise<void>;
    /** Reader-injected section CSS (theme, font size) — replaces prior styles. */
    setStyles?: (css: string) => void;
  };
  /** Page-direction-aware turns (goLeft = next in RTL books). */
  goLeft?: () => Promise<void>;
  goRight?: () => Promise<void>;
  close?: () => void;
}

export interface ReadDocumentOptions {
  /** Blob URL of the rendered chapter (assets already blob-resolved). */
  sectionUrl: string;
  /** Byte-ish size of the section (chapter string length is fine). */
  sectionSize: number;
  flow: ReadFlow;
  maxColumnCount: ReadColumns;
  /** Book language (BCP 47) — drives metadata.language and page direction. */
  lang?: string;
  /** postMessage payload sent to the parent after the first render. */
  doneMessage: string;
  /**
   * Message type posted to the parent on every relocation (page turn, resize
   * repagination, flow change), carrying `{ type, page, pages, scrolled }` from
   * the paginator — the parent's page indicator. Content pages run `1..pages-2`
   * (the paginator pads one turn page at each end).
   */
  relocateMessage: string;
  /**
   * Reader-simulation CSS applied via `renderer.setStyles()` between `open()`
   * and `init()` (flash-free, READ.html's own pattern). Later control changes
   * re-apply through the live view global.
   */
  styles?: string;
}

/** Inputs for the reader-simulation CSS (theme + text size + force colors). */
export interface ReaderSimOptions {
  /** Effective root font size in px (device base × step). */
  basePx: number;
  bg: string;
  fg: string;
  /** CSS color-scheme for UA-rendered chrome. */
  scheme: string;
  /** Override author colors outright (the "force colors" control). */
  force: boolean;
}

/**
 * The reader-simulation CSS injected into foliate sections. Mirrors the raw
 * preview's head-injected theme (`applyPreviewAppearance`): root font-size in
 * px so em/rem text scales while fixed-px text deliberately stays put, palette
 * background/color with an `!important` force variant.
 */
export function readerSimCss(o: ReaderSimOptions): string {
  const font = `:root { font-size: ${o.basePx}px; color-scheme: ${o.scheme}; }`;
  if (o.force) {
    return `${font}
html { background: ${o.bg} !important; }
body { background: ${o.bg} !important; }
body, body * { color: ${o.fg} !important; }`;
  }
  return `${font}
html { background: ${o.bg}; }
body { color: ${o.fg}; }`;
}

/**
 * Build the wrapper document for the READ.html device preview. The result is
 * written into the preview iframe via document.open()/write()/close().
 */
export function buildReadDocument(opts: ReadDocumentOptions): string {
  const {
    sectionUrl,
    sectionSize,
    flow,
    maxColumnCount,
    lang,
    doneMessage,
    relocateMessage,
    styles,
  } = opts;
  // Resolves under any base path the app is served from (same pattern as the
  // Paged.js polyfill src in pdf-export).
  const moduleSrc = new URL('foliate/view.js', document.baseURI).href;
  const dir = isRtlLanguage(lang) ? 'rtl' : 'ltr';
  // All interpolated values go through JSON.stringify: they land inside an
  // inline script in an HTML document, and none may contain "</script" (blob
  // URLs and BCP 47 tags cannot; doneMessage is an app constant).
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; }
  #seed-read-root { height: 100vh; }
  foliate-view { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="seed-read-root"></div>
<script type="module">
import ${JSON.stringify(moduleSrc)};
const view = document.createElement('foliate-view');
document.getElementById('seed-read-root').append(view);
// Teardown hook for the parent: close() disconnects the paginator's
// ResizeObserver before the next document.open() paves this document.
window.${FOLIATE_CLOSE_HOOK} = () => { try { view.close(); } catch { /* already dead */ } };
// Live view for the parent's flow/column/page controls (no re-render needed).
window.${FOLIATE_VIEW_GLOBAL} = view;
// Page indicator + position memory: report every relocation (turns,
// repagination, flow change, free scrolling). fraction is the scrolled-flow
// position (start/viewSize), used to restore the reading position across
// re-renders; paginated restore uses page/pages instead.
view.addEventListener('relocate', () => {
  const r = view.renderer;
  parent.postMessage({
    type: ${JSON.stringify(relocateMessage)},
    page: r.page ?? 0,
    pages: r.pages ?? 0,
    scrolled: !!r.scrolled,
    fraction: r.scrolled && r.viewSize ? r.start / r.viewSize : 0,
  }, '*');
});
// Arrow-key page turns while the preview is focused. Foliate has no built-in
// key handling; READ.html wires the same pair — one listener on this window
// (focus on the wrapper/foliate-view) and one per section document as it
// loads (focus inside the section iframe, where clicks land). goLeft/goRight
// follow the book's page direction.
const onKey = (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  switch (event.key) {
    case 'ArrowLeft':
    case 'PageUp':
      event.preventDefault();
      view.goLeft();
      break;
    case 'ArrowRight':
    case 'PageDown':
      event.preventDefault();
      view.goRight();
      break;
  }
};
window.addEventListener('keydown', onKey);
view.addEventListener('load', (event) => {
  event.detail.doc.addEventListener('keydown', onKey);
});
const book = {
  sections: [{
    id: 'chapter',
    load: () => ${JSON.stringify(sectionUrl)},
    size: ${JSON.stringify(sectionSize)},
    linear: 'yes',
  }],
  dir: ${JSON.stringify(dir)},
  metadata: { language: ${JSON.stringify(lang ?? '')} },
  toc: [],
  resolveHref: (href) => ({ index: 0, anchor: (doc) => {
    const hash = String(href).split('#')[1];
    return (hash && doc.getElementById(hash)) || doc.body;
  } }),
  isExternal: (href) => /^[a-z][a-z0-9+.-]*:/i.test(href),
};
try {
  await view.open(book);
  view.renderer.setAttribute('flow', ${JSON.stringify(flow)});
  view.renderer.setAttribute('max-column-count', ${JSON.stringify(maxColumnCount)});
  view.renderer.setAttribute('gap', '6%');
  view.renderer.setAttribute('margin', '24px');
  ${styles ? `view.renderer.setStyles?.(${JSON.stringify(styles)});` : ''}
  await view.init({});
} catch (err) {
  // Report and fall through: the parent's spinner must clear either way.
  console.error('READ.html preview failed to render', err);
} finally {
  parent.postMessage(${JSON.stringify(doneMessage)}, '*');
}
</script>
</body>
</html>`;
}
