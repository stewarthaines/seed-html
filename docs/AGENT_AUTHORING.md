# Authoring guide for agents

You are assisting an author inside SEED.html, a browser-based EPUB editor. This guide is served by the `seed_get_authoring_guide` tool; call `seed_get_project_setup` before making or proposing any edit — chapter markup, class names, and templates are **per-project decisions**, not conventions you can assume.

## Establish the project before editing

1. `seed_get_project_setup` returns the project's `settings.json`: the configured `text_transform` and `dom_transforms` scripts, insertion templates, and preview configuration.
2. **Read the configured transform scripts** (`seed_read_file`) before editing chapter sources or proposing markup. The chapter XHTML is *generated*: source text (whose syntax — Markdown, Djot, Textile, custom — is the author's per-project choice) runs through the text transform, then each DOM transform in order. A class or element you expect in the output exists only if a transform produces it. To learn the mapping, read one chapter source (`SOURCE/text/<id>.txt`) next to its output (`seed_get_rendered_xhtml`). **Enforced, not advisory**: writes to chapter sources are refused until `seed_get_project_setup` has been called and every transform script it lists has been read this session — the refusal names what remains unread.
3. **If `seed_get_project_setup` returns a `syntaxReference`, treat it as binding.** It lists exactly where this project's source syntax diverges from your Markdown priors — the divergences are chosen because agents get them wrong. The source syntax is not Markdown unless the reference says so.
4. **Verify after every structural edit**: re-check the rendered output (`seed_get_rendered_xhtml` tracks the open chapter live; allow a moment for the re-render after a write) and confirm the DOM shape matches intent — the sublist actually nested, the paragraph split where expected, the class landed. This catches syntax-prior mistakes regardless of which rule you got wrong, and it is cheap. For a bulk edit across chapters, verifying **one representative chapter per edit pattern** is sufficient — syntax failures are pattern-level — but only while the pattern is homogeneous: if chapters differ in the dimension you touched (tight vs loose lists, presence of nested structures, different templates), say so and ask the author to open another affected chapter so you can verify that variant too. You can only see the chapter the author has open; that is by design.
5. Match the project's insertion templates: `image_template` (placeholders `<href>`, `<alt>`), `video_template`, `audio_clip_template` in settings show how this project embeds media in source text. Use them; don't invent markup.
6. `SOURCE/preview/head.xml` (when configured) is authoring-time-only markup injected into previews — never part of the packaged book. Don't put production styles there.

## Writing CSS for EPUB (reflowable content)

The book will be read in reading systems spanning modern WebKit/Blink down to ancient e-ink firmware, and every reading system overrides author styles (fonts, sizes, colors, margins) at the reader's whim. Write CSS that degrades to acceptable, not CSS that requires support:

- **Layer same-property fallbacks** — old parsers keep the last declaration they understand: `max-width: none;` then `max-width: 45vw;` gives modern readers the cap and old readers the safe value. Never let an unsupported modern value fall back to a *wrong* older one.
- **Prefer `em`/`%` over `px` for anything tied to text**, and prefer `em` over `vh`/`vw` (viewport units are unreliable in paginated reading systems — they disagree about what the viewport is). `max-height` in `em` scales with the reader's chosen font size; `%` heights are dead in normal flow.
- **Logical properties** (`margin-inline-end`, `inset-block-start`, `text-align: end`) keep layouts correct if content direction changes; this codebase treats them as house style.
- **Floats + negative margins are the classic pagination trap**: content hanging outside its box paints over neighboring columns/pages and corrupts position math in paginated renderers. For hanging layouts (dated event lists), prefer grid with a fallback; for wrapped figures, float the whole figure, size the image with `max-height`, and beware `width: min-content` + percentage `max-width` circularity (the image collapses; cancel inherited `max-width` inside the float).
- **`break-inside: avoid`** on units that must not split across pages (a date + its event, a figure + caption).
- **Don't fight the reading system**: no fixed backgrounds/colors that break dark mode, no `position: fixed`, no assumptions about page size. `text-align: justify` + `hyphens: auto` are legitimate but need correct `lang` and vary by reader; many books skip justification deliberately.

## Reading-system JavaScript

Scripts in EPUB are opt-in twice: the reading system must support scripting, and readers may refuse it per-book. **Everything must work as static content first**; scripts only enhance:

- The chapter must read correctly — content, order, meaning — with scripting disabled. Controls that only work with JS should be added *by* the script at runtime, not present-but-dead in the markup.
- Scripted chapters carry the `scripted` property in the manifest (the packager derives this — don't hand-edit the OPF).
- Feature-detect; never assume APIs. Target ES2017-ish syntax for breadth.

## The PDF path is a different target

"Print" output runs Paged.js (`paged.polyfill.js`) inside the app's own browser (floor: Safari 16 / 2022-era engines) — not in a reading system. Its quirks are load-bearing:

- Any `@media` block whose condition mentions `print` is **unwrapped unconditionally and appended after the rest of the stylesheet** (cascade reorder: those rules win by position, not by media evaluation). Any other `@media` block is **deleted** for the print run. So: put print-only rules in `@media print`, expect them to apply with elevated cascade position, and never rely on non-print media queries surviving into PDF.
- `@page` (size, margins) is honored by the polyfill; the app's print settings feed it. Screen-oriented viewport units and interactive affordances don't exist here.
- The same chapter must therefore work in three renderings: reflowable reading system, app preview, and Paged.js PDF. When a change targets one, check the others (the preview's device dropdown includes the print preset).

## Accessibility, screen readers, epubcheck

The app checks what you produce — assume the author will run them, and write to pass:

- **Structure is heard, not just seen**: real headings in order (no skipped levels, no styled-`<div>` headings), lists as lists, `<figure>`/`<figcaption>` for captioned images, `<b>`/`<i>` not `<strong>`/`<em>` for conventional offset (bylines, names), `<footer>` inside a section for authorship. The app's screen reader preview announces exactly what your markup claims.
- **Every image needs meaningful alt text** in the source (the image template's `<alt>`); decorative flourishes get `aria-hidden`.
- **`lang` correctness** drives voice switching, hyphenation, and announcements — mark language switches on spans (the transform pipeline and `ctx.language` support this).
- **epubcheck-visible sins**: broken heading order, missing alt, invalid XHTML after transforms, undeclared manifest resources. The nav and OPF are generated — never edit them.
- The author may deliberately relax any of this; flag the tradeoff once, then respect their call.

## Hard boundaries (enforced by the tools, explained here)

- Writes are **modify-in-place** on existing non-generated files. Generated outputs (`OEBPS/Text/*.xhtml`, `nav.xhtml`, the OPF, `toc.ncx`) are refused: the next transform or packaging run would silently revert your edit. To change chapter output, edit the *source* or a *transform*.
- Every write needs the hash from your prior read; the author approves writes in-app and sees every action you take in the activity feed.
- `SOURCE/settings.json`, `SOURCE/main/` (track-changes bases), and `SOURCE/data/` (generator scratch) are app-owned.
