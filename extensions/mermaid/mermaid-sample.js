/**
 * Generator: insert a sample Mermaid diagram, wrapped in the plain-text block
 * syntax the project authors in, ready for transformMermaid.js to render.
 *
 * The wrapper is chosen with the `format` option:
 *   - markdown -> a fenced ```mermaid block  (=> <pre><code class="language-mermaid">)
 *   - textile  -> a `bc(mermaid).` block     (=> <pre class="mermaid"><code>)
 * Both selectors are recognised by transformMermaid.js.
 *
 * With `titled` on (the default), the sample includes Mermaid's accTitle /
 * accDescr keywords, which become the SVG's accessible name and description
 * (<title>/<desc> wired up via aria-labelledby/aria-describedby) — the
 * pattern authors should copy for real diagrams.
 *
 * A non-neutral `theme` is emitted as Mermaid YAML frontmatter (config:
 * theme:) inside the block, overriding the extension's neutral default for
 * that block alone.
 *
 * Options:
 *   format (select)  — "markdown" | "textile" block wrapper
 *   diagram (select) — "flowchart" | "sequence" | "class" | "state" | "pie" | "gantt"
 *   theme (select)   — "neutral" (extension default, no frontmatter) | "default" | "dark" | "forest"
 *   titled (boolean) — include the accTitle/accDescr accessibility keywords
 *
 * @param {object} ctx - generator context (unused here; this generator is self-contained)
 * @param {object} options - values from the invocation form, keyed by option name
 * @returns {string} source text to insert at the caret
 */
function generateText(ctx, options) {
  const opts = options || {}
  const format = opts.format === 'textile' ? 'textile' : 'markdown'
  const diagram = ['flowchart', 'sequence', 'class', 'state', 'pie', 'gantt'].includes(
    opts.diagram
  )
    ? opts.diagram
    : 'flowchart'
  const theme = ['default', 'dark', 'forest'].includes(opts.theme) ? opts.theme : 'neutral'
  const titled = opts.titled !== false

  // Each sample: the declaration line, the acc keywords (placed directly
  // after the declaration), and the body.
  const SAMPLES = {
    flowchart: {
      decl: 'flowchart TD',
      accTitle: 'Publishing decision',
      accDescr: 'A draft is reviewed, then published or returned for revision',
      body: ['  A[Draft] --> B{Review}', '  B -->|approve| C[Publish]', '  B -->|revise| A'],
    },
    sequence: {
      decl: 'sequenceDiagram',
      accTitle: 'Borrowing a book',
      accDescr: 'The reader requests a book and the library lends it',
      body: ['  Reader->>Library: Request book', '  Library-->>Reader: Lend book'],
    },
    class: {
      decl: 'classDiagram',
      accTitle: 'Publication types',
      accDescr: 'Book and Article specialise Publication',
      body: [
        '  class Publication {',
        '    +String title',
        '  }',
        '  Publication <|-- Book',
        '  Publication <|-- Article',
      ],
    },
    state: {
      decl: 'stateDiagram-v2',
      accTitle: 'Manuscript lifecycle',
      accDescr: 'A manuscript is drafted, reviewed, and published',
      body: [
        '  [*] --> Draft',
        '  Draft --> Review : submit',
        '  Review --> Draft : revise',
        '  Review --> Published : approve',
        '  Published --> [*]',
      ],
    },
    pie: {
      decl: 'pie',
      accTitle: 'Reading formats',
      accDescr: 'Share of print, ebook and audio reading',
      body: ['  title Reading formats', '  "Print" : 45', '  "Ebook" : 35', '  "Audio" : 20'],
    },
    gantt: {
      decl: 'gantt',
      accTitle: 'Production schedule',
      accDescr: 'Drafting and review lead to the publication milestone',
      body: [
        '  title Production schedule',
        '  dateFormat YYYY-MM-DD',
        '  section Writing',
        '  Draft :a1, 2026-01-05, 10d',
        '  Review :after a1, 5d',
        '  section Release',
        '  Publish :milestone, after a1, 0d',
      ],
    },
  }

  const sample = SAMPLES[diagram]

  // Non-neutral theme: Mermaid's own YAML frontmatter, parsed by the library
  // itself — no YAML dependency in the transform.
  const frontmatter = theme === 'neutral' ? [] : ['---', 'config:', `  theme: ${theme}`, '---']

  const acc = titled ? [`  accTitle: ${sample.accTitle}`, `  accDescr: ${sample.accDescr}`] : []

  const block = frontmatter.concat([sample.decl], acc, sample.body)

  if (format === 'textile') {
    // The trailing blank line closes the `bc.` block so following text isn't
    // pulled into the code listing.
    return 'bc(mermaid).\n' + block.join('\n') + '\n\n'
  }

  // Markdown fenced block. (Backticks kept out of a template literal on purpose.)
  const fence = '```'
  return fence + 'mermaid\n' + block.join('\n') + '\n' + fence + '\n'
}
