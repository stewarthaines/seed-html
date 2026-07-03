# Go further (Advanced Mode)

Everything so far has used Basic Mode, which keeps SEED.html focused on writing. **Advanced Mode** reveals the rest — the EPUB's inner workings and the tools to shape them. It's for people comfortable with a little code and EPUB internals; you don't need any of it to make a good book.

Turn it on in _Settings_{.ui .icon-gear}, under **App Settings → General**: tick **Advanced mode**. New controls appear across the app — extra metadata, the chapter editor's script files, the text transform pipeline, and more — each covered below. Untick it to return to the simpler view; your book is the same either way.

## App Settings

App Settings apply to SEED.html itself, across every book you make. **General** holds the **Theme** (light, dark, or follow your system), the interface **Language**, and the **Advanced mode** switch you just used.

With Advanced Mode on, App Settings also lists the **Available Extensions** you can add to a project: text formats (like Djot, Markdown, or Textile) and libraries (like KaTeX for maths or highlight.js for code). Adding one makes its features available in your book — building your own is beyond this manual. A **Plugins** area sits here too, where optional features such as remote publishing are enabled.

## Project Settings

Project Settings apply to the book you have open. In Basic Mode that's just **PDF**, the page setup for _Save as PDF_ (see _Produce your book_). Advanced Mode adds a few more: **EPUB Settings** for the transform scripts that turn your text into XHTML (covered next); **Preview** for how the live preview updates; **Extensions**, the libraries and formats added to this book, each with a licence field so their attribution travels with it; and **Generators**, scripts that build parts of the book, such as a list of figures. The pipeline is worth knowing; the rest just manage what you've added.

## Metadata, revisited

In Basic Mode the Metadata view gives you forms. Advanced Mode adds a **content.opf** tab, showing the package document itself — the file inside the EPUB that records all this metadata. The forms write to it; the tab shows what they produce, for when you want to see the EPUB's package structure directly.

## The text transform pipeline (JavaScript)

SEED.html builds each page from your source in two steps, and Advanced Mode lets you see and adjust both: a **text transform** turns your source — written in the project's text format — into HTML, then a **DOM transform** reshapes that HTML into the final XHTML.

Which scripts do this is up to the project, so it isn't a fixed set. The text transform comes from the text format you chose for the book (Markdown, Djot, Textile…); the DOM transforms come from that format and from any libraries you've added. That's why the JavaScript files in the chapter editor's dropdown differ from one book to the next — each named for what it does. You can edit them per project, and set which ones run under **Project Settings → EPUB Settings**.

![The chapter editor's file dropdown in Advanced Mode, listing the chapter text, the CSS files, the transform scripts, and head.xml.](../Images/screen-advanced-file-dropdown.png){.figure .screenshot}
The CSS files, transform scripts, and head.xml shown here are this book's — yours depend on its text format and the libraries you've added.
{.caption}

These scripts and their configuration travel inside the packaged EPUB — in its SEED.zip, alongside your plain-text chapter source.

## Reading System JavaScript

The transforms above run here, while you build the book. **Reading System JavaScript** is different: it runs in the reading app, when someone reads the book. Add a script to the manifest and SEED.html marks all chapters as `scripted` in the file list, so reading apps know they carry code to run. It's how a chapter can do something interactive for the reader — within the limits each reading app places on scripting, which vary widely.

## Preview: head.xml

A finished page hides as much as it shows. Some of what makes an EPUB correct and accessible lives in the markup, not on screen — an inline language change, say, marked with `lang` and `xml:lang` so a screen reader switches pronunciation, looks no different to the eye. **head.xml** lets you see things like that while you work.

Listed in the chapter editor's dropdown as _Preview: head.xml_, it's a small file whose CSS and JavaScript are injected into the `<head>` of the preview. Put rules there to surface what's otherwise invisible: for the language example, you might tint every foreign-language span and give it a tooltip showing its language code, so you can check at a glance that each one is marked correctly. It's open-ended — a hook for any review aid of this kind.

Whatever you add shapes the preview only; it's authoring-time, never part of the exported EPUB. Turn it on per preview type under **Project Settings → Preview**.
