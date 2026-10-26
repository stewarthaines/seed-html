import { describe, it, expect } from 'vitest';
import {
  parseFxlViewport,
  bookViewport,
  DEFAULT_FXL_VIEWPORT,
  DEFAULT_FXL_VIEWPORT_WIDTH,
  DEFAULT_FXL_VIEWPORT_HEIGHT,
} from './fixed-layout.js';

const DEFAULTS = { width: DEFAULT_FXL_VIEWPORT_WIDTH, height: DEFAULT_FXL_VIEWPORT_HEIGHT };

describe('parseFxlViewport', () => {
  it('parses the canonical form and its own default string', () => {
    expect(parseFxlViewport('width=1200, height=1600')).toEqual({ width: 1200, height: 1600 });
    expect(parseFxlViewport(DEFAULT_FXL_VIEWPORT)).toEqual(DEFAULTS);
  });

  it('tolerates spacing, ordering, and case variations', () => {
    expect(parseFxlViewport('width=600,height=800')).toEqual({ width: 600, height: 800 });
    expect(parseFxlViewport('width = 600 , height = 800')).toEqual({ width: 600, height: 800 });
    expect(parseFxlViewport('height=1600, width=1200')).toEqual({ width: 1200, height: 1600 });
    expect(parseFxlViewport('WIDTH=100, HEIGHT=200')).toEqual({ width: 100, height: 200 });
  });

  it('falls back to defaults when absent', () => {
    expect(parseFxlViewport(undefined)).toEqual(DEFAULTS);
    expect(parseFxlViewport(null)).toEqual(DEFAULTS);
    expect(parseFxlViewport('')).toEqual(DEFAULTS);
  });

  it('requires both dimensions — partial values fall back entirely', () => {
    expect(parseFxlViewport('width=1200')).toEqual(DEFAULTS);
    expect(parseFxlViewport('height=1600')).toEqual(DEFAULTS);
  });

  it('rejects zero and non-numeric values', () => {
    expect(parseFxlViewport('width=0, height=800')).toEqual(DEFAULTS);
    expect(parseFxlViewport('width=abc, height=800')).toEqual(DEFAULTS);
    expect(parseFxlViewport('device-width')).toEqual(DEFAULTS);
  });

  it('rejects negative values (the sign breaks the digits-after-= match)', () => {
    expect(parseFxlViewport('width=-5, height=800')).toEqual(DEFAULTS);
  });
});

describe('bookViewport', () => {
  it('is the parsed viewport of a fixed-layout book', () => {
    expect(
      bookViewport({ renditionLayout: 'pre-paginated', renditionViewport: 'width=320, height=460' })
    ).toEqual({ width: 320, height: 460 });
  });

  it('falls back to the defaults for a fixed-layout book without one', () => {
    expect(bookViewport({ renditionLayout: 'pre-paginated' })).toEqual(DEFAULTS);
  });

  it('is null for a reflowable book', () => {
    expect(bookViewport({ renditionViewport: 'width=320, height=460' })).toBeNull();
    expect(bookViewport({ renditionLayout: 'reflowable' })).toBeNull();
    expect(bookViewport(undefined)).toBeNull();
  });
});
