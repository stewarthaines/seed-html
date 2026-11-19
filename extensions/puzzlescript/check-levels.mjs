#!/usr/bin/env node
/**
 * Check that every level of a PuzzleScript game can be won, and report the
 * fewest moves each takes, by breadth-first search with the real engine:
 *
 *   node extensions/puzzlescript/check-levels.mjs <PuzzleScript checkout> <game.txt>
 *
 * A dev tool for writing a puzzle book: a level that cannot be won, or is won
 * in a move or two, should not reach a reader. The engine runs in Node as in
 * PuzzleScript's own test runner (src/tests/run_tests_node.js): its files
 * joined into one script, with the browser stubbed out. Deterministic games
 * only (no random rules or realtime). The search stops at --max states per
 * level (default 200000) and says so.
 *
 * Exit status: 0 when every level was won, 1 otherwise.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const args = process.argv.slice(2);
const maxIndex = args.indexOf('--max');
const MAX_STATES = maxIndex >= 0 ? Number(args.splice(maxIndex, 2)[1]) : 200000;
const [checkout, gamePath] = args;
if (!checkout || !gamePath) {
  console.error('usage: node check-levels.mjs <PuzzleScript checkout> <game.txt> [--max N]');
  process.exit(2);
}
const source = readFileSync(gamePath, 'utf8');

// Browser stubs, as in run_tests_node.js.
const store = {};
Object.assign(globalThis, {
  localStorage: {
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => (store[key] = String(value)),
    removeItem: key => delete store[key],
  },
  document: {
    URL: 'check://',
    body: { classList: { contains: () => false }, addEventListener() {}, removeEventListener() {} },
    createElement: () => ({ style: {}, innerHTML: '', textContent: '', getContext: () => null }),
    getElementById: () => null,
  },
  lastDownTarget: null,
  canvas: null,
});
globalThis.window = globalThis;
globalThis.input = globalThis.document.createElement('TEXTAREA');
for (const name of [
  'canvasResize', 'redraw', 'forceRegenImages', 'consolePrintFromRule', 'consolePrint',
  'consoleError', 'consoleCacheDump', 'addToDebugTimeline', 'killAudioButton',
  'showAudioButton', 'regenSpriteImages', 'jumpToLine', 'printLevel', 'playSound',
]) {
  globalThis[name] = () => {};
}
globalThis.console_print_raw = () => {};

const FILES = [
  'storagewrapper.js', 'bitvec.js', 'level.js', 'languageConstants.js', 'globalVariables.js',
  'debug.js', 'font.js', 'rng.js', 'riffwave.js', 'sfxr.js', 'codemirror/stringstream.js',
  'colorhelpers.js', 'colors.js', 'engine.js', 'parser.js', 'compiler.js', 'soundbar.js',
];
const engine = FILES.map(file => readFileSync(join(checkout, 'src/js', file), 'utf8')).join('\n;\n');

// The engine's names are top-level `let`s, reachable only from code in the
// same script, so the search runs inside it too.
const search = `
globalThis.__check = function (source, maxStates) {
  const plain = message => String(message).replace(/<[^>]*>/g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  let thrown = null;
  try {
    compile(['restart'], source);
  } catch (error) {
    thrown = error;
  }
  if (thrown || errorCount > 0 || !state || !state.levels) {
    const errors = errorStrings.map(plain);
    if (!errors.length) errors.push(thrown ? thrown.message : 'it has no levels');
    return { errors, levels: [] };
  }
  const errors = [];
  const usesAction = /\\baction\\b/i.test(source.split(/^\\s*rules\\s*$/im)[1] || '');
  const moves = usesAction ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];
  const names = ['up', 'left', 'down', 'right', 'action'];
  const results = [];
  state.levels.forEach((entry, index) => {
    if (entry.message !== undefined) return;
    compile(['loadLevel', index], source);
    while (againing) { againing = false; processInput(-1); }
    const start = backupLevel();
    const key = lev => lev.dat.join(',');
    const seen = new Map([[key(start), null]]);
    let frontier = [start];
    let found = null;
    let depth = 0;
    while (frontier.length && !found && seen.size < maxStates) {
      depth++;
      const next = [];
      for (const lev of frontier) {
        for (const move of moves) {
          restoreLevel(lev);
          winning = false;
          processInput(move);
          while (againing) { againing = false; processInput(-1); }
          const after = backupLevel();
          const k = key(after);
          if (winning) { found = { from: lev, move }; break; }
          if (!seen.has(k)) { seen.set(k, { from: key(lev), move }); next.push(after); }
        }
        if (found) break;
      }
      frontier = next;
    }
    winning = false;
    let solution = null;
    if (found) {
      solution = [names[found.move]];
      let step = seen.get(key(found.from));
      while (step) { solution.unshift(names[step.move]); step = seen.get(step.from); }
    }
    results.push({
      level: results.length + 1,
      won: Boolean(found),
      moves: solution ? solution.length : null,
      solution,
      states: seen.size,
      capped: !found && seen.size >= maxStates,
    });
  });
  return { errors, levels: results };
};`;
vm.runInThisContext(engine + '\n' + search, { filename: 'puzzlescript-check.js' });

const { errors, levels } = globalThis.__check(source, MAX_STATES);
if (errors.length) {
  console.log('The game does not compile:');
  for (const error of errors) console.log('  ' + error);
  process.exit(1);
}
let ok = true;
for (const result of levels) {
  if (result.won) {
    const easy = result.moves <= 2 ? ' (too easy?)' : '';
    console.log(`level ${result.level}: won in ${result.moves} moves${easy}: ${result.solution.join(' ')}`);
  } else {
    ok = false;
    console.log(
      `level ${result.level}: NOT WON` +
        (result.capped ? ` (search stopped at ${result.states} states)` : ` (all ${result.states} positions tried)`)
    );
  }
}
process.exit(ok && levels.length ? 0 : 1);
