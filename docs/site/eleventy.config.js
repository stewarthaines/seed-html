/**
 * Hosted docs build (process/DOCS_SITE.md).
 *
 * The manuals' chapter files in docs/user/<book>/Text/ become web pages at
 * /docs/<language>/<book>/<chapter>/, rendered by the app's own MarkdownIt
 * transform (lib/markdown.js) so the web page and the EPUB chapter come out of
 * the same code.
 *
 *   npm run build:docs   → dist/docs/
 *   npm run dev:docs     → the same into dist-docs-dev/, served with live reload
 */

import { rmSync } from 'node:fs';
import path from 'node:path';
import { transformText } from './lib/markdown.js';
import { BOOKS, SOURCE_ROOT, findChapter, loadBooks } from './lib/books.js';
import { bookPage, entryPage, homePage, searchPage } from './pages.js';
import { buildSearchIndex } from './lib/search.js';

const LANGUAGE = 'en';

export default function (eleventyConfig) {
  eleventyConfig.setLibrary('md', { render: source => transformText(source) });

  // Chapters are book content, not templates: no Liquid pass over them.
  eleventyConfig.setTemplateFormats(['md', '11ty.js']);
  eleventyConfig.setUseGitIgnore(false);
  // Only chapter files are pages. Ignore globs are relative to the repo root.
  eleventyConfig.ignores.add(`${SOURCE_ROOT}/*.md`);
  eleventyConfig.ignores.add(`${SOURCE_ROOT}/*/outline.md`);

  // Chapter order is read at build time; re-read when an outline or chapter changes.
  eleventyConfig.addWatchTarget(`${SOURCE_ROOT}/*/outline.md`);
  const books = () => loadBooks(LANGUAGE);
  eleventyConfig.addGlobalData('books', books);
  eleventyConfig.addGlobalData('language', LANGUAGE);

  eleventyConfig.addPassthroughCopy({
    'docs/site/assets/site.css': 'docs/assets/site.css',
    'src/styles/tokens': 'docs/assets/styles/tokens',
    'src/styles/themes': 'docs/assets/styles/themes',
    'src/styles/utilities/forms.css': 'docs/assets/styles/utilities/forms.css',
  });
  for (const book of BOOKS) {
    const out = `docs/${LANGUAGE}/${book.slug}`;
    eleventyConfig.addPassthroughCopy({
      [`${SOURCE_ROOT}/${book.folder}/Images`]: `${out}/Images`,
      [`${SOURCE_ROOT}/${book.folder}/Styles`]: `${out}/Styles`,
    });
  }

  // Chapter pages.
  eleventyConfig.addGlobalData('eleventyComputed', {
    layout: data => (data.page.inputPath.endsWith('.md') ? 'chapter.11ty.js' : undefined),
    docsBook: data => findChapter(data.books, data.page.inputPath)?.book,
    docsChapter: data => findChapter(data.books, data.page.inputPath)?.chapter,
    permalink: data => {
      if (!data.page.inputPath.endsWith('.md')) return data.permalink;
      return findChapter(data.books, data.page.inputPath).chapter.url;
    },
  });

  // Generated pages.
  eleventyConfig.addTemplate('docs-entry.11ty.js', entryPage, { permalink: '/docs/' });
  eleventyConfig.addTemplate('docs-home.11ty.js', homePage, {
    permalink: `/docs/${LANGUAGE}/`,
  });
  eleventyConfig.addTemplate('docs-book.11ty.js', data => bookPage({ ...data, book: data.book }), {
    pagination: { data: 'books', size: 1, alias: 'book' },
    permalink: data => data.book.url,
  });

  eleventyConfig.addTemplate('docs-search.11ty.js', searchPage, {
    permalink: `/docs/${LANGUAGE}/search/`,
  });

  // Eleventy never deletes output, so a renamed or removed chapter would leave
  // its old page behind, still checked and indexed. Clear the docs folder (only
  // that; the app build shares dist/) before every build.
  eleventyConfig.on('eleventy.before', ({ directories }) => {
    rmSync(path.join(directories.output, 'docs'), { recursive: true, force: true });
  });

  // Index the built chapters for search after every build, dev server included.
  eleventyConfig.on('eleventy.after', async ({ directories }) => {
    await buildSearchIndex({ siteDir: directories.output.replace(/\/$/, '') });
  });

  return {
    markdownTemplateEngine: false,
    dir: {
      input: SOURCE_ROOT,
      includes: '../site/_includes',
      output: 'dist',
    },
  };
}
