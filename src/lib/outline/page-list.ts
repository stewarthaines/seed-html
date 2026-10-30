/**
 * Page list — the EPUB nav's `page-list`, derived from the chapters.
 *
 * The page-list is defined by the print page markers in the chapters
 * (`role="doc-pagebreak"` or `epub:type="pagebreak"` elements with an id), so
 * it is always derived from them, for a generated and a hand-written nav alike
 * (process/NAV_LANDMARKS_AND_PAGE_LIST.md, section 3). Nothing here invents a
 * page: a book without markers gets no page-list.
 */

import type { SpineItemWithSource } from '../spine/types';
import type { WorkspaceService } from '../services/workspace/workspace.service.js';
import { dirOfPath, manifestHrefToPath, relativePathFrom } from '../epub/path-utils.js';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const EPUB_NS = 'http://www.idpf.org/2007/ops';

/** A print page marker: `role="doc-pagebreak"` or `epub:type` including `pagebreak`. */
function isPageMarker(el: Element): boolean {
  return (
    el.getAttribute('role') === 'doc-pagebreak' ||
    (el.getAttribute('epub:type') ?? '').split(/\s+/).includes('pagebreak')
  );
}

/** One page-list entry: the marker's location, relative to the nav, and its label. */
export interface PageTarget {
  href: string;
  label: string;
}

/**
 * Every print page marker in the spine, in reading order, as an href relative
 * to the nav document. The label is the marker's `title`, then `aria-label`,
 * then its text; a marker with none of them is skipped, since a page-list entry
 * needs a label. Unreadable chapters are skipped.
 *
 * @param spineItems the spine in reading order (linear and non-linear: a page
 *   marker counts wherever it is)
 * @param basePath the package document's directory (`OEBPS`)
 * @param navHref the nav's manifest href, relative to `basePath`
 */
export async function collectPageTargets(
  spineItems: SpineItemWithSource[],
  workspaceService: WorkspaceService,
  workspaceId: string,
  basePath: string,
  navHref = 'nav.xhtml'
): Promise<PageTarget[]> {
  const navDir = dirOfPath(manifestHrefToPath(basePath, navHref));
  const targets: PageTarget[] = [];

  for (const item of spineItems) {
    if (!item.href) continue;
    const chapterPath = manifestHrefToPath(basePath, item.href);
    let xhtml: string;
    try {
      xhtml = new TextDecoder().decode(await workspaceService.readFile(workspaceId, chapterPath));
    } catch {
      continue;
    }
    // Parsed as HTML: the markers are found by attribute, and the HTML parser
    // reads `epub:type` as a plain attribute name in every DOM implementation.
    const doc = new DOMParser().parseFromString(xhtml, 'text/html');
    const href = relativePathFrom(navDir, chapterPath);
    // Matched in code, not by an `epub\:type` selector, which not every DOM supports.
    Array.from(doc.querySelectorAll('[id]'))
      .filter(isPageMarker)
      .forEach(marker => {
        const label = (
          marker.getAttribute('title') ||
          marker.getAttribute('aria-label') ||
          marker.textContent ||
          ''
        ).trim();
        if (label) targets.push({ href: `${href}#${marker.id}`, label });
      });
  }
  return targets;
}

/** The page-list nav as XHTML markup, or '' when there are no targets. */
export function pageListMarkup(targets: PageTarget[], indent = '  '): string {
  if (targets.length === 0) return '';
  const items = targets
    .map(t => `${indent}    <li><a href="${escapeXML(t.href)}">${escapeXML(t.label)}</a></li>`)
    .join('\n');
  return `${indent}<nav epub:type="page-list" hidden="hidden">
${indent}  <ol>
${items}
${indent}  </ol>
${indent}</nav>`;
}

/**
 * The nav document with its page-list replaced by one built from `targets`
 * (or removed, when there are none). Returns the input unchanged when the
 * page-list it holds already matches, so an unchanged book causes no write.
 */
export function withPageList(navXhtml: string, targets: PageTarget[]): string {
  const doc = new DOMParser().parseFromString(navXhtml, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return navXhtml;

  const existing = Array.from(doc.getElementsByTagName('nav')).filter(nav =>
    (nav.getAttribute('epub:type') ?? nav.getAttributeNS(EPUB_NS, 'type') ?? '')
      .split(/\s+/)
      .includes('page-list')
  );
  const current = existing.flatMap(nav =>
    Array.from(nav.getElementsByTagName('a')).map(a => ({
      href: a.getAttribute('href') ?? '',
      label: (a.textContent ?? '').trim(),
    }))
  );
  if (
    existing.length <= 1 &&
    current.length === targets.length &&
    current.every((t, i) => t.href === targets[i].href && t.label === targets[i].label)
  ) {
    return navXhtml;
  }

  existing.forEach(nav => nav.remove());
  const body = doc.getElementsByTagName('body')[0];
  if (targets.length > 0 && body) {
    const markup = pageListMarkup(targets).replace(
      '<nav ',
      `<nav xmlns="${XHTML_NS}" xmlns:epub="${EPUB_NS}" `
    );
    const fragment = new DOMParser().parseFromString(markup, 'application/xhtml+xml');
    body.appendChild(doc.createTextNode('\n  '));
    body.appendChild(doc.importNode(fragment.documentElement, true));
    body.appendChild(doc.createTextNode('\n'));
  }
  const serialized = new XMLSerializer().serializeToString(doc);
  return serialized.startsWith('<?xml')
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
