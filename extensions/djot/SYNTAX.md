# Djot: where your Markdown priors are wrong

Djot looks like Markdown and is not. Every item below is a real divergence from CommonMark; when editing source text in this project, check this list before trusting instinct. (Full spec: https://djot.net — this is the failure-mode list, not the spec.)

- **A nested list requires a blank line after its parent item's text.** Without it, `- inner` is plain text inside the parent item — the sublist silently collapses:

  ```
  - outer          |  - outer
    - inner        |
  (collapsed!)     |    - inner    (nested correctly)
  ```

- **Emphasis roles are swapped**: `*text*` is **strong**, `_text_` is _emphasis_. There is no `**strong**` doubling.
- **Tight vs loose lists change the DOM**: items separated by blank lines render `<p>`-wrapped content; tight items render bare text nodes. Transforms and CSS in a project may depend on one shape — check the rendered output, don't assume.
- **Block attributes go on their own line, before the block**: `{.events}` above a list classes the list. An attribute line before a `::: name` div fence merges with the fence's class. The fence itself takes exactly one bare class word — `::: a b` is not two classes.
- **Inline attributes attach after the element**: `![alt](img.jpg){.figure width=240}`, `[span text]{.cls lang=ka}`.
- **Hard line break is a backslash** at end of line (not two trailing spaces).
- **Non-breaking space is a backslash** with a trailing space.
- **Headings need a preceding blank line**, and there are no Setext (underlined) headings.
- **Continuation blocks in a list item** (a second paragraph, a code block) must be indented to the item's content column after a blank line. A bare unindented line directly under an item joins its paragraph — fine for prose, but it will not start a new block.
- **Comments exist**: `{% like this %}` — removed from output.
- **Smart punctuation is on by default**: quotes and dashes are transformed; use `\"` to force a literal.
- **Raw output escape**: `` `<video …></video>`{=html} `` passes HTML through verbatim — this is how the project's video template works.
