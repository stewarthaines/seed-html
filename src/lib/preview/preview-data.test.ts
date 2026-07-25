import { describe, it, expect } from 'vitest';
import { previewDataPath, previewDataChapterDir, PREVIEW_DATA_PREFIX } from './preview-data.js';

describe('previewDataPath', () => {
  it('builds SOURCE/data/preview/<idref>/<slot>.json', () => {
    expect(previewDataPath('chap-03', 'pagemap')).toBe('SOURCE/data/preview/chap-03/pagemap.json');
  });

  it('accepts the documented slot and idref character sets', () => {
    expect(previewDataPath('item_2.the-news', 'page-map_2')).toBe(
      `${PREVIEW_DATA_PREFIX}item_2.the-news/page-map_2.json`
    );
  });

  it('rejects a slot that is not a single safe segment', () => {
    expect(previewDataPath('chap-03', 'a/b')).toBeNull(); // separator
    expect(previewDataPath('chap-03', '..')).toBeNull(); // traversal
    expect(previewDataPath('chap-03', 'Page')).toBeNull(); // uppercase
    expect(previewDataPath('chap-03', '')).toBeNull(); // empty
    expect(previewDataPath('chap-03', 'a'.repeat(65))).toBeNull(); // too long
  });

  it('rejects an unsafe idref', () => {
    expect(previewDataPath('../etc', 'pagemap')).toBeNull();
    expect(previewDataPath('a/b', 'pagemap')).toBeNull();
    expect(previewDataPath('', 'pagemap')).toBeNull();
  });
});

describe('previewDataChapterDir', () => {
  it('is the per-chapter directory for GC', () => {
    expect(previewDataChapterDir('chap-03')).toBe('SOURCE/data/preview/chap-03/');
  });

  it('rejects an unsafe idref', () => {
    expect(previewDataChapterDir('../x')).toBeNull();
  });
});
