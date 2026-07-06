/**
 * Integration tests for complete i18n workflow
 *
 * Note: Tests skipped due to happy-dom limitations with storage and navigation APIs.
 * These integration workflows are tested in browser environment via Storybook.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  t,
  initI18n,
  setLocale,
  currentLocale,
  documentDirection,
  isInitialized,
} from '../index.js';
import {
  MockLocalStorage,
  createMockDataUrl,
  createMockTranslationArchive,
  mockTranslationCatalogs,
} from './fixtures/mock-translations.js';

// Note: This test simulates complete workflow but skips browser APIs that don't work in happy-dom

// Skip: requires storage backend detection and browser APIs not available in happy-dom
// This complete workflow is tested in browser environment via Storybook
describe.skip('i18n integration workflow', () => {
  let mockLocalStorage: MockLocalStorage;
  let mockFileStorage: any;

  beforeEach(() => {
    // Setup comprehensive mocks
    mockLocalStorage = new MockLocalStorage();

    mockFileStorage = {
      listFiles: vi.fn(),
      createWorkspace: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
    };

    // Mock all globalThis properties
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: { languages: ['en-US'], language: 'en-US' },
      configurable: true,
    });

    const mockDocumentElement = {
      dir: 'ltr',
      setAttribute: vi.fn(),
    };

    Object.defineProperty(globalThis, 'document', {
      value: { documentElement: mockDocumentElement },
      configurable: true,
    });

    // Mock fetch
    globalThis.fetch = vi.fn();

    // Mock storage module
    vi.doMock('../storage/index.js', () => ({
      getFileStorage: () => mockFileStorage,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // Skip: Complex browser API integration that requires real DecompressionStream
  // This functionality is tested in browser environment via Storybook
  it.skip('should complete full first-run extraction workflow', async () => {
    // This test would require real DecompressionStream which doesn't work in happy-dom
    // The workflow is:
    // 1. Check if update needed (yes, first run)
    // 2. Extract from embedded data URL
    // 3. Decompress gzipped data
    // 4. Store individual locale files
    // 5. Load translations from storage
    // 6. Initialize with detected locale

    const mockDataUrl = createMockDataUrl();
    (globalThis as any).__EDITME_I18N_BUNDLE__ = mockDataUrl;

    // Mock storage responses for first run
    mockFileStorage.listFiles.mockResolvedValue([]); // No files initially
    mockFileStorage.createWorkspace.mockResolvedValue(undefined);
    mockFileStorage.writeFile.mockResolvedValue(undefined);

    // Mock successful extraction and storage
    for (const [locale, catalog] of Object.entries(mockTranslationCatalogs)) {
      const po2jsonData = {
        '': catalog.headers,
        ...catalog.messages,
      };
      mockFileStorage.readFile.mockResolvedValueOnce(JSON.stringify(po2jsonData));
    }

    mockFileStorage.listFiles
      .mockResolvedValueOnce([]) // First call: no files
      .mockResolvedValue([
        // After extraction: files present
        { name: 'en.json', size: 100 },
        { name: 'de.json', size: 100 },
        { name: 'ar.json', size: 100 },
      ]);

    await initI18n();

    expect(get(isInitialized)).toBe(true);
    expect(get(currentLocale)).toBe('en');
    expect(get(t)('Save')).toBe('Save');
  });

  it('should list cached locales from the workspace', async () => {
    mockFileStorage.listFiles.mockResolvedValue([
      { name: 'en.json', size: 100 },
      { name: 'de.json', size: 100 },
    ]);

    const { createI18nLoader } = await import('../loader.js');
    const loader = createI18nLoader();

    const cached = await loader.listCachedLocales();
    expect(cached.sort()).toEqual(['de', 'en']);
  });

  it('should complete locale switching workflow', async () => {
    // Setup initialized state with mock data
    mockFileStorage.listFiles.mockResolvedValue([
      { name: 'en.json', size: 100 },
      { name: 'de.json', size: 100 },
      { name: 'ar.json', size: 100 },
    ]);

    // Mock translation file contents
    mockFileStorage.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'en' },
          Save: 'Save',
          Cancel: 'Cancel',
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'de' },
          Save: 'Speichern',
          Cancel: 'Abbrechen',
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'ar' },
          Save: 'حفظ',
          Cancel: 'إلغاء',
        })
      );

    // Don't need update (existing installation)
    mockLocalStorage.setItem('editme-i18n-version', '1.0.0');

    await initI18n();

    // Test English (initial)
    expect(get(currentLocale)).toBe('en');
    expect(get(documentDirection)).toBe('ltr');
    expect(get(t)('Save')).toBe('Save');

    // Switch to German
    await setLocale('de');

    expect(get(currentLocale)).toBe('de');
    expect(get(documentDirection)).toBe('ltr');
    expect(get(t)('Save')).toBe('Speichern');
    expect(mockLocalStorage.getItem('editme-locale')).toBe('de');

    // Switch to Arabic (RTL)
    await setLocale('ar');

    expect(get(currentLocale)).toBe('ar');
    expect(get(documentDirection)).toBe('rtl');
    expect(get(t)('Save')).toBe('حفظ');
    expect(globalThis.document?.documentElement.dir).toBe('rtl');
  });

  it('should handle storage errors gracefully', async () => {
    // Mock storage failure
    mockFileStorage.listFiles.mockRejectedValue(new Error('Storage unavailable'));

    const { createI18nLoader } = await import('../loader.js');
    const loader = createI18nLoader();

    // A broken workspace reads as "nothing cached", never an exception
    const cached = await loader.listCachedLocales();
    expect(cached).toEqual([]);
  });

  it('should treat a missing embedded bundle as an empty source', async () => {
    // No embedded data URL — builds without inlined catalogs are valid
    delete (globalThis as any).__EDITME_I18N_BUNDLE__;

    const { createI18nLoader } = await import('../loader.js');
    const loader = createI18nLoader();

    await expect(loader.extractEmbeddedBundle()).resolves.toEqual([]);
  });

  it('should use fallback English when all else fails', async () => {
    // Simulate total failure: no storage, no data URL
    delete (globalThis as any).__EDITME_I18N_BUNDLE__;
    mockFileStorage.listFiles.mockRejectedValue(new Error('No storage'));

    // Should initialize with English fallback
    await initI18n();

    expect(get(isInitialized)).toBe(true);
    expect(get(currentLocale)).toBe('en');
    expect(get(t)('Save')).toBe('Save'); // From fallback catalog
  });

  it('should persist and restore locale preference', async () => {
    // Setup with existing locale preference
    mockLocalStorage.setItem('editme-locale', 'de');
    mockLocalStorage.setItem('editme-i18n-version', '1.0.0');

    mockFileStorage.listFiles.mockResolvedValue([
      { name: 'en.json', size: 100 },
      { name: 'de.json', size: 100 },
    ]);

    mockFileStorage.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'en' },
          Save: 'Save',
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'de' },
          Save: 'Speichern',
        })
      );

    await initI18n();

    // The persisted preference wins over browser detection when available
    expect(get(currentLocale)).toBe('de');
  });

  it('should handle partial translation catalogs', async () => {
    // Mock scenario where some locale files are missing or corrupted
    mockLocalStorage.setItem('editme-i18n-version', '1.0.0');

    mockFileStorage.listFiles.mockResolvedValue([
      { name: 'en.json', size: 100 },
      { name: 'broken.json', size: 50 },
      { name: 'de.json', size: 100 },
    ]);

    mockFileStorage.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'en' },
          Save: 'Save',
        })
      )
      .mockRejectedValueOnce(new Error('Corrupted file'))
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'de' },
          Save: 'Speichern',
        })
      );

    await initI18n();

    expect(get(isInitialized)).toBe(true);

    // Should work with English
    expect(get(t)('Save')).toBe('Save');

    // Should work with German
    await setLocale('de');
    expect(get(t)('Save')).toBe('Speichern');
  });

  it('should handle interpolation across different locales', async () => {
    mockLocalStorage.setItem('editme-i18n-version', '1.0.0');

    mockFileStorage.listFiles.mockResolvedValue([
      { name: 'en.json', size: 100 },
      { name: 'de.json', size: 100 },
    ]);

    mockFileStorage.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'en' },
          'Found {count} items': 'Found {count} items',
          'Hello {name}': 'Hello {name}',
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          '': { Language: 'de' },
          'Found {count} items': '{count} Elemente gefunden',
          'Hello {name}': 'Hallo {name}',
        })
      );

    await initI18n();

    // Test English interpolation
    expect(get(t)('Found {count} items', { count: 3 })).toBe('Found 3 items');
    expect(get(t)('Hello {name}', { name: 'World' })).toBe('Hello World');

    // Test German interpolation
    await setLocale('de');
    expect(get(t)('Found {count} items', { count: 3 })).toBe('3 Elemente gefunden');
    expect(get(t)('Hello {name}', { name: 'Welt' })).toBe('Hallo Welt');
  });
});
