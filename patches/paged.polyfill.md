# Local patch: `public/paged.polyfill.js` (Paged.js v0.4.3)

The vendored Paged.js polyfill has **two local modifications**. If you ever
re-download / upgrade `public/paged.polyfill.js`, re-apply both (there is
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
