/**
 * CSS usage analyzer (see process/ICON_CSS_SIZE_REDUCTION.md).
 *
 * Reports, against the actual source tree:
 *   1. utility classes defined in src/styles/utilities/ that no component/module
 *      references,
 *   2. design tokens (custom properties) declared under src/styles/ that nothing
 *      alive references — computed as a reachability closure, since tokens
 *      reference other tokens (--status-ok: var(--green-500)), and
 *   3. per-file sizes for src/styles/.
 *
 * This is a REPORT for humans; it deletes nothing. Deletions are applied at the
 * source level and reviewed as diffs. Matching is deliberately conservative: any
 * word-boundary occurrence of a class name anywhere outside src/styles/ counts
 * as usage (catching class:directives, template-literal composition, tests), and
 * tokens count as used when referenced via var(…), style="--x: …" consumers,
 * setProperty/getPropertyValue, or from any alive token's value.
 *
 * Usage: node scripts/analyze-css-usage.js [--verbose]
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = path.join(projectRoot, 'src', 'styles');
const VERBOSE = process.argv.includes('--verbose');

async function collect(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'generated'].includes(entry.name)) continue;
      out.push(...(await collect(full, exts)));
    } else if (exts.some(e => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

const read = f => fs.readFile(f, 'utf8');
const kb = n => (n / 1024).toFixed(1) + 'KB';

// ---------- corpus ----------
const styleFiles = await collect(stylesDir, ['.css']);
const sourceFiles = (
  await collect(path.join(projectRoot, 'src'), ['.svelte', '.ts', '.js', '.css'])
).filter(f => !f.startsWith(stylesDir));
const styleTexts = new Map();
for (const f of styleFiles) styleTexts.set(path.relative(projectRoot, f), await read(f));
let sourceCorpus = '';
for (const f of sourceFiles) sourceCorpus += (await read(f)) + '\n';

// ---------- 1. utility classes ----------
const utilityFiles = [...styleTexts.keys()].filter(f => f.includes('styles/utilities/'));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const utilReport = [];
for (const file of utilityFiles) {
  const css = styleTexts.get(file);
  const classes = new Set();
  for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) classes.add(m[1]);
  const unused = [];
  const used = [];
  for (const cls of classes) {
    // Word-boundary occurrence anywhere outside src/styles counts as usage.
    const re = new RegExp(`(?<![\\w-])${escapeRe(cls)}(?![\\w-])`);
    (re.test(sourceCorpus) ? used : unused).push(cls);
  }
  utilReport.push({ file, total: classes.size, used: used.sort(), unused: unused.sort() });
}

// ---------- 2. design tokens (reachability closure) ----------
// Declarations: --name: value; anywhere under src/styles/ plus component styles.
const allStyles = [...styleTexts.values()].join('\n');
const declEdges = new Map(); // token -> Set(tokens referenced in its declared values)
const declBytes = new Map(); // token -> total bytes of its declarations (all themes)
for (const m of allStyles.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
  const [decl, name, value] = m;
  const refs = declEdges.get(name) ?? new Set();
  for (const r of value.matchAll(/var\(\s*(--[\w-]+)/g)) refs.add(r[1]);
  declEdges.set(name, refs);
  declBytes.set(name, (declBytes.get(name) ?? 0) + decl.length + 1);
}

// Root usage: var() references from everything EXCEPT token declarations in
// src/styles (component code, inline styles, JS get/setProperty consumers), plus
// var() references in src/styles that appear in NON-custom-property positions
// (e.g. `background: var(--x)` in global.css).
const styleNonDecl = allStyles.replace(/--[\w-]+\s*:\s*[^;}]+/g, '');
const rootCorpus = sourceCorpus + styleNonDecl;
const rootRefs = new Set();
for (const m of rootCorpus.matchAll(/var\(\s*(--[\w-]+)/g)) rootRefs.add(m[1]);
for (const m of sourceCorpus.matchAll(/(?:setProperty|getPropertyValue)\(\s*['"](--[\w-]+)/g))
  rootRefs.add(m[1]);

// Closure over token→token edges
const alive = new Set([...rootRefs].filter(t => declEdges.has(t)));
let grew = true;
while (grew) {
  grew = false;
  for (const t of [...alive]) {
    for (const ref of declEdges.get(t) ?? []) {
      if (declEdges.has(ref) && !alive.has(ref)) {
        alive.add(ref);
        grew = true;
      }
    }
  }
}
const deadTokens = [...declEdges.keys()].filter(t => !alive.has(t)).sort();
const deadBytes = deadTokens.reduce((a, t) => a + (declBytes.get(t) ?? 0), 0);

// ---------- 3. per-file sizes ----------
const sizes = [...styleTexts.entries()]
  .map(([f, css]) => ({ f, bytes: Buffer.byteLength(css) }))
  .sort((a, b) => b.bytes - a.bytes);

// ---------- report ----------
console.log('src/styles/ per-file sizes:');
for (const { f, bytes } of sizes) console.log(`  ${kb(bytes).padStart(8)}  ${f}`);
console.log('');
for (const r of utilReport) {
  console.log(`${r.file}: ${r.total} classes, ${r.used.length} used, ${r.unused.length} unused`);
  if (VERBOSE) {
    console.log(`  used:   ${r.used.join(' ')}`);
    console.log(`  unused: ${r.unused.join(' ')}`);
  }
}
console.log('');
console.log(
  `tokens: ${declEdges.size} declared, ${alive.size} alive, ${deadTokens.length} unreachable (~${kb(deadBytes)} of declarations incl. theme redefinitions)`
);
if (VERBOSE) {
  console.log(`  unreachable: ${deadTokens.join(' ')}`);
}
