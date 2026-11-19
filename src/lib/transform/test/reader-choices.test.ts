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

  async function page(): Promise<void> {
    const store = makeStore();
    const doc = await render(RECIPE, store.ctx('ch1', { choices: CHOICES }));
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
});
