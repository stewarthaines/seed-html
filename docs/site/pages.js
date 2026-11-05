/**
 * Generated pages: the docs home, one index per book, and the /docs/ entry.
 */

import { escape, shell, STRINGS } from './lib/shell.js';

export function homePage({ language, books }) {
  const t = STRINGS[language];
  const cards = books
    .map(
      book => `<li><h2><a href="${book.url}">${escape(book.title)}</a></h2>
<p>${escape(book.description)}</p></li>`
    )
    .join('\n');
  return shell({
    language,
    title: t.siteTitle,
    books,
    main: `<h1>${t.siteTitle}</h1>
<p>${escape(t.homeIntro)}</p>
<ul class="docs-cards">
${cards}
</ul>`,
  });
}

export function bookPage({ language, books, book }) {
  const chapters = book.chapters
    .map(chapter => `<li><a href="${chapter.url}">${escape(chapter.title)}</a></li>`)
    .join('\n');
  return shell({
    language,
    title: book.title,
    books,
    currentBook: book,
    main: `<h1>${escape(book.title)}</h1>
<p>${escape(book.description)}</p>
<ol class="docs-chapter-list">
${chapters}
</ol>`,
  });
}

/** /docs/ has no language of its own; it sends the reader to English. */
export function entryPage({ language }) {
  const target = `/docs/${language}/`;
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
<title>${STRINGS[language].siteTitle}</title>
</head>
<body><p><a href="${target}">${STRINGS[language].siteTitle}</a></p></body>
</html>
`;
}
