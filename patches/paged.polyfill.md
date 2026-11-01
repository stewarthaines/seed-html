# Local patch: `public/paged.polyfill.js` (Paged.js v0.4.3)

The vendored Paged.js polyfill has **four local modifications**. If you ever
re-download / upgrade `public/paged.polyfill.js`, re-apply all four (there is
also a banner comment at the top of that file pointing here).

## Patch 1: the print paper size

### The change

Exactly one occurrence of `size: letter;` in the polyfill's built-in base
stylesheet was changed:

```diff
- @page { size: letter; margin: 0; }
+ @page { size: var(--pagedjs-width) var(--pagedjs-height); margin: 0; }
```

Re-apply with:

```bash
python3 - <<'PY'
p = "public/paged.polyfill.js"
s = open(p, encoding="utf-8").read()
assert s.count("size: letter;") == 1
s = s.replace("size: letter;", "size: var(--pagedjs-width) var(--pagedjs-height);", 1)
open(p, "w", encoding="utf-8").write(s)
PY
```

### Why

Our PDF export and the in-app "Print" preview both paginate with Paged.js and let
the user choose a page size (Settings → Print → Page size; written to
`SOURCE/settings.json`, applied via `printPageCss` in `src/lib/pdf/pdf-export.ts`).

Paged.js reads the author `@page { size: … }` and folds it into its
`--pagedjs-width` / `--pagedjs-height` CSS variables, which correctly size the
on-screen `.pagedjs_page` boxes. **But v0.4.3 never propagates that size to the
actual print `@page`** — it keeps its built-in `@page { size: letter }`. So the
browser's "Save as PDF" printed onto its *default* paper (e.g. A4/Letter) with the
(e.g. A6) page sitting in the top-left corner.

This can't be fixed from outside the polyfill: Paged.js's MutationObserver strips
`size` from any author/added `@page` rule, the browser drops the `size` descriptor
from `@page` rules edited via CSSOM, and `!important` is invalid on `size`. The
only `@page { size }` that survives is the polyfill's own base rule — hence the
patch. Paged.js already sets `--pagedjs-width/height` to the chosen size, so
tying the base print `@page` size to those variables makes the printed paper match.

### Scope / caveats

- **Chromium only.** Verified in Chrome: the print dialog's paper size follows the
  chosen page size. Firefox's "Save to PDF" ignores `@page { size }` entirely and
  only offers a fixed built-in paper list (no A6), so the user picks the closest
  size there — this is why the Page-size options exclude A6
  (`PAGE_SIZE_OPTIONS` in `src/lib/navigation/views/SettingsView.svelte`).
- Verify after re-applying: open a project, Settings → Print → Page size → A5,
  click **PDF**, and confirm the print preview's paper is A5 (content fills the
  sheet rather than sitting in a corner).

## Patch 2: the hyphen at a page split

### The change

Where Paged.js splits a word across pages it appends a hyphen (`‑`, U+2011) to the text on the first page (`hyphenateAtBreak`). The patch moves that append into a new `appendHyphen(e)` method: it appends the hyphen as before and checks whether the word's last letter moved to another line. If it did, the hyphen comes off the text again and goes after it in a zero-width inline-block, `<span class="pagedjs_hyphen_hang">‑</span>`, so it hangs in the margin and takes no room on the line.

```diff
- (e.parentNode.classList.add("pagedjs_hyphen"),e.textContent+=this.settings.hyphenGlyph||"‑")}}
+ (e.parentNode.classList.add("pagedjs_hyphen"),this.appendHyphen(e))}}appendHyphen(e){…}
```

Re-apply with:

```bash
python3 - <<'PY'
p = "public/paged.polyfill.js"
s = open(p, encoding="utf-8").read()
old = '(e.parentNode.classList.add("pagedjs_hyphen"),e.textContent+=this.settings.hyphenGlyph||"‑")}}'
assert s.count(old) == 1
new = ('(e.parentNode.classList.add("pagedjs_hyphen"),this.appendHyphen(e))}}'
       'appendHyphen(e){const t=this.settings.hyphenGlyph||"‑",n=e.length,r=document.createRange(),'
       'a=()=>(r.setStart(e,n-1),r.setEnd(e,n),r.getBoundingClientRect().top),i=a();'
       'if(e.textContent+=t,Math.abs(a()-i)<1)return;e.textContent=e.textContent.slice(0,n);'
       'let o=document.createElement("span");o.className="pagedjs_hyphen_hang",'
       'o.style.cssText="display:inline-block;inline-size:0;white-space:nowrap;text-indent:0;text-align:start;hyphens:manual",'
       'o.textContent=t,e.after(o)}')
s = s.replace(old, new, 1)
open(p, "w", encoding="utf-8").write(s)
PY
```

### Why

Paged.js decides where a page ends with the browser's own line breaking, which hyphenates automatically (`hyphens: auto`). On a tight justified line Chrome fits its own hyphen where the same hyphen typed into the text doesn't fit: in Joseph Jordania's book the line "sion (Grajzel et al., 2023). Another second-order meta-analys-" is 4 px too wide once the hyphen is real text. So after the split the line rewraps, the paragraph grows by a line, and its last line lands in the clipped column off the page: it was missing from the preview, Save as PDF and the accessible PDF (six pages in that book). A hanging hyphen is the usual typographic answer for justified text, and only lines that need it get it.

The accessible PDF's measuring (`src/lib/pdf/page-description.ts`) reads the hanging hyphen as part of the word before it.

### Scope / caveats

- The check measures the word's last letter, not the hyphen: a break before U+2011 isn't allowed, so the word moves with it.
- Paged.js's `findEndToken` steps back over the span (it has no `data-ref`), so resize checks still find the text.
- Verify after re-applying: in Joseph's book, essay08's page that ends "meta-analys-" keeps that line, and the accessible-pdf card shows no warning about text off the page edge.

## Patch 3: empty margin grids

### The change

Paged.js lays each page margin out as a three-track grid sized from its boxes' `max-width` (top, bottom) or `max-height` (left, right). Its last branch, for a margin with nothing in the first two boxes, reads the third box's size without checking the third box has content; that size is then `undefined`, and Paged.js writes `1fr 0 undefined`. The browser drops it, Chrome silently and Firefox with a console warning for every margin of every page. The patch checks the third box's content flag first (`c` for the right box of a top or bottom margin, `p` for the bottom box of a left or right margin), so an empty margin gets `0 0 1fr`, which is what the dropped value left it with anyway.

Re-apply with:

```bash
python3 - <<'PY'
p = "public/paged.polyfill.js"
s = open(p, encoding="utf-8").read()
cols_old = 'else i.style["grid-template-columns"]="none"!==a&&"auto"!==a?"1fr 0 "+a:"0 0 1fr"'
cols_new = 'else i.style["grid-template-columns"]=c&&"none"!==a&&"auto"!==a?"1fr 0 "+a:"0 0 1fr"'
rows_old = '"1fr 0 1fr":"1fr 0 0":"none"!==a&&"auto"!==a?"1fr 0 "+a:"0 0 1fr"'
rows_new = '"1fr 0 1fr":"1fr 0 0":p&&"none"!==a&&"auto"!==a?"1fr 0 "+a:"0 0 1fr"'
assert s.count(cols_old) == 1 and s.count(rows_old) == 1
s = s.replace(cols_old, cols_new).replace(rows_old, rows_new)
open(p, "w", encoding="utf-8").write(s)
PY
```

### Why

Layout is unchanged; the point is the console. In Firefox a whole-book layout (the accessible PDF, the whole-book preview) logged hundreds of these warnings, which slows Firefox down while the console is open and hides real messages.

## Patch 4: where a word splits across pages, in Chrome

### The change

When a word runs past the page, `textBreak` steps through it a letter at a time and splits before the first letter the browser reports on the next page (the next column of Paged.js's page area). The patch measures from the start of the word to the end of each letter, and takes that range's last box, instead of measuring the letter alone.

```diff
- for(;!r&&(t=o.next(),e=t.value,r=t.done,e);)if(l=P(e),c=Math.floor(l.left),…
+ const g=document.createRange();for(;!r&&(t=o.next(),e=t.value,r=t.done,e);){g.setStart(i.startContainer,i.startOffset),g.setEnd(e.endContainer,e.endOffset);const f=Array.from(g.getClientRects()).filter(e=>e.width>0);if(l=f[f.length-1]||P(e),c=Math.floor(l.left),…}
```

Re-apply with:

```bash
python3 - <<'PY'
p = "public/paged.polyfill.js"
s = open(p, encoding="utf-8").read()
old = 'if(u>n||h>a){let e,t,r,o=te(i);for(;!r&&(t=o.next(),e=t.value,r=t.done,e);)if(l=P(e),c=Math.floor(l.left),m=Math.floor(l.top),c>=n||m>=a){d=e.startOffset,s=!0;break}}'
new = ('if(u>n||h>a){let e,t,r,o=te(i);const g=document.createRange();'
       'for(;!r&&(t=o.next(),e=t.value,r=t.done,e);){g.setStart(i.startContainer,i.startOffset),g.setEnd(e.endContainer,e.endOffset);'
       'const f=Array.from(g.getClientRects()).filter(e=>e.width>0);'
       'if(l=f[f.length-1]||P(e),c=Math.floor(l.left),m=Math.floor(l.top),c>=n||m>=a){d=e.startOffset,s=!0;break}}}')
assert s.count(old) == 1
open(p, "w", encoding="utf-8").write(s.replace(old, new))
PY
```

### Why

Chrome misreports the box of a single letter just after an automatic hyphenation point (the accessible PDF's measuring met the same thing). So in Chrome Paged.js split a word one or more letters after the point where Chrome had hyphenated the line, and the page showed the word broken where no hyphen belongs: in Joseph Jordania's book "mechan‑isms", "tog‑ether", "trave‑l", "indefinitel‑y", 29 splits in all, nearly every one wrong, in the preview, Save as PDF and the accessible PDF. A range from the word's start is reported correctly, a box per line. Firefox was right before and is unchanged (its 42 splits in that book are the same).

### Scope / caveats

- Each split is now where the browser hyphenated the line, so Chrome and Firefox still split some words differently: each hyphenates with its own dictionary.
- Verify after re-applying: in Joseph's book in Chrome, page 11 ends "mecha‑" and page 12 starts "nisms".
