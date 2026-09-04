/**
 * The djot adapter for the :detail: directive — the filter that rewrites a
 * paragraph of :detail: symbols into the span.detail carrier the photo-regions
 * DOM transform consumes. The djot library isn't a dev dependency, so the
 * filter is evaluated from the extension source and driven with a hand-built
 * AST of the shape djot.parse produces. The markdown-it adapter shares the
 * attribute list and is checked by hand in the app.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('extensions/djot/transformDjot.js', 'utf8');
const detailFilter = new Function(`${src}\nreturn detailFilter;`)() as () => {
  doc: { enter: (doc: DjotNode) => void };
};

interface DjotNode {
  tag: string;
  alias?: string;
  attributes?: Record<string, string>;
  children?: DjotNode[];
}

const symbol = (attributes: Record<string, string>): DjotNode => ({
  tag: 'symb',
  alias: 'detail',
  attributes,
});

describe('djot detailFilter', () => {
  it('carries every directive attribute as data-* and keeps the authored class', () => {
    const para: DjotNode = {
      tag: 'para',
      attributes: { class: 'two-thirds' },
      children: [
        symbol({
          src: '../Images/ct.jpg',
          at: '20,32,75,7',
          size: '1600x2284',
          alt: 'Proprietor line',
          to: 'sources.xhtml#The-1882-title',
          caption: 'The 1882 title.',
        }),
      ],
    };
    const doc: DjotNode = { tag: 'doc', children: [para] };
    detailFilter().doc.enter(doc);

    expect(para.attributes!.class).toBe('two-thirds detail-set');
    const span = para.children![0];
    expect(span.tag).toBe('span');
    expect(span.attributes).toEqual({
      class: 'detail',
      'data-src': '../Images/ct.jpg',
      'data-at': '20,32,75,7',
      'data-size': '1600x2284',
      'data-alt': 'Proprietor line',
      'data-to': 'sources.xhtml#The-1882-title',
      'data-caption': 'The 1882 title.',
    });
  });

  it('leaves a paragraph alone when src= or at= is missing', () => {
    const para: DjotNode = {
      tag: 'para',
      children: [symbol({ src: '../Images/ct.jpg', alt: 'No box' })],
    };
    detailFilter().doc.enter({ tag: 'doc', children: [para] });
    expect(para.attributes).toBeUndefined();
    expect(para.children![0].tag).toBe('symb');
  });
});
