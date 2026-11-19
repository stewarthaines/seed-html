/**
 * Reader choices (process/READER_CHOICES.md): the reader picks a value for a
 * choice the book declares (servings, measures, a reading level) and the page
 * shows the text written for that value, remembered between openings.
 *
 * DECLARATION. Any chapter's frontmatter may declare the book's choices; by
 * convention the first chapter. Values are a list, in order; the first is the
 * default unless `default:` names another. A value is a bare id, or a one-key
 * map of id to the label the reader sees.
 *
 *   ---
 *   choices:
 *     serves:
 *       label: Serves
 *       values: [{1x: 4–6}, {2x: 8–12}, {4x: 16–24}]
 *       split: "|"
 *     measure:
 *       label: Measures
 *       values: [metric, imperial, volume]
 *       default: metric
 *       split: "/"
 *   ---
 *
 * A chapter that declares choices writes them to the book's register,
 * SOURCE/data/reader-choices.json ({ from: <idref>, choices }), when they
 * differ from what is stored; every other chapter reads the register. The
 * most recent render wins, which is also what packaging ships. A chapter that
 * wrote the register and has lost its block writes null.
 *
 * VARIANTS. `when=` on any span or block names the values it is written for:
 * space-separated choices must all match, comma-separated values within one
 * are alternatives.
 *
 *   [350g]{when=measure:metric}[12 oz]{when=measure:imperial}
 *   {when="level:english,transliteration"}
 *   ::: …
 *
 * The attribute becomes data-rc-when with class rc-variant; a variant that
 * does not match every choice's default also gets rc-off, so a reading
 * system without scripts (and print, which carries no scripts) shows one
 * consistent version. No `when` attribute survives into the XHTML.
 *
 * SCOPES. A block with an attribute named after a choice owns that choice:
 * its controls and variants follow their own value, remembered per block.
 * The attribute labels the book's values in order:
 *
 *   {serves="4–6 | 8–12 | 16–24"}
 *   ::: recipe
 *   ## Lobio
 *   :::
 *
 * A `recipe` block also gets h-recipe semantics (h-recipe, p-name on its
 * title, p-ingredient on list items with a quantity grid).
 *
 * QUANTITY GRIDS. A choice declared with `split: "/"` or `split: "|"` steps
 * through the parts of inline code inside a recipe or scope, "/" outermost;
 * a separator needs a space on each side, so `1/2` is a fraction:
 *
 *   - `350g | 700g | 1.4kg / 12 oz | 1½ lb | 3 lb` dried beans
 *
 * CONTROLS. `:choose:{of=<choice>}` on a line of its own (the Djot extension
 * turns it into p.choose-set > span.choose[data-of]) becomes the choice's
 * label, the default's label as plain text, and a hidden group of buttons
 * that Scripts/reader-choices.js reveals in place of the text:
 *
 *   <p class="rc-choose-set">
 *     <span class="rc-choose" data-rc-of="serves">
 *       <span class="rc-label">Serves</span>
 *       <span class="rc-static">4–6</span>
 *       <span class="rc-buttons" role="group" aria-label="Serves" hidden="">
 *         <button type="button" class="rc-option" data-rc-value="1x" aria-pressed="true">4–6</button> …
 *       </span>
 *     </span>
 *   </p>
 *
 * PAGE STAMP. A page with variants or controls carries, on <body>,
 * data-rc-book (ctx.identifier, the storage key) and data-rc-choices (each
 * choice's value ids and default, as JSON) for the reading-system script.
 *
 * FINDINGS (an invalid declaration, a variant naming an unknown choice or
 * value, a control for an undeclared choice) print as a list at the top of
 * the page, so the author sees them in the preview they are typing next to,
 * and go to the console.
 *
 * Idempotent: nothing it reads (`when`, span.choose) survives its own output.
 *
 * @param {Document} document - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (frontmatter, identifier, source I/O)
 */
async function transformDOM(document, idref, ctx) {
  if (!ctx || !document.body) return document;
  const findings = [];
  const declaration = await resolveDeclaration(ctx, idref, findings);

  // Scopes and quantity grids first: a grid becomes `when` spans, which the
  // variant pass then stamps like any authored variant.
  const labels = new Map(); // scope element → { choice name → [labels] }
  const scopes = declaration ? findScopes(document, declaration) : [];
  for (const el of scopes) stampScope(el, idref, declaration, labels, findings);
  for (const el of document.querySelectorAll('div.recipe')) stampRecipe(el);
  if (declaration) expandGrids(document, declaration, findings);

  const variants = [...document.querySelectorAll('[when]')];
  const controls = [...document.querySelectorAll('p.choose-set > span.choose')];
  const alreadyDone = document.querySelector('[data-rc-when], .rc-choose, .rc-scope');
  if (variants.length === 0 && controls.length === 0 && !alreadyDone) {
    reportFindings(document, findings);
    return document;
  }

  if (!declaration && (variants.length > 0 || controls.length > 0)) {
    findings.push(
      'no choices are declared: add a choices: block to a chapter’s frontmatter and render that chapter'
    );
  }

  for (const el of variants) stampVariant(el, declaration, findings);
  for (const set of new Set(controls.map(span => span.parentElement))) {
    buildControls(document, set, declaration, labels, findings);
  }

  if (declaration) {
    const stamp = {};
    for (const [name, choice] of Object.entries(declaration)) {
      stamp[name] = { values: choice.values.map(v => v.id), default: choice.default };
    }
    document.body.setAttribute('data-rc-book', ctx.identifier || '');
    document.body.setAttribute('data-rc-choices', JSON.stringify(stamp));
  }

  reportFindings(document, findings);
  return document;
}

const REGISTER_PATH = 'SOURCE/data/reader-choices.json';
const NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
// A choice name doubles as a scope's attribute name, which HTML lowercases:
// lowercase, starting with a letter, and never an attribute HTML already has.
const CHOICE_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;
const RESERVED_NAMES = new Set([
  'id', 'class', 'style', 'title', 'lang', 'dir', 'hidden', 'role', 'when',
  'href', 'src', 'alt', 'width', 'height', 'name', 'value', 'type', 'for',
]);
const CHOICE_KEYS = new Set(['label', 'values', 'default', 'split']);
// A grid's separators, outermost first; each needs a space on either side.
const SPLITS = ['/', '|'];

/* ---- The declaration ---------------------------------------------------- */

/**
 * The choices in force for this chapter: its own frontmatter block (written
 * to the register when it differs), else the register. Null when none.
 */
async function resolveDeclaration(ctx, idref, findings) {
  const fm = ctx.frontmatter;
  const own = fm && typeof fm === 'object' && !Array.isArray(fm) && 'choices' in fm;
  const stored = await readRegister(ctx);

  if (own) {
    const declaration = normalizeDeclaration(fm.choices, findings);
    await writeRegister(ctx, stored, { from: idref, choices: declaration });
    return declaration;
  }
  if (stored.value && stored.value.from === idref) {
    // This chapter wrote the register and no longer declares anything.
    await writeRegister(ctx, stored, null);
    return null;
  }
  return stored.value && stored.value.choices ? stored.value.choices : null;
}

async function readRegister(ctx) {
  if (typeof ctx.readSourceText !== 'function') return { text: null, value: null };
  try {
    const text = await ctx.readSourceText(REGISTER_PATH);
    return { text, value: JSON.parse(text) };
  } catch (error) {
    return { text: null, value: null };
  }
}

/** Write the register when it differs from the stored text. */
async function writeRegister(ctx, stored, value) {
  if (typeof ctx.writeSourceText !== 'function') return;
  const text = JSON.stringify(value, null, 2);
  if (stored.text === text) return;
  if (stored.text === null && value === null) return;
  try {
    await ctx.writeSourceText(REGISTER_PATH, text);
  } catch (error) {
    console.warn('reader-choices: could not write the register', error);
  }
}

/**
 * Frontmatter `choices:` → { name: { label, values: [{ id, label }], default } },
 * keeping the valid parts of an invalid block and noting the rest. Null when
 * nothing valid remains.
 */
function normalizeDeclaration(raw, findings) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    findings.push('choices: must be a map of choice names');
    return null;
  }
  const declaration = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (!CHOICE_NAME_PATTERN.test(name)) {
      findings.push(
        `choice "${name}": names are lowercase letters, digits, - and _, starting with a letter`
      );
      continue;
    }
    if (RESERVED_NAMES.has(name)) {
      findings.push(`choice "${name}": that name is already an HTML attribute`);
      continue;
    }
    const spec = Array.isArray(entry) ? { values: entry } : entry;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      findings.push(`choice "${name}": expected label and values`);
      continue;
    }
    for (const key of Object.keys(spec)) {
      if (!CHOICE_KEYS.has(key)) findings.push(`choice "${name}": unknown key "${key}"`);
    }
    const values = normalizeValues(name, spec.values, findings);
    if (values.length === 0) {
      findings.push(`choice "${name}": needs at least one value`);
      continue;
    }
    let fallback = values[0].id;
    if (spec.default !== undefined && spec.default !== null) {
      const wanted = String(spec.default);
      if (values.some(v => v.id === wanted)) fallback = wanted;
      else findings.push(`choice "${name}": default "${wanted}" is not one of its values`);
    }
    const label =
      typeof spec.label === 'string' || typeof spec.label === 'number' ? String(spec.label) : name;
    declaration[name] = { label, values, default: fallback };
    if (spec.split !== undefined && spec.split !== null) {
      const split = String(spec.split);
      const taken = Object.keys(declaration).find(
        other => other !== name && declaration[other].split === split
      );
      if (!SPLITS.includes(split)) {
        findings.push(`choice "${name}": split is "/" or "|"`);
      } else if (taken) {
        findings.push(`choice "${name}": "${taken}" already splits on "${split}"`);
      } else {
        declaration[name].split = split;
      }
    }
  }
  return Object.keys(declaration).length > 0 ? declaration : null;
}

function normalizeValues(name, raw, findings) {
  if (!Array.isArray(raw)) {
    if (raw !== undefined) findings.push(`choice "${name}": values must be a list`);
    return [];
  }
  const values = [];
  for (const item of raw) {
    let id;
    let label;
    if (typeof item === 'string' || typeof item === 'number') {
      id = String(item);
      label = id;
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const keys = Object.keys(item);
      if (keys.length !== 1) {
        findings.push(`choice "${name}": a value is an id, or one id with its label`);
        continue;
      }
      id = keys[0];
      const text = item[id];
      label = text === null || text === undefined ? id : String(text);
    } else {
      findings.push(`choice "${name}": a value is an id, or one id with its label`);
      continue;
    }
    if (!NAME_PATTERN.test(id)) {
      findings.push(`choice "${name}": value "${id}" uses letters, digits, - and _ only`);
      continue;
    }
    if (values.some(v => v.id === id)) {
      findings.push(`choice "${name}": value "${id}" is listed twice`);
      continue;
    }
    values.push({ id, label });
  }
  return values;
}

/* ---- Scopes -------------------------------------------------------------- */

/** Elements carrying an attribute named after a declared choice. */
function findScopes(document, declaration) {
  const found = new Set();
  for (const name of Object.keys(declaration)) {
    for (const el of document.querySelectorAll(`[${name}]`)) found.add(el);
  }
  return [...found];
}

/**
 * `serves="4–6 | 8–12 | 16–24"` → that choice is the block's own, labelled
 * in the order of the book's values. The block is stamped rc-scope with
 * data-rc-scope (the choices it owns) and data-rc-key (chapter + its id or
 * first heading's id), which the reading-system script stores it under; a
 * block with neither id is not remembered.
 */
function stampScope(el, idref, declaration, labels, findings) {
  const own = {};
  for (const [name, choice] of Object.entries(declaration)) {
    if (!el.hasAttribute(name)) continue;
    const text = el.getAttribute(name);
    el.removeAttribute(name);
    const parts = text.split('|').map(part => part.trim());
    if (parts.length !== choice.values.length || parts.some(part => !part)) {
      findings.push(
        `${name}="${text}": give ${choice.values.length} labels separated by |, one for each of ${choice.values.map(v => v.id).join(', ')}`
      );
      continue;
    }
    own[name] = parts;
  }
  const names = Object.keys(own);
  if (names.length === 0) return;
  labels.set(el, own);
  el.classList.add('rc-scope');
  el.setAttribute('data-rc-scope', names.join(' '));
  const heading = el.querySelector('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
  const id = el.getAttribute('id') || (heading && heading.getAttribute('id'));
  if (id) el.setAttribute('data-rc-key', `${idref}#${id}`);
}

/* ---- Quantity grids ------------------------------------------------------ */

/**
 * Inline code inside a recipe block or a scope is a quantity grid when it
 * holds a declared separator with a space on each side:
 *
 *   `350g | 700g | 1.4kg / 12 oz | 1½ lb | 3 lb / 2 cups | 4 cups | 8 cups`
 *
 * "/" parts step through the choice declared with split: "/", "|" parts
 * through the one with split: "|", each in the book's value order; "/" nests
 * outside "|". A part with no "|" is the same at every value of that choice
 * (`1 tsp | 2 tsp | 4 tsp` has no "/" and serves every measure). The code
 * becomes span.rc-quantity holding one `when` span per value, which the
 * variant pass stamps; a count that matches neither 1 nor the values is a
 * finding and the code is left as written. `1/2` has no spaces, so stays.
 */
function expandGrids(document, declaration, findings) {
  const axes = SPLITS.map(split => {
    const name = Object.keys(declaration).find(n => declaration[n].split === split);
    return name ? { split, name, ids: declaration[name].values.map(v => v.id) } : null;
  });
  if (!axes[0] && !axes[1]) return;
  const separator = split => new RegExp(`\\s+\\${split}\\s+`);

  for (const code of document.querySelectorAll('div.recipe code, .rc-scope code')) {
    if (code.closest('pre')) continue;
    const text = code.textContent;
    const present = axes.filter(axis => axis && separator(axis.split).test(text));
    if (present.length === 0) continue;

    // [[outer part, [inner parts]]] with each axis absent treated as one part.
    const outer = axes[0] ? text.split(separator('/')) : [text];
    const cells = outer.map(part => (axes[1] ? part.split(separator('|')) : [part]));
    const problem = gridProblem(axes, outer, cells);
    if (problem) {
      findings.push(`\`${text}\`: ${problem}`);
      continue;
    }

    const quantity = document.createElement('span');
    quantity.setAttribute('class', 'rc-quantity');
    outer.forEach((_, i) => {
      cells[i].forEach((cell, j) => {
        const conditions = [];
        if (outer.length > 1) conditions.push(`${axes[0].name}:${axes[0].ids[i]}`);
        if (cells[i].length > 1) conditions.push(`${axes[1].name}:${axes[1].ids[j]}`);
        const span = document.createElement('span');
        if (conditions.length > 0) span.setAttribute('when', conditions.join(' '));
        span.textContent = cell.trim();
        quantity.appendChild(span);
      });
    });
    code.replaceWith(quantity);

    const item = quantity.closest('.h-recipe li');
    if (item) item.classList.add('p-ingredient');
  }
}

/** Why a grid's part counts don't fit the declaration, or null. */
function gridProblem(axes, outer, cells) {
  const fits = (count, axis) => count === 1 || (axis && count === axis.ids.length);
  if (!fits(outer.length, axes[0])) {
    return `${outer.length} parts separated by / for ${axes[0].name}, which has ${axes[0].ids.length} values`;
  }
  const bad = cells.find(parts => !fits(parts.length, axes[1]));
  if (bad) {
    return `${bad.length} parts separated by | for ${axes[1].name}, which has ${axes[1].ids.length} values`;
  }
  if (cells.some(parts => parts.some(part => !part.trim()))) return 'a part is empty';
  return null;
}

/** h-recipe semantics on a recipe block: the block and its title. */
function stampRecipe(el) {
  el.classList.add('h-recipe');
  const title = el.querySelector('h1, h2, h3, h4, h5, h6');
  if (title) title.classList.add('p-name');
}

/* ---- Variants ------------------------------------------------------------ */

/**
 * `when="measure:metric serves:1x,2x"` → [{ name, values }], or null with a
 * finding when any part names something the declaration lacks.
 */
function parseWhen(text, declaration, findings) {
  const conditions = [];
  const tokens = String(text).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    findings.push('when= is empty');
    return null;
  }
  for (const token of tokens) {
    const colon = token.indexOf(':');
    const name = colon > 0 ? token.slice(0, colon) : '';
    const values = colon > 0 ? token.slice(colon + 1).split(',').filter(Boolean) : [];
    if (!name || values.length === 0) {
      findings.push(`when="${text}": write choice:value, e.g. measure:metric`);
      return null;
    }
    if (!declaration) return null;
    const choice = declaration[name];
    if (!choice) {
      findings.push(`when="${text}": no choice is called "${name}"`);
      return null;
    }
    const unknown = values.filter(v => !choice.values.some(known => known.id === v));
    if (unknown.length > 0) {
      findings.push(`when="${text}": "${name}" has no value "${unknown.join('", "')}"`);
      return null;
    }
    if (conditions.some(c => c.name === name)) {
      findings.push(`when="${text}": "${name}" is named twice`);
      return null;
    }
    conditions.push({ name, values });
  }
  return conditions;
}

/** Turn an authored `when` into the variant markup; an invalid one stays visible. */
function stampVariant(el, declaration, findings) {
  const text = el.getAttribute('when');
  el.removeAttribute('when');
  const conditions = parseWhen(text, declaration, findings);
  if (!conditions) return;
  el.setAttribute('data-rc-when', conditions.map(c => `${c.name}:${c.values.join(',')}`).join(' '));
  el.classList.add('rc-variant');
  const showsByDefault = conditions.every(c => c.values.includes(declaration[c.name].default));
  el.classList.toggle('rc-off', !showsByDefault);
}

/* ---- Controls ------------------------------------------------------------ */

/** Replace a p.choose-set's directives with each choice's controls. */
function buildControls(document, set, declaration, labels, findings) {
  const spans = [...set.children].filter(el => el.matches('span.choose'));
  const built = [];
  for (const span of spans) {
    const name = span.getAttribute('data-of');
    const choice = declaration && name ? declaration[name] : null;
    if (!name) findings.push(':choose: needs of=<choice>, e.g. :choose:{of=serves}');
    else if (declaration && !choice) findings.push(`:choose:{of=${name}}: no choice is called "${name}"`);
    if (choice) built.push(controlFor(document, name, choice, scopeLabels(span, name, labels)));
  }

  set.classList.remove('choose-set');
  set.classList.add('rc-choose-set');
  set.textContent = '';
  built.forEach((control, i) => {
    if (i > 0) set.appendChild(document.createTextNode('\n'));
    set.appendChild(control);
  });
  if (built.length === 0) set.remove();
}

/**
 * The labels the nearest enclosing scope gives a choice, or null when no
 * scope overrides it here.
 */
function scopeLabels(el, name, labels) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const own = labels.get(node);
    if (own && own[name]) return own[name];
  }
  return null;
}

function controlFor(document, name, choice, override) {
  const labelOf = (value, i) => (override ? override[i] : value.label);
  const control = document.createElement('span');
  control.setAttribute('class', 'rc-choose');
  control.setAttribute('data-rc-of', name);

  const label = document.createElement('span');
  label.setAttribute('class', 'rc-label');
  label.textContent = choice.label;

  const index = choice.values.findIndex(v => v.id === choice.default);
  const shown = document.createElement('span');
  shown.setAttribute('class', 'rc-static');
  shown.textContent = labelOf(choice.values[index], index);

  const group = document.createElement('span');
  group.setAttribute('class', 'rc-buttons');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', choice.label);
  group.setAttribute('hidden', '');
  choice.values.forEach((value, i) => {
    if (i > 0) group.appendChild(document.createTextNode(' '));
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('class', 'rc-option');
    button.setAttribute('data-rc-value', value.id);
    button.setAttribute('aria-pressed', value.id === choice.default ? 'true' : 'false');
    button.textContent = labelOf(value, i);
    group.appendChild(button);
  });

  control.append(label, ' ', shown, ' ', group);
  return control;
}

/* ---- Findings ------------------------------------------------------------ */

function reportFindings(document, findings) {
  const unique = [...new Set(findings)];
  if (unique.length === 0) return;
  const list = document.createElement('ul');
  list.setAttribute('class', 'rc-findings');
  for (const message of unique) {
    console.warn(`reader-choices: ${message}`);
    const li = document.createElement('li');
    li.textContent = `⚠ ${message}`;
    list.appendChild(li);
  }
  document.body.insertBefore(list, document.body.firstChild);
}
