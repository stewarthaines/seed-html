# Describe your book

## Metadata

Metadata is the information _about_ your book — its title, who made it, what language it's in, and more. Reading apps and online catalogs use it to list and describe your book, so it's worth filling in. Open the _Metadata_{.ui .icon-article} view from the sidebar.

The view has three tabs in its header — _Basic Info_{.ui}, _Advanced_{.ui}, and _Accessibility_{.ui}. Most books only need the first.

### Basic information

The _Basic Info_{.ui} tab holds the essentials. Set the **Title** and the **Languages** the book is written in — add more than one if it's multilingual. The **Identifier** is a code that uniquely names the book; SEED.html fills one in, and _Generate_{.ui} makes a new one, so you only touch it if you have your own, such as an ISBN. Under **Creators**, name the author — and anyone else you want credited as a main creator, with _Add Another Creator_{.ui} — and write a short **Description**, the kind of blurb a catalog shows.

Below these, **Rendition Properties** control how reading apps lay the book out: whether text reflows or pages are fixed, which way pages turn, and so on. The defaults suit an ordinary reflowing book — leave them unless you know you need to change them.

### Advanced fields

The _Advanced_{.ui} tab adds details some books need: a publisher, date, and copyright under **Publication**; **Subjects** that categorise the book, like _fiction_ or _textbook_, for catalogs to group it by; and **Contributors** — others involved, each given a role such as editor, illustrator, translator, or narrator.

### Accessibility

The _Accessibility_{.ui} tab describes how accessible your book is, so readers and their reading apps know what to expect. You declare the **Access modes** the content can be read in — textual, visual, auditory, tactile — the WCAG **Conformance** level it meets if any, the **Accessibility features** it includes (a table of contents, a clear reading order, alternative text for images, and many more), and any **Hazards** to flag, like flashing, sound, or motion. A short **Summary** sums it up in plain language.

It's how your book tells readers — and the catalogs that look for it — that it's accessible.

## Cover image

SEED.html makes a simple cover for you automatically — your title and author set on a coloured background. It's a **placeholder, not a cover designer**. In the _Metadata_{.ui .icon-article} view, drag **Cover background hue** to change the colour, use the **Aa** toggle for a light or dark treatment, and click _Update cover image_{.ui} to redraw it after you change the title or author.

For a cover of your own, start from the version it saves: the cover is stored both as `cover.png` (flagged as the book's cover image) and as an editable `cover.svg`. Download the SVG, design your cover in a vector editor like Inkscape, and bring it back in as the book's cover (see _The file list_, later in this chapter).

## Table of contents

Every ebook carries a table of contents — the chapter list a reading app shows so readers can jump straight to any part of the book.

You don't have to build it. Open the _Navigation_{.ui .icon-book-open} view, and as long as you leave the editor empty, SEED.html generates the contents from headings in your chapters, in reading order. For most books that's all you need, at least to begin with.

If you want more than that — custom wording, or a nested structure — write your own in the editor in the same plain text as your chapter source. A preview beside it shows how the contents will look. Empty the editor again at any time to return to the automatic list.

## The file list

Everything in your book — chapters, styles, images, the cover — is a file, and the _Manifest_{.ui .icon-list-bullets} view lists them all. Each row shows a file's path and size, and any special role it plays: you'll see the cover marked `cover-image` and the table of contents marked `nav`.

You mostly won't need this view — SEED.html keeps the list in order as you write. It's here for when you want to handle the files directly. Click a row for its details, where you can **Download** or **Delete** the file, and use _Load File_{.ui} to bring one in from your device.

This is also the way in for a custom cover: download `cover.svg`, edit it in a vector editor, then use _Load File_{.ui} to bring your finished cover back in.
