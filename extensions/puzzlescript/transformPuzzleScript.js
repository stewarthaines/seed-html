/**
 * PuzzleScript games (the puzzlescript extension): a code block marked
 * `puzzlescript` holding a whole game, as written for puzzlescript.net, becomes
 * the game in the page.
 *
 * The block becomes div.puzzlescript with:
 * - pre.puzzlescript-source: the game's source, hidden; puzzlescript.js hands
 *   it to the PuzzleScript player when the page loads;
 * - svg.puzzlescript-still: the first level, drawn here from the game's
 *   objects, legend and collision layers, for reading systems that run no
 *   scripts (puzzlescript.js hides it once the game is live). Its label is the
 *   game's title;
 * - the player's own elements (toolbar, title, canvas, message line), found by
 *   id, which is why a page holds one game. A second block on a page stays a
 *   code block with a note.
 *
 * In a fixed-layout book (ctx.viewport set) the game takes the rest of the
 * page below whatever comes before it (div.puzzlescript-page; puzzlescript.js
 * sizes it); in a reflowable one it is a box in the text.
 *
 * The still uses the default palette (arnecolors) and the first object of an
 * `or` legend entry; colours it cannot read are drawn transparent. Notes
 * (no levels, an unknown glyph) are shown in the page, in English, for the
 * author.
 *
 * @param {Document} document - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} [ctx] - transform context; only its viewport is read
 * @returns {Document} the transformed document
 */
function transformDOM(document, idref, ctx) {
  const fixedLayout = Boolean(ctx && ctx.viewport);
  const blocks = [
    ...document.querySelectorAll('pre.puzzlescript, pre:has(> code.language-puzzlescript)'),
  ];
  blocks.forEach((pre, index) => {
    if (index > 0) {
      pre.before(note(document, 'Only one PuzzleScript game fits on a page; this one stays as code.'));
      return;
    }
    const source = pre.textContent.replace(/\n$/, '');
    const game = parseGame(source);
    const root = document.createElement('div');
    root.className = fixedLayout ? 'puzzlescript puzzlescript-page' : 'puzzlescript';

    const toolbar = document.createElement('header');
    toolbar.className = 'player-toolbar';
    toolbar.id = 'playerToolbar';
    const identity = document.createElement('div');
    identity.className = 'player-identity';
    // Not a heading: the page has its own, and the player only needs the id.
    const title = document.createElement('p');
    title.id = 'gametitle';
    title.textContent = game.title;
    identity.append(title);
    toolbar.append(identity);

    const container = document.createElement('div');
    container.className = 'gameContainer';
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    container.append(canvas);

    const message = document.createElement('span');
    message.id = 'errormessage';
    message.setAttribute('role', 'alert');

    const held = document.createElement('pre');
    held.className = 'puzzlescript-source';
    held.setAttribute('hidden', 'hidden');
    held.textContent = source;

    root.append(toolbar);
    const still = drawStill(document, game);
    if (still.svg) root.append(still.svg);
    root.append(container, message, held);
    for (const text of [...game.notes, ...still.notes]) root.append(note(document, text));
    pre.replaceWith(root);
  });
  return document;
}

function note(document, text) {
  const p = document.createElement('p');
  p.className = 'puzzlescript-note';
  p.textContent = text;
  return p;
}

const ARNE = {
  black: '#000000', white: '#FFFFFF', grey: '#9d9d9d', darkgrey: '#697175',
  lightgrey: '#cccccc', gray: '#9d9d9d', darkgray: '#697175', lightgray: '#cccccc',
  red: '#be2633', darkred: '#732930', lightred: '#e06f8b', brown: '#a46422',
  darkbrown: '#493c2b', lightbrown: '#eeb62f', orange: '#eb8931', yellow: '#f7e26b',
  green: '#44891a', darkgreen: '#2f484e', lightgreen: '#a3ce27', blue: '#1d57f7',
  lightblue: '#B2DCEF', darkblue: '#1B2632', purple: '#342a97', pink: '#de65e2',
};

const SECTIONS = ['objects', 'legend', 'sounds', 'collisionlayers', 'rules', 'winconditions', 'levels'];

/** Drop PuzzleScript comments, which are parenthesised and nest. */
function stripComments(text) {
  let depth = 0;
  let out = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    else if (depth === 0) out += ch;
  }
  return out;
}

/** The parts of a game the still needs: title, objects, legend, layers, first level. */
function parseGame(source) {
  const notes = [];
  const lines = stripComments(source).split('\n');
  const prelude = [];
  const sections = {};
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^=+$/.test(line)) continue;
    const lower = line.toLowerCase();
    if (SECTIONS.includes(lower)) {
      current = lower;
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(raw.replace(/\s+$/, ''));
    else prelude.push(line);
  }
  const titleLine = prelude.find(line => /^title\s/i.test(line));
  const title = titleLine ? titleLine.replace(/^title\s+/i, '') : 'PuzzleScript game';

  // OBJECTS: a name line (name, optionally a one-character glyph), a colour
  // line, then optionally five rows of five pixels.
  const objects = {};
  const glyphs = {};
  const objectLines = (sections.objects || []).map(line => line.trim());
  for (let i = 0; i < objectLines.length; ) {
    if (!objectLines[i]) {
      i++;
      continue;
    }
    const [name, glyph] = objectLines[i].split(/\s+/);
    const colours = (objectLines[i + 1] || '').split(/\s+/).filter(Boolean);
    const rows = [];
    let j = i + 2;
    while (j < objectLines.length && /^[0-9.]{5}$/.test(objectLines[j]) && rows.length < 5) {
      rows.push(objectLines[j]);
      j++;
    }
    objects[name.toLowerCase()] = {
      colours: colours.map(colour => colourValue(colour)),
      rows: rows.length === 5 ? rows : null,
    };
    if (glyph && glyph.length === 1) glyphs[glyph.toLowerCase()] = { kind: 'and', names: [name] };
    i = j;
  }

  // LEGEND: `x = a`, `x = a and b` (stacked), `x = a or b` (any of them).
  for (const line of sections.legend || []) {
    const match = line.trim().match(/^(\S+)\s*=\s*(.+)$/);
    if (!match) continue;
    const words = match[2].trim().split(/\s+/);
    const kind = words.some(word => word.toLowerCase() === 'or') ? 'or' : 'and';
    const names = words.filter(word => !/^(and|or)$/i.test(word));
    glyphs[match[1].toLowerCase()] = { kind, names };
  }

  const layers = (sections.collisionlayers || [])
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(/[\s,]+/).filter(Boolean).map(name => name.toLowerCase()));

  // LEVELS: blank-line separated; message lines are not levels.
  const levels = [];
  let level = [];
  for (const line of sections.levels || []) {
    const trimmed = line.trim();
    if (!trimmed || /^message\b/i.test(trimmed)) {
      if (level.length) levels.push(level);
      level = [];
      continue;
    }
    level.push(trimmed);
  }
  if (level.length) levels.push(level);
  if (!levels.length) notes.push('The game has no levels yet.');
  return { title, objects, glyphs, layers, level: levels[0] || null, notes };
}

function colourValue(colour) {
  const lower = colour.toLowerCase();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(lower)) return lower;
  return ARNE[lower] || null;
}

/** The objects a glyph or name stands for, as object names. */
function expand(name, glyphs, objects, seen = new Set()) {
  const key = name.toLowerCase();
  if (objects[key]) return [key];
  const entry = glyphs[key];
  if (!entry || seen.has(key)) return [];
  seen.add(key);
  const names = entry.kind === 'or' ? entry.names.slice(0, 1) : entry.names;
  return names.flatMap(each => expand(each, glyphs, objects, seen));
}

function layerOf(name, layers, glyphs, objects) {
  for (let i = 0; i < layers.length; i++) {
    for (const entry of layers[i]) {
      if (entry === name || expand(entry, glyphs, objects).includes(name)) return i;
    }
  }
  return layers.length;
}

/** The first level as SVG, five units to a cell, runs of a colour merged per row. */
function drawStill(document, game) {
  const notes = [];
  if (!game.level) return { svg: null, notes };
  const { objects, glyphs, layers } = game;
  const background = expand('background', glyphs, objects);
  const width = Math.max(...game.level.map(row => row.length));
  const height = game.level.length;
  const unknown = new Set();
  const rects = [];
  game.level.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const glyph = row[x] || '.';
      const names = expand(glyph, glyphs, objects);
      if (!names.length) unknown.add(glyph);
      const stack = [...new Set([...background, ...names])].sort(
        (a, b) => layerOf(a, layers, glyphs, objects) - layerOf(b, layers, glyphs, objects)
      );
      for (const name of stack) {
        const object = objects[name];
        for (let py = 0; py < 5; py++) {
          let run = null;
          for (let px = 0; px <= 5; px++) {
            const cell = px < 5 ? (object.rows ? object.rows[py][px] : '0') : '.';
            const fill = cell === '.' ? null : object.colours[Number(cell)] || null;
            if (run && run.fill !== fill) {
              rects.push(
                `<rect x="${x * 5 + run.start}" y="${y * 5 + py}" width="${px - run.start}" height="1" fill="${run.fill}"/>`
              );
              run = null;
            }
            if (fill && !run) run = { start: px, fill };
          }
        }
      }
    }
  });
  if (unknown.size) {
    notes.push(`The first level uses ${[...unknown].join(' ')}, which the legend does not define.`);
  }
  const holder = document.createElement('div');
  holder.innerHTML =
    `<svg class="puzzlescript-still" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width * 5} ${height * 5}" role="img" shape-rendering="crispEdges">` +
    `<title></title>${rects.join('')}</svg>`;
  const svg = holder.firstElementChild;
  svg.querySelector('title').textContent = game.title;
  return { svg, notes };
}
