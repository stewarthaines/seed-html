/**
 * The attributed-symbol carrier in both shipped text formats: a paragraph of
 * same-alias `:alias:{…}` directives becomes `p.<alias>-set > span.<alias>`
 * with every attribute as data-*, for any alias. The DOM transforms
 * (photo-regions today, family-history later) bind that one shape.
 *
 * The djot library isn't a dev dependency, so its filter is evaluated from
 * the extension source and driven with a hand-built AST of the shape
 * djot.parse produces. The markdown-it bundles ARE in the extension folder,
 * so that side renders real Markdown through the extension's transformText.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const djotSrc = readFileSync('extensions/djot/transformDjot.js', 'utf8');
const symbolFilter = new Function(`${djotSrc}\nreturn symbolFilter;`)() as () => {
  doc: { enter: (doc: DjotNode) => void };
};

interface DjotNode {
  tag: string;
  alias?: string;
  attributes?: Record<string, string>;
  children?: DjotNode[];
}

const symbol = (alias: string, attributes?: Record<string, string>): DjotNode => ({
  tag: 'symb',
  alias,
  ...(attributes ? { attributes } : {}),
});
const softBreak: DjotNode = { tag: 'soft_break' };

describe('djot symbolFilter', () => {
  it('carries every attribute of every symbol as data-* and stamps the set class', () => {
    const para: DjotNode = {
      tag: 'para',
      children: [
        symbol('region', { at: '5.2,17.7,11.4,21.9', of: 'roger_king', as: 'Roger King' }),
        softBreak,
        symbol('region', { at: '17.3,14.8,9.9,20.4', as: 'Ian Vitcheff', row: 'Back' }),
      ],
    };
    symbolFilter().doc.enter({ tag: 'doc', children: [para] });

    expect(para.attributes).toEqual({ class: 'region-set' });
    expect(para.children!.map(node => node.tag)).toEqual(['span', 'span']);
    expect(para.children![0].attributes).toEqual({
      class: 'region',
      'data-at': '5.2,17.7,11.4,21.9',
      'data-of': 'roger_king',
      'data-as': 'Roger King',
    });
    expect(para.children![1].attributes).toEqual({
      class: 'region',
      'data-at': '17.3,14.8,9.9,20.4',
      'data-as': 'Ian Vitcheff',
      'data-row': 'Back',
    });
  });

  it('keeps the authored paragraph class beside the set class', () => {
    const para: DjotNode = {
      tag: 'para',
      attributes: { class: 'two-thirds' },
      children: [
        symbol('detail', {
          src: '../Images/ct.jpg',
          at: '20,32,75,7',
          size: '1600x2284',
          alt: 'Proprietor line',
          to: 'sources.xhtml#The-1882-title',
          caption: 'The 1882 title.',
        }),
      ],
    };
    symbolFilter().doc.enter({ tag: 'doc', children: [para] });

    expect(para.attributes!.class).toBe('two-thirds detail-set');
    expect(para.children![0].attributes).toEqual({
      class: 'detail',
      'data-src': '../Images/ct.jpg',
      'data-at': '20,32,75,7',
      'data-size': '1600x2284',
      'data-alt': 'Proprietor line',
      'data-to': 'sources.xhtml#The-1882-title',
      'data-caption': 'The 1882 title.',
    });
  });

  it('carries any alias, and does not judge which attributes are present', () => {
    const para: DjotNode = {
      tag: 'para',
      children: [symbol('lifeline', { of: 'nick', as: 'Nick' })],
    };
    symbolFilter().doc.enter({ tag: 'doc', children: [para] });
    expect(para.attributes!.class).toBe('lifeline-set');
    expect(para.children![0].attributes).toEqual({
      class: 'lifeline',
      'data-of': 'nick',
      'data-as': 'Nick',
    });

    // A region without at= still becomes a carrier — the DOM transform
    // breadcrumbs it with a note; the filter no longer gates on it.
    const noAt: DjotNode = { tag: 'para', children: [symbol('region', { as: 'Nobody' })] };
    symbolFilter().doc.enter({ tag: 'doc', children: [noAt] });
    expect(noAt.attributes!.class).toBe('region-set');
  });

  it('leaves bare symbols, mixed aliases and directives amid prose alone', () => {
    const bare: DjotNode = { tag: 'para', children: [symbol('wink')] };
    const mixed: DjotNode = {
      tag: 'para',
      children: [symbol('region', { at: '1,2,3,4' }), softBreak, symbol('detail', { src: 'a' })],
    };
    const prose: DjotNode = {
      tag: 'para',
      children: [
        symbol('region', { at: '1,2,3,4' }),
        { tag: 'str', text: ' trailing' } as DjotNode,
      ],
    };
    symbolFilter().doc.enter({ tag: 'doc', children: [bare, mixed, prose] });

    for (const para of [bare, mixed, prose]) {
      expect(para.attributes).toBeUndefined();
      expect(para.children![0].tag).toBe('symb');
    }
  });

  it('walks into sections and divs', () => {
    const para: DjotNode = { tag: 'para', children: [symbol('tree', { root: 'x' })] };
    const doc: DjotNode = {
      tag: 'doc',
      children: [{ tag: 'section', children: [{ tag: 'div', children: [para] }] }],
    };
    symbolFilter().doc.enter(doc);
    expect(para.attributes!.class).toBe('tree-set');
  });
});

// ---- markdown-it -----------------------------------------------------------

const mdSrc = readFileSync('extensions/markdown-it/transformMarkdown.js', 'utf8');
new Function(readFileSync('extensions/markdown-it/markdown-it.min.js', 'utf8'))();
new Function(readFileSync('extensions/markdown-it/markdown-it-attrs.browser.min.js', 'utf8'))();
const globals = globalThis as unknown as Record<string, unknown>;
const win = (globals.window ?? globals) as Record<string, unknown>;
win.markdownit = globals.markdownit;
win.markdownItAttrs = globals.markdownItAttrs;
const transformMarkdown = new Function(`${mdSrc}\nreturn transformText;`)() as (
  text: string
) => string;

const render = (text: string) =>
  new DOMParser().parseFromString(`<body>${transformMarkdown(text)}</body>`, 'text/html');

describe('markdown-it symbolPlugin', () => {
  it('renders a paragraph of same-alias directives as the set carrier', () => {
    const doc = render(
      ':region:{at="5.2,17.7,11.4,21.9" of=roger_king as="Roger King" row="Back"}\n' +
        ':region:{at="17.3,14.8,9.9,20.4" as="Ian Vitcheff" row="Back"}\n'
    );
    const p = doc.querySelector('p')!;
    expect(p.getAttribute('class')).toBe('region-set');
    const spans = [...p.querySelectorAll('span.region')];
    expect(spans.length).toBe(2);
    expect(spans[0].getAttribute('data-at')).toBe('5.2,17.7,11.4,21.9');
    expect(spans[0].getAttribute('data-of')).toBe('roger_king');
    expect(spans[0].getAttribute('data-as')).toBe('Roger King');
    expect(spans[1].getAttribute('data-row')).toBe('Back');
    expect(p.textContent!.trim()).toBe('');
  });

  it('carries any alias and every attribute, bare or quoted', () => {
    const doc = render(':lifeline:{of=nick as="Nick Haines" from=1901}\n');
    const p = doc.querySelector('p')!;
    expect(p.getAttribute('class')).toBe('lifeline-set');
    const span = p.querySelector('span.lifeline')!;
    expect(span.getAttribute('data-of')).toBe('nick');
    expect(span.getAttribute('data-as')).toBe('Nick Haines');
    expect(span.getAttribute('data-from')).toBe('1901');
  });

  it('joins the set class to a class markdown-it-attrs put on the paragraph', () => {
    // A space before the braces targets the block (markdown-it-attrs' rule).
    const doc = render(
      ':detail:{src="../Images/ct.jpg" at="20,32,75,7" size="1600x2284" alt="Line"} {.two-thirds}\n'
    );
    const p = doc.querySelector('p')!;
    expect(p.getAttribute('class')).toBe('two-thirds detail-set');
    expect(p.querySelector('span.detail')!.getAttribute('data-alt')).toBe('Line');

    // Without the space the class lands on the span; the set is still a set.
    const tight = render(':detail:{src="../Images/ct.jpg" at="20,32,75,7"}{.two-thirds}\n');
    expect(tight.querySelector('p')!.getAttribute('class')).toBe('detail-set');
    expect(tight.querySelector('span')!.getAttribute('class')).toBe('detail two-thirds');
  });

  it('gives no set class to prose or mixed-alias paragraphs, and leaves bare directives as text', () => {
    const prose = render(':region:{at="1,2,3,4"} trailing prose\n');
    expect(prose.querySelector('p')!.hasAttribute('class')).toBe(false);
    expect(prose.querySelector('span.region')).not.toBeNull();

    const mixed = render(':region:{at="1,2,3,4"}\n:detail:{src=a.jpg}\n');
    expect(mixed.querySelector('p')!.hasAttribute('class')).toBe(false);
    expect(mixed.querySelectorAll('span').length).toBe(2);

    const bare = render(':wink:{}\n');
    expect(bare.querySelector('span')).toBeNull();
    expect(bare.body.textContent).toContain(':wink:');
  });

  it('still renders the audio clip directive as before', () => {
    const doc = render(':clip[Hear it]{src=Audio/a.mp3 begin=0:00:05.00 end=0:00:15.00}\n');
    const clip = doc.querySelector('span.clip')!;
    expect(clip.textContent).toBe('Hear it');
    expect(clip.getAttribute('data-src')).toBe('Audio/a.mp3');
    expect(doc.querySelector('p')!.hasAttribute('class')).toBe(false);
  });
});
