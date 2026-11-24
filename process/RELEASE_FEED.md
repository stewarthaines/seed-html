# Release feed

Status: designed 2026-11-24, revised 2026-11-25 after an adversarial review, built 2026-11-25 on branch `release-feed` (`docs/site/lib/release-feed.js`, tests beside it).

## Goal

Announce SEED.html releases to outside readers through an Atom feed hosted at readitinabook.com, so anyone with a feed reader can subscribe and see each release's notes. The feed is for outside readers only for now: the app does not read it, and there is no in-app "What's new".

## Source

`CHANGELOG.md` is the only source. It already follows Keep a Changelog: one dated section per version, with lists under subheadings written in product language. Each version section becomes one feed entry, so writing the changelog is the only work a release needs.

## Generated in the docs build

The feed is an Eleventy template in the docs site (`docs/site/`) with permalink `/releases.xml`. It reads `CHANGELOG.md` and renders the whole feed on every docs build. Nothing is appended by hand and the feed keeps no state of its own, so it cannot drift from the changelog or gain a duplicate entry when a release is redone.

Why the docs build and not a standalone script: `vite build` empties `dist/`, and `npm run deploy` runs only `build:docs` then wrangler. The docs build is the one step that runs after the app build in every path that ships: `deploy`, the preview recipe in `docs/DEPLOYMENT.md`, `validate` (through `check:docs`) and `metrics`. A script chained into `build:plugins` or `build` would be skipped by some of those, and a deploy without it would serve no feed.

The docs site already loads markdown-it (`docs/site/lib/markdown.js`), so the template reuses it for the entry content. No new dependency: the content goes into `<content type="html">` as escaped text through a small escape function. The app's own transform is not used: it turns on raw HTML, typographer and attribute braces and adds SEED's `:clip[]` and symbol plugins, and raw HTML would turn the changelog's `` `SEED.html?book=<url>` `` into a tag. The feed uses `plainMarkdown`, a bare markdown-it from the same vendored bundle, which escapes raw HTML.

## Shape

Atom rather than RSS: every reader handles both, and Atom's required id and updated date for each entry stop readers showing old entries as new.

- Path: `https://readitinabook.com/releases.xml`.
- Entries: the newest 8 version sections, in changelog order; `[Unreleased]` is always left out.
- Entry title: "SEED.html 0.30.0".
- Entry updated: the section's date at midnight UTC, e.g. `2026-11-19T00:00:00Z`. Two releases on the same day (0.17.0 and 0.18.0 both 2026-08-03) tie; changelog order decides how they are listed.
- Entry id: `tag:readitinabook.com,2026:seed-html/0.30.0`. The `2026` is a constant, the year the scheme was set, not the release year. Once published an id never changes, so a re-cut release updates its entry rather than adding another.
- Entry link: the changelog on GitHub, https://github.com/stewarthaines/seed-html/blob/main/CHANGELOG.md. It is a convenience, since each entry carries the full notes. The plain file link is the default: GitHub's heading anchors follow its own slug rules, and tag URLs would 404 until the mirror catches up.
- Content: each subheading of the section (Added, Changed, Fixed, Removed, or any other) with its list rendered to HTML. Nested lists are kept; empty subheadings are dropped.
- Feed-level: title "SEED.html releases", a link to readitinabook.com, author, updated set to the newest entry's.

Autodiscovery: `<link rel="alternate" type="application/atom+xml" title="SEED.html releases" href="https://readitinabook.com/releases.xml">` in the `<head>` of the app's `index.html` (served as `/SEED.html` by `functions/SEED.html.ts`) and of the docs shell (`docs/site/lib/shell.js`). The href is absolute because `index.html` also travels in the npm package and inside packaged EPUBs, where the link is inert but harmless.

## Failure fails the build

A broken feed should stop a deploy, not ship silently. The template throws, failing the docs build and so `deploy` and `validate`, when:

- a `## ` heading is neither `[Unreleased]` nor `[x.y.z] - YYYY-MM-DD`;
- a section included in the feed has no list items;
- the newest dated version differs from the `package.json` version.

The last check means that at release time the changelog section must be cut when the version is bumped, which the changelog's own maintenance note already asks for.

A unit test runs the parsing against the real `CHANGELOG.md` and checks the output is well-formed XML with 8 entries and unique ids.

## Release order

The GitHub repository is an automated mirror of Codeberg. Push to Codeberg before deploying, so that by the time a subscriber clicks a new entry the mirrored changelog has it. The mirror's lag is small, and the entry carries the full notes anyway.

## Where it is shown

- Feed readers, by subscription. This is the primary use.
- blog.stewarthaines.com: a short "Recent releases" list rendered by Eleventy at build time from the live feed. It is only as fresh as the last blog deploy, which is acceptable because bigger releases get a post that triggers a deploy anyway. A list fetched in the visitor's browser would need an `Access-Control-Allow-Origin` header for the feed (a `public/_headers` file on Cloudflare Pages, which does not exist yet); not planned.
- Possible later, each needing no change to the feed: a "Latest: 0.30.0" line on the readitinabook.com landing page, posting new entries to Mastodon or Bluesky from the deploy, and feed-to-email for people without a reader.

## Out of scope for now

- An in-app "What's new" in SEED.html. If it is ever wanted, the feed's separate subheadings and clean version ids already let the app read it.
- READ.html releases. It keeps its own changelog and would get its own feed on its own host; whether to combine the two is undecided.

## Related

SEED.html already handles Atom: book catalogs are OPDS feeds (`src/lib/opds/`, and the 2026-11-03 catalog entry in `DECISIONS.md`). The release feed shares only the format with them and none of their code paths.

## Settled

- 2026-11-24: path `/releases.xml`; entry link to the GitHub `CHANGELOG.md`.
- 2026-11-25: generated by an Eleventy template in the docs build; a malformed changelog fails the build; dates at midnight UTC; 8 versions; autodiscovery in the app's `index.html` and the docs shell; push to Codeberg before deploying, GitHub mirrors it.
