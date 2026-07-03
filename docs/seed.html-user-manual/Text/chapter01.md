# Get started

## Welcome

SEED.html lets you make ebooks — right now, in your browser — that anyone can read. There's nothing to install and no account to set up. You write in plain text, and SEED.html turns it into an EPUB, the standard ebook format. You can open that file in the reading apps and devices you already use, like Apple Books, Google Play Books, Kobo, and Thorium Reader.

![One book you make in SEED.html, opening on a phone, a tablet, and an e-reader.](../Images/diagram-reach.svg){.figure}
Make it once — read it anywhere.
{.caption}

EPUB is an open standard, so a book you make once can be read almost anywhere. The text adjusts to fit any screen, and each reader can set their own text size, font, and contrast. The same EPUB file works on a phone, a tablet, an e-reader, or a desktop reading app.

Making your book in SEED.html is also an easy way to get a genuinely accessible result — one that works well with screen readers and other assistive technology.

SEED.html is for anyone who wants to make a clean, accessible ebook without complex publishing software — authors, educators, and small publishers especially.

One thing to be clear up front: **SEED.html is not a general-purpose EPUB editor.** If you've used Calibre or Sigil, you might expect to open any EPUB and edit it. SEED.html works differently — it can only edit books that were _made_ in SEED.html, because those carry their own source inside them. You can't open one made elsewhere and edit it here.

The rest of this manual follows the steps of making a book. You'll create a project and write its chapters, describe the book with its title, author, cover, and other details, check it for problems and accessibility, and finally produce an EPUB (or PDF) you can share.

> **Try it.** If you're reading this manual inside SEED.html right now, open the _Projects_{.ui .icon-house} panel in the sidebar and you'll see this book in the list. That's where every book starts.
{.try-it}

## How SEED.html works (this book is software)

Most ebooks are a _destination format_: like a PDF, an EPUB is something you publish and archive, not something you open and change again.

A SEED EPUB is different. The book you make is an ordinary EPUB any reading app can open, but it also carries its own source inside, in a small file called `SEED.zip`. That source is what lets you open the book in SEED.html and edit it again — the book carries everything it needs to be worked on.

![SEED.html makes a SEED EPUB; because that book carries its own source, it can return to SEED.html to be edited again.](../Images/diagram-roundtrip.svg){.figure}
A SEED EPUB reads like any other ebook. Because it carries its own source, it can come back into SEED.html to be edited again.
{.caption}

This is why SEED.html can only edit books it made: the source travels inside the book. An EPUB from anywhere else has no source to open.

You're most likely using the web app right now, in your browser. Even so, everything happens on your own device — your book is never uploaded anywhere — and it works in recent versions of all the major browsers. Your work saves automatically as you write, each book kept separate; there's no Save button, but reload the page and you pick up where you left off.
