# Workflows

## Building instructions with Bricks

The **Bricks** extension turns a short list of parts into a page of building instructions. The reader drags a handle along the bottom of the page and the parts drop into place one at a time, with the step number and a box of the parts for each step, as in a printed instruction booklet. A page can instead show a finished model that the reader turns to see from every side.

Bricks pages need a fixed-layout book. Set _Layout_{.ui} to **pre-paginated** under _Metadata → Rendition Properties_{.ui}, and give the page size in _Viewport_{.ui}. The pages were designed at 320 × 460 and scale to any other size.

### Add Bricks to a book

With Advanced Mode on, add **Bricks** from _Available Extensions_{.ui} in App Settings. It brings a set of common parts: bricks, plates, slopes and tiles in the usual sizes. More parts come as separate extensions; **Bricks - Minifigs** adds a standing and a seated spaceman. Add the ones your book uses, and a page loads only the parts it needs.

Bricks also adds a generator. Open _Generators_{.ui} in the chapter editor, choose **Bricks Sample**, pick a building step or a turning model, and choose _Insert at cursor_{.ui}. The sample is a complete page to change.

### Write a step

A page is one code block with the language `bricks`. This is the page that builds the letter J in four plates of a name:

````
``` bricks
---
model: letter-j
color: Yellow
from: [0, 0, 9]
---
built
3032 Green 0 -3 -1 turn 90

step   # the hook
3665a 0 -2 0 turn 180
3665a 0 0 0

step   # the stem
3005 0 -2 3
3005 0 -2 6
3005 0 -2 9

step   # the top
3010 0 -3 12 turn 90
```
````

The lines between the two `---` lines are settings for the whole page. Here, every part is yellow unless its line says otherwise, every part drops from 9 plates above where it lands, and the finished letter is saved under the name `letter-j`.

Each other line is one part: its part number, an optional colour, then its position, in studs across and plates up. A brick is three plates high. `turn 90` turns a part a quarter turn. Anything after `#` is a note to yourself.

The parts under `built` are already in place when the page opens. Each `step` starts the next step; its parts arrive in the order they are written as the reader drags. The step number counts up from 1, or from the number you write after `step`.

Colours use the names from the LDraw parts library, such as `Red`, `Light_Bluish_Grey` or `Dark_Tan`, with underscores in place of spaces.

### A turning model

A page with `spin: true` in its settings shows the model finished, and dragging turns it. This is how a book shows its result at the end of a sequence of steps. Lower `scale` to fit a large model on the page: `scale: 0.5` draws it at half size.

### The look of a page

Pages are drawn on pale blue with a rounded box for the parts. Add `style: classic` to a page's settings to draw it in the manner of a 1970s instruction sheet instead: off-white paper and a square, pale yellow box for the parts.

### Reuse what you built

A page that names its model with `model:` can be placed as a single part on any other page. The name page of the book above places each letter in turn:

````
``` bricks
---
spin: true
scale: 0.5
---
3032 Green 0 -5 -1 turn 90
letter-j 0 -3 0
letter-o 0 -7 0
```
````

A model is saved when its page is shown in the preview. After changing a model, open its page once before the pages that use it, and before you package the book.

### Check your pages

A page with a problem shows a red box listing each one, with its line number: a part number that isn't installed, a colour name that doesn't exist, a line with a number missing. The rest of the page still draws, so fix every note before you publish.

### Readers without the moving page

Each page also carries a picture of itself, made while you write: the step finished, with its number and parts box. A reader whose device cannot show the moving page, such as an older iPad or iPhone, sees the picture instead. The picture's description is read aloud to readers who use a screen reader. It is composed from the part names; to write your own, add `alt:` to the page's settings.

The full notation is in the extension's `SYNTAX.md`, in the SEED.html repository.
