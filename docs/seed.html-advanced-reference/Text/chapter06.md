# Reading System JavaScript

The scripts of the last chapters run while you build a book. **Reading System JavaScript** runs at the other end — inside the reading app, when someone opens the book. It's the read-time half of the split first drawn in _Before you begin_.

There's no special slot for it. A reading-system script is a plain `.js` file added to the **manifest** — _Load File_{.ui} in the _Manifest_{.ui .icon-list-bullets} view, the same way you'd add a stylesheet. Every script in the manifest is included in each chapter's head, so it loads and runs in the reader. Add one and SEED.html marks every chapter with the EPUB `scripted` property — the flag that tells a reading system the content executes code; remove the last script and the flag clears. This is manifest JavaScript, shipped inside the book — not the build-time transform and generator scripts of the earlier chapters, which live in `SOURCE/` and never reach a reader.

## What actually runs

Scripting support across reading systems is hugely varied; an effect you want may run in only one or two of them. Before leaning on a script, decide which reading systems the book genuinely has to work in, and test it in each — and test it *there*, because what runs in a modern browser's preview pane says almost nothing about what a given reading system will do with it.

The trend, though, is encouraging. Through 2026, EPUB 3 reading systems are increasingly leaning on the WebKit already present on their platform — iOS, Android, desktop — rather than a bespoke engine. So a reader increasingly tracks the browser on the same device, and the gap between "works in a browser" and "works in a reader" is narrowing — slowly, and unevenly. Treat any script as enhancement: write the book to work without it, and let it enhance where it can.

## A worked example: responsive width

Reflowable text already adapts to the reader's window; responsive *design* goes further, changing the layout itself at different widths. On the web you'd reach for **container queries**, and they work in a book too — give the content a container context and express the breakpoints in `em`, so a chapter responds to its own measure rather than the device:

```css
body { container-type: inline-size; }

@container (width >= 50em) {
  figure { float: inline-end; inline-size: 40%; }
}
```

No script there, and container queries are increasingly supported — on a current reader this is all you need. But "increasingly" isn't "everywhere": a reader a version or two behind may run JavaScript yet not understand `@container`. For that gap, a reading-system script can stand in: measure the text's width in `em`, set a matching class (`narrow`/`wide`/`full`) on the body for CSS to key on, and guard the whole thing with `CSS.supports('container-type: inline-size')` so it only takes over where container queries are absent — a fallback, not a rival. The working script is in _Reference_.

Three layers: container queries for readers that have them, the script for readers that don't, and, where neither runs, the plain single-column default the book was built on. That last layer is the point: reading-system scripting is worth reaching for, but only as the top of a stack that still stands when it's kicked away.
