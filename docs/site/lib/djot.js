/**
 * The app's Djot text format, loaded for Node.
 *
 * extensions/djot/ ships djot.js as a UMD bundle plus the transform the app
 * runs in its transform iframe (with its id, clip and symbol filters). They
 * run here in a node:vm sandbox, as lib/markdown.js does for MarkdownIt, so
 * the docs site renders a .dj chapter with exactly the code the EPUB uses.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const EXTENSION_DIR = 'extensions/djot';
const FILES = ['djot.js', 'transformDjot.js'];

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

/** A node's text as authored; breaks and non-breaking spaces count as spaces. */
function textOf(node) {
  if (['soft_break', 'hard_break', 'non_breaking_space'].includes(node.tag)) return ' ';
  if (typeof node.text === 'string') return node.text;
  return (node.children ?? []).map(textOf).join('');
}

/** The text of every heading at `level` in a djot source, in order. */
export function headingTexts(source, level) {
  const texts = [];
  const walk = node => {
    if (node.tag === 'heading' && node.level === level) texts.push(textOf(node).trim());
    else (node.children ?? []).forEach(walk);
  };
  walk(sandbox.djot.parse(source));
  return texts;
}
