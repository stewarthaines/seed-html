# abc2svg blocks: where your ABC priors are wrong

Notes on the ` ```abc2svg ` fenced block as THIS extension renders it (transformABC.js + the bundled abc2svg engine). This is the failure-mode list, not a tutorial. References: the ABC standard v2.1 (https://abcnotation.com/wiki/abc:standard:v2.1), the abc2svg repository README (https://chiselapp.com/user/moinejf/repository/abc2svg/doc/trunk/README.md), and the `%%` formatting-directive documentation it points to (https://moinejf.pages-perso.free.fr/abcm2ps-doc/index.html).

## The block

````
```abc2svg
---
scales:
  narrow: 1.9
  wide: 1.15
  full: 0.69
---
T:Title
L:1/8
M:6/8
K:C
…
```
````

- The YAML frontmatter is optional. Each named scale pre-renders the whole tune as one variant; CSS displays exactly one. Only the names `narrow`, `wide`, `full` ever display — other names render invisibly. A **larger** scale means **bigger** engraving, i.e. the variant for the **narrowest** column.
- **Do not write `X:1`.** The transform prepends a directive preamble that already ends with `X:1`; a second `X:` line produces `X: inside tune - ignored`, once per variant. Start the tune at `T:`.
- Any `%%directive` you write in the block comes AFTER the preamble and overrides it — e.g. `%%vocalfont serif 13` to fight lyric crowding.

## Where errors go

abc2svg reports problems (bad ties, lyric miscounts) through `errmsg`, which this extension routes to the **preview warnings chip**, tagged `transformABC.js`, deduplicated with a ×count (one message per rendered variant is normal). The page itself stays silent: an errored `w:` line is dropped WHOLE — the music renders, the lyrics for that line simply vanish. **After any edit, check the warnings chip.**

## Lyrics (`w:` lines) — the big trap

Syllables map to notes in order. Before writing a `w:` line, count: notes in the music line, minus rests, minus tie-continuations, must be ≥ your syllable tokens, or the whole line is dropped with `Too many words in lyric line`.

- Rests (`z`, `x`) take no syllable — they are skipped.
- Tied notes take ONE syllable: only the first note of a `-` chain gets a slot; continuations get none.
- `|` in a `w:` line advances to the next BAR. Everything before the first `|` must fit in bar 1 — a long lyric run before a late `|` overflows even when the total count is fine. For continuous text, use no bars at all.
- `*` skips one note. Legal standalone (`chvents * gva`) or sandwiched mid-word (`da-*brdzan`). **Never trailing** — `na-ni-*` miscounts.
- `_` extends the previous syllable over the next note and draws the melisma sustain line (matches printed "na — o").
- A syllable ending in `-` joins the next token as one word across notes (`shvi-*li`).

## Ties vs slurs

- `-` ties EQUAL pitches only. `D3-` followed by `C3` is a `Bad tie` — discarded silently (visible in the warnings chip). For different pitches use a slur: `(D C)`.
- A tie legitimately crosses a barline or a system break to the same pitch (`C3-C3- | C3-C3`).
- A trailing tie into nothing (last note of the tune) is also a `Bad tie`.

## Voices appearing and disappearing (no clef ghosts)

- Declare **one** `%%score [1 2 3]` at the top and never change it mid-tune. Mid-tune `%%score` changes remap staves by position and abc2svg prints a spurious small courtesy clef at the end of the previous line.
- Hide a voice's staff for a system: give it a line of invisible rests (`x6 | x6 | x6 | x6 |`). Show it resting (staff printed with rests): use visible rests (`z6`).
- One music line per voice per system, same bar count, keeps systems aligned.

## Voice labels

- `name="I Soloist"` prints when the voice's staff first appears (or reappears after being hidden). `sname="I"` prints on continuation systems — **without `sname`, later systems are unlabelled.** The left margin is sized by the longest label, so abbreviate snames.

## Ornaments and decorations

`!pralltriller!`, `!trill!`, `!fermata!`, `!invertedturn!` — written immediately before the note (`e !pralltriller!d2`). xml2abc writes a bare `T` prefix for a trill; normalise it to a `!…!` decoration.

## Cleaning OCR / xml2abc output

- `[K:bass]` / `[K:treble]` mid-line are inline CLEF CHANGES. In homr/xml2abc output they are almost always staff-hopping artifacts (the OCR serialised different staves into one voice): delete them and reassign each passage to the correct voice.
- `M:none` in such output means free meter — bar-length junk (`x2` padding, `z8`, fused durations like `c12`) survived. Restore the real meter and renormalise bars.
- `[cC]` octave chords in a bass line are usually a misread of a single note.
- Always transcribe against the page image; use the OCR only as a duration scaffold.

## Lyric crowding (syllables colliding)

The one lever that works is `%%vocalfont serif <size>` in the block (smaller font both narrows syllables and slightly opens spacing). `%%maxshrink` and `y` spacers do NOT help, and a larger variant scale makes crowding WORSE (text zooms with the music while the line keeps its bars).

## Print / PDF

The extension stylesheet picks the `full` variant for print with unconditional rules — nothing to do in the block. Do not attempt print-specific tricks with container queries; Chromium print does not evaluate them.
