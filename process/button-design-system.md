# Button design system

Buttons use a single token-based utility-class system. **Use these classes; do not add
new per-component button CSS.** This keeps buttons consistent and theme-aware across the
core app and plugins.

## Canonical classes

Compose a base + variant (+ optional size):

```html
<button class="btn btn-primary">Save</button>
<button class="btn btn-secondary btn-sm">Refresh</button>
<button class="btn btn-danger btn-sm">Delete</button>
<button class="btn btn-link">← Back</button>
<button class="btn btn-icon" aria-label="Close">✕</button>
```

| Class                 | Use                                                            |
| --------------------- | -------------------------------------------------------------- |
| `.btn`                | Required base (layout, radius, focus ring, disabled state).    |
| `.btn-primary`        | The main action in a context.                                  |
| `.btn-secondary`      | Neutral / secondary actions (default choice for most buttons). |
| `.btn-danger`         | Destructive actions (delete, remove).                          |
| `.btn-link`           | Inline text-link action (no chrome).                           |
| `.btn-icon`           | Icon-only button (✕, small inline actions).                    |
| `.btn-sm` / `.btn-lg` | Size modifiers; default (no modifier) is medium.               |

Deprecated (migrate to the above when you touch a call site): `.btn-text` → `.btn-link`,
`.btn-minimal` → `.btn-secondary`.

## Where it lives

- **Classes:** `src/styles/utilities/forms.css` (the `BUTTON STYLES` block).
- **Tokens:** `src/styles/tokens/colors.css` (`--color-button-*`), overridden per theme in
  `src/styles/themes/light.css` and `dark.css`. Buttons are theme-aware via these tokens —
  never hardcode button colors.

## Plugins (vendored copy)

Plugins build separately and **cannot import core `src/styles`**. Each plugin vendors a
small copy of the button tokens + `.btn` rules that **mirrors core's light theme**, in its
own stylesheet (e.g. `plugins/publish-to-remote/src/styles.css`). Usage is identical
(`class="btn btn-secondary"`). When the canonical spec changes, update the vendored copies
too — they're flagged with a "keep in sync with core" comment.

## Bespoke surfaces (exempt)

A few controls are intentionally _not_ standard buttons and keep their own styles —
e.g. the card-style action buttons in `WorkspaceActionBar` (icon + title + subtitle),
editor toolbar toggles (`EditorPane`), and audio transport controls (`AudioClipEditor`).
Keep these rare and clearly justified; everything that reads as a normal button should use
the `.btn` utilities.

## Migration status

The codebase is mid-migration off ~45 ad-hoc button classes. Done so far: the entire
`publish-to-remote` plugin; core `PublishView` and `ManifestPreview`. Remaining (ratcheted
follow-up, migrate opportunistically when editing the file): the metadata editors'
`.add-button`/`.remove-button` pair (`src/lib/components/metadata/*`), and the long tail of
per-component button classes. Don't add new ones.
