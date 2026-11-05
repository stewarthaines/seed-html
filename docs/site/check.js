/**
 * Checks the built docs site (dist/docs/) and exits non-zero on a problem:
 *
 * - every internal link, image, stylesheet and script resolves to a built file;
 * - every #fragment names an id on the target page;
 * - every image has alt text (a decorative `.icon` image may have empty alt).
 *
 * The old product name is already caught in the sources by check:rename.
 * Run with `npm run check:docs`, which builds first.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';

const SITE_DIR = 'dist';
const DOCS_DIR = path.join(SITE_DIR, 'docs');
const SKIP_DIRS = new Set([path.join(DOCS_DIR, 'pagefind')]);

const window = new Window();
const parser = new window.DOMParser();

function htmlFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(full) ? [] : htmlFiles(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

/** Site URL path of a built file: dist/docs/en/x/index.html → /docs/en/x/ */
function urlPathOf(file) {
  const rel = '/' + path.relative(SITE_DIR, file).split(path.sep).join('/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
}

/** Built file for a site URL path, or null. */
function fileOf(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const candidate = path.join(SITE_DIR, ...decoded.split('/'));
  if (decoded.endsWith('/')) return path.join(candidate, 'index.html');
  return candidate;
}

const docs = new Map();
function parse(file) {
  if (!docs.has(file)) {
    docs.set(file, parser.parseFromString(readFileSync(file, 'utf8'), 'text/html'));
  }
  return docs.get(file);
}

const problems = [];
const pages = htmlFiles(DOCS_DIR);

for (const file of pages) {
  const doc = parse(file);
  const base = new URL(urlPathOf(file), 'https://docs.invalid');
  const report = message => problems.push(`${urlPathOf(file)}: ${message}`);

  const refs = [
    ...[...doc.querySelectorAll('a[href]')].map(el => el.getAttribute('href')),
    ...[...doc.querySelectorAll('img[src], script[src]')].map(el => el.getAttribute('src')),
    ...[...doc.querySelectorAll('link[href]')].map(el => el.getAttribute('href')),
  ];

  for (const ref of refs) {
    const url = new URL(ref, base);
    if (url.origin !== base.origin) continue;
    // /SEED.html is the app itself, served by the app build, not the docs build.
    if (url.pathname === '/SEED.html') continue;

    const target = fileOf(url.pathname);
    if (!existsSync(target)) {
      report(`broken link ${ref}`);
      continue;
    }
    if (url.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!parse(target).getElementById(id)) report(`no #${id} on ${url.pathname} (${ref})`);
    }
  }

  for (const img of doc.querySelectorAll('img')) {
    const alt = img.getAttribute('alt');
    const decorative = img.classList.contains('icon');
    if (alt === null) report(`image without alt: ${img.getAttribute('src')}`);
    else if (!alt.trim() && !decorative) report(`image with empty alt: ${img.getAttribute('src')}`);
  }
}

if (problems.length > 0) {
  console.error(`docs check: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
// eslint-disable-next-line no-console -- the CLI's success line
console.log(`docs check: ${pages.length} pages, no problems`);
