import { describe, it, expect } from 'vitest';
import { chapterCompanionFiles, renamedCompanionPath } from './chapter-companions.js';

describe('chapterCompanionFiles', () => {
  const paths = [
    'SOURCE/text/ch1.txt',
    'SOURCE/text/ch1.json',
    'SOURCE/locale/en/text/ch1.txt',
    'SOURCE/locale/en/text/ch1.json',
    'SOURCE/locale/de/text/ch1.txt',
    'SOURCE/locale/en/text/ch10.txt', // different chapter — id must match exactly
    'SOURCE/locale/en/meta.json',
    'SOURCE/main/SOURCE/text/ch1.txt',
    'SOURCE/main/OEBPS/Styles/style.css', // base of a stylesheet, not a chapter
    'SOURCE/data/frontmatter/ch1.json',
    'SOURCE/data/frontmatter/ch10.json',
    'SOURCE/data/figures/ch1.json', // another store, not swept here
    'OEBPS/Text/ch1.xhtml',
  ];

  it('matches locale copies, track-changes bases and the frontmatter record for the exact id', () => {
    expect(chapterCompanionFiles(paths, 'ch1')).toEqual([
      'SOURCE/locale/en/text/ch1.txt',
      'SOURCE/locale/en/text/ch1.json',
      'SOURCE/locale/de/text/ch1.txt',
      'SOURCE/main/SOURCE/text/ch1.txt',
      'SOURCE/data/frontmatter/ch1.json',
    ]);
  });

  it('treats regex metacharacters in ids literally', () => {
    const dotted = ['SOURCE/locale/en/text/ch.1.txt', 'SOURCE/locale/en/text/chX1.txt'];
    expect(chapterCompanionFiles(dotted, 'ch.1')).toEqual(['SOURCE/locale/en/text/ch.1.txt']);
  });
});

describe('renamedCompanionPath', () => {
  it('replaces only the final id segment', () => {
    expect(renamedCompanionPath('SOURCE/locale/en/text/ch1.txt', 'ch1', 'intro')).toBe(
      'SOURCE/locale/en/text/intro.txt'
    );
    expect(renamedCompanionPath('SOURCE/main/SOURCE/text/ch1.json', 'ch1', 'intro')).toBe(
      'SOURCE/main/SOURCE/text/intro.json'
    );
    expect(renamedCompanionPath('SOURCE/data/frontmatter/ch1.json', 'ch1', 'intro')).toBe(
      'SOURCE/data/frontmatter/intro.json'
    );
  });
});
