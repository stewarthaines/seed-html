/**
 * Bricks code-block transform (process/BRICKS_BLOCK_NOTATION.md).
 *
 * Turns each ```bricks fenced block (<pre><code class="language-bricks">, or
 * <pre class="bricks"> from Textile) into the element bricks3d.js draws in
 * the book: a building step dragged together part by part, or a finished
 * model the reader turns.
 *
 *   <div class="bricks" data-width="320" data-height="460" data-step="1"
 *        data-color="Yellow" data-spin="90" data-scale="0.5" data-alt="…">
 *     <span class="bricks-library" data-src="../Misc/bricks/core.mpd" hidden>
 *     <p class="bricks-set" data-color="White">   one per section; a model's colour
 *       <span class="bricks-part" data-is="3005" data-color="Red"
 *             data-at="0 -4 3" data-turn="90" data-from="0 0 9" data-step="2">
 *     </p>
 *     <div class="bricks-model" data-name="letter-o" data-color="Yellow" hidden>
 *       <span class="bricks-model-part" data-is=… data-color=… data-at=… data-turn=…>
 *     </div>
 *     <div class="bricks-notes"><p>Line 4: …</p></div>
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
  if (!blocks.length || !ctx) return document;

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

  // This chapter's record of the models it defines.
  const path = 'SOURCE/data/bricks/' + idref + '.json';
  const existing = await bricksReadText(ctx, path);
  const record = Object.keys(defined).length ? JSON.stringify(defined) : null;
  if (record !== null ? existing !== record : existing !== null && existing.trim() !== 'null') {
    await ctx.writeSourceText(path, record === null ? 'null' : record);
  }

  // Every model the book defines, this chapter's first, and who defines each.
  const models = Object.assign({}, defined);
  const definers = {};
  Object.keys(defined).forEach((name) => { definers[name] = [idref]; });
  for (const other of ctx.spine || []) {
    if (other.idref === idref) continue;
    let found = null;
    try { found = JSON.parse(await bricksReadText(ctx, 'SOURCE/data/bricks/' + other.idref + '.json')); } catch (e) { found = null; }
    if (!found || typeof found !== 'object') continue;
    for (const name of Object.keys(found)) {
      (definers[name] = definers[name] || []).push(other.idref);
      if (!(name in models)) models[name] = found[name];
    }
  }

  for (const step of steps) {
    const { header, sections } = step.parsed;
    const notes = step.notes;
    const div = document.createElement('div');
    div.setAttribute('class', 'bricks');
    if (ctx.viewport) {
      div.setAttribute('data-width', String(ctx.viewport.width));
      div.setAttribute('data-height', String(ctx.viewport.height));
    } else {
      notes.push('Bricks pages need a fixed-layout book; this one is reflowable.');
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
    if (header.alt) div.setAttribute('data-alt', header.alt);
    if (header.style) div.setAttribute('data-style', header.style);

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
    if (!libraries.length) notes.push(`No parts library: nothing under ${FOLDER} in the manifest.`);
    libraries.filter((l) => l.error).forEach((l) => notes.push(`${l.href} could not be read: ${l.error}`));

    const base = chapter ? chapter.href.replace(/[^/]*$/, '') : '';
    for (const href of files) {
      const library = document.createElement('span');
      library.setAttribute('class', 'bricks-library');
      library.setAttribute('data-src', bricksRelative(base, href));
      library.setAttribute('hidden', 'hidden');
      div.appendChild(library);
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
  return document;
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

// What the transform needs of a library: its colour names and its parts and
// models by bare name (parts/3001.dat, models/spaceman.ldr).
function bricksReadLibrary(href, text) {
  const library = { href, colours: {}, parts: {} };
  const split = text.search(/^0 FILE /m);
  const main = split < 0 ? text : text.slice(0, split);
  main.replace(/^0 !COLOUR\s+(\S+)\s+CODE\s+(\d+)/gm, (m, name) => {
    library.colours[name.toLowerCase()] = true;
  });
  text.replace(/^0 FILE (?:parts|models)\/([^/\s]+)\.(?:dat|ldr)\s*$/gim, (m, name) => {
    library.parts[name.toLowerCase()] = true;
  });
  return library;
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
