# Letter from Kenya — migration to the Responsive extension and Djot

Plan for moving `workspace-00eb6d30` ("Letter from Kenya") off its hand-rolled transform stack and onto the shipped extensions: the Responsive layout extension in place of `responsive.js`, and Djot in place of markdown-it.

**Executed.** All three phases are done: 11 chapters converted to Djot (51 clips, the `../Audio/` convention discharged), `page.css` rewritten mobile-first with all three width buckets verified against the live preview, and `transformDom.js` trimmed to `figureSetup` + `structureSetup`. Two things surfaced that this plan did not anticipate — djot renders `&mdash;`/`&hellip;` and HTML comments as literal text, and `>text` without a space is not a blockquote — both recorded under Phase 3. The AudioClips play/stop icon option (`process/AUDIOCLIPS_ICON_AFFORDANCE.md`) is queued behind it.

## Where the project is now

This is a pre-extension project. Everything it does, it does with two bespoke scripts and a vendored copy of markdown-it, and none of it is registered as an extension.

| Concern            | Today                                                                                                                                                         | Where it lives                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Text transform     | markdown-it + markdown-it-attrs, with a bespoke `clipPlugin` and unused `selectPlugin` / `neumesPlugin` / `clipPlugin_orig`                                   | `SOURCE/scripts/transformText.js`, `SOURCE/extensions/markdown-it/*` (hand-vendored, no `extension.json`) |
| Clip markup        | `clipPlugin` emits `span.clip` + inner `span.icon`, prefixing `../Audio/` onto a bare filename                                                                | `transformText.js`                                                                                        |
| Clip plumbing      | `clipSetup` adds one static `<audio>` per distinct src; `clipProgress` (disabled)                                                                             | `SOURCE/scripts/transformDom.js`                                                                          |
| Clip playback      | bespoke player, `.playing` class toggling, seek-on-click                                                                                                      | `OEBPS/Scripts/audio-player.js`                                                                           |
| Responsive layout  | `responsive.js` measures the column on `load`/`resize` and stamps `narrow` / `wide` / `full` on `<body>`; ~10 rule blocks in `page.css` key off those classes | `OEBPS/Scripts/responsive.js`, `OEBPS/Styles/page.css`                                                    |
| Figures            | `img.figure` → `<figure>` + `<figcaption>` + hidden `aside` description                                                                                       | `transformDom.js` (`figureSetup`)                                                                         |
| Clip/quote pairing | `p:has(.clip) + blockquote` → `div.container`                                                                                                                 | `transformDom.js` (`structureSetup`)                                                                      |

`settings.json` is the legacy shape — `text_transform: "transformText.js"`, `dom_transforms: ["transformDom.js"]` — where a bare name resolves to `SOURCE/scripts/<name>` and a value starting with `SOURCE/` is used as-is (`resolveTransformPath`, `src/lib/settings/dom-transforms.ts:24`). That is how extension transforms get selected.

Every stylesheet and script in the OPF manifest is linked into every chapter head automatically (`generateXHTMLDocument`, `src/lib/transform/xhtml-template.ts:27`). So installing an extension with assets is enough to get its CSS and JS into the chapters, and removing the old scripts means removing them from the manifest, not just deleting files.

## Where it should end up

| Concern                     | After                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text transform              | `SOURCE/extensions/djot/transformDjot.js`                                                                                                         |
| Clip markup                 | Djot's `clipFilter` — `span.clip` with `data-src` / `data-begin` / `data-end`, no inner icon span                                                 |
| Clip plumbing + playback    | AudioClips extension: `transformClipProgress.js`, `Scripts/clip-player.js`, `Styles/clip.css`                                                     |
| Responsive layout           | Responsive extension: `transformResponsive.js` wraps content in `.sr-page` and each figure in `.sr-figure`; all policy in `Styles/responsive.css` |
| Figures, clip/quote pairing | unchanged, still `transformDom.js`                                                                                                                |

`transformDom.js` survives, trimmed to `figureSetup` + `structureSetup`.

### The third migration, and why it is not optional

The user asked for two changes; there are three. Djot's clip filter emits a bare `span.clip` — the inner `span.icon` that `page.css` styles with `play.svg` / `stop.svg` is a `clipPlugin` invention and disappears with markdown-it. `audio-player.js` itself would keep working (with no inner span, a click lands on `.clip` directly), but the play control would become invisible.

So the choice is: adopt AudioClips, or hand-patch a replacement icon into the new markup. AudioClips is the same thing done properly — it supplies the static `<audio>` element (which `clipSetup` currently hand-rolls for the same iOS Books reason), three progress indicator styles, and a player that is a strict superset of `audio-player.js`.

This also discharges the per-project follow-on recorded when the clip `../`-convention landed: the directive must carry the full `../Audio/…` path rather than relying on `clipPlugin` to prepend it.

## What the bridge can and cannot do

`seed_write_file` is **modify-in-place only** (`process/AGENT_BRIDGE.md`): it overwrites an existing, non-generated file, and creating files is excluded entirely because a new manifest item is an OPF mutation rather than a file write. OPF and settings are excluded outright. Every write carries the hash from the prior read and prompts for consent.

**Over the bridge (me):**

- rewrite all 11 `SOURCE/text/*.txt` sources
- rewrite `SOURCE/scripts/transformDom.js`
- rewrite `OEBPS/Styles/page.css`
- read any file, capture the generated `OEBPS/Text/*.xhtml` before and after as a diff baseline, measure the live preview, run the checks

**In the app (you):**

- install the Responsive, AudioClips and Djot extensions — this is what creates `SOURCE/extensions/<id>/*`, copies assets to `OEBPS/Styles/` and `OEBPS/Scripts/`, and registers them in the manifest
- set `text_transform` and the `dom_transforms` list and order in Project Settings
- set the audio clip insertion template (Project Settings → EPUB) to the Djot form: `:clip[<label>]{src="<href>" begin="<begin>" end="<end>"}`
- remove `Scripts/responsive.js` and `Scripts/audio-player.js` from the manifest, and delete the orphaned `SOURCE/scripts/transformText.js` and `SOURCE/extensions/markdown-it/`
- export a packaged EPUB before we start

## Phase 0 — backup

Package and export the EPUB. The source rewrite touches every chapter and there is no undo; the exported file is the rollback.

I capture the current generated `OEBPS/Text/*.xhtml` for all 11 chapters as the structural baseline. Note that `figureSetup` mints `img-desc-${Date.now()}-${random}` ids on every run, so those attributes will differ in every diff and should be ignored (or made deterministic — a separate, optional cleanup).

## Phase 1 — Responsive extension

Independent of the other two, small, and verifiable on its own. Do it first.

1. **(you)** Install "Responsive layout".
2. **(you)** Append `SOURCE/extensions/responsive/transformResponsive.js` to `dom_transforms`, **after** `transformDom.js` — it wraps `<figure>` elements, and `figureSetup` is what creates them.
3. **(me)** Rewrite `page.css`. This has to happen in the same phase, not after: once `responsive.js` is gone nothing stamps `narrow` / `wide` / `full`, so every rule keyed to those classes silently stops matching. The rewrite is an inversion to mobile-first —

   | Today                                                             | After                                                                                    |
   | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ | ------------------------------ | -------------------------- |
   | `.narrow .container { grid-template-columns: 1fr; … }`            | becomes the unconditional `.container` rule                                              |
   | `.container { grid-template-columns: 2em 1fr; … }`                | moves inside `@media (min-width: 34em)`                                                  |
   | `.narrow .container blockquote { border: none; padding-left: 0 }` | unconditional; the bordered form moves into the width bucket                             |
   | `.narrow .clip`, `.narrow .clip .icon`                            | unconditional (and largely superseded by `clip.css` in phase 2)                          |
   | `.wide figure`, `.full figure`, `.full figure img`                | `.sr-figure` rules; the caption-beside-image case is already in `responsive.css` layer 4 |
   | `.wide                                                            | .full blockquote.hugh                                                                    | .bruce | .stewart { margin-left: 4em }` | `@media (min-width: 34em)` |
   | `.narrow figure { margin: 0 }`                                    | `responsive.css` already owns figure spacing                                             |

4. **(you)** Remove `Scripts/responsive.js` from the manifest and delete it.
5. **Verify:** `.sr-page` and `.sr-figure` exist and are measured where expected; the `.container` grid still collapses at narrow widths; no chapter regressed against the phase 0 baseline.

Expect one deliberate visual change: `responsive.css` sets `.sr-page { max-width: 36em }`, a reading measure the project does not currently impose.

## Phase 2 — AudioClips extension

1. **(you)** Install AudioClips.
2. **(you)** Add `SOURCE/extensions/audio-clips/transformClipProgress.js` to `dom_transforms`.
3. **(me)** Trim `transformDom.js` to `figureSetup` + `structureSetup`: drop `clipSetup` (AudioClips inserts the static `<audio>` itself, only when the chapter has clips and none of its own), the disabled `clipProgress`, and the dead `selectSetup` / `abcSetup` / `neumesSetup`.
4. **(me)** Drop the clip presentation from `page.css` — `.clip .icon`, `.progressBar`, `.contracting-bar`, `.playing …`, `img.play` / `img.stop` — all of which `clip.css` now owns. Keep `.container`.
5. **(you)** Remove `Scripts/audio-player.js` from the manifest and delete it.
6. **Verify:** clips play, the progress indicator animates, and `recordings.txt`'s inline `<audio controls>` is still adopted rather than duplicated.

Phase 2 can run before phase 3 while the sources are still markdown — the markdown-it `:clip` template and the Djot one differ only in quoting, and `clipPlugin` keeps emitting the markup AudioClips expects. That keeps the two risky changes apart.

## Phase 3 — Djot

1. **(you)** Install Djot; set `text_transform` to `SOURCE/extensions/djot/transformDjot.js`; set the audio clip template.
2. **(me)** Convert the 11 sources. The mechanical rules:

   | Markdown today                                     | Djot                                                                                         |
   | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
   | `**Yen**` (strong)                                 | `*Yen*`                                                                                      |
   | `*word*` / `_word_` (emphasis)                     | `_word_`                                                                                     |
   | `:clip[x]{src=Track_13.mp3 begin=1:05.5 end=2:16}` | `:clip[x]{src="../Audio/Track_13.mp3" begin="1:05.5" end="2:16"}` — values quoted, full path |
   | `{.philips}` after an image                        | unchanged; djot attributes use the same syntax                                               |
   | `{.stewart}` trailing a blockquote                 | moves to its own line **before** the block                                                   |
   | raw `<audio …>` block (html: true)                 | fenced raw block: ` ```=html ` … ` ``` `                                                     |
   | inline raw HTML                                    | `` `<em>x</em>`{=html} ``                                                                    |

   The emphasis inversion is the trap worth naming: markdown `*x*` is emphasis, djot `*x*` is strong. A blind pass would silently turn every italic into bold.

3. **Verify** per chapter against the phase 0 baseline: `<strong>` / `<em>` land on the same words, every `span.clip` keeps its three data attributes, `div.container` still forms (it depends on djot emitting `p:has(.clip) + blockquote`, which is worth confirming on the first chapter before converting the other ten), and `blockquote` classes survive.

One thing to watch: markdown-it ran with `typographer: true`. Djot has its own smart punctuation, and the two do not agree in every case (ellipses and dashes especially). If the sources contain literal curly characters already, this is moot; if they lean on the typographer, expect small differences in the rendered text.

## Verification strategy

The generated `OEBPS/Text/*.xhtml` files are readable over the bridge, so the whole book can be diffed structurally at each phase boundary without opening chapters in the app. `seed_get_checks` covers a11y and the last epubcheck run; `seed_inspect_elements` covers anything that only shows up in layout. Ignore the `img-desc-*` ids.

## Open items

- Whether to adopt AudioClips (phase 2) or keep the bespoke player and hand-patch an icon into the new markup.
- Whether to make `figureSetup`'s description ids deterministic, so future diffs are clean. Optional, and out of scope unless wanted.
- The unused `.clipping` float rules in `page.css` appear in no chapter; candidates for deletion during the phase 1 rewrite.
