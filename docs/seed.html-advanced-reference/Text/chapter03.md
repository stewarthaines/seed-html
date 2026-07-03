# Extensions

An extension is, at heart, a **library plus the wiring that puts it to use**. The app can install that bundle in a single click, but the parts are worth seeing first — so this chapter does it by hand, then shows the shortcut.

Adding a javascript global and code that calls it is two moves. First, make the library available: in _Settings_{.ui .icon-gear}, under **Project Settings → Extensions**, upload its JavaScript file — it loads into the build sandbox as a global, exactly like those built-in libraries. Second, call it: a new project ships with a single `transformText.js` and a single `transformDom.js`, and you open either from the chapter editor's file dropdown to wire the global into the pipeline.

That's the whole mechanism. The two examples below show it — first for a text format, then for a library that also needs a stylesheet.

## A text format: Textile

Textile is a lightweight markup syntax with a small JavaScript implementation. To write your book in it instead of the default format, upload `textile.js` on the **Extensions** tab; it exposes a `textile(input)` global. Then open `transformText.js` from the chapter editor's dropdown and hand your source to it:

```js
function transformText(text, idref) {
  return textile(text);
}
```

The project now renders Textile. A project has just one text transform, and `transformText.js` is it — so editing that script is all the wiring a format needs.

## A library with a stylesheet: highlight.js

Syntax highlighting takes more than a script. Upload `highlight.js` on the **Extensions** tab — it provides an `hljs` global — then add its theme stylesheet through _Load File_{.ui} in the _Manifest_{.ui .icon-list-bullets} view. Every JavaScript and CSS file in the manifest is included in each chapter's head automatically, so the theme applies with no further linking.

Then wire the library into `transformDom.js` from the chapter editor's dropdown:

```js
function transformDOM(htmlDocument, idref) {
  htmlDocument.querySelectorAll('pre code').forEach(el => {
    hljs.highlightElement(el);
  });
}
```

Now every code block comes out highlighted, coloured by the theme you added. That's a library, a stylesheet, and a transform to join them — three pieces for one feature. Doing it by hand is instructive, but fiddly and easy to get subtly wrong. For the content types SEED.html already supports, there's a faster way.

## The one-click version

You won't usually do any of that by hand. The content types SEED.html already supports — Markdown, Djot, and Textile as formats; syntax highlighting; maths; music notation — come packaged as **Extensions**. In **App Settings → Available Extensions**, pick one and add it to your project, and SEED.html does the upload and wiring for you: it loads the library, copies in any stylesheets or fonts, and sets up the transform. Adding the highlighting extension gives you exactly what the section above built — the library, its theme, and a DOM transform — in a single step. Each extension you've added is listed under **Project Settings → Extensions** with its licence, so attribution travels with the book.

## Under the hood

Behind the one click is a small manifest the app reads — an `extension.json` that names the parts. The highlighting extension's is just:

```json
{
  "id": "highlight",
  "name": "highlight.js",
  "license": "LICENSE.txt",
  "scripts": ["highlight.min.js"],
  "domTransforms": ["transformHighlight.js"],
  "assets": [{ "file": "themes/default.css", "target": "Styles/highlight.css" }]
}
```

Read top to bottom, that's the by-hand recipe: load `highlight.min.js` as a global, run `transformHighlight.js` over the DOM, and copy a theme into the book's styles — plus the licence to carry along. Installing the extension simply does what the manifest declares.

These manifests are part of the app, not something you write — the by-hand route is your equivalent. But an extension can declare one more thing: **generators**, scripts that build content from the whole book, like the shipped List of Figures. That's the next chapter.
