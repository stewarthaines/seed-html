#!/usr/bin/env node
/**
 * Rebuild puzzlescript-engine.txt from a PuzzleScript checkout:
 *
 *   git clone --depth 1 https://github.com/increpare/PuzzleScript.git <dir>
 *   node extensions/puzzlescript/build-engine.mjs <dir>
 *
 * The files are the standalone player's (src/standalone.html), in its order,
 * joined and minified with esbuild. Top-level names stay global, which the
 * engine needs: it compiles rules into `new Function` code that refers to them.
 * The bundle ships as text and puzzlescript.js runs it only on a page with a
 * game, after the page has loaded (see that file for why).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const FILES = [
  'storagewrapper.js', 'bitvec.js', 'level.js', 'languageConstants.js', 'globalVariables.js',
  'debug_off.js', 'font.js', 'rng.js', 'riffwave.js', 'sfxr.js', 'codemirror/stringstream.js',
  'colors.js', 'graphics.js', 'engine.js', 'parser.js', 'compiler.js', 'inputoutput.js',
  'mobile.js',
];

const checkout = process.argv[2];
if (!checkout) {
  console.error('usage: node build-engine.mjs <PuzzleScript checkout>');
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const commit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD']).toString().trim();
const parts = [];
for (const file of FILES) {
  parts.push(`/* ${file} */\n` + (await readFile(join(checkout, 'src/js', file), 'utf8')));
}
const { code } = await transform(parts.join('\n;\n'), {
  minify: true,
  target: 'es2020',
  legalComments: 'none',
});
const header = `/* PuzzleScript player, https://github.com/increpare/PuzzleScript at ${commit}
   Copyright (c) 2013 Stephen Lavelle. MIT License: see LICENSE.txt. */\n`;
await writeFile(join(here, 'puzzlescript-engine.txt'), header + code);
console.log(`puzzlescript-engine.txt: ${(header + code).length} bytes from ${commit.slice(0, 7)}`);
