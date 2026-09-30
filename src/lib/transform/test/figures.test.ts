/**
 * Tests for the figures extension's DOM transform: an authored `{.figure}`
 * image becomes <figure> + <figcaption> from its title. Djot and Markdown
 * sources are rendered through the real extension text transforms, so the
 * input is the markup those formats actually produce. The last block runs
 * figures → photo-regions → responsive in stage order to show the three
 * agree on the figure they share.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

type DomTransform = (doc: Document, idref: string, ctx: unknown) => Document | Promise<Document>;
const load = (path: string) =>
  new Function(`${readFileSync(path, 'utf8')}\nreturn transformDOM;`)() as DomTransform;

const transformFigures = load('extensions/figures/transformFigures.js');
const transformRegions = load('extensions/photo-regions/transformRegions.js');
const transformResponsive = load('extensions/responsive/transformResponsive.js');

const globals = globalThis as unknown as Record<string, unknown>;
new Function(readFileSync('extensions/djot/djot.js', 'utf8')).call(globalThis);
const djotText = new Function(
  'djot',
  `${readFileSync('extensions/djot/transformDjot.js', 'utf8')}\nreturn transformText;`
)(globals.djot) as (text: string) => string;

new Function(readFileSync('extensions/markdown-it/markdown-it.min.js', 'utf8'))();
new Function(readFileSync('extensions/markdown-it/markdown-it-attrs.browser.min.js', 'utf8'))();
const win = window as unknown as Record<string, unknown>;
win.markdownit = globals.markdownit;
win.markdownItAttrs = globals.markdownItAttrs;
const markdownText = new Function(
  `${readFileSync('extensions/markdown-it/transformMarkdown.js', 'utf8')}\nreturn transformText;`
)() as (text: string) => string;

function parse(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
}

describe('transformFigures', () => {
  it('turns a djot {.figure} image into a figure, keeping width and copying modifiers', async () => {
    const doc = parse(
      djotText(
        'Before.\n\n![Two men applying stage makeup](../Images/eggs.jpg){.figure .wrap-left title="Adelaide, 2025" width=240}\n\nAfter.\n'
      )
    );
    await transformFigures(doc, 'ch1', {});

    const figure = doc.querySelector('figure')!;
    expect(figure).not.toBeNull();
    expect(figure.getAttribute('class')).toBe('wrap-left');
    expect(figure.parentElement!.tagName).not.toBe('P');
    const img = figure.querySelector('img')!;
    expect(img.getAttribute('class')).toBe('wrap-left');
    expect(img.getAttribute('width')).toBe('240');
    expect(img.getAttribute('alt')).toBe('Two men applying stage makeup');
    expect(img.hasAttribute('title')).toBe(false);
    expect(figure.querySelector('figcaption')!.textContent).toBe('Adelaide, 2025');
    // The paragraph around the image is gone; the prose paragraphs remain.
    expect([...doc.querySelectorAll('p')].map(p => p.textContent)).toEqual(['Before.', 'After.']);
  });

  it('reads a Markdown title and drops the class attribute when only .figure was set', async () => {
    const doc = parse(
      markdownText('![A harbour](../Images/harbour.jpg "Portsea, 1890"){.figure}\n')
    );
    await transformFigures(doc, 'ch1', {});

    const figure = doc.querySelector('figure')!;
    expect(figure.hasAttribute('class')).toBe(false);
    expect(figure.querySelector('img')!.hasAttribute('class')).toBe(false);
    expect(figure.querySelector('figcaption')!.textContent).toBe('Portsea, 1890');
    expect(doc.querySelector('p')).toBeNull();
  });

  it('makes a figure without a figcaption when there is no title', async () => {
    const doc = parse('<p><img class="figure" src="a.jpg" alt="A"/></p>');
    await transformFigures(doc, 'ch1', {});
    expect(doc.querySelector('figure > img')).not.toBeNull();
    expect(doc.querySelector('figcaption')).toBeNull();
  });

  it('leaves an image that shares its paragraph with text', async () => {
    const html = '<p>See <img class="figure" src="a.jpg" alt="A" title="T"/> here.</p>';
    const doc = parse(html);
    await transformFigures(doc, 'ch1', {});
    expect(doc.querySelector('figure')).toBeNull();
    expect(doc.body.innerHTML).toBe(html.replace('/>', '>'));
  });

  it('moves a linked image into the figure with its link', async () => {
    const doc = parse(
      '<p><a href="big.jpg"><img class="figure" src="a.jpg" alt="A" title="T"/></a></p>'
    );
    await transformFigures(doc, 'ch1', {});
    expect(doc.querySelector('p')).toBeNull();
    expect(doc.querySelector('figure > a[href="big.jpg"] > img')).not.toBeNull();
    expect(doc.querySelector('figure > figcaption')!.textContent).toBe('T');
  });

  it('is idempotent', async () => {
    const doc = parse('<p><img class="figure thumb" src="a.jpg" alt="A" title="T"/></p>');
    await transformFigures(doc, 'ch1', {});
    const once = doc.body.innerHTML;
    await transformFigures(doc, 'ch1', {});
    expect(doc.body.innerHTML).toBe(once);
  });
});

describe('figures → photo-regions → responsive (stage order)', () => {
  it('shares one figure: regions bind to it and keep its caption, responsive wraps it', async () => {
    const doc = parse(
      djotText(
        '![The team](../Images/team.jpg){.figure title="The survey team."}\n\n' +
          ':region:{at="5.2,17.7,11.4,21.9" as="Roger King" row="Back"}\n'
      )
    );
    const ctx = { manifest: [], readSourceText: async () => '{}', writeSourceText: async () => {} };
    for (const transform of [transformFigures, transformRegions, transformResponsive]) {
      await transform(doc, 'ch1', ctx);
    }

    const figure = doc.querySelector('.sr-figure > figure.name-faces')!;
    expect(figure).not.toBeNull();
    const caption = figure.querySelector('figcaption')!;
    expect(caption.textContent).toContain('The survey team.');
    expect(caption.querySelector('.fc-name')!.textContent).toContain('Roger King');
    expect(doc.querySelector('.region-set')).toBeNull();
  });
});
