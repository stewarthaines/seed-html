# Hosted docs: one manual, two destinations

Status: proposal, 2026-11-05. An exploration, not a commitment. The premise may not hold, and finding where it breaks is part of the work.

## The idea

The user manual and the advanced reference have been EPUB-only: SEED projects in `docs/user/` that the reader opens inside the app. That is a neat idea, but it hides the docs from search engines, from people who haven't opened the app yet, and from anyone who wants to send a link to an answer. A hosted version fixes that.

The experiment: build the hosted docs from the same chapter files as the EPUB, with the same conventions (`{.ui .icon-*}` pills, `{.figure}`, `{.try-it}`, one line per paragraph), and see what has to give. The manual is overdue for revision anyway, so content changes that help both destinations are welcome. Changes that help only the web are a signal that the premise is under strain.

The style to aim for is the headscale docs (https://headscale.net/stable/about/faq/). They use Material for MkDocs: a sidebar of pages, an "On this page" list on the right, offline search, dark mode, callouts.

## Decisions so far

- URLs use the fuller book titles: `user-manual`, `advanced-reference`.

- Same sources: one manual, written once, built as an EPUB in the app and as web pages by a Node build.
- One web page per chapter file. If a chapter is too long for a web page, split its source file, so the book gets the smaller unit too.
- The language is in the URL from the start. Translation is a maybe; the URLs leave room for it without ever changing.
- No versions in the URL. `/docs/` describes the live app and is rebuilt with every deploy. Archived copies per release can be added later under their own prefix without breaking any link.

## Tooling

Eleventy 3 (already familiar from the blog), with its markdown engine replaced by the app's own transform. `extensions/markdown-it/` ships `markdown-it.min.js` (14.1.0) and `markdown-it-attrs.browser.min.js` (4.3.1) as UMD bundles, which Node can `require` as they are. `transformMarkdown.js` calls `window.markdownit` and `window.markdownItAttrs`. The build can load it with a two-line `window` shim, so the web pages come out of exactly the code the EPUB uses: same typographer settings, same attrs plugin, same `:clip` and symbol rules. If the extension changes, the docs change with it.

Starlight (Astro) was the closest ready-made match for the headscale look. It was set aside because it parses markdown with remark: `{.ui}` attributes would need a plugin, and that plugin would be a second implementation that drifts from the app's. MkDocs means a Python toolchain in a Node repo, which is why this question came up.

The cost of Eleventy is building the docs theme ourselves. The pieces:

- Layout: a header, a sidebar listing both books and their chapters, the content column, and an "On this page" list built from each page's `##` and `###` headings.
- Search: Pagefind (an npm package that indexes the built HTML after the Eleventy run and serves search with no backend). It indexes per language, which suits the URL scheme.
- Dark mode and RTL, driven by the app's tokens from `src/styles/tokens` so the site looks like SEED.html. Logical CSS properties throughout, as in the app.
- Content styling: the book's own `Styles/book.css`, loaded on its book's pages, so pills, icons, figures and callouts look the same in both destinations. Its hex literals are book content, not app components, so the tokens rule doesn't reach them; the site chrome follows the tokens rule.

## URL scheme

The site root keeps its current edge 302 to `/SEED.html`. A landing page at `/` is a separate decision.

- `/docs/` redirects to `/docs/en/`.
- `/docs/en/` is the docs home: the two books, with a line on each.
- `/docs/en/user-manual/<chapter>/` for the user manual.
- `/docs/en/advanced-reference/<chapter>/` for the advanced reference.
- Sections are anchors on the chapter page: `/docs/en/user-manual/make-a-book/#start-a-project`.
- Images and the stylesheet live at `/docs/en/user-manual/Images/…` and `/docs/en/user-manual/Styles/book.css`. Each chapter page sits one level below its book folder, as `Text/` does in the EPUB, so the chapter's `../Images/` and `book.css`'s `url(../Images/…)` resolve unchanged. No rewriting.

A translated book would sit at `/docs/de/user-manual/<chapter>/` with the same chapter slugs, so a language switcher only swaps the prefix.

### Chapter slugs come from file names

The chapter files are `chapter01.md` … `chapter08.md` today. Proposal: rename them to their slugs (`get-started.md`, `make-a-book.md`, …) in the repo, and let folder sync carry the rename into the SEED project (see below), so the slug is the same word in both destinations. Then a cross-reference written for the EPUB, `make-a-book.xhtml#start-a-project`, maps to `../make-a-book/#start-a-project` with one rule. Slugs taken from the `#` title would break every link whenever a title changes; file names change only on purpose.

### Heading ids

markdown-it doesn't give headings ids. Two needs:

- Cross-references and shared links need stable targets in both destinations. Headings that are link targets get an explicit `{#id}` in the source, which the attrs plugin already supports.
- The "On this page" list needs an id on every `##`/`###`. The web build adds a slug id to any heading that lacks one. The EPUB doesn't need these.

Adding automatic ids to the markdown-it extension itself would change every author's book, so it stays out of this work.

## The repo is the source; folder sync makes the book

The chapter files in the repo are the one source. The SEED project for each book is a build of them, kept current with the app's folder sync (Chrome or Edge): link `docs/user/<book>/Text/` to the project and click sync after editing. No chapter gets loaded by hand, and the EPUB is remade from exactly the files the web build reads. Linking `Text/` and not the book folder keeps `outline.md` out of the chapters.

What folder sync does and doesn't do (`process/FOLDER_SYNC.md`, v1):

- It is a one-way pull, folder to project, run by a click. Edits made in the app don't go back to the repo, so chapter text is edited in the repo, never in the app.
- It reads only text files (`.txt`, `.md`, `.markdown`) at the top level of the folder. `Images/` and `Styles/book.css` still go in by hand through Manifest → Load File. They change rarely, but this is the remaining manual step, and media sync (out of scope for v1) is the follow-on this work would argue for.
- A file's name becomes the chapter id through `sanitizeChapterId`, so `make-a-book.md` becomes the chapter `make-a-book`. Renaming a file in the repo shows up in the sync review as one remove and one add, not a rename. The removes default to skip, so the one-time move from `chapterNN` to slugs needs the removes ticked, then the spine reordered once.
- The app owns the spine order. Sync never reorders; it appends new chapters, natural-sorted among themselves.

### Reading order

Not chased. The EPUB copy's spine is part of its manual setup, along with the images and stylesheet. The web build takes its order from the book's `outline.md`, which already lists the chapters in order as its `##` sections; the spike settles how it reads them.

## Where it lives and ships

Same repo, so the docs and the app share a commit and a version.

- Sources stay in `docs/user/<book>/`. The build lives in `docs/site/` (Eleventy config, layouts, site CSS), with Eleventy and Pagefind as devDependencies.
- `npm run build:docs` writes `dist/docs/`. The deploy order becomes i18n → plugins → docs → deploy, so a normal production deploy ships the docs, and a preview branch deploy (`--branch docs-site`) shows them at `docs-site.readitinabook.pages.dev/docs/` before they go live.
- The docs build gets its own checks, run from `npm run validate`: no broken internal links or anchors, every image has alt text, the old product name doesn't appear. The checks run on the built HTML.
- Work goes on a `docs-site` feature branch and merges per shippable phase.

## What may not hold

The things to watch, each a possible compromise or a reason to stop:

- "Try it" callouts assume the app is open beside the book. On the web it may not be. A link that opens SEED.html in a new tab might be enough; rewording them so they work either way is better.
- No full-app screenshots was right inside the app (picture-in-picture). On the web the reader may never have seen the app, so one orientation screenshot may earn its place. Cropped affordances work in both.
- Self-references such as "How SEED.html works (this book is software)" read oddly on a web page.
- Icon pills are decorative `::before` backgrounds. They should carry over, but check them in dark mode against the site's background.
- Long chapters: "Make a book" (1,360 words) and the advanced reference's "Reference" (1,680 words) are the likely first splits.
- Anything the EPUB gets from the app's transform chain beyond markdown-it (DOM transforms, extensions such as figures) won't be in the web build unless it's ported. Today the manuals use only the MarkdownIt format, so this should be empty; if it isn't, it's the strongest signal against the premise.

## Phases

1. Spike: Eleventy renders one chapter of the user manual through the app's `transformMarkdown.js` with `book.css`, with no theme. Answers whether the same-code idea works at all. Small.
2. Both books, the layout (sidebar, "On this page"), slugs, image rewriting, the docs home. Preview deploy.
3. Search, dark mode, RTL check, the validate checks, deploy integration. First production ship.
4. Content revision for both destinations, with the books linked to their `Text/` folders: file renames to slugs, chapter splits, heading ids, "Try it" rewording, and anything else the earlier phases turned up.
5. The app links to the docs (About view, the manual's sample-project description); the docs link back to the app. How a docs page offers the book itself (download, open in READ.html, open in SEED.html) is a later decision; no EPUB download for now.

## Spike result (phase 1, 2026-11-05)

It works. `docs/site/eleventy.config.js` loads the three files from `extensions/markdown-it/` into a `node:vm` sandbox whose global is also `window`, and hands the sandbox's `transformText` to Eleventy as its markdown library. All eight user-manual chapters build to `dist/docs/en/user-manual/chapterNN/` in about 0.3 s, with `markdownTemplateEngine: false` so no Liquid pass touches the chapters. In a browser the pills, icons, `{.figure .screenshot}` images and `{.try-it}` callouts render as in the EPUB, styled by the book's own `book.css` and nothing else. `npm run build:docs` builds, `npm run dev:docs` serves.

Spike notes for phase 2:

- Eleventy ignore globs are relative to the repo root, not the input folder.
- URLs still use the `chapterNN` file names until the slug renames in phase 4.
- The advanced reference is left out of the spike; it should build the same way.

## Phase 2 (2026-11-05)

Both books build: 15 chapter pages, an index page per book, the docs home at `/docs/en/`, and `/docs/` sending the reader to `/docs/en/` with a meta refresh (no `_redirects` file, so nothing touches the site root's edge redirect).

- Chapter order comes from each `outline.md`, matched to chapter files by heading text. Both outlines and markdown sources are read with the app's own markdown-it (token stream, no regular expressions). Outline progress marks after two spaces ("Extensions (drafted)") are dropped. Outline sections with no chapter yet are skipped; a chapter the outline doesn't name stops the build.
- The layout parses the rendered chapter with happy-dom to give every h2/h3 an id (keeping any `{#id}` from the source), build "On this page", take the page title from the rendered `h1`, and wrap tables in a keyboard-focusable scroll region. Nothing else in the chapter markup changes.
- Three columns on wide screens (book navigation, chapter, "On this page"), two below 80rem, one below 64rem, where the book navigation becomes a closed "Contents" disclosure. Previous/next links end each chapter. No page scrolls sideways at phone width; long code lines and wide tables scroll inside their own block.
- Site CSS uses only the app's tokens, themes and `.btn` utilities, copied into `dist/docs/assets/styles/` at build time.
- The site sets `data-theme` from the system preference with a small head script, as the app sets it explicitly. The theme files' fallback for pages without the attribute (`:root:not([data-theme])` in `dark.css`) covers only part of the palette: it has no button tokens, so a `.btn-secondary` rendered white on white, and its link colour is the one the explicit dark block notes fails AA. That is an app-side gap worth closing separately.

Findings:

- The advanced reference uses `{.ui .icon-gear}`, `{.figure}`, `{.caption}` and other classes, but the repo holds no `Styles/` for it and none of its icon SVGs. Its stylesheet presumably lives only in the browser copy of the project, so the repo isn't yet the whole source of that book. Its web pages link a stylesheet only when the book has one; they currently render unstyled pills and tables.
- Site chrome strings ("On this page", "Contents", …) are in a per-language table in `docs/site/lib/shell.js`, not in the `.po` catalogs. Fine while only English exists; a translated manual would want them in the catalogs.
- The build takes about 2 s, most of it happy-dom.

Preview deploy (the user runs deploys): `npm run build && npm run build:docs && npx wrangler pages deploy dist --project-name readitinabook --branch docs-site`, then `https://docs-site.readitinabook.pages.dev/docs/`. `vite build` empties `dist/`, so the docs build always runs after it.

## Phase 3 (2026-11-05)

- Search: Pagefind 1.5.2 (pinned; 1.6.0 was four days old), run through its Node API at the end of every Eleventy build, dev server included. Only chapter articles are indexed (`data-pagefind-body`); one index per `<html lang>`. The header has a plain search form that submits to `/docs/en/search/?q=…`, where Pagefind's UI runs the query, with results grouped by chapter and section. Its colours come from the app's tokens.
- Pagefind's UI prefixes result URLs with its bundle folder's parent (`/docs/`), and the index already stores site-root paths, which doubled `/docs/docs/`. `baseUrl: '/'` fixes it. Cloudflare Pages does no URL mapping of its own: it serves `dist/` as built, exactly as the dev server does.
- `npm run dev:docs` builds into its own `dist-docs-dev/` (gitignored, and ignored by Prettier and ESLint). With both writing to `dist/`, a running dev server and a build or validate could write the search index at the same time; one run left `pagefind-entry.json` empty.
- `npm run check:docs` builds the site and checks the built pages: internal links, images, stylesheets and scripts resolve; every `#fragment` names an id on its target page; every image has alt text (empty alt only on a `.icon`). It runs in `npm run validate` (`docs/QUALITY.md`).
- `npm run deploy` runs `build:docs` before uploading, so local deploys and the dormant Forgejo workflow both ship docs matching the app (`docs/DEPLOYMENT.md`, Docs Site).
- RTL: with `dir="rtl"` forced on a chapter page the layout mirrors (book navigation right, "On this page" left, the try-it rule on the right) with no sideways scroll. Each language's chrome strings carry a `dir`, set on `<html>`.
- Dark mode follows the system, as in phase 2. No theme toggle yet.

## Phase 4 (2026-11-06)

- Chapter files are named for their URL slugs (`make-a-book.md`, `text-pipeline.md`, …). The file name is also the EPUB chapter id, so both outlines and `docs/user/CLAUDE.md` say to rename only on purpose. The in-app projects take the new names at their next folder sync: the old files arrive as removes (tick them; removes default to skip) and the spine needs putting back in order once.
- The docs build clears `dist/docs/` before every build. Eleventy never deletes output, so the renamed chapters' old pages were still being checked and indexed. Only `dist/docs/` is cleared; the app build shares `dist/`.
- The advanced reference's `Styles/book.css`, `Styles/highlight.css` and the ten icon SVGs its `book.css` names came into the repo from the in-app project (read over the seed-bridge). Its `book.css` differs slightly from the user manual's (pill weight, screenshot margin, a `.fleuron` block) and its header comment still says "User Manual"; both kept as they are.
- Chapter pages link every stylesheet in the book's `Styles/`, as an EPUB chapter links every stylesheet in its manifest.
- Extensions: a book lists the DOM-transform extensions its project installs (`extensions` in `docs/site/lib/books.js`). `docs/site/lib/extensions.js` loads each from `extensions/<id>/` into its own `node:vm` sandbox, scripts first and then transforms, as the app loads them into its transform iframe, and runs them on the chapter's happy-dom document before the web-only touches. Text-transform extensions stop the build; none are needed yet. The advanced reference lists `highlight`; the user manual stays plain by choice, although its Workflows chapter has code blocks.
- A highlighted code block keeps the site's frame and shows only the theme's background, instead of a box inside a box.
- Chapter splits were declined; the user is doing a content pass instead.

Findings:

- The repo still can't rebuild the advanced reference EPUB on its own. The in-app project also has `page.css` (code font, `.thumbnail`, the responsive `.half` figure), the Noto Sans Mono font, the impressum and prettier extensions, the code-block and figure-list generators, and its own `transformText.js` and `transformDom.js` (figure data, `<hr>` to fleuron). `page.css` stays off the web on purpose: its body and heading fonts and italic blockquotes would fight the site's typography. So the one `.thumbnail` and one `.half` figure are unstyled on the web.
- The in-app advanced reference is in Firefox, where folder sync isn't available; syncing it from the repo means moving it to Chrome or Edge.
- For the content pass: cross-reference targets want explicit `{#id}` (generated ids change when a heading is reworded); "Try it" callouts and self-references ("this book is software") assume the reader is in the app.

## Phase 5 (2026-11-06)

- About SEED.html links to `https://readitinabook.com/docs/` ("Documentation", next to the source link). It is absolute because the app also runs from `file://` and from inside an EPUB. The link goes nowhere useful until a production deploy ships the docs.
- The docs link back with "Open SEED.html" in every page header (since phase 2).
- The app has no in-app copy of the manuals to link from. They reach readers as samples in the sample catalog, whose descriptions come from each book project's details when it is sent; pointing those at the web pages is an edit in the projects, not the repo.
- Changelog: one Added line under Unreleased.
