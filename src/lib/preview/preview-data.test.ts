import { describe, it, expect } from 'vitest';
import {
  previewDataPath,
  previewDataChapterDir,
  acceptPreviewSaveData,
  PREVIEW_DATA_PREFIX,
} from './preview-data.js';

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

describe('acceptPreviewSaveData', () => {
  const msg = { type: 'seed-save-data', idref: 'chap-03', slot: 'pagemap', text: '{}' };

  it('accepts a well-formed envelope whose idref matches the current chapter', () => {
    expect(acceptPreviewSaveData(msg, 'chap-03')).toEqual({
      idref: 'chap-03',
      slot: 'pagemap',
      text: '{}',
    });
  });

  it('drops a late message from a previously rendered chapter (identity mismatch)', () => {
    // The iframe Window survives document.open() across a chapter switch, so
    // this is the case event.source cannot catch: chapter A's capture script
    // posting after the preview moved on to chapter B.
    expect(acceptPreviewSaveData(msg, 'chap-04')).toBeNull();
  });

  it('drops messages when no chapter is being previewed', () => {
    expect(acceptPreviewSaveData(msg, null)).toBeNull();
    expect(acceptPreviewSaveData(msg, undefined)).toBeNull();
  });

  it('drops envelopes missing the idref echo', () => {
    expect(
      acceptPreviewSaveData({ type: 'seed-save-data', slot: 'pagemap', text: '{}' }, 'chap-03')
    ).toBeNull();
  });

  it('drops wrong types, shapes, and non-string fields', () => {
    expect(acceptPreviewSaveData(null, 'chap-03')).toBeNull();
    expect(acceptPreviewSaveData('seed-save-data', 'chap-03')).toBeNull();
    expect(acceptPreviewSaveData({ ...msg, type: 'other' }, 'chap-03')).toBeNull();
    expect(acceptPreviewSaveData({ ...msg, text: 42 }, 'chap-03')).toBeNull();
    expect(acceptPreviewSaveData({ ...msg, slot: undefined }, 'chap-03')).toBeNull();
  });

  it('drops unsafe slots even when the identity matches', () => {
    expect(acceptPreviewSaveData({ ...msg, slot: '../escape' }, 'chap-03')).toBeNull();
    expect(acceptPreviewSaveData({ ...msg, slot: 'a/b' }, 'chap-03')).toBeNull();
  });

  it('drops an unsafe idref even if the preview somehow matches it', () => {
    const bad = { ...msg, idref: 'a/b' };
    expect(acceptPreviewSaveData(bad, 'a/b')).toBeNull();
  });
});
