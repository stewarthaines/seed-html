import { describe, it, expect } from 'vitest';
import { parseContent, parseCounterList, quotePairs } from './generated-content.js';

// materializeGeneratedContent reads a live layout's pseudo-elements, which
// happy-dom doesn't compute; it is exercised in the browser.

describe('parseContent', () => {
  it('reads strings, attr(), counters and quotes', () => {
    expect(parseContent('"Chapter " counter(chapter, upper-roman) ". "')).toEqual([
      { kind: 'string', value: 'Chapter ' },
      { kind: 'counter', name: 'chapter', style: 'upper-roman' },
      { kind: 'string', value: '. ' },
    ]);
    expect(parseContent('counters(section, ".") " " attr(data-label)')).toEqual([
      { kind: 'counters', name: 'section', separator: '.', style: 'decimal' },
      { kind: 'string', value: ' ' },
      { kind: 'attr', name: 'data-label' },
    ]);
    expect(parseContent('open-quote')).toEqual([{ kind: 'quote', which: 'open-quote' }]);
  });

  it('unescapes strings and leaves out alternative text', () => {
    expect(parseContent('"\\201C" / "quote"')).toEqual([{ kind: 'string', value: '“' }]);
  });

  it('is null for content it does not draw', () => {
    expect(parseContent('url("star.png")')).toBeNull();
    expect(parseContent('leader(dotted)')).toBeNull();
  });
});

describe('parseCounterList', () => {
  it('pairs names with values, defaulting the value', () => {
    expect(parseCounterList('chapter 2 section', 0)).toEqual([
      ['chapter', 2],
      ['section', 0],
    ]);
    expect(parseCounterList('none', 1)).toEqual([]);
  });
});

describe('quotePairs', () => {
  it('reads a quotes list, or the language default for auto', () => {
    expect(quotePairs('"<" ">"', 'en')).toEqual(['<', '>']);
    expect(quotePairs('auto', 'de-AT')).toEqual(['„', '“', '‚', '‘']);
    expect(quotePairs('none', 'en')).toEqual([]);
    expect(quotePairs('auto', 'xx')).toBeNull();
  });
});
