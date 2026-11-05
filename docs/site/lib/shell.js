/**
 * The page frame shared by every docs page: header, book navigation, content.
 *
 * Site chrome strings are keyed by language so a translated manual can bring
 * its own; only English exists today.
 */

export const STRINGS = {
  en: {
    siteTitle: 'SEED.html documentation',
    skipToContent: 'Skip to content',
    openApp: 'Open SEED.html',
    manuals: 'Manuals',
    contents: 'Contents',
    onThisPage: 'On this page',
    previous: 'Previous',
    next: 'Next',
    chapters: 'Chapters',
    table: 'Table',
    homeIntro:
      'Two manuals: one for making books, one for extending them with code.',
  },
};

export const escape = text =>
  String(text).replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );

function bookNav({ books, currentBook, currentChapter, t }) {
  const items = books
    .map(book => {
      const chapters = book.chapters
        .map(chapter => {
          const current = chapter === currentChapter ? ' aria-current="page"' : '';
          return `<li><a href="${chapter.url}"${current}>${escape(chapter.title)}</a></li>`;
        })
        .join('\n');
      const open = !currentBook || book === currentBook ? ' open' : '';
      return `<li><details${open}><summary><a href="${book.url}">${escape(book.title)}</a></summary>
<ol>
${chapters}
</ol></details></li>`;
    })
    .join('\n');
  return `<nav class="docs-nav" aria-label="${t.manuals}">
<details class="docs-nav-toggle"><summary>${t.contents}</summary>
<ul class="docs-books">
${items}
</ul>
</details>
<script>
  // Book navigation is a sidebar on wide screens and a closed disclosure on
  // narrow ones. Without the script it stays a disclosure everywhere.
  (() => {
    const toggle = document.currentScript.previousElementSibling;
    const wide = matchMedia('(min-width: 64.01rem)');
    const apply = () => (toggle.open = wide.matches);
    apply();
    wide.addEventListener('change', apply);
  })();
</script>
</nav>`;
}

/**
 * @param {object} options
 * @param {string} options.language
 * @param {string} options.title - page title, without the site name
 * @param {string} options.main - the main column's HTML
 * @param {string} [options.aside] - the right-hand column's HTML
 * @param {string[]} [options.stylesheets] - extra stylesheet hrefs (the book's own)
 */
export function shell({ language, title, main, aside = '', stylesheets = [], books, currentBook, currentChapter }) {
  const t = STRINGS[language];
  const links = stylesheets.map(href => `<link rel="stylesheet" href="${href}">`).join('\n');
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title === t.siteTitle ? t.siteTitle : `${escape(title)} — ${t.siteTitle}`}</title>
<script>
  // Follow the system theme with the app's explicit data-theme, as the app
  // does; the theme files' no-attribute fallback covers only part of the palette.
  (() => {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => (document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light');
    apply();
    dark.addEventListener('change', apply);
  })();
</script>
<link rel="stylesheet" href="/docs/assets/site.css">
${links}
</head>
<body>
<a class="docs-skip" href="#content">${t.skipToContent}</a>
<header class="docs-header">
<a class="docs-brand" href="/docs/${language}/">${t.siteTitle}</a>
<a class="btn btn-secondary" href="/SEED.html">${t.openApp}</a>
</header>
<div class="docs-layout">
${bookNav({ books, currentBook, currentChapter, t })}
<main id="content" class="docs-main" tabindex="-1">
${main}
</main>
${aside ? `<aside class="docs-aside">${aside}</aside>` : ''}
</div>
</body>
</html>
`;
}
