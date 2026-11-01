import { describe, it, expect } from 'vitest';
import { counterText, markerText } from './counter-styles.js';

describe('counterText', () => {
  it('writes a number in a style, without a suffix', () => {
    expect(counterText('upper-roman', 4)).toBe('IV');
    expect(counterText('lower-alpha', 1)).toBe('a');
    expect(counterText('disc', 1)).toBe('\u2022');
    expect(counterText('hebrew', 1)).toBeNull();
  });
});

describe('markerText', () => {
  it('writes numbers, letters and numerals with the suffix and space', () => {
    expect(markerText('decimal', 3)).toBe('3. ');
    expect(markerText('decimal-leading-zero', 3)).toBe('03. ');
    expect(markerText('lower-alpha', 28)).toBe('ab. ');
    expect(markerText('upper-roman', 14)).toBe('XIV. ');
    expect(markerText('arabic-indic', 12)).toBe('١٢. ');
  });

  it('writes symbols and strings as they are, and nothing for none', () => {
    expect(markerText('disc', 1)).toBe('\u2022 ');
    expect(markerText('"→ "', 1)).toBe('→ ');
    expect(markerText('none', 1)).toBe('');
  });

  it('is null for a style it does not draw', () => {
    expect(markerText('hebrew', 1)).toBeNull();
    expect(markerText('lower-roman', 4000)).toBeNull();
  });
});
