# Beyond writing: for designers and developers

## Who this chapter is for

SEED.html pictures three kinds of people making books: **authors**, who write; **designers**, who shape how a book looks; and **developers**, who extend what a book can do. Everything so far has been written for the author. This chapter is for the other two.

You don't need to be a team of three — one person often wears all three hats. But the work differs in kind, and so does the part of SEED.html you reach for: designers live in CSS and the preview, developers in the transform pipeline and the scripts around it.

One idea runs through both. SEED.html is **reflowable-first**: like a web page, a book should adapt to the reader — their screen, their text size, their screen reader — rather than being pinned to a fixed page. EPUB has always been reflowable, but its authoring tools have rarely encouraged the responsive-design thinking that's routine on the web. That's the thread of this chapter: familiar web techniques, for pages that fit any screen, applied to books.

## For designers

Your tools are the ones you'd expect: the book's **CSS** — its stylesheets sit in the chapter editor's file dropdown beside the text — and the device **preview**, whose presets run from phone to tablet to e-reader. Both were covered in the earlier chapters.

The opportunity is **responsive, reflowable design** — routine on the web, underused in EPUB. The same skills that make a responsive web page make a responsive book — one that's laid out and art-directed, yet adapts to any screen and to each reader's settings. A magazine is the clearest case: columns, pull-quotes, and considered spacing that hold up on a large screen and reflow gracefully on a small one. Where a layout leans on JavaScript to adapt, keep a CSS fallback, so the book still works wherever scripting doesn't.

**Fixed layout** is the deliberate exception. Set a book to **pre-paginated** under _Metadata → Rendition Properties_ and reserve it for the case that needs it — a picture book, where image and text are a single composition. Everywhere else, reflowable keeps the design working on every screen and for every reader.

## For developers

Your domain is the pipeline — the text and DOM transforms of _Go further_ — and the scripts around it, where you change what a book can _do_, not just how it looks.

The first lever is the **authoring format**. A text transform turns a markup syntax into HTML, so adding one under _Available Extensions_ hands authors a different way to write — Djot, Markdown, Textile, or one you wire up. Past that, libraries hang DOM transforms off the pipeline to render plain markup into rich output: KaTeX for maths from TeX, abc2svg for notation from ABC, highlight.js or Prism for syntax highlighting code samples. Add the library and the matching markup comes out typeset — maths in a textbook, a score in a songbook, listings in a programming manual.

The same hook is yours to extend with **custom content types**. A DOM transform can take a fenced block in some notation and emit whatever you can generate — a diagram language compiled to inline SVG, say — giving a book a content type EPUB never shipped with.

Other content is derived from the whole book rather than written by hand, and that's what **generators** are for: a generator runs across the current chapter or some data extracted from the entire book and inserts what it finds. The shipped **List of Figures** records the images in each chapter and builds the list; an index or a glossary is the same pattern — a DOM transform to mark the terms, a generator to collect and place them.

It all travels in the book's SEED.zip, so a SEED EPUB carries the machinery that made it: open it again and the transforms, libraries, and generators are still there.
