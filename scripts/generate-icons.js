/**
 * Icon subset generator (see process/ICON_CSS_SIZE_REDUCTION.md).
 *
 * Scans app + plugin sources for `import { … } from 'phosphor-svelte'` and the
 * icon weights each file uses, then emits single-purpose components carrying
 * ONLY those icons in ONLY those weights into src/lib/icons/generated/. The
 * `phosphor-svelte` module specifier is aliased to that directory (vite,
 * vitest, tsconfig), so authoring code keeps importing from 'phosphor-svelte'
 * while shipped bytes drop from six weights per icon to what is actually used.
 *
 * Path data is read from the INSTALLED phosphor-svelte package, so the subset
 * can never skew from the version in the lockfile; upgrades are handled by
 * re-running this script.
 *
 * Usage:
 *   node scripts/generate-icons.js          regenerate src/lib/icons/generated/
 *   node scripts/generate-icons.js --check  fail if the generated set is out of
 *                                           date with source imports (wired into
 *                                           `npm run check`)
 *
 * Weight detection covers literal `weight="fill"` attributes and dynamic
 * `weight={…}` expressions (every quoted weight keyword inside the braces
 * counts — catches `weight={active ? 'fill' : 'regular'}`). A weight expression
 * with NO recognizable keyword must be annotated on the line above:
 *   <!-- icons-weights: fill,regular -->   (or // icons-weights: … in scripts)
 * The generator refuses to guess.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phosphorLib = path.join(projectRoot, 'node_modules', 'phosphor-svelte', 'lib');
const outDir = path.join(projectRoot, 'src', 'lib', 'icons', 'generated');
const CHECK = process.argv.includes('--check');

const WEIGHTS = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];
const WEIGHT_KEYWORD = new RegExp(`['"](${WEIGHTS.join('|')})['"]`, 'g');

/** Recursively collect source files under a directory */
async function collectSources(dir) {
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
      out.push(...(await collectSources(full)));
    } else if (/\.(svelte|ts)$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan one file: which phosphor icons it imports (value imports only) and
 * which weights it uses. Returns null when the file doesn't touch phosphor.
 */
function scanFile(relPath, content) {
  const icons = [];
  for (const m of content.matchAll(
    /import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]phosphor-svelte['"]/g
  )) {
    if (m[1]) continue; // type-only import — types are re-exported regardless
    for (let name of m[2].split(',')) {
      name = name
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (name && !name.startsWith('type ')) icons.push(name);
    }
  }
  if (icons.length === 0) return null;

  const weights = new Set();
  let pragmaSatisfied = true;
  // Literal weight attributes
  for (const m of content.matchAll(/\bweight="([a-z]+)"/g)) {
    if (WEIGHTS.includes(m[1])) weights.add(m[1]);
  }
  // Dynamic weight expressions: harvest quoted weight keywords inside the braces
  for (const m of content.matchAll(/\bweight=\{([^}]*)\}/g)) {
    const found = [...m[1].matchAll(WEIGHT_KEYWORD)].map(k => k[1]);
    found.forEach(w => weights.add(w));
    if (found.length === 0) pragmaSatisfied = false;
  }
  // Pragma escape hatch for fully dynamic expressions
  for (const m of content.matchAll(/icons-weights:\s*([a-z, ]+)/g)) {
    pragmaSatisfied = true;
    for (const w of m[1].split(',').map(s => s.trim())) {
      if (!WEIGHTS.includes(w)) {
        throw new Error(`${relPath}: unknown weight '${w}' in icons-weights pragma`);
      }
      weights.add(w);
    }
  }
  if (!pragmaSatisfied) {
    throw new Error(
      `${relPath}: a weight={…} expression has no recognizable weight literal. ` +
        `Add an icons-weights pragma comment (e.g. <!-- icons-weights: fill,regular -->).`
    );
  }

  weights.add('regular'); // phosphor's default when no weight prop is given
  return { icons, weights };
}

/** Union icon → weight set across all source files */
async function scanProject() {
  const files = [
    ...(await collectSources(path.join(projectRoot, 'src'))),
    ...(await collectSources(path.join(projectRoot, 'plugins'))),
  ];
  /** @type {Map<string, Set<string>>} */
  const iconWeights = new Map();
  for (const file of files) {
    const relPath = path.relative(projectRoot, file);
    const scanned = scanFile(relPath, await fs.readFile(file, 'utf8'));
    if (!scanned) continue;
    for (const icon of scanned.icons) {
      const set = iconWeights.get(icon) ?? new Set();
      scanned.weights.forEach(w => set.add(w));
      iconWeights.set(icon, set);
    }
  }
  return iconWeights;
}

/** Extract per-weight inner SVG markup from an installed phosphor component */
async function readIconPaths(name) {
  const file = path.join(phosphorLib, `${name}.svelte`);
  let content;
  try {
    content = await fs.readFile(file, 'utf8');
  } catch {
    throw new Error(
      `'${name}' is imported from phosphor-svelte but node_modules/phosphor-svelte/lib/${name}.svelte does not exist`
    );
  }
  /** @type {Record<string, string>} */
  const byWeight = {};
  for (const m of content.matchAll(
    /\{(?:#if|:else if) weight === "([a-z]+)"\}([\s\S]*?)(?=\s*\{:else|\s*\{\/if\})/g
  )) {
    byWeight[m[1]] = m[2].trim();
  }
  if (Object.keys(byWeight).length === 0) {
    throw new Error(`could not parse weight branches from phosphor-svelte/lib/${name}.svelte`);
  }
  return byWeight;
}

/** Render one generated component */
function renderComponent(name, weights, byWeight, phosphorVersion) {
  for (const w of weights) {
    if (!byWeight[w]) throw new Error(`phosphor-svelte '${name}' has no '${w}' weight data`);
  }
  const sorted = [...weights].sort((a, b) =>
    a === 'regular' ? 1 : b === 'regular' ? -1 : a.localeCompare(b)
  );
  // Single-weight icons never read `weight`; still destructure it (as _weight,
  // per the unused-vars convention) so it can't leak into restProps and land as
  // an attribute on the <svg>.
  const weightBinding = sorted.length === 1 ? 'weight: _weight' : 'weight';
  let body;
  if (sorted.length === 1) {
    body = `  ${byWeight[sorted[0]]}`;
  } else {
    // Non-regular weights branch explicitly; regular is the {:else} default, so
    // an unscanned weight renders as regular instead of nothing.
    const branches = sorted.slice(0, -1);
    body =
      branches
        .map((w, i) => `  {${i === 0 ? '#if' : ':else if'} weight === '${w}'}\n    ${byWeight[w]}`)
        .join('\n') + `\n  {:else}\n    ${byWeight[sorted[sorted.length - 1]]}\n  {/if}`;
  }
  return `<!--
  @generated by scripts/generate-icons.js — do not edit.
  Subset of phosphor-svelte ${phosphorVersion} '${name}' (weights: ${sorted.join(', ')}).
  Re-run \`npm run icons:generate\` after adding icons or weights.
-->
<script lang="ts">
  import type { IconComponentProps } from './types.js';

  let {
    ${weightBinding} = 'regular',
    color = 'currentColor',
    size = '1em',
    mirrored = false,
    children,
    ...restProps
  }: IconComponentProps = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  width={size}
  height={size}
  fill={color}
  transform={mirrored ? 'scale(-1, 1)' : undefined}
  viewBox="0 0 256 256"
  {...restProps}
>
  {#if children}
    {@render children()}
  {/if}
  <rect width="256" height="256" fill="none" />
${body}
</svg>
`;
}

const TYPES_TS = `/**
 * @generated by scripts/generate-icons.js — do not edit.
 * Minimal copy of phosphor-svelte's public prop types (lib/shared.d.ts) so the
 * generated components need no runtime import from the real package (the
 * 'phosphor-svelte' specifier is aliased to this directory).
 */

import type { Snippet } from 'svelte';
import type { SVGAttributes } from 'svelte/elements';

export type IconWeight = 'bold' | 'duotone' | 'fill' | 'light' | 'thin' | 'regular';

export interface IconBaseProps {
  color?: string;
  size?: number | string;
  weight?: IconWeight;
  mirrored?: boolean;
}

export interface IconComponentProps
  extends Omit<SVGAttributes<SVGSVGElement>, keyof IconBaseProps>,
    IconBaseProps {
  children?: Snippet;
}
`;

async function main() {
  const phosphorVersion = JSON.parse(
    await fs.readFile(
      path.join(projectRoot, 'node_modules', 'phosphor-svelte', 'package.json'),
      'utf8'
    )
  ).version;

  const iconWeights = await scanProject();
  const names = [...iconWeights.keys()].sort();
  if (names.length === 0) {
    throw new Error('no phosphor-svelte imports found — refusing to generate an empty icon set');
  }

  // Render everything up front so --check and generation share one code path.
  const rendered = new Map();
  for (const name of names) {
    const weights = iconWeights.get(name);
    rendered.set(
      `${name}.svelte`,
      renderComponent(name, weights, await readIconPaths(name), phosphorVersion)
    );
  }
  rendered.set('types.ts', TYPES_TS);
  rendered.set(
    'index.ts',
    `/**\n * @generated by scripts/generate-icons.js — do not edit.\n * Subset of phosphor-svelte ${phosphorVersion}: ${names.length} icon(s).\n */\n\n` +
      names.map(n => `export { default as ${n} } from './${n}.svelte';`).join('\n') +
      `\nexport type { IconComponentProps, IconBaseProps, IconWeight } from './types.js';\n`
  );

  if (CHECK) {
    const problems = [];
    for (const [file, content] of rendered) {
      let existing = null;
      try {
        existing = await fs.readFile(path.join(outDir, file), 'utf8');
      } catch {
        problems.push(`missing: ${file}`);
        continue;
      }
      if (existing !== content) problems.push(`out of date: ${file}`);
    }
    let onDisk = [];
    try {
      onDisk = await fs.readdir(outDir);
    } catch {
      // outDir missing — already reported as missing files above
    }
    for (const file of onDisk) {
      if (!rendered.has(file)) problems.push(`orphaned: ${file}`);
    }
    if (problems.length > 0) {
      console.error(`❌ icon subset out of date (${problems.length} problem(s)):`);
      for (const p of problems) console.error(`  - ${p}`);
      console.error('Run `npm run icons:generate` and commit the result.');
      process.exit(1);
    }
    console.log(`✓ icon subset up to date (${names.length} icon(s))`);
    return;
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  for (const [file, content] of rendered) {
    await fs.writeFile(path.join(outDir, file), content);
  }
  const weightSummary = names
    .map(n => `${n} [${[...iconWeights.get(n)].sort().join(',')}]`)
    .join(', ');
  console.log(`🎨 Generated ${names.length} icon(s) from phosphor-svelte ${phosphorVersion}`);
  console.log(`   ${weightSummary}`);
}

main().catch(err => {
  console.error(`❌ generate-icons: ${err.message}`);
  process.exit(1);
});
