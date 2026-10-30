/**
 * Tests for the print-page-markers extension: an authored `.pagebreak` run
 * becomes the empty doc-pagebreak span with its text as the page label. Djot,
 * Markdown and Textile sources are rendered through the real extension text
 * transforms, so the input is the markup those formats actually produce. The
 * generator's samples are rendered the same way to show they round-trip.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';

type DomTransform = (doc: Document, idref: string, ctx: unknown) => Document;
const transformMarkers = new Function(
  `${readFileSync('extensions/print-page-markers/transformPageMarkers.js', 'utf8')}\nreturn transformDOM;`
)() as DomTransform;
const generateText = new Function(
  `${readFileSync('extensions/print-page-markers/generatePageMarker.js', 'utf8')}\nreturn generateText;`
)() as (ctx: unknown, options: unknown) => string;

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

new Function(readFileSync('extensions/textile/textile.min.js', 'utf8')).call(globalThis);
const textileText = new Function(
  'textile',
  `${readFileSync('extensions/textile/transformTextile.js', 'utf8')}\nreturn transformText;`
)(globals.textile) as (text: string) => string;

function render(body: string): Document {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
  return transformMarkers(doc, 'ch1', {});
}

const markers = (doc: Document) =>
  [...doc.querySelectorAll('[role="doc-pagebreak"]')].map(el => el.outerHTML);

const PAGE_20 = '<span id="page20" epub:type="pagebreak" role="doc-pagebreak" title="20"></span>';

describe('transformPageMarkers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('turns a djot marker inside a sentence into the full marker', () => {
    const doc = render(
      djotText('The last word of page nine-\nteen,[20]{.pagebreak} then page twenty.\n')
    );
    expect(markers(doc)).toEqual([PAGE_20]);
    expect(doc.querySelector('p')!.textContent).toBe(
      'The last word of page nine-\nteen, then page twenty.'
    );
  });

  it('accepts the markdown and textile class syntax', () => {
    expect(markers(render(markdownText('Text*20*{.pagebreak} more.\n')))).toEqual([PAGE_20]);
    expect(markers(render(textileText('Text[%(pagebreak)20%] more.')))).toEqual([PAGE_20]);
  });

  it('takes the label from a page attribute, leaving the heading text and section id alone', () => {
    const doc = render(djotText('## []{.pagebreak page=20}A Family Without Parents?\n\nText.\n'));
    expect(markers(doc)).toEqual([PAGE_20]);
    expect(doc.querySelector('section')!.id).toBe('A-Family-Without-Parents');
    expect(doc.querySelector('h2')!.textContent).toBe('A Family Without Parents?');
  });

  it('prefers the page attribute to the text, and logs when they differ', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = render(djotText('[19]{.pagebreak page=20}\n'));
    expect(markers(doc)).toEqual([PAGE_20]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('makes an id from a roman or alphanumeric label', () => {
    const doc = render(djotText('[iv]{.pagebreak} [12a]{.pagebreak} [Plate 3]{.pagebreak}\n'));
    expect(
      [...doc.querySelectorAll('[role="doc-pagebreak"]')].map(el => [
        el.id,
        el.getAttribute('title'),
      ])
    ).toEqual([
      ['pageiv', 'iv'],
      ['page12a', '12a'],
      ['pagePlate-3', 'Plate 3'],
    ]);
  });

  it("keeps the author's id and other classes", () => {
    const doc = render(djotText('[20]{.pagebreak .print-only #p20}\n'));
    const marker = doc.querySelector('[role="doc-pagebreak"]')!;
    expect(marker.id).toBe('p20');
    expect(marker.getAttribute('class')).toBe('print-only');
  });

  it('logs and leaves alone a marker with no label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = render('<p>Text<span class="pagebreak"> </span> more.</p>');
    expect(markers(doc)).toEqual([]);
    expect(doc.querySelector('.pagebreak')).not.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('logs and leaves alone a marker whose id is already used', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = render(djotText('[20]{.pagebreak} and again [20]{.pagebreak}\n'));
    expect(markers(doc)).toEqual([PAGE_20]);
    expect(doc.querySelectorAll('.pagebreak')).toHaveLength(1);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('generatePageMarker', () => {
  it.each([
    ['djot', djotText],
    ['markdown', markdownText],
    ['textile', textileText],
  ])('inserts a %s sample that renders to a marker', (format, toHtml) => {
    const sample = generateText({}, { format });
    expect(markers(render(toHtml(`Text${sample} more.\n`)))).toEqual([PAGE_20]);
  });
});
