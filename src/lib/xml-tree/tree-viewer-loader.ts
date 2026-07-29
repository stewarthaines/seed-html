/**
 * On-demand loader for the vendored XML tree viewer (public/xml-tree-viewer/,
 * adapted from Chromium's DocumentXMLTreeViewer — see the provenance headers
 * there). Served from the app origin like axe.min.js and the Paged.js
 * polyfill, so it is http-only: under file:// the asset cannot be fetched and
 * the tree toggle is hidden (the raw source view remains).
 */
import { isHttpContext } from '$lib/reader/open-in-reader.js';

export interface XmlTreeViewerModule {
  /** Render `xmlDoc` as a collapsible tree into `container` (replaces content). */
  render: (xmlDoc: Document, container: Element) => void;
}

/** Whether the tree view can be offered at all (asset is fetchable). */
export function canShowXmlTree(): boolean {
  return isHttpContext();
}

let modulePromise: Promise<XmlTreeViewerModule> | null = null;
let cssInjected = false;

/**
 * Load the viewer module (cached after the first call) and inject its
 * stylesheet into the app document once. Rejects when the asset cannot be
 * fetched; a later call retries.
 */
export function loadXmlTreeViewer(): Promise<XmlTreeViewerModule> {
  if (!modulePromise) {
    injectStylesheet();
    // @vite-ignore: the specifier is resolved at runtime against the deploy
    // base path; the asset is copied verbatim from public/, not bundled.
    modulePromise = import(
      /* @vite-ignore */ new URL('xml-tree-viewer/xml-tree-viewer.js', document.baseURI).href
    ) as Promise<XmlTreeViewerModule>;
    modulePromise.catch(() => {
      modulePromise = null;
    });
  }
  return modulePromise;
}

function injectStylesheet(): void {
  if (cssInjected) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('xml-tree-viewer/xml-tree-viewer.css', document.baseURI).href;
  document.head.appendChild(link);
  cssInjected = true;
}
