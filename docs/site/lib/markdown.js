/**
 * The app's MarkdownIt text format, loaded for Node.
 *
 * extensions/markdown-it/ ships markdown-it and markdown-it-attrs as UMD
 * bundles plus the transform the app runs in its transform iframe. They run
 * here in a node:vm sandbox whose global doubles as `window`, so the docs site
 * renders chapters with exactly the code the EPUB uses.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const EXTENSION_DIR = 'extensions/markdown-it';
const FILES = ['markdown-it.min.js', 'markdown-it-attrs.browser.min.js', 'transformMarkdown.js'];

function loadSandbox() {
  const sandbox = { console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of FILES) {
    const filename = path.join(EXTENSION_DIR, file);
    vm.runInContext(readFileSync(filename, 'utf8'), sandbox, { filename });
  }
  return sandbox;
}

const sandbox = loadSandbox();

/** The app's transform: chapter source → HTML. */
export const transformText = source => sandbox.transformText(source);

/** A parser with the same attrs plugin, for reading structure from sources. */
const parser = sandbox.markdownit().use(sandbox.markdownItAttrs);

/**
 * The text of every heading at `level` in a markdown source, in order.
 * Attribute braces (`{#id}`) are consumed by the attrs plugin, not returned.
 */
export function headingTexts(source, level) {
  const tokens = parser.parse(source, {});
  const texts = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type === 'heading_open' && tokens[i].tag === `h${level}`) {
      texts.push(tokens[i + 1].content.trim());
    }
  }
  return texts;
}
