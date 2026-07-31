import { describe, it, expect } from 'vitest';
import {
  buildInspectSection,
  elementPath,
  measureSelectors,
  DEFAULT_INSPECT_PROPERTIES,
  MAX_MATCHES_PER_SELECTOR,
  MAX_SELECTORS,
  type InspectContext,
  type InspectedElement,
} from './inspect-element.js';

/** happy-dom gives real querySelectorAll / getComputedStyle over plain HTML,
 *  which is all the pure layer touches (rect values are 0 there — geometry is
 *  the browser's job, so these tests assert shape and selection, not pixels). */
function docWith(bodyHtml: string): { doc: Document; win: Window } {
  const doc = document.implementation.createHTMLDocument('test');
  doc.body.innerHTML = bodyHtml;
  // happy-dom's created documents share the global window realm.
  return { doc, win: window };
}

const context = (overrides: Partial<InspectContext> = {}): InspectContext => ({
  chapterId: 'chapter1',
  engine: 'foliate',
  device: 'iphone',
  flow: 'scrolled',
  surface: 1,
  rendering: false,
  ...overrides,
});

describe('elementPath', () => {
  it('builds an ancestor chain and disambiguates same-tag siblings', () => {
    const { doc } = docWith('<main><p>one</p><p><img id="target"></p></main>');
    const img = doc.getElementById('target')!;
    expect(elementPath(img)).toBe('body > main > p:nth-of-type(2) > img');
  });

  it('omits nth-of-type when the tag is unique among its siblings', () => {
    const { doc } = docWith('<main><section><h1>t</h1></section></main>');
    expect(elementPath(doc.querySelector('h1')!)).toBe('body > main > section > h1');
  });
});

describe('measureSelectors', () => {
  it('reports identity, path and the requested properties per match', () => {
    const { doc, win } = docWith('<p><img alt="" class="cover thumb" id="c"></p>');
    const [result] = measureSelectors(doc, win, ['img'], ['display', 'position']);
    expect(result.selector).toBe('img');
    expect(result.total).toBe(1);
    expect(result.elements[0]).toMatchObject({
      index: 0,
      tag: 'img',
      id: 'c',
      className: 'cover thumb',
      path: 'body > p > img',
    });
    expect(Object.keys(result.elements[0].styles)).toEqual(['display', 'position']);
    expect(result.elements[0].rect).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
  });

  it('reports only the opening tag, so a large subtree stays cheap', () => {
    const { doc, win } = docWith(`<div class="wrap"><p>${'x'.repeat(500)}</p></div>`);
    const [result] = measureSelectors(doc, win, ['div'], []);
    expect(result.elements[0].html).toBe('<div class="wrap">');
  });

  it('omits absent id and class rather than reporting empty strings', () => {
    const { doc, win } = docWith('<p><span>x</span></p>');
    const [result] = measureSelectors(doc, win, ['span'], []);
    expect(result.elements[0]).not.toHaveProperty('id');
    expect(result.elements[0]).not.toHaveProperty('className');
  });

  it('caps matches per selector but reports the true total', () => {
    const { doc, win } = docWith('<p>x</p>'.repeat(MAX_MATCHES_PER_SELECTOR + 5));
    const [result] = measureSelectors(doc, win, ['p'], []);
    expect(result.total).toBe(MAX_MATCHES_PER_SELECTOR + 5);
    expect(result.elements).toHaveLength(MAX_MATCHES_PER_SELECTOR);
  });

  it('reports an invalid selector as an error without discarding the others', () => {
    const { doc, win } = docWith('<p><img></p>');
    const results = measureSelectors(doc, win, ['[', 'img'], []);
    expect(results[0].error).toMatch(/invalid selector/);
    expect(results[0].elements).toEqual([]);
    expect(results[1].total).toBe(1);
  });

  it('measures every selector in one pass, in the order given', () => {
    const { doc, win } = docWith('<p><img></p><figure></figure>');
    const results = measureSelectors(doc, win, ['figure', 'img'], []);
    expect(results.map(r => r.selector)).toEqual(['figure', 'img']);
  });

  it('drops selectors beyond the cap', () => {
    const { doc, win } = docWith('<p>x</p>');
    const many = Array.from({ length: MAX_SELECTORS + 3 }, () => 'p');
    expect(measureSelectors(doc, win, many, [])).toHaveLength(MAX_SELECTORS);
  });

  it('reports a selector that matches nothing as an empty result, not an error', () => {
    const { doc, win } = docWith('<p>x</p>');
    const [result] = measureSelectors(doc, win, ['video'], []);
    expect(result).toMatchObject({ total: 0, elements: [] });
    expect(result.error).toBeUndefined();
  });
});

describe('buildInspectSection', () => {
  it('carries the rendering context through to the payload', () => {
    const section = buildInspectSection(context(), [], 1);
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section).toMatchObject({
      chapterId: 'chapter1',
      engine: 'foliate',
      device: 'iphone',
      flow: 'scrolled',
      surface: 1,
      caveats: [],
    });
  });

  it('caveats a measurement taken while a render was in flight', () => {
    const section = buildInspectSection(context({ rendering: true }), [], 1);
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section.caveats).toContain('render-in-flight');
  });

  it('caveats Paged.js wrapper markup, as the a11y section does', () => {
    const section = buildInspectSection(context({ engine: 'paged', flow: undefined }), [], 1);
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section.caveats).toContain('paged-chrome');
  });

  it('makes both kinds of truncation visible', () => {
    const section = buildInspectSection(
      context(),
      [
        {
          selector: 'p',
          total: 40,
          elements: new Array(MAX_MATCHES_PER_SELECTOR).fill({
            tag: 'p',
          }) as unknown as InspectedElement[],
        },
      ],
      MAX_SELECTORS + 2
    );
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section.caveats).toEqual([
      `selectors truncated to the first ${MAX_SELECTORS}`,
      `matches truncated to the first ${MAX_MATCHES_PER_SELECTOR} per selector`,
    ]);
  });

  it('announces scaled rects when any element sits under a transform', () => {
    const section = buildInspectSection(
      context(),
      [
        {
          selector: '.pagedjs_page_content',
          total: 1,
          elements: [{ scale: 0.2254 } as unknown as InspectedElement],
        },
      ],
      1
    );
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section.caveats.some(c => c.startsWith('scaled-rects'))).toBe(true);
  });

  it('stays silent about scale when nothing is transformed', () => {
    const section = buildInspectSection(
      context(),
      [{ selector: 'p', total: 1, elements: [{ tag: 'p' } as unknown as InspectedElement] }],
      1
    );
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section.caveats).toEqual([]);
  });

  it('defaults to layout-shaped properties', () => {
    expect(DEFAULT_INSPECT_PROPERTIES).toContain('position');
    expect(DEFAULT_INSPECT_PROPERTIES).toContain('display');
    expect(DEFAULT_INSPECT_PROPERTIES.length).toBeLessThan(20);
  });
});
