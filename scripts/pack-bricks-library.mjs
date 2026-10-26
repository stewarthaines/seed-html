/**
 * Pack a Bricks parts library (process/BRICK_STEPS_EXTENSION.md, "Layered
 * libraries").
 *
 * Reads an inventory — an LDraw model with one type-1 line per part the set
 * offers — and writes a packed .mpd: the LDraw colour table (unless
 * --no-colours), then one `0 FILE` section for every part, model and
 * primitive the inventory reaches, dependencies first. The inventory's own
 * lines are not written: a set holds parts, not a model. The Bricks extension
 * reads every such file under Misc/bricks/ in a book; only the core set
 * carries the colour table.
 *
 * Files are looked up as three.js's packLDrawModel.mjs does, in the LDraw
 * library's parts/, p/ and models/ folders (s/ under parts/, 48/ under p/,
 * retrying in lower case), except that a model (.ldr) beside the inventory is
 * found first and packed as models/<name>.ldr, so a set can ship its own
 * submodels (a minifig assembled from parts).
 *
 * Usage:
 *   node scripts/pack-bricks-library.mjs --ldraw <ldraw dir> <inventory.ldr> <out.mpd> [--no-colours]
 *
 * The LDraw library is the official download from ldraw.org (CC BY 4.0),
 * unzipped; it is not kept in this repository.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const option = name => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const [, value] = args.splice(i, 2);
  return value;
};
const colours = !flag('--no-colours');
const ldraw = option('--ldraw');
const [inventoryPath, outPath] = args;
if (!ldraw || !inventoryPath || !outPath) {
  console.log(
    'Usage: node scripts/pack-bricks-library.mjs --ldraw <ldraw dir> <inventory.ldr> <out.mpd> [--no-colours]'
  );
  process.exit(1);
}
const beside = path.dirname(inventoryPath);

const packed = [];
const seen = new Set();
const missing = [];

// A reference's packed name and text, or null when it cannot be found.
function locate(reference) {
  const name = reference.replace(/\\/g, '/');
  for (const candidate of [name, name.toLowerCase()]) {
    if (/\.ldr$/i.test(candidate) && existsSync(path.join(beside, candidate))) {
      return { packedName: 'models/' + candidate, file: path.join(beside, candidate) };
    }
    const prefixes = candidate.startsWith('48/')
      ? ['p/']
      : candidate.startsWith('s/')
        ? ['parts/']
        : ['', 'parts/', 'p/', 'models/'];
    for (const prefix of prefixes) {
      const file = path.join(ldraw, prefix, candidate);
      if (existsSync(file)) return { packedName: prefix + candidate, file };
    }
  }
  return null;
}

// The type-1 references in an LDraw file's lines: the file name after the
// colour, position and matrix (14 fields).
function references(lines) {
  return lines
    .filter(line => line.startsWith('1 '))
    .map(line => line.split(/\s+/).slice(14).join(' ').trim())
    .filter(Boolean);
}

// Packs a file and everything it references; returns its packed name. Each
// reference is rewritten to the packed name, since LDrawLoader looks embedded
// files up by exactly that name (stud.dat is found only as p/stud.dat).
function pack(reference) {
  const found = locate(reference);
  if (!found) {
    missing.push(reference);
    return null;
  }
  if (seen.has(found.packedName)) return found.packedName;
  seen.add(found.packedName);
  const lines = readFileSync(found.file, 'utf8')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/^[ \t]+/, ''))
    .filter((line, i) => !(i === 0 && line.startsWith('0 FILE ')))
    .map(line => {
      if (!line.startsWith('1 ')) return line;
      const fields = line.split(/\s+/);
      const child = pack(fields.slice(14).join(' ').trim());
      return child ? fields.slice(0, 14).join(' ') + ' ' + child : line;
    });
  packed.push('0 FILE ' + found.packedName + '\n' + lines.join('\n').trimEnd() + '\n');
  return found.packedName;
}

const inventory = readFileSync(inventoryPath, 'utf8').replace(/\r\n?/g, '\n').split('\n');
for (const reference of references(inventory.map(line => line.trim()))) pack(reference);
// Dependents before their dependencies, as packLDrawModel.mjs writes them.
packed.reverse();
if (missing.length) {
  console.error('Not found in the LDraw library: ' + [...new Set(missing)].join(', '));
  process.exit(1);
}

const title = inventory.find(line => line.startsWith('0 ')) || '0 Bricks parts set';
const head = colours ? readFileSync(path.join(ldraw, 'LDConfig.ldr'), 'utf8') : title + '\n';
writeFileSync(outPath, head.replace(/\r\n?/g, '\n').trimEnd() + '\n\n' + packed.join('\n'));
const offered = references(inventory.map(line => line.trim())).length;
console.log(`${outPath}: ${offered} parts offered, ${packed.length} files packed`);
