#!/usr/bin/env node
/**
 * Release metrics: runs the validate steps and the builds, timing each, then
 * appends one JSON line to metrics.jsonl and prints the change from the last
 * line. Run after the version bump and commit the line with the release, so
 * git history holds one data point per release. Same shape as read-html's
 * scripts/metrics.mjs; the steps and sizes are SEED.html's own.
 *
 *   node scripts/metrics.mjs [--out <file>] [--no-validate]
 *
 * It measures the checkout it runs in (the working directory), so it can be
 * pointed at an older release checked out elsewhere. A step the checkout's
 * package.json does not define is left out; a step that fails stops the run,
 * since its timings and counts would not be comparable. --no-validate skips
 * the validate steps (and so durations, coverage, lint and unit counts) and
 * records builds, sizes and counts only: what backfilling old tags can trust.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const outArg = process.argv.indexOf('--out');
const outFile = resolve(outArg > -1 ? process.argv[outArg + 1] : join(root, 'metrics.jsonl'));
const withValidate = !process.argv.includes('--no-validate');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};
const scratch = name => join(tmpdir(), `seed-metrics-${process.pid}-${name}`);

/** @param {string} cmd @param {string[]} args @param {{ allowFail?: boolean }} [options] */
function run(cmd, args, options = {}) {
  const started = performance.now();
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
  });
  const seconds = Math.round((performance.now() - started) / 100) / 10;
  if (result.status !== 0 && !options.allowFail) {
    process.stderr.write((result.stdout ?? '').slice(-4000) + (result.stderr ?? '').slice(-4000));
    throw new Error(`metrics: \`${cmd} ${args.join(' ')}\` failed`);
  }
  return { seconds, stdout: result.stdout, status: result.status };
}

/** @param {string} cmd */
const git = cmd => run('git', cmd.split(' ')).stdout.trim();
const round1 = n => Math.round(n * 10) / 10;

// --- validate, step by step ---------------------------------------------
// Lint and unit tests run with JSON output so one run gives both the timing
// and the counts; the arguments are appended to the checkout's own scripts,
// so its config and warning cap still apply.
const lintReport = scratch('eslint.json');
const unitReport = scratch('vitest.json');
/** @type {Record<string, number>} */
const validate = {};
/** @type {Record<string, number>} */
const lint = {};
/** @type {Record<string, number>} */
const coverage = {};
/** @type {Record<string, number>} */
const tests = {};

if (withValidate) {
  const steps = (scripts.validate ?? '')
    .split('&&')
    .map(part => part.trim().match(/^npm run (\S+)$/)?.[1])
    .filter(Boolean);
  for (const step of steps) {
    let args = ['run', step];
    if (step === 'lint') args = [...args, '--', '-f', 'json', '-o', lintReport];
    if (step === 'test:coverage') {
      args = [
        ...args,
        '--',
        '--reporter=json',
        `--outputFile=${unitReport}`,
        '--coverage.reporter=json-summary',
        `--coverage.reportsDirectory=${scratch('coverage')}`,
      ];
    }
    validate[step] = run('npm', args).seconds;
  }
  validate.total = round1(Object.values(validate).reduce((a, b) => a + b, 0));

  if (existsSync(lintReport)) {
    const results = JSON.parse(readFileSync(lintReport, 'utf8'));
    lint.warnings = results.reduce((sum, file) => sum + file.warningCount, 0);
    const cap = scripts.lint?.match(/--max-warnings[= ](\d+)/);
    if (cap) lint.cap = Number(cap[1]);
  }
  if (existsSync(unitReport)) {
    const report = JSON.parse(readFileSync(unitReport, 'utf8'));
    tests.unit = report.numTotalTests;
    tests.unitSkipped = report.numPendingTests + report.numTodoTests;
    tests.unitFiles = report.testResults.length;
  }
  const summary = join(scratch('coverage'), 'coverage-summary.json');
  if (existsSync(summary)) {
    const total = JSON.parse(readFileSync(summary, 'utf8')).total;
    for (const key of ['lines', 'statements', 'branches', 'functions'])
      coverage[key] = total[key].pct;
  }
}

// --- builds ---------------------------------------------------------------
// The docs build goes last: the app build empties dist/, docs included.
/** @type {Record<string, number>} */
const build = {};
for (const step of ['build', 'build:plugins', 'build:docs']) {
  if (scripts[step]) build[step] = run('npm', ['run', step]).seconds;
}

// --- sizes ----------------------------------------------------------------
/** @param {string} dir @returns {string[]} */
const filesUnder = dir =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]
      )
    : [];
/** @param {string[]} files */
const sizeOf = files => ({
  bytes: files.reduce((sum, file) => sum + statSync(file).size, 0),
  gzip: files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0),
});
const dist = join(root, 'dist');
/** @type {Record<string, unknown>} */
const sizes = {};
if (existsSync(join(dist, 'index.html'))) sizes.app = sizeOf([join(dist, 'index.html')]);
// Assets served beside the app (print preview, checks, reader engine, …),
// excluding what is measured on its own below.
const own = new Set(['index.html', 'docs', 'extensions', 'plugins', 'read']);
const beside = readdirSync(dist).filter(name => !own.has(name));
sizes.appAssets = sizeOf(
  beside.flatMap(name => {
    const path = join(dist, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  })
);
const extensionFiles = filesUnder(join(dist, 'extensions'));
if (extensionFiles.length > 0) sizes.extensions = sizeOf(extensionFiles);
/** @type {Record<string, { bytes: number, gzip: number }>} */
const plugins = {};
const pluginDirs = existsSync(join(dist, 'plugins'))
  ? readdirSync(join(dist, 'plugins'), { withFileTypes: true }).filter(entry => entry.isDirectory())
  : [];
for (const { name: dir } of pluginDirs) {
  const files = filesUnder(join(dist, 'plugins', dir));
  if (files.length > 0) plugins[dir] = sizeOf(files);
}
if (Object.keys(plugins).length > 0) sizes.plugins = plugins;
const docsFiles = filesUnder(join(dist, 'docs'));
if (docsFiles.length > 0)
  sizes.docs = { ...sizeOf(docsFiles), pages: docsFiles.filter(f => f.endsWith('.html')).length };

// --- test suites outside validate (listed, not run) ------------------------
for (const [name, config] of [
  ['plugins', 'vitest.config.plugins.ts'],
  ['storage', 'vitest.config.storage.ts'],
]) {
  if (!existsSync(join(root, config))) continue;
  const listFile = scratch(`list-${name}.json`);
  run('npx', ['vitest', 'list', '--config', config, `--json=${listFile}`]);
  if (existsSync(listFile)) tests[name] = JSON.parse(readFileSync(listFile, 'utf8')).length;
}
const tracked = git('ls-files').split('\n');
tests.storyFiles = tracked.filter(file => /\.stories\.(svelte|ts|js)$/.test(file)).length;

// --- translations ---------------------------------------------------------
/** Message entries of a .po/.pot file: { id, translated, fuzzy }. */
function poEntries(path) {
  return readFileSync(path, 'utf8')
    .split(/\n\s*\n/)
    .map(block => {
      const lines = block.split('\n');
      const field = name => {
        const start = lines.findIndex(line => line.startsWith(`${name} `));
        if (start === -1) return '';
        let text = lines[start]
          .slice(name.length + 1)
          .trim()
          .replace(/^"|"$/g, '');
        for (const line of lines.slice(start + 1)) {
          if (!line.startsWith('"')) break;
          text += line.trim().replace(/^"|"$/g, '');
        }
        return text;
      };
      return {
        id: field('msgid'),
        translated: (field('msgstr') || field('msgstr[0]')) !== '',
        fuzzy: lines.some(line => line.startsWith('#,') && line.includes('fuzzy')),
      };
    })
    .filter(entry => entry.id !== '');
}
/** @type {Record<string, unknown>} */
const i18n = {};
const pot = join(root, 'locales/messages.pot');
if (existsSync(pot)) i18n.messages = poEntries(pot).length;
const localeMeta = join(root, 'src/lib/i18n/locale-meta.js');
const enabled = existsSync(localeMeta)
  ? JSON.parse(
      (
        readFileSync(localeMeta, 'utf8').match(/ENABLED_LOCALES\s*=\s*(\[[^\]]*\])/)?.[1] ?? '[]'
      ).replace(/'/g, '"')
    )
  : [];
for (const locale of enabled) {
  const po = join(root, `locales/${locale}.po`);
  if (locale === 'en' || !existsSync(po)) continue;
  const entries = poEntries(po);
  i18n[locale] = {
    untranslated: entries.filter(entry => !entry.translated).length,
    fuzzy: entries.filter(entry => entry.fuzzy).length,
  };
}

// --- code and dependencies -------------------------------------------------
const srcFiles = tracked.filter(
  file =>
    file.startsWith('src/') &&
    /\.(ts|js|svelte)$/.test(file) &&
    !/\.(test|spec|stories)\./.test(file)
);
const code = {
  srcFiles: srcFiles.length,
  srcLines: srcFiles.reduce(
    (sum, file) => sum + readFileSync(join(root, file), 'utf8').split('\n').length,
    0
  ),
  extensions: tracked.filter(file => /^extensions\/[^/]+\/extension\.json$/.test(file)).length,
  plugins: Object.keys(plugins).length,
  dependencies: Object.keys(pkg.dependencies ?? {}).length,
  devDependencies: Object.keys(pkg.devDependencies ?? {}).length,
};

for (const name of ['eslint.json', 'vitest.json', 'coverage'])
  rmSync(scratch(name), { recursive: true, force: true });

const record = {
  version: pkg.version,
  // At release time the version commit does not exist yet: this is its parent.
  commit: git('rev-parse --short HEAD'),
  // Changes beyond the release files themselves mean the numbers describe
  // something other than the commit.
  dirty: git('status --porcelain --untracked-files=no')
    .split('\n')
    .some(
      line =>
        line &&
        !/ (package\.json|package-lock\.json|npm-package\/package\.json|CHANGELOG\.md|metrics\.jsonl)$/.test(
          line
        )
    ),
  date: new Date().toISOString(),
  node: process.version,
  ...(withValidate ? { validate, lint, coverage } : { validated: false }),
  build,
  sizes,
  tests,
  i18n,
  code,
};

// --- compare with the previous line, then append ---------------------------
/** @param {Record<string, unknown>} value @param {string} [prefix] @returns {[string, number][]} */
const numbers = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, inner]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof inner === 'number') return [[path, inner]];
    if (inner && typeof inner === 'object')
      return numbers(/** @type {Record<string, unknown>} */ (inner), path);
    return [];
  });

const lines = existsSync(outFile)
  ? readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean)
  : [];
const previous = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;

console.log(
  `metrics: ${record.version} (${record.commit}${record.dirty ? ', uncommitted changes' : ''})`
);
const before = new Map(previous ? numbers(previous) : []);
for (const [path, value] of numbers(record)) {
  const old = before.get(path);
  if (old === undefined) {
    console.log(`  ${path}  ${value}`);
  } else if (old !== value) {
    const pct =
      old === 0 ? '' : ` (${value > old ? '+' : ''}${(((value - old) / old) * 100).toFixed(0)}%)`;
    console.log(`  ${path}  ${old} → ${value}${pct}`);
  }
}
if (previous) console.log(`  (unchanged values omitted; compared with ${previous.version})`);

appendFileSync(outFile, JSON.stringify(record) + '\n');
const shown = relative(root, outFile);
console.log(`metrics: appended to ${shown.startsWith('..') ? outFile : shown}`);
