import { describe, it, expect } from 'vitest';
import { chapterRelativeHref, formatDirective } from './format.js';

const TEMPLATE = ':clip[<label>]{src="<href>" begin="<begin>" end="<end>"}';

describe('formatDirective', () => {
  it('writes the audio path relative to the chapter, which lives in Text/', () => {
    expect(
      formatDirective(TEMPLATE, { href: 'Audio/take.mp3', begin: 1, end: 2.5, label: 'Hello' }),
    ).toBe(':clip[Hello]{src="../Audio/take.mp3" begin="0:00:01.00" end="0:00:02.50"}');
  });

  it('injects a quoted rate when set', () => {
    expect(
      formatDirective(TEMPLATE, { href: 'Audio/a.mp3', begin: 0, end: 1, label: '', rate: 0.75 }),
    ).toBe(':clip[]{src="../Audio/a.mp3" begin="0:00:00.00" end="0:00:01.00" rate="0.75"}');
  });
});

describe('chapterRelativeHref', () => {
  it('leaves relative, absolute and special hrefs alone', () => {
    for (const href of ['../Audio/a.mp3', './a.mp3', '/a.mp3', 'https://x.example/a.mp3', 'blob:abc']) {
      expect(chapterRelativeHref(href)).toBe(href);
    }
  });
});
