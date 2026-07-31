/**
 * Blob URL Manager Utilities
 *
 * Helper functions for URL classification, path resolution, and XHTML processing
 */

/**
 * Resolve manifest item href to full workspace path
 */
export function resolveManifestPath(href: string, basePath: string): string {
  // Handle OPF in container root (empty basePath)
  if (!basePath) return href;

  // Standard case: basePath + href
  // Examples: "OEBPS" + "images/cover.jpg" → "OEBPS/images/cover.jpg"
  return `${basePath}/${href}`;
}

/**
 * Preview only: stop external scripts from blocking the document parser.
 *
 * The built-in preview builds its document with document.open()/write()/close().
 * A parser-blocking `<script src>` in the chapter head suspends that write
 * mid-parse — before `<body>` exists — and anything that touches the half-built
 * document while it is suspended (the iframe `load` handler injecting its style
 * element) can leave it permanently body-less. The symptom is a blank preview
 * for a chapter whose transform output is perfectly intact.
 *
 * `defer` removes the suspension: the whole document parses in one pass, then
 * the scripts run in document order before DOMContentLoaded. Scripts already
 * marked `async` are non-blocking, and module scripts defer by default.
 *
 * Trade-off: a deferred script now runs after any inline script in the same
 * document rather than interleaved with it. Preview only — the packaged EPUB
 * keeps the author's scripts exactly as written.
 */
export function deferParserBlockingScripts(doc: Document): void {
  for (const script of Array.from(doc.querySelectorAll('script[src]'))) {
    if (script.hasAttribute('async') || script.hasAttribute('defer')) continue;
    if ((script.getAttribute('type') ?? '').trim().toLowerCase() === 'module') continue;
    script.setAttribute('defer', '');
  }
}
