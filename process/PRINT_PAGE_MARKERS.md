# Print page markers as an extension

Status: proposal, 2026-10-30.

## The problem

A print page marker in an EPUB is an empty element that says "page 20 of the paperback starts here". Screen readers announce it, and a reading system can use it to go to a print page once the book has a page-list (`process/NAV_LANDMARKS_AND_PAGE_LIST.md`, section 3).

*John, Paul, and George* carries 216 of them, written by `pdf_to_djot.py` and `front_matter.py` in this form:

```
[]{#page20 epub:type="pagebreak" role="doc-pagebreak" title="20"}
```

Every marker repeats the page number three times and the same three attributes each time. That cuts against SEED.html's aim of minimal, non-repetitive source for a feature like this. It is also easy to get subtly wrong. axe 4.10 accepts `role="doc-pagebreak"` only on `<hr>`; on a `<span>` it treats the role as absent and flags `aria-label` as prohibited, so the label has to go in `title` (finding in the book's `DESIGN_NOTES.md`, section 4). An author writing markers by hand has to rediscover that.

Language switching already solved the same shape of problem: the author writes a class (`[bonjour]{.lang-fr}`) and a DOM transform writes the attributes the reading systems need.

## Proposal

A catalog extension, `print-page-markers`, with one DOM transform. The author marks a print page boundary with a `pagebreak` class on a short run whose text is the page label:

```
[20]{.pagebreak}
```

The transform replaces each `.pagebreak` element in the chapter with:

```
<span id="page20" epub:type="pagebreak" role="doc-pagebreak" title="20"></span>
```

### The label is explicit

The page label is always written in the source. The transform never counts. Three reasons, discussed 2026-10-30:

Print page numbers are facts about the print edition, not values to derive. If a marker is added or lost by mistake, counting would silently shift every later page, and the EPUB would claim page 87 is somewhere it isn't. With explicit labels a mistake stays local.

Counting across chapters would make one chapter's output depend on the others. DOM transforms run one chapter at a time; numbering chapter 5 would need the marker count of chapters 1 to 4, so an edit in one chapter could change another chapter's rendered XHTML.

Print books don't number in a straight line: roman front matter, unnumbered blanks, plates, `12a`. An explicit label handles all of these with no rules.

The label in the source also helps proofing: the number sits where the author checks it against the paperback.

### Any text format

The transform matches the class, not the element, as language switching does, so every built-in format works with its own class syntax:

- djot: `[20]{.pagebreak}`
- markdown (markdown-it + markdown-it-attrs): `*20*{.pagebreak}`
- textile: `%(pagebreak)20%`

Whatever element the format produces (`span`, `em`), the output is always an empty `span`.

### What the transform writes

`title` is the element's trimmed text content. A marker with no text is left as it is and logged with `console.warn`, as photo-regions and family-history report their problems, not given an invented label. DOM transforms have no channel into the checks panel, which stays limited to axe and epubcheck (`process/DECISIONS.md`, 2026-10-28).

`id` is the author's own id if the element has one (`[20]{.pagebreak #p20}`), otherwise `page` followed by the label, with any character not allowed in an id replaced by `-` (`page20`, `pageiv`, `page12a`). If that id is already used in the chapter, the marker is left as it is and logged, not renamed; epubcheck then reports the duplicate after packaging. Two markers with the same label in one chapter are almost always a transcription error.

`epub:type="pagebreak"` and `role="doc-pagebreak"` are written as above, and the `pagebreak` class is removed. Other classes the author put on the element are kept.

The marker stays a `span`, with the label in `title`, because markers fall inside paragraphs, often mid-sentence, where an `<hr>` is not allowed.

### Stage

`structure`: it turns authored markup into a semantic element. It runs before `derive`, so a derive-stage transform (a list, an index) sees finished markers, and before the packaging-time page-list scan in `NAV_LANDMARKS_AND_PAGE_LIST.md`, which looks for `[role="doc-pagebreak"]` elements with an id. The two features meet only through that markup; neither needs to know about the other.

### Generator

As language switching does, the extension ships a generator that inserts a sample marker in the project's text format, so the syntax can be found from inside the app.

### What it doesn't do

It does not set the `pageBreakMarkers` or `pageNavigation` accessibility features in Details. Claims stay the author's choice (`process/DECISIONS.md`, 2026-10-28).

It does not create a page-list. That is the nav proposal's job.

It does not style the marker. An empty span has no visual presence; an author who wants a visible page number in the margin can style `[role="doc-pagebreak"]` in their own stylesheet.

## John, Paul, and George

The book changes in its scripts, not by hand: `pdf_to_djot.py` and `front_matter.py` write `[20]{.pagebreak}` instead of the full form, the extension is installed, and the rebuilt EPUB's XHTML should be byte-for-byte the same markers as today. That comparison is the first test.

## Testing

Unit tests for the transform: djot, markdown and textile input; roman and alphanumeric labels; an author id kept; other classes kept; an empty marker and a duplicate id logged and left alone, not repaired.

axe and epubcheck on the rebuilt *John, Paul, and George*, expecting no new findings.

## Decided

1. A marker with no label is an error (2026-10-30). It is logged and left as it is, not given a label. EPUB allows an unlabelled pagebreak, but it can't go in a page-list, so it serves no reader of the print edition.
