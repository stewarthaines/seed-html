/**
 * Tests for the reader-choices extension: the DOM transform (declaration and
 * register, `when=` variants, generated `:choose:` controls, findings) over
 * real Djot output, then the reading-system script applying stored choices
 * to the transformed page.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

type Ctx = {
  idref: string;
  identifier: string;
  frontmatter: unknown;
  readSourceText: (path: string) => Promise<string>;
  writeSourceText: (path: string, text: string) => Promise<string>;
};
type DomTransform = (doc: Document, idref: string, ctx: Ctx) => Promise<Document>;

const transform = new Function(
  `${readFileSync('extensions/reader-choices/transformReaderChoices.js', 'utf8')}\nreturn transformDOM;`
)() as DomTransform;
const runtimeSource = readFileSync('extensions/reader-choices/reader-choices.js', 'utf8');

const globals = globalThis as unknown as Record<string, unknown>;
new Function(readFileSync('extensions/djot/djot.js', 'utf8')).call(globalThis);
const djotText = new Function(
  'djot',
  `${readFileSync('extensions/djot/transformDjot.js', 'utf8')}\nreturn transformText;`
)(globals.djot) as (text: string) => string;

const REGISTER = 'SOURCE/data/reader-choices.json';

const CHOICES = {
  serves: { label: 'Serves', values: [{ '1x': '4–6' }, { '2x': '8–12' }, { '4x': '16–24' }] },
  measure: { label: 'Measures', values: ['metric', 'imperial', 'volume'], default: 'metric' },
};

const RECIPE = `:choose:{of=serves}
:choose:{of=measure}

- [350g]{when="measure:metric serves:1x"}[700g]{when="measure:metric serves:2x"}[12 oz]{when="measure:imperial serves:1x"} dried beans

{when=measure:volume}
Cups are level, not heaped.
`;

const TWO_RECIPES = `:choose:{of=serves}

{serves="4–6 | 8–12 | 16–24"}
::: recipe
## Lobio

:choose:{of=serves}

- [350g]{when=serves:1x}[700g]{when=serves:2x}[1.4kg]{when=serves:4x} beans
:::

{#kharcho serves="4 | 8 | 16"}
::: recipe
## Kharcho

:choose:{of=serves}

- [1 kg]{when=serves:1x}[2 kg]{when=serves:2x}[4 kg]{when=serves:4x} beef
:::
`;

const SPLIT_CHOICES = {
  serves: { ...CHOICES.serves, split: '|' },
  measure: { ...CHOICES.measure, split: '/' },
};

const GRID_RECIPE = `{serves="4–6 | 8–12 | 16–24"}
::: recipe
## Lobio

- \`350g | 700g | 1.4kg / 12 oz | 1½ lb | 3 lb / 2 cups | 4 cups | 8 cups\` dried beans
- \`1/2 tsp | 1 tsp | 2 tsp\` ground fenugreek
- \`30g | 60g | 120g / 1 oz / 2 tbsp | 4 tbsp | 8 tbsp\` butter
- \`1/2\` a lemon
:::

Outside: \`a | b | c\`
`;

function makeStore(files: Record<string, string> = {}) {
  const writes: string[] = [];
  return {
    files,
    writes,
    ctx(idref: string, frontmatter: unknown = null): Ctx {
      return {
        idref,
        identifier: 'urn:uuid:book-1',
        frontmatter,
        readSourceText: async path => {
          if (!(path in files)) throw new Error('not found');
          return files[path];
        },
        writeSourceText: async (path, text) => {
          files[path] = text;
          writes.push(path);
          return path;
        },
      };
    },
  };
}

async function render(source: string, ctx: Ctx): Promise<Document> {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${djotText(source)}</body></html>`,
    'text/html'
  );
  return transform(doc, ctx.idref, ctx);
}

const texts = (doc: Document, selector: string) =>
  [...doc.querySelectorAll(selector)].map(el => el.textContent);

describe('reader-choices transform', () => {
  it('declares from frontmatter, writes the register, and builds the default page', async () => {
    const store = makeStore();
    const doc = await render(RECIPE, store.ctx('ch1', { choices: CHOICES }));

    expect(JSON.parse(store.files[REGISTER])).toEqual({
      from: 'ch1',
      choices: {
        serves: {
          label: 'Serves',
          values: [
            { id: '1x', label: '4–6' },
            { id: '2x', label: '8–12' },
            { id: '4x', label: '16–24' },
          ],
          default: '1x',
        },
        measure: {
          label: 'Measures',
          values: [
            { id: 'metric', label: 'metric' },
            { id: 'imperial', label: 'imperial' },
            { id: 'volume', label: 'volume' },
          ],
          default: 'metric',
        },
      },
    });

    // No authored attribute survives; only the default variant is on.
    expect(doc.querySelector('[when]')).toBeNull();
    expect(texts(doc, '.rc-variant:not(.rc-off)')).toEqual(['350g']);
    expect(texts(doc, '.rc-variant.rc-off')).toEqual([
      '700g',
      '12 oz',
      'Cups are level, not heaped.',
    ]);
    expect(doc.querySelector('p.rc-variant')!.getAttribute('data-rc-when')).toBe('measure:volume');

    // Controls: label, the default as text, hidden buttons.
    const controls = [...doc.querySelectorAll('p.rc-choose-set > .rc-choose')];
    expect(controls.map(c => c.getAttribute('data-rc-of'))).toEqual(['serves', 'measure']);
    expect(controls[0].querySelector('.rc-label')!.textContent).toBe('Serves');
    expect(controls[0].querySelector('.rc-static')!.textContent).toBe('4–6');
    const group = controls[0].querySelector('.rc-buttons')!;
    expect(group.hasAttribute('hidden')).toBe(true);
    expect(group.getAttribute('role')).toBe('group');
    expect(texts(doc, '[data-rc-of="serves"] button')).toEqual(['4–6', '8–12', '16–24']);
    expect([...group.querySelectorAll('button')].map(b => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(doc.querySelector('.choose-set, .choose')).toBeNull();

    expect(doc.body.getAttribute('data-rc-book')).toBe('urn:uuid:book-1');
    expect(JSON.parse(doc.body.getAttribute('data-rc-choices')!)).toEqual({
      serves: { values: ['1x', '2x', '4x'], default: '1x' },
      measure: { values: ['metric', 'imperial', 'volume'], default: 'metric' },
    });
    expect(doc.querySelector('.rc-findings')).toBeNull();
  });

  it('reads the register in a chapter without its own block, and does not rewrite it', async () => {
    const store = makeStore();
    await render('Intro.\n', store.ctx('ch1', { choices: CHOICES }));
    store.writes.length = 0;

    const doc = await render(RECIPE, store.ctx('ch2'));
    expect(texts(doc, '.rc-variant:not(.rc-off)')).toEqual(['350g']);
    expect(store.writes).toEqual([]);
  });

  it('rewrites the register only when the declaration changes; most recent render wins', async () => {
    const store = makeStore();
    await render('Intro.\n', store.ctx('ch1', { choices: CHOICES }));
    await render('Intro.\n', store.ctx('ch1', { choices: CHOICES }));
    expect(store.writes).toEqual([REGISTER]);

    await render('Other.\n', store.ctx('ch5', { choices: { level: ['english', 'georgian'] } }));
    expect(JSON.parse(store.files[REGISTER]).from).toBe('ch5');
  });

  it('clears the register when the chapter that wrote it loses its block', async () => {
    const store = makeStore();
    await render('Intro.\n', store.ctx('ch1', { choices: CHOICES }));
    await render('Intro.\n', store.ctx('ch1', { title: 'Intro' }));
    expect(store.files[REGISTER]).toBe('null');

    const doc = await render(RECIPE, store.ctx('ch2'));
    expect(texts(doc, '.rc-findings li')[0]).toMatch(/no choices are declared/);
    // Without a declaration every variant stays visible, attribute gone.
    expect(doc.querySelector('[when], .rc-off')).toBeNull();
  });

  it('notes invalid declarations and variants, keeping what is valid', async () => {
    const store = makeStore();
    const doc = await render(
      ':choose:{of=size}\n\n[a]{when=serves:8x} [b]{when=nonsense} [c]{when=colour:red} [d]{when=serves:2x}\n',
      store.ctx('ch1', {
        choices: {
          serves: { values: ['1x', '2x', '1x'], default: '3x', colour: 'red' },
          'bad name': ['x'],
          empty: { values: [] },
        },
      })
    );
    const findings = texts(doc, '.rc-findings li');
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/"bad name"/),
        expect.stringMatching(/unknown key "colour"/),
        expect.stringMatching(/value "1x" is listed twice/),
        expect.stringMatching(/default "3x" is not one of its values/),
        expect.stringMatching(/"empty": needs at least one value/),
        expect.stringMatching(/:choose:\{of=size\}/),
        expect.stringMatching(/has no value "8x"/),
        expect.stringMatching(/write choice:value/),
        expect.stringMatching(/no choice is called "colour"/),
      ])
    );
    // Invalid variants stay visible; the valid one is off (default 1x).
    expect(texts(doc, '.rc-variant.rc-off')).toEqual(['d']);
    expect(doc.querySelector('.rc-choose-set')).toBeNull();
  });

  it('is idempotent', async () => {
    const store = makeStore();
    const ctx = store.ctx('ch1', { choices: CHOICES });
    const doc = await render(RECIPE, ctx);
    const once = doc.body.innerHTML;
    await transform(doc, 'ch1', ctx);
    expect(doc.body.innerHTML).toBe(once);
  });

  it('gives a block its own labels for a choice, keyed by chapter and heading id', async () => {
    const store = makeStore();
    const doc = await render(TWO_RECIPES, store.ctx('ch1', { choices: CHOICES }));

    const scopes = [...doc.querySelectorAll('.rc-scope')];
    expect(scopes.map(el => el.getAttribute('data-rc-scope'))).toEqual(['serves', 'serves']);
    expect(scopes.map(el => el.getAttribute('data-rc-key'))).toEqual(['ch1#Lobio', 'ch1#kharcho']);
    expect(doc.querySelector('[serves]')).toBeNull();
    expect(texts(doc, '.rc-scope .rc-static')).toEqual(['4–6', '4']);
    expect(texts(doc, '#kharcho button')).toEqual(['4', '8', '16']);
    // A control outside any scope keeps the book's labels.
    expect(texts(doc, 'body > .rc-choose-set [data-rc-of="serves"] button')).toEqual([
      '4–6',
      '8–12',
      '16–24',
    ]);
    // Recipe semantics.
    expect(scopes.every(el => el.classList.contains('h-recipe'))).toBe(true);
    expect(texts(doc, '.h-recipe .p-name')).toEqual(['Lobio', 'Kharcho']);
    expect(doc.querySelector('.rc-findings')).toBeNull();
  });

  it('notes a scope whose labels do not match the values, and bad choice names', async () => {
    const store = makeStore();
    const doc = await render(
      '{serves="4 | 8"}\n::: recipe\n## Short\n:::\n',
      store.ctx('ch1', { choices: { ...CHOICES, Size: ['s'], title: ['t'] } })
    );
    const findings = texts(doc, '.rc-findings li');
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/serves="4 \| 8": give 3 labels/),
        expect.stringMatching(/choice "Size": names are lowercase/),
        expect.stringMatching(/choice "title": that name is already an HTML attribute/),
      ])
    );
    expect(doc.querySelector('.rc-scope, [serves]')).toBeNull();
  });

  it('expands quantity grids inside a recipe into variants', async () => {
    const store = makeStore();
    const doc = await render(GRID_RECIPE, store.ctx('ch1', { choices: SPLIT_CHOICES }));
    expect(doc.querySelector('.rc-findings')).toBeNull();

    const items = [...doc.querySelectorAll('.h-recipe li')];
    const cells = (li: Element) =>
      [...li.querySelectorAll('.rc-quantity > span')].map(
        el => `${el.getAttribute('data-rc-when') ?? 'always'}=${el.textContent}`
      );
    expect(cells(items[0])).toEqual([
      'measure:metric serves:1x=350g',
      'measure:metric serves:2x=700g',
      'measure:metric serves:4x=1.4kg',
      'measure:imperial serves:1x=12 oz',
      'measure:imperial serves:2x=1½ lb',
      'measure:imperial serves:4x=3 lb',
      'measure:volume serves:1x=2 cups',
      'measure:volume serves:2x=4 cups',
      'measure:volume serves:4x=8 cups',
    ]);
    // No "/": the same in every measure; "1/2" is a fraction, not a separator.
    expect(cells(items[1])).toEqual(['serves:1x=1/2 tsp', 'serves:2x=1 tsp', 'serves:4x=2 tsp']);
    // A "/" part may have a single value for every serving.
    expect(cells(items[2])).toEqual([
      'measure:metric serves:1x=30g',
      'measure:metric serves:2x=60g',
      'measure:metric serves:4x=120g',
      'measure:imperial=1 oz',
      'measure:volume serves:1x=2 tbsp',
      'measure:volume serves:2x=4 tbsp',
      'measure:volume serves:4x=8 tbsp',
    ]);
    expect(items.slice(0, 3).every(li => li.classList.contains('p-ingredient'))).toBe(true);
    // Plain inline code and code outside a recipe stay code.
    expect(items[3].querySelector('code')!.textContent).toBe('1/2');
    expect(doc.querySelector('body > p > code')!.textContent).toBe('a | b | c');
    // The default page: metric, 4–6.
    expect(texts(doc, '.rc-variant:not(.rc-off)')).toEqual(['350g', '1/2 tsp', '30g']);
  });

  it('notes a grid whose part counts do not fit, leaving it as code', async () => {
    const store = makeStore();
    const doc = await render(
      '::: recipe\n- `1 | 2` eggs\n- `a / b` salt\n:::\n',
      store.ctx('ch1', {
        choices: {
          ...SPLIT_CHOICES,
          other: { values: ['x'], split: '|' },
          more: { values: ['y'], split: ':' },
        },
      })
    );
    expect(texts(doc, '.rc-findings li')).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/`1 \| 2`: 2 parts separated by \| for serves, which has 3 values/),
        expect.stringMatching(/`a \/ b`: 2 parts separated by \/ for measure, which has 3 values/),
        expect.stringMatching(/choice "other": "serves" already splits on "\|"/),
        expect.stringMatching(/choice "more": split is "\/" or "\|"/),
      ])
    );
    expect(texts(doc, '.h-recipe code')).toEqual(['1 | 2', 'a / b']);
  });

  it('leaves a page without choices alone', async () => {
    const store = makeStore();
    await render('Intro.\n', store.ctx('ch1', { choices: CHOICES }));
    const doc = await render('Just *prose*.\n', store.ctx('ch2'));
    expect(doc.body.hasAttribute('data-rc-choices')).toBe(false);
    expect(doc.body.innerHTML.trim()).toBe('<p>Just <strong>prose</strong>.</p>');
  });
});

describe('reader-choices reading-system script', () => {
  const KEY = 'seed-reader-choices:urn:uuid:book-1';

  async function page(source = RECIPE): Promise<void> {
    const store = makeStore();
    const doc = await render(source, store.ctx('ch1', { choices: CHOICES }));
    document.body.innerHTML = doc.body.innerHTML;
    for (const attr of ['data-rc-book', 'data-rc-choices']) {
      document.body.setAttribute(attr, doc.body.getAttribute(attr)!);
    }
    new Function(runtimeSource)();
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('reveals the buttons and applies the defaults when nothing is stored', async () => {
    await page();
    expect(
      document.querySelector('[data-rc-of="serves"] .rc-buttons')!.hasAttribute('hidden')
    ).toBe(false);
    expect(document.querySelector('[data-rc-of="serves"] .rc-static')!.hasAttribute('hidden')).toBe(
      true
    );
    expect(texts(document, '.rc-variant:not(.rc-off)')).toEqual(['350g']);
  });

  it('applies stored choices and ignores a stored value the page does not offer', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ serves: '2x', measure: 'cubits', level: 'georgian' })
    );
    await page();
    expect(texts(document, '.rc-variant:not(.rc-off)')).toEqual(['700g']);
    expect(
      document
        .querySelector('[data-rc-of="serves"] [data-rc-value="2x"]')!
        .getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('switches on a button press and stores only that choice', async () => {
    localStorage.setItem(KEY, JSON.stringify({ level: 'georgian' }));
    await page();
    (document.querySelector('[data-rc-value="imperial"]') as HTMLElement).click();
    expect(texts(document, '.rc-variant:not(.rc-off)')).toEqual(['12 oz']);
    expect(document.querySelector('[data-rc-value="imperial"]')!.getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(document.querySelector('[data-rc-value="metric"]')!.getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      level: 'georgian',
      measure: 'imperial',
    });

    (document.querySelector('[data-rc-value="volume"]') as HTMLElement).click();
    expect(texts(document, '.rc-variant:not(.rc-off)')).toEqual(['Cups are level, not heaped.']);
  });

  it('keeps each recipe’s setting apart and stores it under its own key', async () => {
    await page(TWO_RECIPES);
    const lobio = '[data-rc-key="ch1#Lobio"]';
    const kharcho = '[data-rc-key="ch1#kharcho"]';
    (document.querySelector(`${lobio} [data-rc-value="4x"]`) as HTMLElement).click();

    expect(texts(document, `${lobio} .rc-variant:not(.rc-off)`)).toEqual(['1.4kg']);
    expect(texts(document, `${kharcho} .rc-variant:not(.rc-off)`)).toEqual(['1 kg']);
    expect(JSON.parse(localStorage.getItem(`${KEY}|ch1#Lobio`)!)).toEqual({ serves: '4x' });
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(`${KEY}|ch1#kharcho`)).toBeNull();
  });

  it('restores each recipe’s setting; an untouched recipe starts from the book’s value', async () => {
    localStorage.setItem(KEY, JSON.stringify({ serves: '2x' }));
    localStorage.setItem(`${KEY}|ch1#Lobio`, JSON.stringify({ serves: '4x' }));
    await page(TWO_RECIPES);

    expect(texts(document, '[data-rc-key="ch1#Lobio"] .rc-variant:not(.rc-off)')).toEqual([
      '1.4kg',
    ]);
    expect(texts(document, '[data-rc-key="ch1#kharcho"] .rc-variant:not(.rc-off)')).toEqual([
      '2 kg',
    ]);
    expect([...document.querySelectorAll('[aria-pressed="true"]')].map(b => b.textContent)).toEqual(
      ['8–12', '16–24', '8']
    );
  });
});
