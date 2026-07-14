import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  cacheKey,
  entryFreshFor,
  readEntry,
  writeEntry,
  removeEntry,
  pruneEntries,
  MAX_THUMB_CHARS,
  TOTAL_BUDGET_CHARS,
  type ProjectsCacheEntry,
} from './projects-cache.js';

const entry = (overrides: Partial<ProjectsCacheEntry> = {}): ProjectsCacheEntry => ({
  v: 2,
  opfMtime: 1000,
  rowMeta: { fileCount: 12, extensionIds: ['abc2svg'], readOnly: false },
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readEntry / writeEntry', () => {
  it('round-trips an entry', () => {
    writeEntry('ws1', entry({ thumb: 'data:image/png;base64,AAAA' }));
    expect(readEntry('ws1')).toEqual(entry({ thumb: 'data:image/png;base64,AAAA' }));
  });

  it('treats corrupt JSON as a miss and removes the key', () => {
    localStorage.setItem(cacheKey('ws1'), '{not json');
    expect(readEntry('ws1')).toBeNull();
    expect(localStorage.getItem(cacheKey('ws1'))).toBeNull();
  });

  it('treats a version mismatch as a miss and removes the key', () => {
    localStorage.setItem(cacheKey('ws1'), JSON.stringify({ v: 99, opfMtime: 1 }));
    expect(readEntry('ws1')).toBeNull();
    expect(localStorage.getItem(cacheKey('ws1'))).toBeNull();
  });

  it('drops an oversized thumbnail instead of persisting it', () => {
    writeEntry('ws1', entry({ thumb: 'x'.repeat(MAX_THUMB_CHARS + 1) }));
    expect(readEntry('ws1')?.thumb).toBeUndefined();
    expect(readEntry('ws1')?.rowMeta?.fileCount).toBe(12);
  });

  it('retries without the thumbnail when the first write hits quota', () => {
    const setItem = vi.spyOn(localStorage, 'setItem');
    setItem.mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    writeEntry('ws1', entry({ thumb: 'data:image/png;base64,AAAA' }));
    const stored = readEntry('ws1');
    expect(stored?.thumb).toBeUndefined();
    expect(stored?.rowMeta?.fileCount).toBe(12);
  });

  it('never throws when storage is entirely unavailable', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => writeEntry('ws1', entry())).not.toThrow();
    expect(() => removeEntry('ws1')).not.toThrow();
  });
});

describe('entryFreshFor', () => {
  it('matches only the same non-zero mtime', () => {
    expect(entryFreshFor(entry(), 1000)).toBe(true);
    expect(entryFreshFor(entry(), 1001)).toBe(false);
    expect(entryFreshFor(entry({ opfMtime: 0 }), 0)).toBe(false);
  });
});

describe('pruneEntries', () => {
  it('removes entries for workspaces that no longer exist', () => {
    writeEntry('ws1', entry());
    writeEntry('ws2', entry());
    localStorage.setItem('seedhtml_other_key', 'untouched');
    pruneEntries(['ws1']);
    expect(readEntry('ws1')).not.toBeNull();
    expect(localStorage.getItem(cacheKey('ws2'))).toBeNull();
    expect(localStorage.getItem('seedhtml_other_key')).toBe('untouched');
  });

  it('strips thumbnails (largest first) when over the total budget', () => {
    const bigThumb = 'x'.repeat(Math.ceil(TOTAL_BUDGET_CHARS * 0.7));
    const smallThumb = 'y'.repeat(1000);
    writeEntry('big-a', entry({ thumb: bigThumb }));
    writeEntry('big-b', entry({ thumb: bigThumb }));
    writeEntry('small', entry({ thumb: smallThumb }));

    pruneEntries(['big-a', 'big-b', 'small']);

    const survivors = ['big-a', 'big-b', 'small'].map(id => readEntry(id));
    // Entries themselves survive; enough big thumbs are stripped to fit.
    expect(survivors.every(e => e?.rowMeta?.fileCount === 12)).toBe(true);
    expect(survivors.filter(e => e?.thumb).length).toBeLessThan(3);
    expect(readEntry('small')?.thumb).toBe(smallThumb);
  });
});
