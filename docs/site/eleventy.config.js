/**
 * Hosted docs build — spike (process/DOCS_SITE.md, phase 1).
 *
 * Renders the user manual's chapter files to web pages through the app's own
 * MarkdownIt text transform (extensions/markdown-it/transformMarkdown.js), so
 * the web page and the EPUB chapter come out of the same code.
 *
 * Run from the repo root:
 *   npx @11ty/eleventy --config=docs/site/eleventy.config.js
 *   npx @11ty/eleventy --config=docs/site/eleventy.config.js --serve
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const EXTENSION_DIR = 'extensions/markdown-it';

/** Book folders under docs/user and their URL slugs (fuller book titles). */
const BOOKS = [{ folder: 'seed.html-user-manual', slug: 'user-manual' }];

const LANGUAGE = 'en';

/**
 * Load the app's markdown transform in a sandbox that stands in for the
 * transform iframe: the vendored UMD bundles attach `markdownit` and
 * `markdownItAttrs` to the global, and `window` is that same global.
 */
function loadAppTransform() {
  const sandbox = { console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of [
    'markdown-it.min.js',
    'markdown-it-attrs.browser.min.js',
    'transformMarkdown.js',
  ]) {
    const filename = path.join(EXTENSION_DIR, file);
    vm.runInContext(readFileSync(filename, 'utf8'), sandbox, { filename });
  }
  return sandbox.transformText;
}

export default function (eleventyConfig) {
  const transformText = loadAppTransform();
  eleventyConfig.setLibrary('md', { render: source => transformText(source) });

  // Chapters are book content, not templates: no Liquid pass over them.
  eleventyConfig.setTemplateFormats(['md']);
  eleventyConfig.setUseGitIgnore(false);
  // Ignore globs are relative to the repo root, not the input folder.
  eleventyConfig.ignores.add('docs/user/*.md');
  eleventyConfig.ignores.add('docs/user/*/outline.md');
  eleventyConfig.ignores.add('docs/user/seed.html-advanced-reference/**');

  for (const book of BOOKS) {
    const out = `docs/${LANGUAGE}/${book.slug}`;
    eleventyConfig.addPassthroughCopy({
      [`docs/user/${book.folder}/Images`]: `${out}/Images`,
      [`docs/user/${book.folder}/Styles`]: `${out}/Styles`,
    });
  }

  eleventyConfig.addGlobalData('layout', 'chapter.11ty.js');
  eleventyConfig.addGlobalData('language', LANGUAGE);
  eleventyConfig.addGlobalData('eleventyComputed', {
    book: data => BOOKS.find(b => data.page.inputPath.includes(`/${b.folder}/`)),
    // The page sits one level below its book folder, as Text/ does in the
    // EPUB, so the chapter's ../Images/ and book.css's url(../Images/…)
    // resolve unchanged.
    permalink: data => {
      const book = BOOKS.find(b => data.page.inputPath.includes(`/${b.folder}/`));
      return `/docs/${LANGUAGE}/${book.slug}/${data.page.fileSlug}/`;
    },
    // The chapter's # heading, read from the source's first heading line.
    title: data => /^# (.+)$/m.exec(data.page.rawInput ?? '')?.[1] ?? data.page.fileSlug,
  });

  return {
    markdownTemplateEngine: false,
    dir: {
      input: 'docs/user',
      includes: '../site/_includes',
      output: 'dist',
    },
  };
}
