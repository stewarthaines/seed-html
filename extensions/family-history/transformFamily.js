/**
 * Family history: a kinship panel, a surname index, portrait strips,
 * lifelines and family trees, derived from every chapter's frontmatter
 * record. Nothing is hand-maintained beyond the records: children and
 * siblings come from inverting `parents:`, partnerships from scanning both
 * sides, "links to a chapter" from the OPF manifest.
 *
 * THE RECORD. A person chapter opens with a YAML frontmatter block (the app
 * splits it off and hands it over as ctx.frontmatter; every other chapter's
 * record is read from SOURCE/data/frontmatter/<idref>.json — see
 * src/lib/transform/TRANSFORM_CONTEXT.md). Its keys, validated against
 * person.schema.json beside this script:
 *
 *   display, nickname, birth, death, birthplace, deathplace,
 *   parents: [id, id], partner + married + married_place, others: { id: {…} }
 *
 * `partner` is one id (with the record's own `married` / `married_place`) or
 * a list, in order, of ids or { id, married, married_place }. Dates are EDTF
 * strings or bare integer years. `others:` holds the same record shape for
 * relatives who have no chapter; a stub may be a bare null. Precedence: a
 * chapter's own record beats a stub with its id; between two stubs the
 * earlier chapter in spine order wins and the duplicate is a finding.
 *
 * FINDINGS — a schema violation, a duplicate stub, a `married` beside a list
 * of partners, an orphan stub (no parents, nobody's partner, nobody's
 * parent), a region naming an unknown person — print as a list at the top
 * of every rendered `:family:` panel, so the author sees them in the preview
 * they are typing next to, and go to the console as well for chapters
 * without a panel.
 *
 * MARKERS, each a paragraph of its own. Written bare — `:family:`,
 * `:family-index:`, `:portraits:`, `:lifeline:`, `:tree:` — a marker is a
 * symbol with no attributes, which djot renders as literal text and
 * Markdown never parses; it is matched here by paragraph text and means
 * "this chapter's person". With attributes — `:portraits:{of=…}`,
 * `:lifeline:{of=… as=… include=…}`, `:tree:{of=… depth=… to=… via=…}` —
 * it arrives as the text formats' attributed-symbol carrier,
 * `<p class="<alias>-set"><span class="<alias>" data-…></span></p>`, where
 * consecutive lines form one set — for `:lifeline:` the unit that shares a
 * time scale. A bare marker becomes a one-span set here, so both forms
 * reach the renderers as one shape.
 *
 * PORTRAITS read what the photo-regions extension recorded per chapter at
 * SOURCE/data/regions/<idref>.json — every `:region:` it bound, with the
 * image's manifest href, its box and, when the panel library knew it, the
 * image's pixel size (a crop needs the size for its aspect; without it the
 * crop is skipped with a console warning). A region's `of=` is free text
 * resolved against the records here; one that matches no record is a
 * finding. Soft dependency by path only: no regions data, no portraits,
 * nothing errors. Naming the faces IN a photograph is photo-regions' job.
 *
 * LABELS follow ctx.language (en, de); dates format through Intl in the
 * book's language, so day/month order is metadata, not code.
 *
 * Structural CSS ships as Styles/family.css; the book's look stays in its
 * page.css. `figureSetup` (img.figure → figure/figcaption) is deliberately
 * NOT here — it is a project script, not family logic.
 *
 * @param {Document} document - the chapter's rendered DOM
 * @param {string} idref - spine item id for this chapter
 * @param {object} ctx - transform context (frontmatter, spine, manifest, readSourceText, language)
 */

const LABELS = {
  en: {
    parents: 'Parents',
    siblings: 'Siblings',
    partner: 'Partner',
    partners: 'Partners',
    b: 'b.',
    d: 'd.',
    m: 'm.',
    born: 'born',
    died: 'died',
    married: 'married',
    alsoMarried: 'also married',
    inYear: 'in',
    circa: 'c.',
    and: 'and',
    more: '… {n} more',
    unknown: 'Unknown',
    noRecord: 'No person record for "{id}" — add YAML frontmatter to this chapter.',
    noPeople: 'No people found to generate an index. Package the book once so every chapter has rendered, then re-render.',
    inPhotograph: '{name} in a photograph',
    inPhotographIn: '{name} in a photograph in {chapter}',
    inPhotographHere: '{name} in a photograph in this chapter',
  },
  de: {
    parents: 'Eltern',
    siblings: 'Geschwister',
    partner: 'Partner',
    partners: 'Partner',
    b: 'geb.',
    d: 'gest.',
    m: 'verh.',
    born: 'geboren',
    died: 'gestorben',
    married: 'verheiratet mit',
    alsoMarried: 'auch verheiratet mit',
    inYear: 'im Jahr',
    circa: 'um',
    and: 'und',
    more: '… {n} weitere',
    unknown: 'Unbekannt',
    noRecord: 'Kein Personendatensatz für „{id}“ — dem Kapitel YAML-Frontmatter voranstellen.',
    noPeople:
      'Keine Personen für ein Register gefunden. Das Buch einmal paketieren, damit jedes Kapitel gerendert ist, und neu rendern.',
    inPhotograph: '{name} auf einer Fotografie',
    inPhotographIn: '{name} auf einer Fotografie in {chapter}',
    inPhotographHere: '{name} auf einer Fotografie in diesem Kapitel',
  },
};

/** Portrait crop height; each crop's width follows its region's aspect. */
const PORTRAIT_HEIGHT_EM = 7;

/** Per-render state, rebuilt by loadFamily. */
let people = {}; // id → record (chapter records beat `others:` stubs)
let recordChapter = {}; // id → chapter whose block defined the record
let chapterIds = new Set(); // manifest chapter ids — a person links iff present
let chapterHrefs = {}; // chapter idref → OPF manifest href
let chapterOrder = {}; // chapter idref → spine position
let portraits = {}; // person id → [{ href, at, size, chapterId }]
let findings = []; // { where, id, message }
let labels = LABELS.en;
let language = 'en';
let schemaValidator = null;
let schemaChecked = false;

function t(key, vars) {
  let text = labels[key] || LABELS.en[key] || key;
  for (const [name, value] of Object.entries(vars || {})) {
    text = text.split('{' + name + '}').join(String(value));
  }
  return text;
}

function addFinding(where, id, message) {
  const entry = { where, id, message };
  if (!findings.some(f => f.where === where && f.id === id && f.message === message)) {
    findings.push(entry);
  }
}

/* ---- Records ------------------------------------------------------------ */

async function readJSON(ctx, path) {
  if (!ctx || typeof ctx.readSourceText !== 'function') return null;
  try {
    return JSON.parse(await ctx.readSourceText(path));
  } catch (error) {
    return null;
  }
}

/** Chapters in reading order: the spine, or manifest order without one. */
function chapterList(ctx) {
  const manifest = ctx && Array.isArray(ctx.manifest) ? ctx.manifest : [];
  const isChapter = item => {
    if (!item || item.mediaType !== 'application/xhtml+xml') return false;
    const props = Array.isArray(item.properties)
      ? item.properties.join(' ')
      : String(item.properties || '');
    return !props.split(/\s+/).includes('nav');
  };
  const byId = new Map(manifest.filter(isChapter).map(item => [item.id, item]));
  const spine = ctx && Array.isArray(ctx.spine) ? ctx.spine : [];
  const ordered = [];
  for (const entry of spine) {
    const item = byId.get(entry && entry.idref);
    if (item && !ordered.includes(item)) ordered.push(item);
  }
  for (const item of byId.values()) if (!ordered.includes(item)) ordered.push(item);
  return ordered;
}

/**
 * The schema validator, built once per render from the extension's own
 * person.schema.json (copied into SOURCE/extensions/family-history/ on
 * install). Missing schema or library → no validation, one console note.
 */
async function loadValidator(ctx) {
  if (schemaChecked) return schemaValidator;
  schemaChecked = true;
  schemaValidator = null;
  const schema = await readJSON(ctx, 'SOURCE/extensions/family-history/person.schema.json');
  if (!schema) {
    console.warn('family-history: person.schema.json not found — records are not validated');
    return null;
  }
  if (typeof jsonSchema === 'undefined' || typeof jsonSchema.Validator !== 'function') {
    console.warn('family-history: json-schema.js not loaded — records are not validated');
    return null;
  }
  try {
    schemaValidator = new jsonSchema.Validator(schema, '2020-12', false);
  } catch (error) {
    console.error('family-history: person.schema.json is not a valid schema', error);
  }
  return schemaValidator;
}

const DATE_KEYS = new Set(['birth', 'death', 'married']);
/** Every key the schema knows, at any level — an additionalProperties error
 *  for one of these is the validator restating a failed value, not a typo. */
const KNOWN_KEYS = new Set([
  'display',
  'nickname',
  'birth',
  'death',
  'birthplace',
  'deathplace',
  'parents',
  'partner',
  'married',
  'married_place',
  'others',
  'id',
]);

/**
 * Validate one chapter's record; each distinct offence becomes one finding
 * against the person it concerns (the chapter's own person, or the stub).
 */
function validateRecord(validator, chapterId, record) {
  if (!validator) return;
  let result;
  try {
    result = validator.validate(record);
  } catch (error) {
    console.error('family-history: validation failed', error);
    return;
  }
  if (result.valid) return;
  for (const err of result.errors) {
    // Children of a failing branch repeat the parent's story; keep the
    // shallowest statement of each problem.
    if (err.keyword === 'false' || err.keyword === 'properties') continue;
    if (/\/anyOf\/\d+\//.test(err.keywordLocation)) continue;
    const path = err.instanceLocation.replace(/^#\/?/, '').split('/').filter(Boolean);
    let subject = chapterId;
    let keyPath = path;
    if (path[0] === 'others') {
      subject = path[1] || chapterId;
      keyPath = path.slice(2);
    }
    if (err.keyword === 'additionalProperties') {
      const m = /Property "([^"]*)"/.exec(err.error || '');
      const key = m ? m[1] : '?';
      if (!KNOWN_KEYS.has(key)) addFinding(chapterId, subject, `unknown key "${key}"`);
      continue;
    }
    if (path[0] === 'others' && path.length === 2 && err.keyword === 'anyOf') {
      addFinding(chapterId, subject, 'record must be a map of facts, or null');
      continue;
    }
    const key = keyPath[0] || '';
    if (DATE_KEYS.has(key) && keyPath.length === 1) {
      addFinding(chapterId, subject, `${key} is not an EDTF date`);
    } else if (key === 'partner' && keyPath[keyPath.length - 1] === 'married') {
      addFinding(chapterId, subject, 'partner: married is not an EDTF date');
    } else if (key === 'partner') {
      addFinding(
        chapterId,
        subject,
        'partner must be an id, or a list of ids and { id, married, married_place }'
      );
    } else if (key === 'parents') {
      addFinding(chapterId, subject, 'parents must be a list of one or two ids');
    } else if (key) {
      addFinding(chapterId, subject, `${key}: ${err.error || err.keyword}`);
    } else {
      addFinding(chapterId, subject, err.error || err.keyword);
    }
  }
}

/** Parse "x,y,w,h" (percent) → { x, y, w, h } or null. */
function parseAt(value) {
  const parts = String(value == null ? '' : value)
    .split(',')
    .map(s => Number(s.trim()));
  if (parts.length !== 4 || !parts.every(Number.isFinite) || parts[2] <= 0 || parts[3] <= 0) {
    return null;
  }
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

async function loadFamily(ctx, idref) {
  people = {};
  recordChapter = {};
  chapterIds = new Set();
  chapterHrefs = {};
  chapterOrder = {};
  portraits = {};
  findings = [];
  schemaChecked = false;
  language = (ctx && ctx.language) || 'en';
  labels = LABELS[language] || LABELS[String(language).split('-')[0]] || LABELS.en;

  const chapters = chapterList(ctx);
  const validator = await loadValidator(ctx);
  const stubs = new Set();
  const regionSets = [];
  let position = 0;

  for (const chapter of chapters) {
    chapterIds.add(chapter.id);
    chapterHrefs[chapter.id] = chapter.href;
    chapterOrder[chapter.id] = position++;

    const record =
      chapter.id === idref && ctx && ctx.frontmatter !== undefined
        ? ctx.frontmatter
        : await readJSON(ctx, 'SOURCE/data/frontmatter/' + chapter.id + '.json');
    if (record && typeof record === 'object' && !Array.isArray(record)) {
      validateRecord(validator, chapter.id, record);
      const { others, ...self } = record;
      // A chapter's own record is authoritative. A block that is only an
      // `others:` map (a people chapter) makes the chapter no person.
      if (Object.keys(self).length > 0) {
        people[chapter.id] = self;
        recordChapter[chapter.id] = chapter.id;
      }
      if (others && typeof others === 'object') {
        for (const [id, stub] of Object.entries(others)) {
          if (id in people) {
            if (chapterIds.has(id) && !stubs.has(id)) continue; // a chapter wins silently
            if (stubs.has(id)) {
              addFinding(
                chapter.id,
                id,
                `also defined in ${recordChapter[id]}, which wins — consolidate`
              );
            }
            continue;
          }
          if (stub && typeof stub === 'object' && !Array.isArray(stub)) {
            people[id] = stub;
          } else {
            people[id] = {};
          }
          recordChapter[id] = chapter.id;
          stubs.add(id);
        }
      }
    }

    const regions = await readJSON(ctx, 'SOURCE/data/regions/' + chapter.id + '.json');
    if (Array.isArray(regions)) regionSets.push({ chapterId: chapter.id, regions });
  }
  // A chapter read after a stub with its id: the chapter still wins.
  for (const chapter of chapters) {
    if (stubs.has(chapter.id) && people[chapter.id]) stubs.delete(chapter.id);
  }

  // `married` beside a list of partners has no partner to pair with.
  for (const [id, person] of Object.entries(people)) {
    if (Array.isArray(person.partner) && (person.married || person.married_place)) {
      addFinding(
        recordChapter[id],
        id,
        'married / married_place beside a list of partners — move them into the list'
      );
    }
  }

  // Orphan stubs: no parents, no partnership from either side, no children.
  for (const id of stubs) {
    const person = people[id];
    if (
      !Array.isArray(person.parents) &&
      partnershipsOf(id).length === 0 &&
      childrenOf(id).length === 0
    ) {
      addFinding(recordChapter[id], id, 'orphan record — no parents, nobody’s partner or parent');
    }
  }

  // Portraits: every region naming a known person, first per photograph.
  for (const { chapterId, regions } of regionSets) {
    for (const region of regions) {
      if (!region || typeof region !== 'object') continue;
      const of = typeof region.of === 'string' ? region.of.trim() : '';
      if (!of) continue;
      if (!(of in people)) {
        addFinding(chapterId, of, 'a photograph names this id, which is not a person record');
        continue;
      }
      const at = parseAt(region.at);
      if (!at || typeof region.href !== 'string') continue;
      const size =
        region.size && Number(region.size.w) > 0 && Number(region.size.h) > 0
          ? { w: Number(region.size.w), h: Number(region.size.h) }
          : null;
      const list = portraits[of] || (portraits[of] = []);
      if (!list.some(crop => crop.href === region.href)) {
        list.push({ href: region.href, at, size, chapterId });
      }
    }
  }
  for (const list of Object.values(portraits)) {
    list.sort((a, b) => chapterOrder[a.chapterId] - chapterOrder[b.chapterId]);
  }

  for (const finding of findings) {
    console.warn(`family-history: ${finding.id}: ${finding.message} (${finding.where})`);
  }
}

/* ---- Derivations -------------------------------------------------------- */

/** The partnerships a record declares itself, in order. */
function partnersDeclared(person) {
  if (!person) return [];
  const out = [];
  if (typeof person.partner === 'string') {
    out.push({ partnerId: person.partner, married: person.married, place: person.married_place });
  } else if (Array.isArray(person.partner)) {
    for (const item of person.partner) {
      if (typeof item === 'string') out.push({ partnerId: item });
      else if (item && typeof item.id === 'string') {
        out.push({ partnerId: item.id, married: item.married, place: item.married_place });
      }
    }
  }
  return out;
}

/**
 * Partnerships involving `id`, whichever side declared them, in the order
 * this record lists them, then the order the other side's records appear.
 * Declaring one on BOTH sides yields one entry — date and place from
 * whichever side carries them.
 */
function partnershipsOf(id) {
  const byPartner = new Map();
  const add = (partnerId, married, place) => {
    const existing = byPartner.get(partnerId) || { partnerId };
    if (married != null && married !== '' && existing.married == null) existing.married = married;
    if (place && !existing.place) existing.place = place;
    byPartner.set(partnerId, existing);
  };
  partnersDeclared(people[id]).forEach(p => add(p.partnerId, p.married, p.place));
  for (const [otherId, person] of Object.entries(people)) {
    partnersDeclared(person)
      .filter(p => p.partnerId === id)
      .forEach(p => add(otherId, p.married, p.place));
  }
  return [...byPartner.values()];
}

const byBirth = (a, b) =>
  String((people[a] || {}).birth || '9999').localeCompare(String((people[b] || {}).birth || '9999'));

/** Ids of everyone declaring `id` as a parent, in birth order. */
function childrenOf(id) {
  return Object.keys(people)
    .filter(candidate => {
      const parents = people[candidate].parents;
      return Array.isArray(parents) && parents.includes(id);
    })
    .sort(byBirth);
}

/** Everyone sharing a parent with `id` (excluding `id`), in birth order. */
function siblingsOf(id) {
  const person = people[id];
  const parents = (person && Array.isArray(person.parents) && person.parents) || [];
  const found = new Set();
  parents.forEach(parentId => {
    childrenOf(parentId).forEach(childId => {
      if (childId !== id) found.add(childId);
    });
  });
  return [...found].sort(byBirth);
}

/* ---- Dates -------------------------------------------------------------- */

/**
 * Display form of a date value in the book's language: an integer or
 * partial ISO date formats through Intl (1867 · April 1867 · 4 April 1867 —
 * built and formatted in UTC so a machine west of UTC doesn't shift the
 * day); EDTF qualifiers read as prose (1861~ → "c. 1861", 1837? stays,
 * 187X → 187X, 1866/1868 → "1866–1868"). Anything else passes through.
 */
function formatDate(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (s.includes('/')) {
    const [from, to] = s.split('/');
    const a = from && from !== '..' ? formatDate(from) : '';
    const b = to && to !== '..' ? formatDate(to) : '';
    if (a && b) return `${a}–${b}`;
    if (a) return `${a}–`;
    return b ? `–${b}` : s;
  }
  const qualified = /^(.*?)([?~%])$/.exec(s);
  const core = qualified ? qualified[1] : s;
  const m = core.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  let text = core;
  if (m) {
    const [, year, month, day] = m;
    if (!month) text = year;
    else {
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day || 1)));
      const options = day
        ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
        : { month: 'long', year: 'numeric', timeZone: 'UTC' };
      text = new Intl.DateTimeFormat(language, options).format(date);
    }
  }
  if (!qualified) return text;
  if (qualified[2] === '~' || qualified[2] === '%') return `${t('circa')} ${text}`;
  return `${text}?`;
}

/** The year of a date value as a number — 187X reads as mid-decade — or null. */
function yearOf(value) {
  const m = /(\d{4}|\d{3}X|\d{2}XX)/.exec(String(value == null ? '' : value));
  if (!m) return null;
  return Number(m[1].replace(/X/g, '5'));
}

/** Compact year text for lifespans: 1859 · c. 1861 · 1837? · 187X. */
function yearText(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim().split('/')[0];
  const m = /^(\d{4}|\d{3}X|\d{2}XX)(?:-[\dX]{2})?(?:-[\dX]{2})?([?~%])?$/.exec(s);
  if (!m) return s;
  if (m[2] === '~' || m[2] === '%') return `${t('circa')} ${m[1]}`;
  return m[2] ? `${m[1]}?` : m[1];
}

/** " (1859–1939)" · " (b. 1908)" · " (d. 1939)" · "" — for relative lists. */
function lifespanOf(id) {
  const person = people[id] || {};
  const born = yearText(person.birth);
  const died = yearText(person.death);
  if (born && died) return ` (${born}–${died})`;
  if (born) return ` (${t('b')} ${born})`;
  if (died) return ` (${t('d')} ${died})`;
  return '';
}

/** "born 1859, died 1939" — lifespanOf as prose for a listener. */
function lifespanSpokenOf(id) {
  const person = people[id] || {};
  const born = yearText(person.birth);
  const died = yearText(person.death);
  return [born && `${t('born')} ${born}`, died && `${t('died')} ${died}`].filter(Boolean).join(', ');
}

/* ---- Names -------------------------------------------------------------- */

function capitalizeWord(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
}

function idToName(id) {
  const person = people[id];
  if (person && person.display) return person.display;
  return id
    .split('_')
    .filter(part => !/^\d+$/.test(part))
    .map(capitalizeWord)
    .join(' ');
}

/** Generational suffixes that never count as a surname ("Andrew Haddow Snr"). */
const NAME_SUFFIXES = new Set(['snr', 'jnr', 'sr', 'jr', 'senior', 'junior']);

/**
 * Given names and surname for the index: the surname is the last word of the
 * display name (or the last id token), except that a trailing generational
 * suffix stays with the given names and a trailing all-digit id token (the
 * disambiguator in andrew_haddow_1828) is ignored.
 */
function namesOf(id) {
  const person = people[id] || {};
  let parts;
  const fromDisplay = !!person.display;
  if (fromDisplay) parts = person.display.split(' ');
  else parts = id.split('_').filter(part => !/^\d+$/.test(part));

  let suffix = '';
  if (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    suffix = parts.pop();
  }
  if (parts.length === 0) return { surname: t('unknown'), givenNames: id };

  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1);
  if (suffix) given.push(suffix);
  return {
    surname: fromDisplay ? surname : capitalizeWord(surname),
    givenNames: (fromDisplay ? given.join(' ') : given.map(capitalizeWord).join(' ')) || t('unknown'),
    nickname: person.nickname,
    hasChapter: chapterIds.has(id),
  };
}

/** A person's name: a link when they have a chapter, a plain span otherwise. */
function personLink(document, id) {
  const linked = chapterIds.has(id);
  const el = document.createElement(linked ? 'a' : 'span');
  if (linked) el.setAttribute('href', id + '.xhtml');
  else el.setAttribute('class', 'person-name');
  el.textContent = idToName(id);
  return el;
}

/* ---- Anchors and carriers ----------------------------------------------- */

const isElementOnly = node =>
  [...node.childNodes].every(child => child.nodeType !== 3 || !child.textContent.trim());

/** Paragraphs that are one attributed-symbol carrier set of `alias`. */
function carrierSets(document, alias) {
  return [...document.querySelectorAll('p.' + alias + '-set')].filter(p => {
    const children = [...p.children];
    return (
      children.length > 0 &&
      children.every(el => el.tagName === 'SPAN' && el.classList.contains(alias)) &&
      isElementOnly(p)
    );
  });
}

/** Extra classes on a carrier paragraph, beyond the set class. */
function extraClasses(el, ...drop) {
  return (el.getAttribute('class') || '').split(/\s+/).filter(cls => cls && !drop.includes(cls));
}

const BARE_CARRIERS = ['portraits', 'lifeline', 'tree'];

/**
 * A bare `:portraits:` / `:lifeline:` / `:tree:` paragraph (literal text —
 * no attributes, so the text format left it alone) becomes the one-span
 * carrier its attributed form would have produced, with no data-*: the
 * chapter's own person, every default.
 */
function bareMarkerSetup(document) {
  document.querySelectorAll('p').forEach(p => {
    if (p.children.length > 0) return;
    const m = /^:([a-z-]+):$/.exec(p.textContent.trim());
    if (!m || !BARE_CARRIERS.includes(m[1])) return;
    const set = document.createElement('p');
    set.setAttribute('class', `${m[1]}-set`);
    const span = document.createElement('span');
    span.setAttribute('class', m[1]);
    set.appendChild(span);
    p.replaceWith(set);
  });
}

/**
 * `:family:` / `:family-index:` anchors: the bare marker as a paragraph's
 * whole text, or an attributed carrier. Converted to <div class="family">
 * (data-of carried) so the panel renderers have a target.
 */
function anchorSetup(document, idref) {
  const ANCHORS = { ':family:': 'family', ':family-index:': 'family-index' };
  const targets = [];
  document.querySelectorAll('p').forEach(p => {
    const cls = ANCHORS[p.textContent.trim()];
    if (!cls || p.children.length > 0) return;
    const div = document.createElement('div');
    div.setAttribute('class', cls);
    p.replaceWith(div);
    targets.push({ el: div, cls, of: idref });
  });
  for (const cls of ['family', 'family-index']) {
    for (const set of carrierSets(document, cls)) {
      const span = set.children[0];
      const div = document.createElement('div');
      div.setAttribute('class', cls);
      set.replaceWith(div);
      targets.push({ el: div, cls, of: span.getAttribute('data-of') || idref });
    }
  }
  return targets;
}

/* ---- The kinship panel and the index ------------------------------------ */

function findingsList(document) {
  if (!findings.length) return null;
  const ul = document.createElement('ul');
  ul.setAttribute('class', 'family-findings');
  for (const finding of findings) {
    const li = document.createElement('li');
    li.textContent = `⚠ ${finding.id}: ${finding.message}`;
    ul.appendChild(li);
  }
  return ul;
}

function renderPersonPanel(document, personId, target) {
  target.textContent = '';
  const list = findingsList(document);
  if (list) target.appendChild(list);

  const person = people[personId];
  if (!person) {
    const p = document.createElement('p');
    p.textContent = t('noRecord', { id: personId });
    target.appendChild(p);
    return;
  }

  const lifeEvent = (prefix, date, place) => {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(prefix + ' '));
    const strong = document.createElement('strong');
    strong.textContent = date ? formatDate(date) : t('unknown');
    p.appendChild(strong);
    if (place) p.appendChild(document.createTextNode(`, ${place}`));
    return p;
  };
  target.appendChild(lifeEvent(t('b'), person.birth, person.birthplace));
  if (person.death || person.deathplace) {
    target.appendChild(lifeEvent(t('d'), person.death, person.deathplace));
  }

  const parentIds = Array.isArray(person.parents) ? person.parents : [];
  if (parentIds.length > 0) {
    const p = document.createElement('p');
    p.textContent = t('parents') + ' ';
    parentIds.forEach((parentId, index) => {
      if (index > 0) p.appendChild(document.createTextNode(` ${t('and')} `));
      p.appendChild(personLink(document, parentId));
    });
    target.appendChild(p);
  }

  const siblingIds = siblingsOf(personId);
  if (siblingIds.length > 0) {
    const p = document.createElement('p');
    p.textContent = t('siblings');
    target.appendChild(p);
    const ul = document.createElement('ul');
    siblingIds.forEach(siblingId => {
      const li = document.createElement('li');
      li.appendChild(personLink(document, siblingId));
      li.appendChild(document.createTextNode(lifespanOf(siblingId)));
      ul.appendChild(li);
    });
    target.appendChild(ul);
  }

  const partnerships = partnershipsOf(personId);
  if (partnerships.length > 0) {
    const p = document.createElement('p');
    p.textContent = partnerships.length > 1 ? t('partners') : t('partner');
    target.appendChild(p);
    const ul = document.createElement('ul');
    partnerships.forEach(partnership => {
      const li = document.createElement('li');
      li.appendChild(personLink(document, partnership.partnerId));
      if (partnership.married != null && partnership.married !== '') {
        li.appendChild(document.createTextNode(`, ${t('m')} ${formatDate(partnership.married)}`));
      }
      if (partnership.place) li.appendChild(document.createTextNode(`, ${partnership.place}`));
      ul.appendChild(li);
    });
    target.appendChild(ul);
  }
}

function renderIndex(document, target) {
  const grouped = {};
  for (const id of Object.keys(people)) {
    const names = namesOf(id);
    (grouped[names.surname] || (grouped[names.surname] = [])).push({ id, ...names });
  }
  const fragment = document.createDocumentFragment();
  const surnames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, language));
  for (const surname of surnames) {
    const group = grouped[surname].sort((a, b) => a.givenNames.localeCompare(b.givenNames, language));
    const h3 = document.createElement('h3');
    h3.textContent = surname;
    fragment.appendChild(h3);
    const ul = document.createElement('ul');
    for (const person of group) {
      const li = document.createElement('li');
      const el = document.createElement(person.hasChapter ? 'a' : 'span');
      if (person.hasChapter) el.setAttribute('href', person.id + '.xhtml');
      else el.setAttribute('class', 'person-name');
      el.textContent = person.givenNames;
      li.appendChild(el);
      if (person.nickname) li.appendChild(document.createTextNode(` (${person.nickname})`));
      ul.appendChild(li);
    }
    fragment.appendChild(ul);
  }
  if (surnames.length === 0) {
    const p = document.createElement('p');
    p.textContent = t('noPeople');
    fragment.appendChild(p);
  }
  target.replaceWith(fragment);
}

/* ---- Portraits ---------------------------------------------------------- */

/** Chapter-relative path to an OPF-relative href from inside `fromHref`. */
function relativeHref(targetHref, fromHref) {
  const from = fromHref.split('/').slice(0, -1);
  const to = targetHref.split('/');
  while (from.length && to.length > 1 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  return '../'.repeat(from.length) + to.join('/');
}

/**
 * One crop: a viewport onto the photograph already in the book. The box
 * takes the region's aspect; the photo is its background, scaled so the
 * region fills the box — background-size `(10000/w)% auto` makes the region
 * as wide as the box, and background-position P% aligns the P% point of the
 * image with the P% point of the box, hence the /(100−w) form. Links to
 * the chapter showing the photograph, except the chapter being rendered.
 */
function portraitElement(document, crop, personId, idref) {
  const round2 = value => Math.round(value * 100) / 100;
  const { x, y, w, h } = crop.at;
  const aspect = ((w / 100) * crop.size.w) / ((h / 100) * crop.size.h);
  const posX = w >= 100 ? 0 : (x / (100 - w)) * 100;
  const posY = h >= 100 ? 0 : (y / (100 - h)) * 100;
  const src = relativeHref(crop.href, chapterHrefs[idref] || '').replace(/'/g, "\\'");

  const linked = crop.chapterId !== idref && chapterIds.has(crop.chapterId);
  const el = document.createElement(linked ? 'a' : 'span');
  el.setAttribute('class', 'portrait');
  el.setAttribute(
    'style',
    `width:${round2(PORTRAIT_HEIGHT_EM * aspect)}em; height:${PORTRAIT_HEIGHT_EM}em; ` +
      `background-image:url('${src}'); background-size:${round2(10000 / w)}% auto; ` +
      `background-position:${round2(posX)}% ${round2(posY)}%;`
  );
  const name = idToName(personId);
  if (linked) {
    el.setAttribute('href', crop.chapterId + '.xhtml');
    el.setAttribute(
      'aria-label',
      t('inPhotographIn', { name, chapter: idToName(crop.chapterId) })
    );
  } else {
    el.setAttribute('role', 'img');
    el.setAttribute(
      'aria-label',
      crop.chapterId === idref ? t('inPhotographHere', { name }) : t('inPhotograph', { name })
    );
  }
  return el;
}

/** `:portraits:{of=…}` sets → one strip per marker; nothing for nobody. */
function portraitsSetup(document, idref) {
  for (const set of carrierSets(document, 'portraits')) {
    const strips = [];
    for (const span of set.children) {
      const personId = span.getAttribute('data-of') || idref;
      const crops = portraits[personId] || [];
      const renderable = crops.filter(crop => crop.size);
      if (renderable.length < crops.length) {
        console.warn(
          'family-history: portrait(s) skipped for',
          personId,
          '— the photograph’s pixel size is unknown; open it once in the Photo Regions panel'
        );
      }
      if (!renderable.length) continue;
      const strip = document.createElement('div');
      strip.setAttribute(
        'class',
        ['portrait-strip', ...extraClasses(set, 'portraits-set')].join(' ')
      );
      renderable.forEach(crop => strip.appendChild(portraitElement(document, crop, personId, idref)));
      strips.push(strip);
    }
    if (strips.length) set.replaceWith(...strips);
    else set.remove();
  }
}

/* ---- Lifelines ---------------------------------------------------------- */

function lifelineEventsOf(personId, include) {
  const person = people[personId];
  if (!person) return [];
  const events = [];
  if (include.includes('birth')) {
    const year = yearOf(person.birth);
    if (year) events.push({ kind: 'birth', year, label: yearText(person.birth) });
  }
  if (include.includes('marriage')) {
    partnershipsOf(personId).forEach(partnership => {
      const year = yearOf(partnership.married);
      if (year) events.push({ kind: 'marriage', year, label: `${t('m')} ${yearText(partnership.married)}` });
    });
  }
  if (include.includes('death')) {
    const year = yearOf(person.death);
    if (year) events.push({ kind: 'death', year, label: yearText(person.death) });
  }
  return events.sort((a, b) => a.year - b.year);
}

function lifelineRow(document, row, x, idref) {
  const div = document.createElement('div');
  div.setAttribute('class', 'lifeline-row');

  const name = document.createElement('span');
  name.setAttribute('class', 'lifeline-name');
  if (chapterIds.has(row.personId) && row.personId !== idref) {
    const a = personLink(document, row.personId);
    if (row.as) a.textContent = row.as;
    name.appendChild(a);
  } else {
    name.textContent = row.as || idToName(row.personId);
  }
  div.appendChild(name);

  const summary = document.createElement('span');
  summary.setAttribute('class', 'visually-hidden');
  summary.textContent =
    ': ' +
    row.events
      .map(event =>
        event.kind === 'marriage'
          ? `${t('married')} ${event.year}`
          : `${t(event.kind === 'birth' ? 'born' : 'died')} ${event.year}`
      )
      .join(', ');
  div.appendChild(summary);

  const track = document.createElement('span');
  track.setAttribute('class', 'lifeline-track');
  track.setAttribute('aria-hidden', 'true');
  const first = x(row.events[0].year);
  const last = x(row.events[row.events.length - 1].year);
  const segment = document.createElement('span');
  segment.setAttribute('class', 'lifeline-span');
  segment.setAttribute('style', `left:${first}%; width:${Math.max(0, last - first)}%;`);
  track.appendChild(segment);
  row.events.forEach(event => {
    const mark = document.createElement('span');
    mark.setAttribute('class', 'lifeline-event lifeline-' + event.kind);
    mark.setAttribute('style', `left:${x(event.year)}%;`);
    const dot = document.createElement('span');
    dot.setAttribute('class', 'lifeline-dot');
    mark.appendChild(dot);
    const label = document.createElement('span');
    label.setAttribute('class', 'lifeline-date');
    label.textContent = event.label;
    mark.appendChild(label);
    track.appendChild(mark);
  });
  div.appendChild(track);
  return div;
}

/**
 * `:lifeline:{of=… as=… include="birth,marriage,death"}` — one set (the
 * consecutive lines of one paragraph) is ONE chart on a shared time scale,
 * so partners' or siblings' lives line up. The scale spans the set's
 * earliest to latest event, padded ~5% (min 2 years). A person with no
 * dateable events contributes no row; a set with no rows renders nothing.
 */
function lifelinesSetup(document, idref) {
  for (const set of carrierSets(document, 'lifeline')) {
    const rows = [];
    for (const span of set.children) {
      const personId = span.getAttribute('data-of') || idref;
      const include = (span.getAttribute('data-include') || 'birth,marriage,death')
        .split(',')
        .map(kind => kind.trim())
        .filter(Boolean);
      const events = lifelineEventsOf(personId, include);
      if (!events.length) {
        console.warn('family-history: lifeline has no dated events for', personId);
        continue;
      }
      rows.push({ personId, as: span.getAttribute('data-as') || '', events });
    }
    if (!rows.length) {
      set.remove();
      continue;
    }
    const years = rows.flatMap(row => row.events.map(event => event.year));
    const min = Math.min(...years);
    const max = Math.max(...years);
    const pad = Math.max(2, Math.round((max - min) * 0.05));
    const lo = min - pad;
    const span = max + pad - lo;
    const x = year => Math.round(((year - lo) / span) * 10000) / 100;

    const group = document.createElement('div');
    group.setAttribute('class', ['lifeline-group', ...extraClasses(set, 'lifeline-set')].join(' '));
    rows.forEach(row => group.appendChild(lifelineRow(document, row, x, idref)));
    set.replaceWith(group);
  }
}

/* ---- Family trees ------------------------------------------------------- */

/** Every ancestor of `id` (blood line) → generation distance; `id` is 0. */
function ancestorsOf(id) {
  const found = new Map();
  const queue = [[id, 0]];
  while (queue.length) {
    const [current, distance] = queue.shift();
    if (found.has(current)) continue;
    found.set(current, distance);
    const parents = (people[current] || {}).parents;
    if (Array.isArray(parents)) parents.forEach(parentId => queue.push([parentId, distance + 1]));
  }
  return found;
}

/** The ids from `id` up to `root` inclusive, or null. */
function pathUp(id, root, seen) {
  if (id === root) return [id];
  if (seen.has(id)) return null;
  seen.add(id);
  const parents = (people[id] || {}).parents;
  if (!Array.isArray(parents)) return null;
  for (const parentId of parents) {
    const rest = pathUp(parentId, root, seen);
    if (rest) return [id, ...rest];
  }
  return null;
}

function spokenOnly(document, text) {
  const span = document.createElement('span');
  span.setAttribute('class', 'visually-hidden');
  span.textContent = text;
  return span;
}

function treePerson(document, id, idref) {
  const span = document.createElement('span');
  span.setAttribute('class', 'tree-person');
  if (chapterIds.has(id) && id !== idref) span.appendChild(personLink(document, id));
  else span.appendChild(document.createTextNode(idToName(id)));
  const dates = lifespanOf(id);
  if (dates) {
    const d = document.createElement('span');
    d.setAttribute('class', 'tree-dates');
    d.setAttribute('aria-hidden', 'true');
    d.textContent = dates;
    span.appendChild(d);
    span.appendChild(spokenOnly(document, `, ${lifespanSpokenOf(id)},`));
  }
  return span;
}

function appendPartner(document, target, partnership, idref, verb) {
  const eq = document.createElement('span');
  eq.setAttribute('class', 'tree-eq');
  eq.setAttribute('aria-hidden', 'true');
  eq.textContent = ' = ';
  target.appendChild(eq);
  target.appendChild(spokenOnly(document, ` ${verb} `));
  target.appendChild(treePerson(document, partnership.partnerId, idref));
  const year = yearOf(partnership.married);
  if (year) {
    const m = document.createElement('span');
    m.setAttribute('class', 'tree-married');
    m.setAttribute('aria-hidden', 'true');
    m.textContent = `${t('m')} ${yearText(partnership.married)}`;
    target.appendChild(m);
    target.appendChild(spokenOnly(document, ` ${t('inYear')} ${yearText(partnership.married)}`));
  }
}

function treeCouple(document, id, partnerships, idref) {
  const couple = document.createElement('span');
  couple.setAttribute('class', 'tree-couple');
  couple.appendChild(treePerson(document, id, idref));
  partnerships.forEach(p => appendPartner(document, couple, p, idref, t('married')));
  return couple;
}

function treeRemarriage(document, partnership, idref) {
  const line = document.createElement('span');
  line.setAttribute('class', 'tree-couple tree-remarried');
  appendPartner(document, line, partnership, idref, t('alsoMarried'));
  return line;
}

/**
 * Descendant mode: `id` with partnerships, then children while `depth`
 * allows. One partnership: one line, every child below. Several: each
 * partnership gets its own children — the first partner on the person's
 * line, later partners on lines of their own after the previous
 * partnership's children, children naming none of the partners last. At
 * the depth cut a child count stands in for the hidden generation.
 */
function treeDescendantNode(document, id, depth, seen, idref) {
  const li = document.createElement('li');
  const partnerships = partnershipsOf(id);
  const children = childrenOf(id).filter(childId => !seen.has(childId));
  const grouped = partnerships.length > 1 && children.length > 0 && depth > 0;

  li.appendChild(treeCouple(document, id, grouped ? partnerships.slice(0, 1) : partnerships, idref));
  if (!children.length) return li;

  if (depth <= 0) {
    const linked = chapterIds.has(id) && id !== idref;
    const more = document.createElement(linked ? 'a' : 'span');
    more.setAttribute('class', 'tree-more');
    if (linked) more.setAttribute('href', id + '.xhtml');
    more.textContent = t('more', { n: children.length });
    li.appendChild(more);
    return li;
  }

  const childList = ids => {
    const ul = document.createElement('ul');
    ids.forEach(childId => {
      seen.add(childId);
      ul.appendChild(treeDescendantNode(document, childId, depth - 1, seen, idref));
    });
    return ul;
  };

  if (!grouped) {
    li.appendChild(childList(children));
    return li;
  }

  const parentsOf = childId => (people[childId] || {}).parents || [];
  const claimed = new Set();
  partnerships.forEach((partnership, index) => {
    if (index > 0) li.appendChild(treeRemarriage(document, partnership, idref));
    const own = children.filter(childId => {
      if (claimed.has(childId) || !parentsOf(childId).includes(partnership.partnerId)) return false;
      claimed.add(childId);
      return true;
    });
    if (own.length) li.appendChild(childList(own));
  });
  const rest = children.filter(childId => !claimed.has(childId));
  if (rest.length) li.appendChild(childList(rest));
  return li;
}

/**
 * Path mode: the nearest shared ancestor of `fromId` and `toId` as the root,
 * with one chain of descent to each. `viaId` overrides the nearest choice.
 */
function treePathNode(document, fromId, toId, viaId, idref) {
  const fromSide = ancestorsOf(fromId);
  const toSide = ancestorsOf(toId);
  let root = null;
  let best = Infinity;
  for (const [id, distance] of fromSide) {
    if (!toSide.has(id)) continue;
    const total = distance + toSide.get(id);
    if (total < best) {
      best = total;
      root = id;
    }
  }
  if (viaId) {
    const candidates = [viaId, ...partnershipsOf(viaId).map(p => p.partnerId)];
    const hit = candidates.find(id => fromSide.has(id) && toSide.has(id));
    if (hit) root = hit;
    else console.warn('family-history: tree via', viaId, 'is not an ancestor shared by', fromId, 'and', toId);
  }
  if (!root) {
    console.warn('family-history: tree has no shared ancestor for', fromId, 'and', toId);
    return null;
  }

  const chainNode = (ids, index) => {
    const id = ids[index];
    const next = ids[index + 1];
    const partnerships = next
      ? partnershipsOf(id).filter(p => ((people[next] || {}).parents || []).includes(p.partnerId))
      : partnershipsOf(id);
    const li = document.createElement('li');
    li.appendChild(treeCouple(document, id, partnerships, idref));
    if (next) {
      const ul = document.createElement('ul');
      ul.appendChild(chainNode(ids, index + 1));
      li.appendChild(ul);
    }
    return li;
  };

  const rootLi = document.createElement('li');
  rootLi.appendChild(treeCouple(document, root, partnershipsOf(root), idref));
  const branches = document.createElement('ul');
  [fromId, toId].forEach(endId => {
    const up = pathUp(endId, root, new Set());
    if (!up || up.length < 2) return; // the endpoint is the root itself
    branches.appendChild(chainNode(up.slice(0, -1).reverse(), 0));
  });
  if (branches.childNodes.length) rootLi.appendChild(branches);
  return rootLi;
}

/**
 * `:tree:{of=… depth=N to=… via=…}` — descendant mode (`depth` generations
 * below `of`, default 1) or, with `to=`, path mode. Nested lists: the
 * register convention printed genealogies use, and a structure a screen
 * reader already walks. Each marker in a set renders independently.
 */
function treesSetup(document, idref) {
  for (const set of carrierSets(document, 'tree')) {
    const trees = [];
    for (const span of set.children) {
      const ofId = span.getAttribute('data-of') || idref;
      const toId = span.getAttribute('data-to');
      const viaId = span.getAttribute('data-via');
      const depthAttr = span.getAttribute('data-depth');
      const depth =
        depthAttr === null || depthAttr === '' ? 1 : Math.max(0, parseInt(depthAttr, 10) || 0);

      let root = null;
      if (!people[ofId]) {
        console.warn('family-history: tree of unknown person', ofId);
      } else if (toId) {
        if (people[toId]) root = treePathNode(document, ofId, toId, viaId, idref);
        else console.warn('family-history: tree to unknown person', toId);
      } else {
        root = treeDescendantNode(document, ofId, depth, new Set([ofId]), idref);
      }
      if (!root) continue;
      const tree = document.createElement('div');
      tree.setAttribute('class', ['tree', ...extraClasses(set, 'tree-set')].join(' '));
      const ul = document.createElement('ul');
      ul.appendChild(root);
      tree.appendChild(ul);
      trees.push(tree);
    }
    if (trees.length) set.replaceWith(...trees);
    else set.remove();
  }
}

/* ---- Entry -------------------------------------------------------------- */

async function transformDOM(document, idref, ctx) {
  try {
    bareMarkerSetup(document);
    const anchors = anchorSetup(document, idref);
    const wanted =
      anchors.length > 0 ||
      document.querySelector('p.portraits-set, p.lifeline-set, p.tree-set') !== null;
    if (!wanted) return document;

    await loadFamily(ctx, idref);
    for (const anchor of anchors) {
      if (anchor.cls === 'family') renderPersonPanel(document, anchor.of, anchor.el);
      else renderIndex(document, anchor.el);
    }
    portraitsSetup(document, idref);
    lifelinesSetup(document, idref);
    treesSetup(document, idref);
  } catch (error) {
    console.error('family-history:', error);
  }
  return document;
}
