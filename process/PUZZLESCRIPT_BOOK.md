# PuzzleScript puzzle book (prototype)

A book of playable puzzles written in PuzzleScript (https://www.puzzlescript.net/), started 2026-11-18 as a test of extension development alongside agent book authoring. The split: the `puzzlescript` extension is built in the repo with shell access (branch `puzzlescript-extension`); the author turns it on in the book's settings; the book-editor agent writes the chapters over the bridge; levels are checked solvable before hand-over.

## The extension (built 2026-11-18, bc304e5)

A `puzzlescript` code block becomes the game, played by the PuzzleScript player (increpare/PuzzleScript at e5a9c5a, MIT), with an SVG still of the first level for reading systems that run no scripts. The engine ships as text (`Misc/puzzlescript/engine.txt`) and `Scripts/puzzlescript.js` runs it only on a page with a game, after load, because the engine grabs its canvas when it runs, listens to every key, and compiles rules into `new Function` code that needs its globals. On XHTML pages the boot script makes innerHTML parse as HTML so the player's own controls build. One game per page (the player finds its elements by id). `build-engine.mjs` rebuilds the bundle from a checkout.

Tried in Chromium on a test chapter outside SEED: level won from the keyboard, touch arrows move the player, the still matches the level with scripts off. Tried inside SEED in Firefox 2026-11-18: renders, starts, fits a 600×800 fixed-layout page below the page's text, arrow keys play. Not yet tried in Apple Books.

## Open questions

1. Fixed layout or reflowable (open, 2026-11-18; the book is currently fixed layout). For fixed layout: Apple Books canvas and Pointer Events are proven on fixed-layout pages, the player is designed to fill a screen, and Bricks shows SEED's fixed-layout support. Against: prose pages do not reflow (accessibility), and fixed-layout support outside Books is uneven. Untested in reflowable: whether Books' page-turn swipe takes horizontal moves from the game. The extension handles both: the game fills the page when the transform is given a viewport, and is a box in the text otherwise.
2. Solvability check: built 2026-11-18 as `extensions/puzzlescript/check-levels.mjs <checkout> <game.txt>`, a breadth-first search with the real engine in Node (as PuzzleScript's own test runner loads it). It reports each level's fewest moves and solution, flags levels won in two moves or fewer, says when a level cannot be won or the search hit its cap, and prints compile errors. Deterministic games only.
4. Touch in the SEED preview: the browser takes the touch events, so the on-screen controls do not respond there; the arrow keys work. Not chased (author, 2026-11-18); touch belongs to the device test in Books.
3. Engine on every page: `Scripts/puzzlescript.js` is linked into every chapter (the app links every manifest script), but it does nothing without a game; the engine itself loads only on game pages.
