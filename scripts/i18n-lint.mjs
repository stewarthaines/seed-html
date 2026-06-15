/**
 * Source-level i18n lint.
 *
 * Flags user-facing strings in Svelte markup that bypass the i18n chain — bare
 * template text and literal translatable attributes (aria-*, placeholder, title,
 * alt) that aren't wrapped in `$t()`. These never reach `i18n-extract.js` (which
 * only sees `t`/`$t`/`_`/`translate` calls), so they can't be translated, and the
 * aria ones don't render as visible text so a runtime scan can't catch them either.
 *
 * Scans the same files as the extractor: src and per-plugin src. Parses each
 * component with the Svelte compiler and walks only the template fragment (script
 * and style hang off other Root fields, so they're excluded). Wrapped strings show
 * up as ExpressionTag nodes, never Text, so `{$t('…')}` is never flagged.
 *
 * Usage:
 *   node scripts/i18n-lint.mjs            # report, exit 0
 *   node scripts/i18n-lint.mjs --fail     # exit 1 if any findings (CI)
 *
 * Opt out a specific line with an `<!-- i18n-ignore -->` comment on that line or
 * the line above. Extend ALLOW_EXACT / ALLOW_REGEX for intentional literals.
 */
import { readFileSync } from 'fs';
import { parse } from 'svelte/compiler';
import { glob } from 'glob';

const GLOBS = ['src/**/*.svelte', 'plugins/*/src/**/*.svelte'];
// Demo/story components are scaffolding, not shipped UI — not localised.
const IGNORE = ['src/stories/**', '**/*.stories.svelte', '**/*.story.svelte'];

// Attributes whose literal string values are user-facing and should be localised.
const TRANSLATABLE_ATTRS = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'placeholder',
  'title',
  'alt',
]);

// Elements whose text content is intentionally non-prose (code samples, shortcuts).
const SKIP_ELEMENTS = new Set(['code', 'pre', 'kbd', 'samp', 'script', 'style']);

// Whole-string literals that are proper nouns / technical tokens, not translatable.
const ALLOW_EXACT = new Set([
  'EPUB',
  'OPF',
  'XHTML',
  'HTML',
  'CSS',
  'PDF',
  'ZIP',
  'URL',
  'ID',
  'MIME',
  'UTF-8',
  'OPDS',
  'API',
  'RGB',
  'OKLCH',
  'SEED.html',
  'SEED.zip',
  'EDITME',
  'WebDAV',
  'S3',
  'R2',
  'Dropbox',
  'Google Drive',
  'Apple Books',
  'Pocket',
  'Kobo',
  'Thorium Reader',
  'Google Play Books',
  'djot',
  'JavaScript',
  'OEBPS',
  // Storage providers + tool/file proper nouns (brand names, never translated).
  'Cloudflare R2',
  'Backblaze B2',
  'DigitalOcean Spaces',
  'Bunny Storage',
  'EpubCheck',
  'EPUBCheck',
  'content.opf',
]);
const ALLOW_REGEX = [
  /^(iPhone|iPad)\b/, // device presets (already in the catalog where shown)
  /^https?:\/\//, // URLs
  /^[\w.-]+@[\w.-]+$/, // emails
  /^(px|KB|MB|GB|TB|kbps|Hz|ms)\b/, // units (possibly with trailing punctuation)
  /^[+-]?\d+(\.\d+)?\s*s$/, // time deltas, e.g. "-1s", "+0.1s"
  /^Aa$/, // font preview sample
];

const hasLetter = s => /\p{L}/u.test(s);
const isTrivial = s => {
  const t = s.trim();
  return t.length < 2 || !hasLetter(t);
};
const isAllowed = s => {
  const t = s.trim();
  return ALLOW_EXACT.has(t) || ALLOW_REGEX.some(r => r.test(t));
};

// Readable text of a template literal: quasis joined with a placeholder marker.
const templateText = tpl => tpl.quasis.map(q => q.value.cooked ?? q.value.raw ?? '').join('{…}');

/**
 * Walk an embedded JS expression (ESTree, from an ExpressionTag in a display
 * position) and emit hardcoded display strings via `emit(start, text)`: template
 * literals containing words, and string literals used as ternary/logical branches
 * or as the bare expression. Descends only through display-transparent containers
 * (ternary / logical / paren / sequence) — never into comparisons, member access,
 * object keys, or non-translation call arguments — so it stays high-precision.
 * t/$t/_/translate calls are skipped entirely (their string is already the msgid).
 */
function walkExpr(node, emit) {
  if (!node || typeof node !== 'object') return;
  const flag = (text, start) => {
    const t = (text || '').trim();
    if (hasLetter(t) && !isTrivial(t) && !isAllowed(t)) emit(start, t);
  };
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') flag(node.value, node.start);
      return;
    case 'TemplateLiteral':
      flag(templateText(node), node.start); // the whole template is the finding
      return;
    case 'ConditionalExpression':
      walkExpr(node.consequent, emit); // skip `test` — that's logic, not display
      walkExpr(node.alternate, emit);
      return;
    case 'LogicalExpression':
      walkExpr(node.left, emit);
      walkExpr(node.right, emit);
      return;
    case 'ParenthesizedExpression':
      walkExpr(node.expression, emit);
      return;
    case 'SequenceExpression':
      node.expressions.forEach(e => walkExpr(e, emit));
      return;
    default:
      return; // CallExpression / BinaryExpression / Identifier / Member / Object — not display-transparent
  }
}

function lineColOf(src, offset) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === '\n') {
      line++;
      col = 1;
    } else col++;
  }
  return { line, col };
}

// Template sub-fragments for every block/element kind (if/each/await/key/snippet…).
function fragmentsOf(node) {
  const out = [];
  const push = f => {
    if (f && Array.isArray(f.nodes)) out.push(f);
  };
  push(node.fragment);
  push(node.consequent);
  push(node.alternate);
  push(node.body);
  push(node.fallback);
  push(node.pending);
  push(node.then);
  push(node.catch);
  if (node.type === 'Fragment' && Array.isArray(node.nodes)) out.push(node);
  return out;
}

function scanFile(file) {
  const src = readFileSync(file, 'utf8');
  // Lines bearing an opt-out marker (this line and the next are suppressed).
  const ignoreLines = new Set();
  src.split('\n').forEach((l, i) => {
    if (l.includes('i18n-ignore')) ignoreLines.add(i + 1);
  });

  let ast;
  try {
    ast = parse(src, { modern: true });
  } catch {
    return []; // unparseable component — skip rather than crash the whole run
  }

  const raw = [];
  // elemStart lets an attribute finding be silenced by a marker above the element's
  // opening tag (you can't put an HTML comment between attributes in a multi-line tag).
  const record = (start, kind, text, elemStart = start) =>
    raw.push({ start, kind, text: text.trim(), elemStart });

  const handleAttributes = node => {
    for (const attr of node.attributes || []) {
      if (attr.type !== 'Attribute' || !TRANSLATABLE_ATTRS.has(attr.name)) continue;
      const v = attr.value;
      if (v === true) continue; // boolean attribute
      const parts = Array.isArray(v) ? v : [v];
      // Literal text parts → a hardcoded literal attribute.
      const textParts = parts.filter(p => p && p.type === 'Text');
      const literal = textParts.map(p => p.data).join('');
      if (textParts.length && !isTrivial(literal) && !isAllowed(literal)) {
        record(attr.start, `attr:${attr.name}`, literal, node.start);
      }
      // Expression parts → hardcoded display strings inside `={...}`.
      for (const et of parts) {
        if (et && et.type === 'ExpressionTag') {
          walkExpr(et.expression, (start, text) =>
            record(start, `attr-expr:${attr.name}`, text, node.start)
          );
        }
      }
    }
  };

  const walk = (node, parentName) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Text') {
      if (SKIP_ELEMENTS.has(parentName)) return;
      if (isTrivial(node.data) || isAllowed(node.data)) return;
      record(node.start, 'text', node.data);
      return;
    }
    if (node.type === 'ExpressionTag') {
      // Visible `{...}` text — flag hardcoded display strings inside it.
      if (!SKIP_ELEMENTS.has(parentName)) {
        walkExpr(node.expression, (start, text) => record(start, 'expr', text));
      }
      return;
    }
    let nextParent = parentName;
    if (Array.isArray(node.attributes)) {
      handleAttributes(node);
      nextParent = node.name || parentName;
    }
    for (const fr of fragmentsOf(node)) for (const child of fr.nodes) walk(child, nextParent);
  };

  walk(ast.fragment, '');

  const ignored = f =>
    ignoreLines.has(f.line) || ignoreLines.has(f.line - 1) || ignoreLines.has(f.elemLine - 1);
  return raw
    .map(f => {
      const { line, col } = lineColOf(src, f.start);
      const elemLine = lineColOf(src, f.elemStart).line;
      return { file, line, col, elemLine, kind: f.kind, text: f.text };
    })
    .filter(f => !ignored(f))
    .sort((a, b) => a.line - b.line || a.col - b.col);
}

// --- run -------------------------------------------------------------------
const failMode = process.argv.includes('--fail');
const files = (await glob(GLOBS, { nodir: true, ignore: IGNORE })).sort();

let total = 0;
const byKind = {};
for (const file of files) {
  const findings = scanFile(file);
  if (!findings.length) continue;
  console.log(`\n${file}`);
  for (const f of findings) {
    total++;
    byKind[f.kind] = (byKind[f.kind] || 0) + 1;
    const label = f.kind === 'text' ? 'text' : f.kind;
    console.log(`  ${f.line}:${f.col}  ${label}  "${f.text}"`);
  }
}

console.log(
  `\n${total} untranslated literal${total === 1 ? '' : 's'} across ${files.length} files scanned.`
);
const kinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]);
if (kinds.length) console.log(kinds.map(([k, n]) => `  ${k}: ${n}`).join('\n'));

if (failMode && total > 0) process.exit(1);
