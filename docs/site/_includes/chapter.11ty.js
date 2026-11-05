/**
 * A chapter page: the chapter as the app renders it, styled by the book's own
 * stylesheet, with the book navigation, "On this page" and previous/next.
 */

import { processChapter } from '../lib/chapter-html.js';
import { escape, shell, STRINGS } from '../lib/shell.js';

function pageToc(toc, t) {
  if (toc.length === 0) return '';
  const list = entries =>
    `<ul>${entries
      .map(
        e =>
          `<li><a href="#${e.id}">${escape(e.text)}</a>${e.children.length ? list(e.children) : ''}</li>`
      )
      .join('')}</ul>`;
  return `<nav class="docs-toc" aria-labelledby="docs-toc-title">
<h2 id="docs-toc-title">${t.onThisPage}</h2>
${list(toc)}
</nav>`;
}

function pager(chapter, t) {
  const link = (target, rel, label) =>
    target
      ? `<a class="docs-pager-${rel}" rel="${rel}" href="${target.url}"><span>${label}</span> ${escape(target.title)}</a>`
      : '';
  if (!chapter.previous && !chapter.next) return '';
  return `<nav class="docs-pager" aria-label="${t.chapters}">
${link(chapter.previous, 'prev', t.previous)}
${link(chapter.next, 'next', t.next)}
</nav>`;
}

export default function (data) {
  const { content, language, books, docsBook, docsChapter } = data;
  const t = STRINGS[language];
  const { html, title, toc } = processChapter(content, { tableLabel: t.table });
  return shell({
    language,
    title: title || docsChapter.title,
    books,
    currentBook: docsBook,
    currentChapter: docsChapter,
    // The page sits one level below its book folder, as Text/ does in the
    // EPUB, so this and the chapter's ../Images/ paths resolve unchanged.
    stylesheets: docsBook.hasStylesheet ? ['../Styles/book.css'] : [],
    main: `<article class="docs-chapter">
${html}
</article>
${pager(docsChapter, t)}`,
    aside: pageToc(toc, t),
  });
}
