/**
 * The books on the docs site and their chapters, in reading order.
 *
 * Order comes from each book's outline.md: its `##` sections list the chapters
 * in order, and each one matches a chapter file by that file's `#` heading.
 * Outline sections with no chapter yet are planned work and are skipped. A
 * chapter file the outline doesn't name stops the build, because the site
 * can't place it.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { headingTexts } from './markdown.js';

export const SOURCE_ROOT = 'docs/user';

/**
 * Book folders under docs/user, their URL slugs (the fuller book titles) and
 * names, and the DOM-transform extensions their EPUB projects install
 * (extensions/<id>/), which the web pages run too.
 */
export const BOOKS = [
  {
    folder: 'seed.html-user-manual',
    slug: 'user-manual',
    title: 'User Manual',
    description: 'How to make, check and publish a book with SEED.html.',
  },
  {
    folder: 'seed.html-advanced-reference',
    slug: 'advanced-reference',
    title: 'Advanced Reference',
    description:
      'How to extend a book with scripts, extensions and generators, for readers who know JavaScript and EPUB.',
    extensions: ['highlight'],
  },
];

/**
 * An outline section's chapter title. Outlines mark progress after two or more
 * spaces ("Extensions  (drafted)"); a parenthesis after one space is part of
 * the title ("Go further (Advanced Mode)").
 */
function outlineTitle(text) {
  const marker = text.search(/ {2,}\(/);
  return marker === -1 ? text : text.slice(0, marker);
}

function loadBook(book, language) {
  const bookDir = path.join(SOURCE_ROOT, book.folder);
  const textDir = path.join(bookDir, 'Text');
  const files = readdirSync(textDir).filter(name => name.endsWith('.md'));

  const byTitle = new Map();
  for (const file of files) {
    const [title] = headingTexts(readFileSync(path.join(textDir, file), 'utf8'), 1);
    if (!title) throw new Error(`${textDir}/${file} has no # heading`);
    byTitle.set(title, file);
  }

  const outline = readFileSync(path.join(bookDir, 'outline.md'), 'utf8');
  const order = headingTexts(outline, 2).map(outlineTitle);
  const unplaced = [...byTitle.keys()].filter(title => !order.includes(title));
  if (unplaced.length > 0) {
    throw new Error(
      `${bookDir}/outline.md has no ## section for: ${unplaced.map(t => `"${t}"`).join(', ')}`
    );
  }

  const url = `/docs/${language}/${book.slug}/`;
  const chapters = order
    .filter(title => byTitle.has(title))
    .map(title => {
      const file = byTitle.get(title);
      const slug = path.basename(file, '.md');
      return { title, slug, inputPath: path.join(textDir, file), url: `${url}${slug}/` };
    });

  chapters.forEach((chapter, i) => {
    chapter.previous = chapters[i - 1] ?? null;
    chapter.next = chapters[i + 1] ?? null;
  });

  // The book's own stylesheets style its pages, as every chapter links them in the EPUB.
  const stylesDir = path.join(bookDir, 'Styles');
  const stylesheets = existsSync(stylesDir)
    ? readdirSync(stylesDir)
        .filter(name => name.endsWith('.css'))
        .sort()
    : [];

  return { ...book, extensions: book.extensions ?? [], url, chapters, stylesheets };
}

export function loadBooks(language) {
  return BOOKS.map(book => loadBook(book, language));
}

/** The book and chapter a chapter source file belongs to. */
export function findChapter(books, inputPath) {
  const normalized = path.normalize(inputPath);
  for (const book of books) {
    const chapter = book.chapters.find(c => c.inputPath === normalized);
    if (chapter) return { book, chapter };
  }
  return null;
}
