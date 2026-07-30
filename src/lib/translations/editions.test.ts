/**
 * Unit tests for the translation-editions swap core: pure metadata helpers,
 * add/switch/remove against an in-memory storage fake, and — the load-bearing
 * one — crash-at-every-mutation resume: a switch interrupted after any single
 * storage mutation must be completed by recoverPendingSwap to exactly the
 * committed end state (or, if it never journaled, roll forward to nothing).
 */

import { describe, it, expect } from 'vitest';
import type { FileStorageAPI } from '../storage/index.js';
import type { EPUBMetadata } from '../epub/opf-utils.js';
import {
  LOCALE_PREFIX,
  SWAP_JOURNAL_PATH,
  addTranslation,
  listTranslations,
  localeMetaPath,
  localeTextPrefix,
  recoverPendingSwap,
  removeTranslation,
  swapMetadataUpdates,
  switchTranslation,
  translationMetaFrom,
} from './editions.js';

// ---------------------------------------------------------------------------
// In-memory FileStorageAPI covering the methods the module uses. listFiles
// mirrors the real backends' directory semantics: recursive, full paths,
// empty array for a missing directory.
function fakeStorage(files: Map<string, string>): FileStorageAPI {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return {
    listFiles: async (_id: string, basePath?: string) => {
      const base = (basePath ?? '').replace(/\/+$/, '');
      return [...files.keys()].filter(p => (base ? p.startsWith(`${base}/`) : true)).sort();
    },
    fileExists: async (_id: string, path: string) => files.has(path),
    readTextFile: async (_id: string, path: string) => {
      if (!files.has(path)) throw new Error(`not found: ${path}`);
      return files.get(path)!;
    },
    writeTextFile: async (_id: string, path: string, content: string) => {
      files.set(path, content);
    },
    readFile: async (_id: string, path: string) => {
      if (!files.has(path)) throw new Error(`not found: ${path}`);
      return encoder.encode(files.get(path)!).buffer as ArrayBuffer;
    },
    writeFile: async (_id: string, path: string, content: ArrayBuffer) => {
      files.set(path, decoder.decode(content));
    },
    deleteFile: async (_id: string, path: string) => {
      files.delete(path);
    },
  } as unknown as FileStorageAPI;
}

/** Wraps a storage so the (budget+1)-th mutation throws — a simulated crash. */
function faultyStorage(storage: FileStorageAPI, budget: number): FileStorageAPI {
  let used = 0;
  const spend = () => {
    if (used >= budget) throw new Error('simulated crash');
    used += 1;
  };
  return {
    ...storage,
    writeFile: async (id: string, path: string, content: ArrayBuffer) => {
      spend();
      return storage.writeFile(id, path, content);
    },
    writeTextFile: async (id: string, path: string, content: string) => {
      spend();
      return storage.writeTextFile(id, path, content);
    },
    deleteFile: async (id: string, path: string) => {
      spend();
      return storage.deleteFile(id, path);
    },
  } as unknown as FileStorageAPI;
}

const WS = 'ws1';

describe('swapMetadataUpdates', () => {
  it('moves the target tag to the front and keeps the outgoing tag', () => {
    const updates = swapMetadataUpdates({ language: ['ka', 'en'] }, 'en', 'ka', null);
    expect(updates.language).toEqual(['en', 'ka']);
    expect(updates.title).toBeUndefined();
  });

  it('re-adds a missing outgoing tag and applies incoming overrides', () => {
    const updates = swapMetadataUpdates({ language: ['de'] }, 'de', 'en', {
      title: 'Der Titel',
      description: 'Beschreibung',
    });
    expect(updates.language).toEqual(['de', 'en']);
    expect(updates.title).toBe('Der Titel');
    expect(updates.description).toBe('Beschreibung');
    expect(updates.titleFileAs).toBeUndefined();
  });

  it('tolerates legacy single-string language data', () => {
    const updates = swapMetadataUpdates(
      { language: 'en' as unknown as string[] },
      'ka',
      'en',
      null
    );
    expect(updates.language).toEqual(['ka', 'en']);
  });
});

describe('translationMetaFrom', () => {
  it('captures only non-empty swap-relevant fields', () => {
    expect(
      translationMetaFrom({ title: 'T', titleFileAs: '  ', description: 'D' } as EPUBMetadata)
    ).toEqual({ title: 'T', description: 'D' });
  });
});

describe('listTranslations', () => {
  it('derives tags from locale text trees only', async () => {
    const storage = fakeStorage(
      new Map([
        ['SOURCE/locale/en/text/ch1.txt', 'x'],
        ['SOURCE/locale/en/meta.json', '{}'],
        ['SOURCE/locale/de/text/ch1.txt', 'x'],
        ['SOURCE/locale/fr/meta.json', '{}'], // meta-only: no stored text, not a translation
        [SWAP_JOURNAL_PATH, '{}'],
        ['SOURCE/text/ch1.txt', 'x'],
      ])
    );
    expect(await listTranslations(storage, WS)).toEqual(['de', 'en']);
  });
});

describe('addTranslation', () => {
  it('freezes the current text and meta under the current tag', async () => {
    const files = new Map([
      ['SOURCE/text/ch1.txt', 'english'],
      ['SOURCE/text/ch1.json', '{"a":1}'],
    ]);
    const storage = fakeStorage(files);
    await addTranslation(storage, WS, {
      currentTag: 'en',
      targetTag: 'ka',
      meta: { title: 'The Title' },
    });
    // Active tree untouched; frozen copy + meta stored.
    expect(files.get('SOURCE/text/ch1.txt')).toBe('english');
    expect(files.get('SOURCE/locale/en/text/ch1.txt')).toBe('english');
    expect(files.get('SOURCE/locale/en/text/ch1.json')).toBe('{"a":1}');
    expect(JSON.parse(files.get(localeMetaPath('en'))!)).toEqual({ title: 'The Title' });
  });

  it('rejects an existing target and the active tag itself', async () => {
    const storage = fakeStorage(
      new Map([
        ['SOURCE/text/ch1.txt', 'x'],
        ['SOURCE/locale/ka/text/ch1.txt', 'y'],
      ])
    );
    await expect(
      addTranslation(storage, WS, { currentTag: 'en', targetTag: 'ka', meta: {} })
    ).rejects.toThrow(/already exists/);
    await expect(
      addTranslation(storage, WS, { currentTag: 'en', targetTag: 'EN', meta: {} })
    ).rejects.toThrow(/already in this language/);
  });

  it('replaces debris from an interrupted add', async () => {
    const files = new Map([
      ['SOURCE/text/ch1.txt', 'current'],
      ['SOURCE/locale/en/text/stale.txt', 'stale'],
    ]);
    await addTranslation(fakeStorage(files), WS, { currentTag: 'en', targetTag: 'ka', meta: {} });
    expect(files.has('SOURCE/locale/en/text/stale.txt')).toBe(false);
    expect(files.get('SOURCE/locale/en/text/ch1.txt')).toBe('current');
  });
});

// Shared fixture: KA active (mid-translation), EN stored.
function switchFixture() {
  return new Map([
    ['SOURCE/text/ch1.txt', 'georgian ch1'],
    ['SOURCE/text/ch1.json', '{"lang":"ka"}'],
    ['SOURCE/text/nav.txt', 'georgian nav'],
    ['SOURCE/locale/en/text/ch1.txt', 'english ch1'],
    ['SOURCE/locale/en/text/ch1.json', '{"lang":"en"}'],
    ['SOURCE/locale/en/text/nav.txt', 'english nav'],
    [localeMetaPath('en'), JSON.stringify({ title: 'English Title' })],
    ['OEBPS/Text/ch1.xhtml', '<html/>'], // untouched bystander
  ]);
}

function metadataApplier(metadata: Partial<EPUBMetadata>) {
  return async (incoming: unknown, toTag: string, fromTag: string) => {
    Object.assign(metadata, swapMetadataUpdates(metadata, toTag, fromTag, incoming as never));
  };
}

function expectSwitchedToEnglish(files: Map<string, string>, metadata: Partial<EPUBMetadata>) {
  expect(files.get('SOURCE/text/ch1.txt')).toBe('english ch1');
  expect(files.get('SOURCE/text/ch1.json')).toBe('{"lang":"en"}');
  expect(files.get('SOURCE/text/nav.txt')).toBe('english nav');
  expect(files.get('SOURCE/locale/ka/text/ch1.txt')).toBe('georgian ch1');
  expect(files.get('SOURCE/locale/ka/text/nav.txt')).toBe('georgian nav');
  expect(JSON.parse(files.get(localeMetaPath('ka'))!)).toEqual({ title: 'ქართული' });
  // The incoming edition dissolved; no journal left behind.
  expect([...files.keys()].filter(p => p.startsWith(`${LOCALE_PREFIX}en/`))).toEqual([]);
  expect(files.has(SWAP_JOURNAL_PATH)).toBe(false);
  expect(files.get('OEBPS/Text/ch1.xhtml')).toBe('<html/>');
  expect(metadata.language).toEqual(['en', 'ka']);
  expect(metadata.title).toBe('English Title');
}

describe('switchTranslation', () => {
  it('swaps the trees, applies incoming meta, and reports the active paths', async () => {
    const files = switchFixture();
    const metadata: Partial<EPUBMetadata> = { language: ['ka', 'en'], title: 'ქართული' };
    const { changedPaths } = await switchTranslation(fakeStorage(files), WS, {
      fromTag: 'ka',
      toTag: 'en',
      outgoingMeta: { title: 'ქართული' },
      applyMetadata: metadataApplier(metadata),
    });
    expectSwitchedToEnglish(files, metadata);
    expect(changedPaths.sort()).toEqual([
      'SOURCE/text/ch1.json',
      'SOURCE/text/ch1.txt',
      'SOURCE/text/nav.txt',
    ]);
  });

  it('refuses when there is no stored edition for the target tag', async () => {
    const files = switchFixture();
    await expect(
      switchTranslation(fakeStorage(files), WS, {
        fromTag: 'ka',
        toTag: 'de',
        outgoingMeta: {},
        applyMetadata: async () => {},
      })
    ).rejects.toThrow(/No stored de translation/);
  });

  it('refuses while another switch is journaled', async () => {
    const files = switchFixture();
    files.set(SWAP_JOURNAL_PATH, JSON.stringify({ from: 'ka', to: 'en', phase: 'stash' }));
    await expect(
      switchTranslation(fakeStorage(files), WS, {
        fromTag: 'ka',
        toTag: 'en',
        outgoingMeta: {},
        applyMetadata: async () => {},
      })
    ).rejects.toThrow(/in progress/);
  });
});

describe('recoverPendingSwap', () => {
  it('is a no-op without a journal', async () => {
    const files = switchFixture();
    const result = await recoverPendingSwap(fakeStorage(files), WS, async () => {});
    expect(result).toBeNull();
    expect(files.get('SOURCE/text/ch1.txt')).toBe('georgian ch1');
  });

  it('completes a switch crashed after any single mutation', async () => {
    // Establish how many mutations a clean switch needs.
    const probe = switchFixture();
    let mutations = 0;
    const counting = faultyStorage(fakeStorage(probe), Number.MAX_SAFE_INTEGER);
    const countingWrapped = {
      ...counting,
      writeFile: async (...args: [string, string, ArrayBuffer]) => {
        mutations += 1;
        return counting.writeFile(...args);
      },
      writeTextFile: async (...args: [string, string, string]) => {
        mutations += 1;
        return counting.writeTextFile(...args);
      },
      deleteFile: async (...args: [string, string]) => {
        mutations += 1;
        return counting.deleteFile(...args);
      },
    } as unknown as FileStorageAPI;
    await switchTranslation(countingWrapped, WS, {
      fromTag: 'ka',
      toTag: 'en',
      outgoingMeta: { title: 'ქართული' },
      applyMetadata: async () => {},
    });
    expect(mutations).toBeGreaterThan(5);

    for (let crashAfter = 0; crashAfter < mutations; crashAfter++) {
      const files = switchFixture();
      const metadata: Partial<EPUBMetadata> = { language: ['ka', 'en'], title: 'ქართული' };
      const applyMetadata = metadataApplier(metadata);

      await expect(
        switchTranslation(faultyStorage(fakeStorage(files), crashAfter), WS, {
          fromTag: 'ka',
          toTag: 'en',
          outgoingMeta: { title: 'ქართული' },
          applyMetadata,
        })
      ).rejects.toThrow(/simulated crash/);

      const recovered = await recoverPendingSwap(fakeStorage(files), WS, applyMetadata);
      if (recovered === null) {
        // Crashed before the journal was committed: the swap never happened
        // and the active text is untouched.
        expect(files.get('SOURCE/text/ch1.txt')).toBe('georgian ch1');
        expect(files.get('SOURCE/text/nav.txt')).toBe('georgian nav');
      } else {
        expect(recovered.from).toBe('ka');
        expect(recovered.to).toBe('en');
        expectSwitchedToEnglish(files, metadata);
      }
    }
  });

  it('re-applies metadata when the OPF save itself crashed', async () => {
    const files = switchFixture();
    const metadata: Partial<EPUBMetadata> = { language: ['ka', 'en'], title: 'ქართული' };
    let calls = 0;
    await expect(
      switchTranslation(fakeStorage(files), WS, {
        fromTag: 'ka',
        toTag: 'en',
        outgoingMeta: { title: 'ქართული' },
        applyMetadata: async () => {
          calls += 1;
          throw new Error('opf save failed');
        },
      })
    ).rejects.toThrow(/opf save failed/);
    expect(files.has(SWAP_JOURNAL_PATH)).toBe(true);

    await recoverPendingSwap(fakeStorage(files), WS, metadataApplier(metadata));
    expect(calls).toBe(1);
    expectSwitchedToEnglish(files, metadata);
  });
});

describe('removeTranslation', () => {
  it('deletes the stored edition tree', async () => {
    const files = switchFixture();
    await removeTranslation(fakeStorage(files), WS, 'en');
    expect([...files.keys()].filter(p => p.startsWith(`${LOCALE_PREFIX}en/`))).toEqual([]);
    expect(files.get('SOURCE/text/ch1.txt')).toBe('georgian ch1');
  });

  it('rejects unsafe tags', async () => {
    const files = switchFixture();
    await expect(removeTranslation(fakeStorage(files), WS, '../text')).rejects.toThrow(
      /Invalid language tag/
    );
  });
});

describe('localeTextPrefix', () => {
  it('mirrors the documented layout', () => {
    expect(localeTextPrefix('en')).toBe('SOURCE/locale/en/text/');
    expect(localeMetaPath('en')).toBe('SOURCE/locale/en/meta.json');
  });
});
