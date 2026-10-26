/**
 * Bricks block parser (process/BRICKS_BLOCK_NOTATION.md).
 *
 * Turns the text of one ```bricks block into a step: the YAML header's
 * settings, then the sections in source order, each with its part lines.
 * A plain function of text, with no DOM and no parts library: whether a part
 * or colour name exists is for the caller to check. Anything malformed is
 * left out and reported as a note with its line number in the block (1 is
 * the line after the fence); the rest of the block still parses.
 *
 *   ---
 *   model: letter-o
 *   color: Yellow
 *   from: [0, 0, 9]
 *   ---
 *   built
 *   3032 Green 0 -8 -1 turn 90
 *   step   # the rounded bottom corners
 *   3665a 0 -5 0
 *   3665a 0 -7 0 turn 180
 *
 * A part line is `<part> [<colour>] <x> <y> <z> [turn <deg>] [from <x> <y> <z>]`.
 * Section lines are `built`, `step [<n>] [from <x> <y> <z>]` and
 * `model <name> [<colour>]`; parts before any section line belong to a first
 * step.
 * `#` starts a comment.
 *
 * Each part's `from` is resolved here (its own, else its step's, else the
 * header's; `from 0 0 0` means it does not move, given as null). Its colour
 * is its own or null: a part without one takes the main colour (its model
 * section's color, else header.color) where it is drawn and stays colourless
 * in a model record.
 *
 * Needs js-yaml as the global jsyaml (the extension's script).
 *
 * @param {string} text - the block's content, without the fences
 * @returns {{header: {spin: number|null, scale: number, model: string|null,
 *   color: string|null, from: number[]|null, alt: string|null, style: string|null},
 *   sections: Array<{kind: 'built'|'step'|'model', line: number,
 *   number?: number, given?: boolean, name?: string|null, color?: string|null, parts: Array<{part: string,
 *   color: string|null, at: number[], turn: number, from: number[]|null,
 *   line: number}>}>, notes: Array<{line: number, message: string}>}}
 */
function parseBricks(text) {
  const SECTIONS = ['built', 'step', 'model'];
  const MODIFIERS = ['turn', 'from'];
  const STYLES = ['classic'];
  const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;
  const isNumber = (token) => NUMBER.test(token);

  const notes = [];
  const note = (line, message) => notes.push({ line, message });
  const header = { spin: null, scale: 1, model: null, color: null, from: null, alt: null, style: null };
  const sections = [];

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let first = 0;
  while (first < lines.length && !lines[first].trim()) first++;

  // The header, between --- lines at the top.
  let body = first;
  if (first < lines.length && lines[first].trim() === '---') {
    let close = first + 1;
    while (close < lines.length && lines[close].trim() !== '---') close++;
    if (close === lines.length) {
      note(first + 1, 'the header has no closing ---');
      return { header, sections, notes };
    }
    readHeader(lines.slice(first + 1, close).join('\n'), first + 1);
    body = close + 1;
  }

  // The part list.
  let section = null;
  let stepNumber = 0;
  for (let i = body; i < lines.length; i++) {
    const line = i + 1;
    const tokens = lines[i].replace(/#.*/, '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const word = tokens[0].toLowerCase();

    if (word === 'built') {
      if (tokens.length > 1) note(line, `built takes nothing after it (${tokens.slice(1).join(' ')})`);
      section = open({ kind: 'built', line });
    } else if (word === 'step') {
      const step = { kind: 'step', line };
      let rest = tokens.slice(1);
      if (rest.length && /^\d+$/.test(rest[0])) {
        stepNumber = Number(rest[0]);
        step.given = true;
        if (stepNumber < 1) note(line, 'a step number starts at 1');
        rest = rest.slice(1);
      } else {
        stepNumber++;
      }
      step.number = Math.max(stepNumber, 1);
      if (rest.length) {
        const from = rest[0].toLowerCase() === 'from' && rest.length === 4 && rest.slice(1).every(isNumber);
        if (from) step.from = rest.slice(1).map(Number);
        else note(line, `a step line is step [<number>] [from <x> <y> <z>], not ${tokens.join(' ')}`);
      }
      section = open(step);
    } else if (word === 'model') {
      // A model without a usable name (null) is still drawn but recorded nowhere.
      let name = tokens.length === 2 || tokens.length === 3 ? tokens[1] : null;
      let color = tokens.length === 3 ? tokens[2] : null;
      if (!name) note(line, 'a model line is model <name> [<colour>]');
      else if (SECTIONS.includes(name.toLowerCase()) || isNumber(name)) {
        note(line, `${name} cannot name a model`);
        name = null;
      }
      if (color && isNumber(color)) {
        note(line, `${color} is not a colour name`);
        color = null;
      }
      section = open({ kind: 'model', line, name, color });
    } else {
      const part = readPart(tokens, line);
      if (!part) continue;
      if (!section) {
        stepNumber++;
        section = open({ kind: 'step', line, number: stepNumber });
      }
      part.from = resolveFrom(part.from, section);
      section.parts.push(part);
    }
  }

  sections.forEach((s) => {
    if (!s.parts.length) note(s.line, `this ${s.kind} has no parts`);
  });
  if (!sections.length && !notes.length) note(body + 1, 'the block has no parts');
  return { header, sections, notes };

  function open(s) {
    s.parts = [];
    sections.push(s);
    return s;
  }

  function resolveFrom(own, s) {
    const from = own || (s.kind === 'built' ? null : s.from || header.from);
    return from && from.some((n) => n !== 0) ? from : null;
  }

  // <part> [<colour>] <x> <y> <z> [turn <deg>] [from <x> <y> <z>]
  function readPart(tokens, line) {
    const shape = `a part line is <part> [<colour>] <x> <y> <z> [turn <degrees>] [from <x> <y> <z>]`;
    const part = { part: tokens[0], color: null, at: null, turn: 0, from: null, line };
    // Part numbers are often all digits (3005), so the first token is always the part.
    let k = 1;
    if (k < tokens.length && !isNumber(tokens[k]) && !MODIFIERS.includes(tokens[k].toLowerCase())) {
      part.color = tokens[k++];
    }
    const at = tokens.slice(k, k + 3);
    if (at.length < 3 || !at.every(isNumber)) {
      note(line, `${tokens.join(' ')}: ${shape}`);
      return null;
    }
    part.at = at.map(Number);
    k += 3;
    const seen = [];
    while (k < tokens.length) {
      const modifier = tokens[k].toLowerCase();
      if (!MODIFIERS.includes(modifier) || seen.includes(modifier)) {
        note(line, `${tokens.join(' ')}: ${seen.includes(modifier) ? `${modifier} given twice` : shape}`);
        return null;
      }
      seen.push(modifier);
      const count = modifier === 'turn' ? 1 : 3;
      const values = tokens.slice(k + 1, k + 1 + count);
      if (values.length < count || !values.every(isNumber)) {
        note(line, `${tokens.join(' ')}: ${modifier === 'turn' ? 'turn takes a number of degrees' : 'from takes three numbers'}`);
        return null;
      }
      if (modifier === 'turn') part.turn = Number(values[0]);
      else part.from = values.map(Number);
      k += 1 + count;
    }
    return part;
  }

  // The header keys; unknown keys and wrong types get a note and the default.
  function readHeader(yaml, startLine) {
    let data;
    try {
      data = yaml.trim() ? jsyaml.load(yaml, { schema: jsyaml.JSON_SCHEMA }) : {};
    } catch (error) {
      const at = error.mark && typeof error.mark.line === 'number' ? startLine + 1 + error.mark.line : startLine;
      note(at, `the header is not valid YAML: ${error.reason || error.message}`);
      return;
    }
    if (data === null || data === undefined) return;
    if (typeof data !== 'object' || Array.isArray(data)) {
      note(startLine, 'the header should be key: value lines');
      return;
    }
    const keyLine = (key) => {
      const found = yaml.split('\n').findIndex((l) => new RegExp(`^\\s*${key}\\s*:`).test(l));
      return found < 0 ? startLine : startLine + 1 + found;
    };
    for (const [key, value] of Object.entries(data)) {
      const line = keyLine(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (key === 'spin') {
        if (value === true) header.spin = 90;
        else if (value === false) header.spin = null;
        else if (typeof value === 'number' && value !== 0) header.spin = value;
        else note(line, 'spin is true or a number of degrees');
      } else if (key === 'scale') {
        if (typeof value === 'number' && value > 0) header.scale = value;
        else note(line, 'scale is a number above 0');
      } else if (key === 'model') {
        if (typeof value === 'string' && /^\S+$/.test(value) && !SECTIONS.includes(value.toLowerCase())) header.model = value;
        else note(line, 'model is a name with no spaces, other than built, step or model');
      } else if (key === 'color') {
        if (typeof value === 'string' && value.trim() && !isNumber(value.trim())) header.color = value.trim();
        else note(line, 'color is a colour name');
      } else if (key === 'from') {
        if (Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number')) header.from = value;
        else note(line, 'from is three numbers, as [x, y, z]');
      } else if (key === 'alt') {
        if (typeof value === 'string' && value.trim()) header.alt = value.trim();
        else note(line, 'alt is a description');
      } else if (key === 'style') {
        if (typeof value === 'string' && STYLES.includes(value.trim().toLowerCase())) header.style = value.trim().toLowerCase();
        else note(line, `style is one of ${STYLES.join(', ')}`);
      } else if (key === 'colour') {
        note(line, 'unknown key colour; did you mean color?');
      } else {
        note(line, `unknown key ${key}`);
      }
    }
  }
}
