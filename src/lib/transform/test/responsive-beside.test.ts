/**
 * Tests for the Responsive extension's beside blocks: a `::: beside` div
 * holding a heading, its text and one or more figures is split into
 * .beside-text followed by .beside-figures, each in source order, and every
 * figure still gets its .sr-figure container. Djot source goes through the
 * real djot and figures transforms, so the input is the markup a book
 * actually produces. The layout itself is CSS (responsive.css), exercised in
 * the browser.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

type DomTransform = (doc: Document, idref: string, ctx: unknown) => Document | Promise<Document>;
const load = (path: string) =>
  new Function(`${readFileSync(path, 'utf8')}\nreturn transformDOM;`)() as DomTransform;

const transformFigures = load('extensions/figures/transformFigures.js');
const transformResponsive = load('extensions/responsive/transformResponsive.js');

const globals = globalThis as unknown as Record<string, unknown>;
new Function(readFileSync('extensions/djot/djot.js', 'utf8')).call(globalThis);
const djotText = new Function(
  'djot',
  `${readFileSync('extensions/djot/transformDjot.js', 'utf8')}\nreturn transformText;`
)(globals.djot) as (text: string) => string;

function parse(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
}

async function render(source: string): Promise<Document> {
  const doc = parse(djotText(source));
  await transformFigures(doc, 'ch1', {});
  await transformResponsive(doc, 'ch1', {});
  return doc;
}

const childClasses = (el: Element) => [...el.children].map(c => c.getAttribute('class'));

describe('transformResponsive (beside blocks)', () => {
  it('splits heading and text from the figures, text first', async () => {
    const doc = await render(
      [
        '::: beside',
        '## The Allen Family',
        '',
        'They settled at Canterbury.',
        '',
        '![A map](../Images/map.svg){.figure title="Carrickfergus"}',
        ':::',
      ].join('\n')
    );
    const block = doc.querySelector('div.beside')!;
    expect(childClasses(block)).toEqual(['beside-text', 'beside-figures']);

    const text = block.querySelector('.beside-text')!;
    expect([...text.children].map(c => c.tagName)).toEqual(['H2', 'P']);
    expect(text.querySelector('h2')!.textContent).toBe('The Allen Family');

    const figures = block.querySelector('.beside-figures')!;
    expect(childClasses(figures)).toEqual(['sr-figure']);
    expect(figures.querySelector('.sr-figure > figure figcaption')!.textContent).toBe(
      'Carrickfergus'
    );
  });

  it('keeps several figures in source order, each in its own container', async () => {
    const doc = await render(
      [
        '::: beside',
        'Text.',
        '',
        '![First](../Images/a.svg){.figure title="A"}',
        '',
        '![Second](../Images/b.svg){.figure title="B"}',
        ':::',
      ].join('\n')
    );
    const captions = [...doc.querySelectorAll('.beside-figures > .sr-figure figcaption')].map(
      c => c.textContent
    );
    expect(captions).toEqual(['A', 'B']);
  });

  it('outputs text before figures even when the source puts a figure first', async () => {
    const doc = await render(
      [
        '::: beside',
        '![A map](../Images/map.svg){.figure title="Map"}',
        '',
        '## Heading',
        '',
        'Text.',
        ':::',
      ].join('\n')
    );
    const block = doc.querySelector('div.beside')!;
    expect(childClasses(block)).toEqual(['beside-text', 'beside-figures']);
    expect(block.querySelector('.beside-text > h2')).not.toBeNull();
  });

  it('accepts figures another layout transform already wrapped in .sr-figure', async () => {
    const doc = parse(
      '<div class="beside"><h2>H</h2><p>Text.</p>' +
        '<div class="sr-figure"><figure><img src="a.svg" alt="A"/></figure></div></div>'
    );
    await transformResponsive(doc, 'ch1', {});
    const figures = doc.querySelector('.beside-figures')!;
    expect(childClasses(figures)).toEqual(['sr-figure']);
    expect(figures.querySelectorAll('.sr-figure .sr-figure')).toHaveLength(0);
  });

  it('leaves a block with no figures, or only figures, as written', async () => {
    const doc = parse(
      '<div class="beside"><h2>H</h2><p>Text.</p></div>' +
        '<div class="beside"><figure><img src="a.svg" alt="A"/></figure></div>'
    );
    await transformResponsive(doc, 'ch1', {});
    expect(doc.querySelector('.beside-text')).toBeNull();
    expect(doc.querySelector('.beside-figures')).toBeNull();
  });

  it('is idempotent across pipeline re-runs', async () => {
    const doc = await render(
      ['::: beside', 'Text.', '', '![A](../Images/a.svg){.figure title="A"}', ':::'].join('\n')
    );
    const once = doc.body.innerHTML;
    await transformResponsive(doc, 'ch1', {});
    expect(doc.body.innerHTML).toBe(once);
  });
});
