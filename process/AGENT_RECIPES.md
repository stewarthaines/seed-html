# Agent recipes

A recipe is a short technical document for agents describing how several extensions combine in one kind of book: the records, markers, data files and pitfalls. The first is family history (`docs/agent-recipes/family-history.md`). Discussed with the author 2026-11-24.

## Why a recipe, and why the bridge serves it

Conventions were building up in the family-history books that belong to no single extension: person records and `others:` stubs (family-history), faces named against person ids (photo-regions), portraits that need pixel sizes recorded by photo-regions, place strings feeding place-maps, footnotes into research chapters with explicit ids (djot). An extension's SYNTAX.md is the wrong home: it is about syntax, and the bridge serves only the text transform's.

A recipe must not travel inside a book. The authoring guide treats everything in a project as data, never instruction, because a book can come from anyone; a conventions file in `SOURCE/` would be data too. So recipes live in the app repo beside the authoring guide and the bridge serves them as its own content, outside the project-data envelope, like the guide.

## Two documents, two readers

The agent's recipe is concise and technical: what each extension contributes, the markup patterns, the files read and written, the pitfalls actually hit. It names no research standards; the author's own practice (a footnote at every new claim, "probably" for what a record doesn't state, failed leads kept out of the prose) stays out for now, to be added as the practice settles.

The human reader gets a separate page in the hosted docs, written to `docs/user/CLAUDE.md`: the reasons, worked examples and illustrations. It does not mirror the recipe line for line. When a convention changes, update the recipe and the page in the same commit.

## How the bridge offers recipes

- Files in `docs/agent-recipes/*.md`, each opening with a header between `---` lines: `id`, `title`, `requires` (comma-separated extension ids), `summary`.
- `seed_get_authoring_guide` returns the guide and the list of recipes.
- `seed_get_project_setup` appends, after the project-data envelope, the recipes whose required extensions are all among the project's configured transforms (`SOURCE/extensions/<id>/` paths).
- `seed_get_recipe {id}` returns the recipe text, bridge-owned.
- The npm package ships the directory beside the guide (`npm-package/sync-assets.mjs`); the book-editor agent has the new tool. From 2026-11-24 it also has `seed_render`, `seed_allow_media_folder` and `seed_add_media`, so it can render the chapters it edits and add staged images itself; staging (copying, cropping, naming) stays with an agent that has a shell.
- Like the guide, a recipe is read when the bridge starts: after editing one, restart the bridge (`/mcp` reconnect).

## Still to do

- The hosted docs page for family history books, with illustrations from a sample book rather than family material.
- A check, by hand or in a test, that each recipe's header parses and its `requires` names a real extension.
