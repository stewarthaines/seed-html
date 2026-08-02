# AudioClips — a play/stop icon as a selectable affordance

Generalise the icon style from "Letter from Kenya" into the AudioClips extension, picked per clip the way progress indicators already are.

## What each side has today

**The extension** draws two things on a clip, both presentational, both driven by the player toggling `.clip-playing` and publishing `--clip-duration`:

- a **state affordance** — `clip.css` puts `▶` before the clip via `::before`, swapping to `■` while playing. Unconditional, and gated on `[role='button']`, which `clip-player.js` adds at init. No script, no affordance: a script-less reading system shows dotted-underlined text and nothing that looks pressable.
- a **progress indicator** — `transformClipProgress.js` injects an inline SVG chosen by `data-progress` (`ring` | `bar` | `wave`, default `ring`, anything else including `none` → nothing).

**The Kenya project** has one affordance and no progress: `<span class="icon">` with `background: url('../Images/play.svg')`, swapped to `stop.svg` under `.playing`. Its clips carry no label text — the icon _is_ the clip.

So the extension already has a play/stop toggle. What Kenya has that the extension lacks is that the toggle is a **graphic** rather than a text character.

## The design decision: a second axis, not a fourth `data-progress` value

The tempting move is `data-progress="icon"`. It is wrong, for a reason the existing CSS makes concrete: the `▶` is not progress, it is state, and it renders **unconditionally**. Adding an icon under `data-progress` would either double the affordance (`▶ ■icon`) or require a `data-progress` value to reach across and suppress a rule that has nothing to do with progress.

They are orthogonal, and usefully so:

|                                  | `data-progress=none` | `ring` / `bar` / `wave` |
| -------------------------------- | -------------------- | ----------------------- |
| `data-affordance=text` (default) | today's minimum      | today's default         |
| `data-affordance=icon`           | **Kenya's style**    | icon + progress bar     |
| `data-affordance=none`           | bare clickable text  | waveform only           |

So: add `data-affordance` with `text` (default) | `icon` | `none`, leaving `data-progress` untouched.

## What the extension version improves on Kenya's

Worth stating, because these are the reasons to generalise rather than copy:

- **Inline SVG with `fill="currentColor"`** instead of a CSS `background-image`. Kenya cannot colour a background SVG, so `page.css` carries `filter: invert(48%) sepia(61%) saturate(835%) hue-rotate(173deg) …` to tint it. That hack disappears — the icon inherits text colour, and therefore the reader's theme.
- **No assets to register.** Kenya's icon needs `Images/play.svg` and `Images/stop.svg` in the manifest and resolvable at `../Images/`. Inline SVG needs neither, matching how ring/bar/wave already work.
- **No false affordance without JavaScript.** Kenya's icon paints whether or not the script runs, so a script-less reading system shows a play button that does nothing. The extension's icon inherits the `[role='button']` gate.
- **Logical properties**, so the icon sits correctly in RTL.

## Changes

### `transformClipProgress.js`

Add an `ICON` template and inject it as the clip's **first** child (the `▶` leads today, so the icon should too; the progress SVG keeps trailing). One SVG holding both glyphs, CSS decides which shows:

```svg
<svg xmlns="http://www.w3.org/2000/svg" class="clip-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
  <polygon class="clip-icon-play" points="6,4 16,10 6,16" fill="currentColor"/>
  <rect class="clip-icon-stop" x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor"/>
</svg>
```

Same guards as the progress pass: idempotent (skip when `svg.clip-icon` is already present), parse-error tolerant, unknown value → nothing.

`pointer-events` is not needed — `clip-player.js` binds its click handler to the span itself (`span.addEventListener('click', …)`), not by inspecting `event.target`, so a child can never steal the click. Kenya's `pointer-events: none` was guarding against its own handler, which does read `event.target`.

### `clip.css`

Suppress the text affordance when the icon is chosen — **as two separate rules, not a selector list**. One invalid selector invalidates an entire list, so pairing `[data-affordance='text']` with `:not([data-affordance])` in one rule would take the default down with it on any parser that chokes on `:not()`:

```css
.clip[role='button'][data-affordance='text']::before {
  content: '\25B6\00A0';
  font-size: 0.8em;
}
.clip[role='button']:not([data-affordance])::before {
  content: '\25B6\00A0';
  font-size: 0.8em;
}
```

…and the matching `.clip-playing` pair for `■`. If an old reader drops the `:not()` rule, an untagged clip simply loses its `▶` and stays a working, dotted-underlined, clickable clip — acceptable degradation, per the layer-1 rule in the authoring guide.

Then the icon itself: `1.1em` square, `vertical-align: -0.15em`, `margin-inline-end: 0.25em`, `.clip-icon-stop { display: none }`, and under `.clip-playing` the two swap.

### `extension.json`

The description names `data-progress`; it should name both axes. No change to `assets` or `scripts` — the icon ships inside the transform, not as a file.

## Adopting it in Kenya

**This depends on the djot migration, and cannot precede it.** Kenya's bespoke `clipPlugin` builds a fixed attribute list (`class`, `data-src`, `data-begin`, `data-end`) and silently drops anything else, so `data-affordance` written in a source would never reach the span. Djot's `clipFilter` spreads `...rest`, so arbitrary attributes pass through — which is what makes per-clip options work at all.

Once on djot, two steps:

1. Set the project's audio clip template (Project Settings → EPUB) to carry the attributes, so every newly inserted clip gets them:
   `:clip[<label>]{src="<href>" begin="<begin>" end="<end>" data-affordance="icon" data-progress="none"}`
2. The 17 existing clips in `side1_1` (and the rest of the book) pick the attributes up during the markdown → djot conversion — the same pass that quotes the values and moves `../Audio/` into `src`.

Then `page.css` loses `.clip .icon`, the `filter` hack, and the `play.svg` / `stop.svg` manifest entries, and `clip.css` owns the appearance.

## Verification

Nothing under `extensions/` has unit tests — these are shipped assets, not lib modules — so this is manual, consistent with the rest of the directory:

- a clip with `data-affordance="icon" data-progress="none"` shows the triangle, swaps to the square while playing, and returns on stop
- an untagged clip is **unchanged**: `▶`, ring indicator, same as before the change
- `data-affordance="none"` leaves clickable text with no glyph
- scripting disabled → no icon, no `▶`, clip reads as plain text
- the icon follows text colour in both light and dark reader themes (the point of `currentColor`)
- re-running the pipeline twice injects nothing twice

## Open item

The icon geometry above is drawn to match the ring's `20×20` viewBox, not traced from Kenya's `play.svg` / `stop.svg` — those live in OPFS and need the bridge connected to read. If the exact silhouette matters, reconnect and I will match the paths before this ships.
