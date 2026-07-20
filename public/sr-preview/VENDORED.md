# Vendored: @guidepup/virtual-screen-reader

- **Upstream**: [guidepup/virtual-screen-reader](https://github.com/guidepup/virtual-screen-reader) — a screen reader simulator that walks a live DOM and reports the announcement phrases a screen reader would speak
- **Source of this snapshot**: `lib/esm/index.browser.js` from the npm package `@guidepup/virtual-screen-reader@0.32.1` (self-contained browser ESM, no runtime imports), copied verbatim as `virtual-screen-reader.js`
- **License**: MIT (Copyright (c) 2023 Craig Morten)

## What it is here for

Powers the preview pane's **Screen reader** panel: hovering a block in the preview offers an Announce button, and the library walks that element reporting phrases like `heading, level 3` or `listitem, position 3, set size 12`, shown in a caption overlay (and optionally spoken via the Web Speech API). It is lazy-loaded into the same-origin preview iframe on first use — the axe-core model — so it ships as a static asset and adds nothing to the single-file build. HTTP-only: `file://` cannot fetch it, so the panel is hidden there (`isHttpContext()`).

It is a simulator: phrasing approximates the accessibility-tree announcement, not any specific screen reader's dialect (NVDA, VoiceOver, and JAWS each word things differently). The UI should not claim otherwise.

## Upgrading

`npm pack @guidepup/virtual-screen-reader@<version>` (outside the repo), copy `package/lib/esm/index.browser.js` over `virtual-screen-reader.js`, confirm it still has no `import … from` statements (it must stay self-contained), and update the version lines above and in `src/lib/navigation/views/ThirdPartyView.svelte`. Re-verify in the app: open the Screen reader panel, announce a heading, a long list item, a table, and a figure; run a whole-chapter walk to completion; confirm `npm run validate` stays green.
