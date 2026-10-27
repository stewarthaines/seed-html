/**
 * Bricks code-block transform (process/BRICKS_BLOCK_NOTATION.md).
 *
 * Turns each ```bricks fenced block (<pre><code class="language-bricks">, or
 * <pre class="bricks"> from Textile) into the element bricks3d.js draws in
 * the book: a building step dragged together part by part, or a finished
 * model the reader turns.
 *
 *   <div class="bricks" data-width="320" data-height="460" data-step="1"
 *        data-color="Yellow" data-spin="90" data-scale="0.5" data-alt="…"
 *        data-open="end">                     open: a step to open at, while authoring
 *     <span class="bricks-library" data-src="../Misc/bricks/core.mpd" hidden>
 *     <p class="bricks-set" data-color="White">   one per section; a model's colour
 *       <span class="bricks-part" data-is="3005" data-color="Red"
 *             data-at="0 -4 3" data-turn="90" data-from="0 0 9" data-step="2">
 *     </p>
 *     <div class="bricks-model" data-name="letter-o" data-color="Yellow" hidden>
 *       <span class="bricks-model-part" data-is=… data-color=… data-at=… data-turn=…>
 *     </div>
 *     <div class="bricks-notes"><p>Line 4: …</p></div>
 *     <p class="bricks-pictures">Pictures only here. …</p>
 *   </div>
 *
 * The page size is the book's fixed-layout viewport (ctx.viewport); in a
 * reflowable book a step is a note and is not drawn, since the drag and the
 * fixed scale need a fixed page.
 *
 * A part with a from moves into place as the reader drags; a part without one
 * is there from the start. The first moving part of each step carries the
 * step's number.
 *
 * PARTS LIBRARIES. Every .mpd manifest item under Misc/bricks/ is a library,
 * read in manifest order: this extension's core.mpd, a set from each parts
 * extension installed, and the book's own. A step names only the libraries its
 * parts come from (with the one holding the colour table), so the reader's
 * device fetches no set the page does not use: one span.bricks-library each,
 * since the SEED.html preview resolves a data-src holding a single path. Part and colour names are
 * checked here, so mistakes show in the editor.
 *
 * MODELS. The header's `model:` names every part the block builds outside
 * `built`, where it ends up; a `model <name>` section names the parts under
 * it, with the colour on that line as its main colour (else the header's).
 * Any page can then place the model as one part. The models a chapter
 * defines are recorded at SOURCE/data/bricks/<idref>.json
 *
 *   { "letter-o": { "color": "Yellow", "parts": [{ "is": "3665a", "at": "0 -5 0" }, …] } }
 *
 * (`null` once a chapter that had models has none; an unchanged record is not
 * rewritten). A chapter's own models come first, then other chapters' in spine
 * order; a name defined in more than one chapter is noted. Each model a step
 * uses, and each model those use, is copied into the step. A record is current
 * once its chapter has rendered since the model last changed; packaging does
 * not render, so open a defining chapter after editing its model.
 *
 * PARTS PAGES. A block whose header has `inventory:` lists parts instead of
 * building anything: one span.bricks-part per part, with data-inventory,
 * data-columns and data-rows on the stage for bricks3d.js to lay out.
 * `library` lists the parts the libraries offer (data-is only); `book` lists
 * every chapter's counts added up (data-is, data-color, data-count), the
 * counts a chapter records at SOURCE/data/bricks/<idref>.counts.json as it
 * renders (see the counts below). A list is dealt out across every page of
 * its kind in reading order, a page's worth each; the other chapters' pages
 * are counted from their sources (SOURCE/text/<idref>.txt), so they need not
 * have rendered.
 *
 * STILLS. Each step also gets an image of itself, drawn here while the page
 * renders: <img class="bricks-still"> first in the step, a PNG data: URL at
 * twice the page size, showing the step finished with its step number and
 * parts callout, as a reader first sees it, and the description as its alt
 * text. bricks3d.js draws it (setupStage with its still option, the same code
 * that draws the page in the book) with three-bricks.js, both loaded here as
 * scripts. The book's page hides it once the live model has drawn; a reading
 * system without WebGL 2 shows only the image. A step with notes, or where
 * the frame cannot draw (no OffscreenCanvas or WebGL 2), has no still.
 *
 * THE PICTURES LINE. A reading system that does not run bricks3d.js shows
 * only the stills. The book says so in its own words, once, with a
 * `pictures:` key on any Bricks page; the first page in reading order that
 * has one is used. Its chapter records the line with its models, under the
 * key "pictures line" (no model name has a space), and every Bricks page
 * carries it as p.bricks-pictures, which bricks3d.js hides where the page
 * works. A book with no `pictures:` key has no line.
 *
 * Notes (malformed lines, unknown parts and colours, duplicate models) are
 * shown in the page, in English, for the author.
 *
 * Needs parseBricks (parseBricks.js), jsyaml (js-yaml.min.js), and for the
 * stills setupStage, readLibrary, mergeLibraries (bricks3d.js) and THREE
 * (three-bricks.js): this extension's scripts.
 *
 * @param {Document} document - the chapter's rendered DOM (HTML)
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context: reads the manifest's libraries,
 *   reads and writes SOURCE/data/bricks/
 * @returns {Promise<Document>} the transformed document
 */
async function transformDOM(document, idref, ctx) {
  const blocks = [...document.querySelectorAll('pre.bricks, pre:has(code.language-bricks)')];
  if (!ctx) return document;
  const path = 'SOURCE/data/bricks/' + idref + '.json';
  const countsPath = 'SOURCE/data/bricks/' + idref + '.counts.json';
  if (!blocks.length) {
    // A chapter that has lost its blocks no longer defines models, sets the
    // pictures line or adds to the book's parts list.
    for (const record of [path, countsPath]) {
      const stale = await bricksReadText(ctx, record);
      if (stale !== null && stale.trim() !== 'null') await ctx.writeSourceText(record, 'null');
    }
    return document;
  }

  const FOLDER = 'Misc/bricks/';
  const manifest = ctx.manifest || [];
  const chapter = manifest.find((item) => item.id === idref);
  const libraries = [];
  for (const item of manifest) {
    if (!item.href.startsWith(FOLDER) || !/\.mpd$/i.test(item.href)) continue;
    try {
      const text = await ctx.readManifestText(item.href);
      libraries.push(Object.assign(bricksReadLibrary(item.href, text), { text }));
    } catch (error) {
      libraries.push({ href: item.href, colours: {}, parts: {}, error: error.message });
    }
  }
  const coloured = libraries.find((library) => Object.keys(library.colours).length);
  const colourKnown = (name) => !!coloured && name.toLowerCase() in coloured.colours;

  // Parse every block, and the models this chapter defines.
  const steps = blocks.map((pre) => {
    const code = pre.querySelector('code');
    const parsed = parseBricks((code || pre).textContent || '');
    return { pre, parsed, notes: parsed.notes.map((n) => `Line ${n.line}: ${n.message}`) };
  });
  const defined = {};
  for (const { parsed } of steps) {
    const { header, sections } = parsed;
    if (header.model) {
      defined[header.model.toLowerCase()] = bricksModel(header.color,
        sections.filter((s) => s.kind !== 'built').flatMap((s) => s.parts));
    }
    for (const s of sections) {
      if (s.kind === 'model' && s.name) defined[s.name.toLowerCase()] = bricksModel(s.color || header.color, s.parts);
    }
  }

  // The pictures line this chapter sets: its first block's with the key.
  const PICTURES = 'pictures line';
  const saying = steps.filter((step) => step.parsed.header.pictures);
  const said = saying.length ? saying[0].parsed.header.pictures : null;

  // This chapter's record of the models it defines, and its pictures line.
  const existing = await bricksReadText(ctx, path);
  const kept = said ? Object.assign({}, defined, { [PICTURES]: said }) : defined;
  const record = Object.keys(kept).length ? JSON.stringify(kept) : null;
  if (record !== null ? existing !== record : existing !== null && existing.trim() !== 'null') {
    await ctx.writeSourceText(path, record === null ? 'null' : record);
  }

  // Every model the book defines, this chapter's first, and who defines each;
  // the chapters that set a pictures line, in reading order.
  const models = Object.assign({}, defined);
  const definers = {};
  Object.keys(defined).forEach((name) => { definers[name] = [idref]; });
  const sayers = [];
  const spine = ctx.spine || [];
  if (said && !spine.some((other) => other.idref === idref)) sayers.push({ idref, line: said });
  for (const other of spine) {
    if (other.idref === idref) {
      if (said) sayers.push({ idref, line: said });
      continue;
    }
    let found = null;
    try { found = JSON.parse(await bricksReadText(ctx, 'SOURCE/data/bricks/' + other.idref + '.json')); } catch (e) { found = null; }
    if (!found || typeof found !== 'object') continue;
    if (typeof found[PICTURES] === 'string' && found[PICTURES]) sayers.push({ idref: other.idref, line: found[PICTURES] });
    for (const name of Object.keys(found)) {
      if (name === PICTURES) continue;
      (definers[name] = definers[name] || []).push(other.idref);
      if (!(name in models)) models[name] = found[name];
    }
  }

  // This chapter's part counts, for the book's parts list: what a reader needs
  // to build its pages, by part and colour, recorded at
  // SOURCE/data/bricks/<idref>.counts.json as { "3005 yellow": 4, … } (null
  // when nothing counts). A page counts its moving parts (count: steps, the
  // default), every part (all) or nothing (none); a model the book builds is
  // counted where it is built, not where it is placed, and a model from a
  // parts set (a minifig) counts as one item.
  const counts = {};
  for (const { parsed } of steps) {
    const { header, sections } = parsed;
    const mode = header.count || 'steps';
    if (header.inventory || mode === 'none') continue;
    for (const s of sections) {
      for (const part of s.parts) {
        if (mode === 'steps' && !part.from) continue;
        const name = part.part.toLowerCase();
        if (name in models || !libraries.some((l) => name in l.parts)) continue;
        const colour = part.color || s.color || header.color;
        if (!colour || !colourKnown(colour)) continue;
        const key = name + ' ' + colour.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }
  const countsRecord = Object.keys(counts).length ? JSON.stringify(counts) : null;
  const countsExisting = await bricksReadText(ctx, countsPath);
  if (countsRecord !== null ? countsExisting !== countsRecord : countsExisting !== null && countsExisting.trim() !== 'null') {
    await ctx.writeSourceText(countsPath, countsRecord === null ? 'null' : countsRecord);
  }

  // Parts pages deal their list out across themselves in reading order, each
  // kind on its own: this chapter's take their turn after the other chapters'
  // before it. The library list is every part the libraries offer; the book's
  // is every chapter's counts added up.
  const kinds = {};
  for (const kind of ['library', 'book']) {
    const own = steps.filter((step) => step.parsed.header.inventory === kind);
    if (!own.length) continue;
    kinds[kind] = {
      own,
      pages: await bricksInventoryPages(ctx, idref, kind),
      list: kind === 'library' ? bricksOffered(libraries) : await bricksCounted(ctx, idref, counts, libraries),
    };
  }

  const pictures = sayers.length ? sayers[0].line : null;
  for (const step of steps) {
    const { header, sections } = step.parsed;
    const notes = step.notes;
    if (header.pictures) {
      if (step !== saying[0]) notes.push('pictures is set on an earlier page of this chapter; the first is used.');
      else if (sayers[0].idref !== idref) notes.push(`pictures is set first in ${sayers[0].idref}; that line is used.`);
      else if (sayers.length > 1) notes.push(`pictures is also set in ${sayers.slice(1).map((s) => s.idref).join(', ')}.`);
    }
    const div = document.createElement('div');
    div.setAttribute('class', 'bricks');
    if (ctx.viewport) {
      div.setAttribute('data-width', String(ctx.viewport.width));
      div.setAttribute('data-height', String(ctx.viewport.height));
    } else {
      notes.push('Bricks pages need a fixed-layout book; this one is reflowable.');
    }
    if (header.alt) div.setAttribute('data-alt', header.alt);
    if (header.style) div.setAttribute('data-style', header.style);

    if (header.inventory) {
      // A parts page: its share of the list, one cell each.
      const { own, pages, list } = kinds[header.inventory];
      const book = header.inventory === 'book';
      div.setAttribute('data-inventory', header.inventory);
      if (!book) {
        const colour = header.color || 'Light_Bluish_Grey';
        if (colourKnown(colour)) div.setAttribute('data-color', colour);
        else if (header.color) notes.push(`The header's color, ${header.color}, is not an LDraw colour.`);
      }
      const files = new Set(coloured ? [coloured.href] : []);
      if (ctx.viewport) {
        const grid = bricksInventoryGrid(ctx.viewport);
        div.setAttribute('data-columns', String(grid.columns));
        div.setAttribute('data-rows', String(grid.rows));
        const size = grid.columns * grid.rows;
        const page = pages.before + own.indexOf(step);
        const last = page === pages.before + own.length + pages.after - 1;
        const share = list.slice(page * size, (page + 1) * size);
        const set = document.createElement('p');
        set.setAttribute('class', 'bricks-set');
        for (const part of share) {
          const span = document.createElement('span');
          span.setAttribute('class', 'bricks-part');
          span.setAttribute('data-is', part.is);
          if (book) {
            span.setAttribute('data-color', part.colour);
            span.setAttribute('data-count', String(part.count));
          }
          set.appendChild(span);
          files.add(part.href);
        }
        div.appendChild(set);
        if (book && !list.length) {
          notes.push('Nothing counted yet: open the pages that build the book, then this one.');
        }
        if (list.length && !share.length) notes.push('Nothing left to list: the parts pages before this one hold every part.');
        if (last && list.length > (page + 1) * size) {
          notes.push(`${list.length - (page + 1) * size} more parts: add another parts page.`);
        }
      }
      await finish(step, div, notes, files);
      continue;
    }
    const first = sections.find((s) => s.kind === 'step');
    // A turning page has no steps, so a step number only when its step line
    // gives one (the last step of a sheet, where the model is turned).
    if (!header.spin) div.setAttribute('data-step', String(first ? first.number : 1));
    else if (first && first.given) div.setAttribute('data-step', String(first.number));
    if (header.color) {
      if (colourKnown(header.color)) div.setAttribute('data-color', header.color);
      else notes.push(`The header's color, ${header.color}, is not an LDraw colour.`);
    }
    if (header.spin) div.setAttribute('data-spin', String(header.spin));
    if (header.scale !== 1) div.setAttribute('data-scale', String(header.scale));
    if (header.open !== null) div.setAttribute('data-open', String(header.open));

    // The parts, a paragraph per section; the libraries and models they use.
    const used = [];
    const files = new Set(coloured ? [coloured.href] : []);
    const want = (is, line) => {
      const name = is.toLowerCase();
      if (name in models) {
        if (used.includes(name)) return true;
        used.push(name);
        for (const part of models[name].parts || []) want(part.is, line);
        return true;
      }
      const library = libraries.find((l) => name in l.parts);
      if (library) files.add(library.href);
      return !!library;
    };
    for (const s of sections) {
      const set = document.createElement('p');
      set.setAttribute('class', 'bricks-set');
      if (s.color) {
        if (colourKnown(s.color)) set.setAttribute('data-color', s.color);
        else notes.push(`Line ${s.line}: ${s.color} is not an LDraw colour.`);
      }
      let numbered = s.kind !== 'step';
      for (const part of s.parts) {
        if (!want(part.part, part.line)) {
          notes.push(`Line ${part.line}: ${part.part} is not in the parts libraries or the book's models.`);
          continue;
        }
        if (part.color && !colourKnown(part.color)) {
          notes.push(`Line ${part.line}: ${part.color} is not an LDraw colour.`);
          continue;
        }
        const span = document.createElement('span');
        span.setAttribute('class', 'bricks-part');
        span.setAttribute('data-is', part.part);
        if (part.color) span.setAttribute('data-color', part.color);
        span.setAttribute('data-at', part.at.join(' '));
        if (part.turn) span.setAttribute('data-turn', String(part.turn));
        if (part.from) {
          span.setAttribute('data-from', part.from.join(' '));
          if (!numbered) span.setAttribute('data-step', String(s.number));
          numbered = true;
        }
        set.appendChild(span);
      }
      div.appendChild(set);
    }
    for (const name of used) {
      if (definers[name] && definers[name].length > 1) {
        notes.push(`The model ${name} is defined in ${definers[name].join(', ')}; the first is used.`);
      }
    }
    for (const name of Object.keys(defined)) {
      if (definers[name].length > 1 && !used.includes(name)) {
        notes.push(`The model ${name} is also defined in ${definers[name].slice(1).join(', ')}.`);
      }
    }
    for (const name of used) {
      const holder = document.createElement('div');
      holder.setAttribute('class', 'bricks-model');
      holder.setAttribute('data-name', name);
      holder.setAttribute('hidden', 'hidden');
      if (models[name].color) holder.setAttribute('data-color', models[name].color);
      for (const part of models[name].parts || []) {
        const span = document.createElement('span');
        span.setAttribute('class', 'bricks-model-part');
        for (const key of ['is', 'color', 'at', 'turn']) {
          if (part[key] !== undefined) span.setAttribute('data-' + key, part[key]);
        }
        holder.appendChild(span);
      }
      div.appendChild(holder);
    }
    await finish(step, div, notes, files);
  }
  return document;

  // The libraries a page names, its notes, its still image; then it takes the
  // block's place.
  async function finish(step, div, notes, files) {
    if (!libraries.length) notes.push(`No parts library: nothing under ${FOLDER} in the manifest.`);
    libraries.filter((l) => l.error).forEach((l) => notes.push(`${l.href} could not be read: ${l.error}`));

    const base = chapter ? chapter.href.replace(/[^/]*$/, '') : '';
    // The holders follow the parts: a library span goes before the first model.
    const before = div.querySelector('.bricks-model');
    for (const href of files) {
      const library = document.createElement('span');
      library.setAttribute('class', 'bricks-library');
      library.setAttribute('data-src', bricksRelative(base, href));
      library.setAttribute('hidden', 'hidden');
      div.insertBefore(library, before);
    }

    if (notes.length) {
      const box = document.createElement('div');
      box.setAttribute('class', 'bricks-notes');
      for (const text of notes) {
        const p = document.createElement('p');
        p.textContent = text;
        box.appendChild(p);
      }
      div.appendChild(box);
    }
    if (pictures) {
      const line = document.createElement('p');
      line.setAttribute('class', 'bricks-pictures');
      line.textContent = pictures;
      div.appendChild(line);
    }
    if (!notes.length) {
      const drawn = await bricksStill(div, libraries.filter((l) => files.has(l.href)));
      if (drawn) {
        const img = document.createElement('img');
        img.setAttribute('class', 'bricks-still');
        img.setAttribute('src', drawn.src);
        img.setAttribute('alt', drawn.alt);
        div.insertBefore(img, div.firstChild);
      }
    }
    step.pre.replaceWith(div);
  }
}

// A step's still image, { src, alt }, or null when this frame cannot draw it.
async function bricksStill(div, used) {
  if (typeof setupStage !== 'function' || typeof OffscreenCanvas === 'undefined' ||
      typeof THREE === 'undefined' || !used.length) return null;
  const library = mergeLibraries(used.map((l) => l.parsed || (l.parsed = readLibrary(l.text))));
  const drawn = await new Promise((resolve) => {
    setupStage(div, library, { done: (canvas, alt) => resolve(canvas && { canvas, alt }) });
  });
  if (!drawn) return null;
  const blob = await drawn.canvas.convertToBlob({ type: 'image/png' });
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { src, alt: drawn.alt };
}

// What the transform needs of a library: its colour names, and its parts and
// models by bare name (parts/3001.dat, models/spaceman.ldr) with the name each
// file's first line gives it ("Brick  1 x  1").
function bricksReadLibrary(href, text) {
  const library = { href, colours: {}, parts: {}, names: {} };
  const split = text.search(/^0 FILE /m);
  const main = split < 0 ? text : text.slice(0, split);
  main.replace(/^0 !COLOUR\s+(\S+)\s+CODE\s+(\d+)/gm, (m, name) => {
    library.colours[name.toLowerCase()] = true;
  });
  text.replace(/^0 FILE (?:parts|models)\/([^/\s]+)\.(?:dat|ldr)\s*\n(?:0 (.*))?/gim, (m, name, title) => {
    library.parts[name.toLowerCase()] = true;
    library.names[name.toLowerCase()] = (title || name).replace(/\s+/g, ' ').trim();
  });
  return library;
}

// How many parts a parts page holds: the columns and rows of its grid, for a
// 320 x 460 page 4 x 5, cells at least 72 x 84 px scaled with the page.
// bricks3d.js lays the cells out from these.
function bricksInventoryGrid(viewport) {
  const u = Math.min(viewport.width / 320, viewport.height / 460);
  return {
    columns: Math.max(1, Math.floor((viewport.width - 24 * u) / (72 * u))),
    rows: Math.max(1, Math.floor((viewport.height - 24 * u) / (84 * u))),
  };
}

// The parts the libraries offer, for a parts page: each set in manifest order,
// sorted by name (then number) within it, without LDraw's ~ files (moved and
// alias parts).
function bricksOffered(libraries) {
  const offered = [];
  const seen = new Set();
  for (const library of libraries) {
    if (library.error) continue;
    const names = Object.keys(library.names)
      .filter((is) => !library.names[is].startsWith('~'))
      .sort((a, b) => library.names[a].localeCompare(library.names[b], 'en', { numeric: true }) ||
        a.localeCompare(b, 'en', { numeric: true }));
    for (const is of names) {
      if (seen.has(is)) continue;
      seen.add(is);
      offered.push({ is, href: library.href });
    }
  }
  return offered;
}

// The book's parts list: every chapter's counts added up in reading order
// (this chapter's fresh, the others' as of their last render), as
// [{ is, colour, count, href }], sorted by colour, then by part name and
// number. A counted part no library holds any more is left out.
async function bricksCounted(ctx, idref, counts, libraries) {
  const totals = {};
  for (const other of ctx.spine || []) {
    let found = counts;
    if (other.idref !== idref) {
      try { found = JSON.parse(await bricksReadText(ctx, 'SOURCE/data/bricks/' + other.idref + '.counts.json')); } catch (e) { found = null; }
    }
    if (!found || typeof found !== 'object') continue;
    for (const key of Object.keys(found)) {
      if (typeof found[key] === 'number') totals[key] = (totals[key] || 0) + found[key];
    }
  }
  const list = [];
  for (const key of Object.keys(totals)) {
    const [is, colour] = key.split(' ');
    const library = libraries.find((l) => !l.error && is in l.parts);
    if (library) list.push({ is, colour, count: totals[key], href: library.href, name: library.names[is] || is });
  }
  return list.sort((a, b) => a.colour.localeCompare(b.colour) ||
    a.name.localeCompare(b.name, 'en', { numeric: true }) || a.is.localeCompare(b.is, 'en', { numeric: true }));
}

// How many parts pages of a kind the other chapters hold, before and after
// this one in reading order: a chapter's source is read for its
// `inventory: <kind>` header lines, so the count is current without the
// chapter having rendered.
async function bricksInventoryPages(ctx, idref, kind) {
  let before = 0, after = 0, seen = false;
  const line = new RegExp(`^\\s*inventory:\\s*${kind}\\s*$`, 'gim');
  for (const other of ctx.spine || []) {
    if (other.idref === idref) {
      seen = true;
      continue;
    }
    const text = await bricksReadText(ctx, 'SOURCE/text/' + other.idref + '.txt');
    const n = text ? (text.match(line) || []).length : 0;
    if (seen) after += n;
    else before += n;
  }
  return { before, after };
}

// A model as recorded: its main colour and its parts where they end up.
function bricksModel(colour, parts) {
  const model = {
    parts: parts.map((part) => {
      const recorded = { is: part.part };
      if (part.color) recorded.color = part.color;
      recorded.at = part.at.join(' ');
      if (part.turn) recorded.turn = String(part.turn);
      return recorded;
    }),
  };
  if (colour) model.color = colour;
  return model;
}

// An href relative to a chapter's folder; both relative to the OPF.
function bricksRelative(base, href) {
  const from = base.split('/').filter(Boolean);
  const to = href.split('/');
  while (from.length && to.length > 1 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  return '../'.repeat(from.length) + to.join('/');
}

// A source file's text, or null when there is none.
async function bricksReadText(ctx, path) {
  try {
    const text = await ctx.readSourceText(path);
    return typeof text === 'string' ? text : null;
  } catch (e) {
    return null;
  }
}
