/**
 * Search index for the docs site, written by Pagefind after every Eleventy
 * build (dev server included), so search works wherever the pages do.
 *
 * Only chapter articles are indexed: the chapter layout marks the article with
 * data-pagefind-body, which makes Pagefind skip every page without one (home,
 * book indexes, the search page itself) and every part of a page outside it
 * (navigation, "On this page"). Pagefind keeps one index per <html lang>.
 */

import * as pagefind from 'pagefind';

export const SEARCH_BUNDLE = '/docs/pagefind/';

export async function buildSearchIndex({ siteDir = 'dist' } = {}) {
  const { index, errors } = await pagefind.createIndex({});
  if (errors.length > 0) throw new Error(`Pagefind: ${errors.join('; ')}`);
  try {
    const added = await index.addDirectory({ path: siteDir, glob: 'docs/**/*.html' });
    if (added.errors.length > 0) throw new Error(`Pagefind: ${added.errors.join('; ')}`);
    const written = await index.writeFiles({ outputPath: `${siteDir}${SEARCH_BUNDLE}` });
    if (written.errors.length > 0) throw new Error(`Pagefind: ${written.errors.join('; ')}`);
    return added.page_count;
  } finally {
    await pagefind.close();
  }
}
