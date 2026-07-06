/**
 * Unit tests for i18n runtime system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  t,
  initI18n,
  setLocale,
  currentLocale,
  documentDirection,
  isLoading,
  isInitialized,
  getAvailableLocales,
  getCurrentLocaleConfig,
  _resetI18nForTesting,
  _awaitRemoteRefreshForTesting,
} from '../index.js';
import { MockLocalStorage, mockTranslationCatalogs } from './fixtures/mock-translations.js';

// Mock the loader
const mockLoader = {
  extractEmbeddedBundle: vi.fn(),
  listCachedLocales: vi.fn(),
  loadCatalog: vi.fn(),
  loadTranslations: vi.fn(),
  cacheCatalog: vi.fn(),
  removeCatalog: vi.fn(),
  getCachedManifest: vi.fn(),
  saveManifest: vi.fn(),
};

vi.mock('../loader.js', () => ({
  createI18nLoader: () => mockLoader,
}));

// Mock the http catalog source (default: unavailable, like file://)
const mockHttpSource = {
  isHttpSourceAvailable: vi.fn(),
  fetchLocalesManifest: vi.fn(),
  fetchCatalogFile: vi.fn(),
};

vi.mock('../http-catalog-source.js', () => ({
  isHttpSourceAvailable: (...args: unknown[]) => mockHttpSource.isHttpSourceAvailable(...args),
  fetchLocalesManifest: (...args: unknown[]) => mockHttpSource.fetchLocalesManifest(...args),
  fetchCatalogFile: (...args: unknown[]) => mockHttpSource.fetchCatalogFile(...args),
}));

// Mock navigator for browser locale detection
const mockNavigator = {
  languages: ['en-US', 'en'],
  language: 'en-US',
};

describe('i18n runtime system', () => {
  let mockLocalStorage: MockLocalStorage;
  let originalNavigator: any;
  let originalDocument: any;

  beforeEach(() => {
    // Setup mocks
    mockLocalStorage = new MockLocalStorage();
    originalNavigator = globalThis.navigator;
    originalDocument = globalThis.document;

    // Reset mock navigator to default English
    mockNavigator.languages = ['en-US', 'en'];
    mockNavigator.language = 'en-US';

    // Mock globalThis properties
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true,
    });

    // Mock document
    const mockDocumentElement = {
      dir: 'ltr',
      setAttribute: vi.fn(),
    };

    Object.defineProperty(globalThis, 'document', {
      value: {
        documentElement: mockDocumentElement,
      },
      writable: true,
      configurable: true,
    });

    // Reset i18n system state
    _resetI18nForTesting();

    // Reset loader mocks
    mockLoader.extractEmbeddedBundle.mockReset();
    mockLoader.listCachedLocales.mockReset();
    mockLoader.loadCatalog.mockReset();
    mockLoader.loadTranslations.mockReset();
    mockLoader.cacheCatalog.mockReset();
    mockLoader.removeCatalog.mockReset();
    mockLoader.getCachedManifest.mockReset();
    mockLoader.saveManifest.mockReset();
    mockLoader.extractEmbeddedBundle.mockResolvedValue([]);
    mockLoader.listCachedLocales.mockResolvedValue([]);
    mockLoader.loadCatalog.mockResolvedValue(null);
    mockLoader.cacheCatalog.mockResolvedValue(undefined);
    mockLoader.removeCatalog.mockResolvedValue(undefined);
    mockLoader.getCachedManifest.mockResolvedValue(null);
    mockLoader.saveManifest.mockResolvedValue(undefined);

    // Reset http source mocks (default: unavailable, like file://)
    mockHttpSource.isHttpSourceAvailable.mockReset();
    mockHttpSource.fetchLocalesManifest.mockReset();
    mockHttpSource.fetchCatalogFile.mockReset();
    mockHttpSource.isHttpSourceAvailable.mockReturnValue(false);
    mockHttpSource.fetchLocalesManifest.mockResolvedValue(null);
    mockHttpSource.fetchCatalogFile.mockResolvedValue(null);
  });

  afterEach(() => {
    // Restore originals
    if (originalNavigator !== undefined) {
      globalThis.navigator = originalNavigator;
    } else {
      delete (globalThis as any).navigator;
    }

    if (originalDocument !== undefined) {
      globalThis.document = originalDocument;
    } else {
      delete (globalThis as any).document;
    }

    vi.restoreAllMocks();
  });

  describe('translation function t()', () => {
    beforeEach(async () => {
      // Setup with mock catalogs
      _resetI18nForTesting();
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);
      await initI18n();
    });

    it('should translate basic strings', () => {
      expect(get(t)('Save')).toBe('Save');
      expect(get(t)('Cancel')).toBe('Cancel');
      expect(get(t)('Delete')).toBe('Delete');
    });

    it('should handle missing translations with fallback', () => {
      expect(get(t)('Nonexistent key')).toBe('Nonexistent key');
    });

    it('should interpolate parameters', () => {
      expect(get(t)('Found {count} items', { count: 5 })).toBe('Found 5 items');
      expect(get(t)('Found {count} items', { count: 0 })).toBe('Found 0 items');
    });

    it('should handle multiple parameters', () => {
      const result = get(t)('Hello {name}, you have {count} messages', {
        name: 'John',
        count: 3,
      });
      expect(result).toBe('Hello John, you have 3 messages');
    });

    it('should translate to German when locale is set', async () => {
      await setLocale('de');

      expect(get(t)('Save')).toBe('Speichern');
      expect(get(t)('Cancel')).toBe('Abbrechen');
      expect(get(t)('Delete')).toBe('Löschen');
    });

    it('should fall back to English for missing German translations', async () => {
      await setLocale('de');

      // This key doesn't exist in German catalog
      expect(get(t)('Nonexistent key')).toBe('Nonexistent key');
    });

    it('should translate to Arabic when its catalog is available', async () => {
      // Availability is delivery-gated: a catalog a source supplied (here the mock
      // storage) is switchable even if not in the build's ENABLED_LOCALES.
      await setLocale('ar');

      expect(get(currentLocale)).toBe('ar');
      expect(get(t)('Save')).toBe('حفظ');
    });

    it('should ignore a switch to a locale no source can supply and stay on English', async () => {
      // Japanese is scaffolded but no catalog was delivered, so setLocale must
      // refuse it rather than surface a placeholder/English-stub UI.
      await setLocale('ja');

      expect(get(currentLocale)).toBe('en');
      expect(get(t)('Save')).toBe('Save');
    });
  });

  describe('initI18n()', () => {
    it('should initialize successfully with mock catalogs', async () => {
      expect(get(isInitialized)).toBe(false);
      expect(get(isLoading)).toBe(false);

      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(isInitialized)).toBe(true);
      expect(get(isLoading)).toBe(false);
      expect(get(currentLocale)).toBe('en');
    });

    it('should extract the embedded bundle before loading catalogs', async () => {
      mockLoader.extractEmbeddedBundle.mockResolvedValue(['en', 'de']);
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(mockLoader.extractEmbeddedBundle).toHaveBeenCalled();
      expect(get(isInitialized)).toBe(true);
    });

    it('should sweep orphaned cached catalogs on file://', async () => {
      // 'ka' was written by an earlier app revision; this build's bundle only
      // delivers 'de', so 'ka' has no active source and must not surface.
      mockLoader.extractEmbeddedBundle.mockResolvedValue(['de']);
      mockLoader.listCachedLocales.mockResolvedValue(['de', 'ka']);
      mockLoader.loadTranslations.mockResolvedValue({
        de: mockTranslationCatalogs.de,
      });

      await initI18n();

      expect(mockLoader.removeCatalog).toHaveBeenCalledWith('ka');
      expect(mockLoader.removeCatalog).not.toHaveBeenCalledWith('de');
      expect(
        getAvailableLocales()
          .map(l => l.code)
          .sort()
      ).toEqual(['de', 'en']);
    });

    it('should not initialize twice', async () => {
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();
      await initI18n(); // Second call

      expect(mockLoader.loadTranslations).toHaveBeenCalledTimes(1);
    });

    it('should fall back to English on error', async () => {
      mockLoader.extractEmbeddedBundle.mockRejectedValue(new Error('Load failed'));

      await initI18n();

      expect(get(isInitialized)).toBe(true);
      expect(get(currentLocale)).toBe('en');
      expect(get(t)('Save')).toBe('Save'); // Fallback English
    });

    it('should restore the persisted locale preference', async () => {
      mockLocalStorage.setItem('editme-locale', 'de');
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('de');
      expect(get(t)('Save')).toBe('Speichern');
    });

    it('should restore a persisted non-enabled locale when its catalog is available', async () => {
      // Explicit user choice: ar was picked before (its catalog was delivered),
      // so the preference is honored even though ar is not in ENABLED_LOCALES.
      mockLocalStorage.setItem('editme-locale', 'ar');
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('ar');
      expect(get(documentDirection)).toBe('rtl');
    });

    it('should ignore a persisted locale no source can supply', async () => {
      mockLocalStorage.setItem('editme-locale', 'ja');
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('en');
    });

    it('should ignore a non-enabled browser locale (Arabic) and use English/LTR', async () => {
      // Auto-detection stays restricted to shipped-quality locales even when the
      // catalog happens to be available — only an explicit user choice enables it.
      mockNavigator.languages = ['ar-SA', 'ar'];
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('en');
      expect(globalThis.document?.documentElement.lang).toBe('en');
      expect(globalThis.document?.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-dir',
        'ltr'
      );
      expect(globalThis.document?.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-locale',
        'en'
      );
    });

    it('should set document direction for LTR locale', async () => {
      mockNavigator.languages = ['de-DE', 'de'];
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(globalThis.document?.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-dir',
        'ltr'
      );
      expect(globalThis.document?.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-locale',
        'de'
      );
    });
  });

  describe('setLocale()', () => {
    beforeEach(async () => {
      _resetI18nForTesting();
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);
      await initI18n();
    });

    it('should switch locale successfully', async () => {
      expect(get(currentLocale)).toBe('en');

      await setLocale('de');

      expect(get(currentLocale)).toBe('de');
      expect(get(t)('Save')).toBe('Speichern');
      // The real <html lang>/dir track the active UI locale, not just data-*.
      expect(globalThis.document?.documentElement.lang).toBe('de');
      expect(globalThis.document?.documentElement.dir).toBe('ltr');
    });

    it('should switch to an available RTL locale and flip direction', async () => {
      await setLocale('ar'); // catalog available in the mock storage

      expect(get(currentLocale)).toBe('ar');
      expect(get(documentDirection)).toBe('rtl');
      expect(globalThis.document?.documentElement.dir).toBe('rtl');
    });

    it('should refuse to switch to an unavailable locale and stay LTR', async () => {
      await setLocale('he'); // RTL but no catalog delivered

      expect(get(currentLocale)).toBe('en');
      expect(get(documentDirection)).toBe('ltr');
    });

    it('should store locale preference', async () => {
      await setLocale('de');

      expect(mockLocalStorage.getItem('editme-locale')).toBe('de');
    });

    it('should throw error for unsupported locale', async () => {
      await expect(setLocale('invalid')).rejects.toThrow('Unsupported locale: invalid');
    });

    it('should throw error when not initialized', async () => {
      // Reset to uninitialized state
      _resetI18nForTesting();
      mockLoader.loadTranslations.mockResolvedValue({});

      await expect(setLocale('de')).rejects.toThrow('i18n system not initialized');
    });

    it('should warn and no-op when switching to an unavailable locale', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* silence */
      });

      await setLocale('ja'); // known but no source supplies a catalog

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('is not available'));
      expect(get(currentLocale)).toBe('en');

      consoleSpy.mockRestore();
    });

    it('should not persist the preference when the switch is refused', async () => {
      await setLocale('de');
      expect(mockLocalStorage.getItem('editme-locale')).toBe('de');

      await setLocale('ja'); // refused — unavailable

      expect(mockLocalStorage.getItem('editme-locale')).toBe('de');
      expect(get(currentLocale)).toBe('de');
    });
  });

  describe('reactive stores', () => {
    beforeEach(async () => {
      _resetI18nForTesting();
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);
      await initI18n();
    });

    it('should update currentLocale store', async () => {
      expect(get(currentLocale)).toBe('en');

      await setLocale('de');

      expect(get(currentLocale)).toBe('de');
    });

    it('should keep documentDirection LTR when an unavailable RTL locale is attempted', async () => {
      expect(get(documentDirection)).toBe('ltr');

      await setLocale('he'); // RTL but no catalog delivered — refused

      expect(get(documentDirection)).toBe('ltr');
    });

    it('should keep documentDirection LTR across enabled locales', async () => {
      await setLocale('de');

      expect(get(documentDirection)).toBe('ltr');
    });
  });

  describe('utility functions', () => {
    beforeEach(async () => {
      _resetI18nForTesting();
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);
      await initI18n();
    });

    it('should return the union of locales the sources can supply', () => {
      const locales = getAvailableLocales();
      const codes = locales.map(l => l.code).sort();

      // en always, plus every delivered catalog (the mock storage holds de and ar).
      expect(codes).toEqual(['ar', 'de', 'en']);
      // Scaffolded locales with no delivered catalog must not appear in the picker.
      expect(codes).not.toContain('ja');
      expect(codes).not.toContain('he');
    });

    it('should return current locale config', () => {
      const config = getCurrentLocaleConfig();

      expect(config).toEqual({
        code: 'en',
        name: 'English',
        direction: 'ltr',
        englishName: 'English',
      });
    });

    it('should return current locale config after switching', async () => {
      await setLocale('de');

      const config = getCurrentLocaleConfig();

      expect(config).toEqual({
        code: 'de',
        name: 'Deutsch',
        direction: 'ltr',
        englishName: 'German',
      });
    });
  });

  describe('browser locale detection', () => {
    it('should detect exact locale match', async () => {
      mockNavigator.languages = ['de-DE', 'en-US'];
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('de');
    });

    it('should detect language code match', async () => {
      mockNavigator.languages = ['de-AT', 'en-US']; // Austrian German
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('de');
    });

    it('should fall back to English for unsupported language', async () => {
      mockNavigator.languages = ['fr-FR', 'es-ES']; // Unsupported languages
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('en');
    });

    it('should fall back to English for a non-enabled browser locale (zh-TW)', async () => {
      // zh-Hant is scaffolded but not enabled, so a Taiwan browser stays on English.
      mockNavigator.languages = ['zh-TW'];
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('en');
    });

    it('should fall back to English for a non-enabled browser locale (Japanese)', async () => {
      mockNavigator.languages = ['ja-JP', 'ja'];
      mockLoader.loadTranslations.mockResolvedValue(mockTranslationCatalogs);

      await initI18n();

      expect(get(currentLocale)).toBe('en');
    });
  });

  describe('http on-demand locales', () => {
    const deManifest = {
      version: '1.0.0',
      locales: [
        {
          code: 'de',
          name: 'Deutsch',
          englishName: 'German',
          direction: 'ltr' as const,
          file: 'de.json',
          bytes: 100,
          hash: 'sha256-abc',
        },
      ],
    };
    const deCatalogJson = JSON.stringify({
      '': { Language: 'de' },
      Save: 'Speichern',
    });
    const deCatalog = {
      locale: 'de',
      messages: { Save: 'Speichern' },
      headers: { Language: 'de' },
    };

    beforeEach(() => {
      mockHttpSource.isHttpSourceAvailable.mockReturnValue(true);
    });

    it('should merge remote locales into availability after init', async () => {
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockLoader.loadTranslations.mockResolvedValue({});

      await initI18n();
      await _awaitRemoteRefreshForTesting();

      const de = getAvailableLocales().find(l => l.code === 'de');
      expect(de).toMatchObject({ code: 'de', availability: 'remote' });
      expect(mockLoader.saveManifest).toHaveBeenCalledWith(deManifest);
    });

    it('should fetch, cache and switch on setLocale of a remote locale', async () => {
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockHttpSource.fetchCatalogFile.mockResolvedValue(deCatalogJson);
      mockLoader.loadTranslations.mockResolvedValue({});
      mockLoader.loadCatalog.mockResolvedValue(deCatalog);

      await initI18n();
      await _awaitRemoteRefreshForTesting();
      await setLocale('de');

      expect(get(currentLocale)).toBe('de');
      expect(get(t)('Save')).toBe('Speichern');
      expect(mockLoader.cacheCatalog).toHaveBeenCalledWith('de', deCatalogJson);
      // Next switch needs no refetch
      expect(getAvailableLocales().find(l => l.code === 'de')?.availability).toBe('loaded');
    });

    it('should stay on the current locale when the remote fetch fails', async () => {
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockHttpSource.fetchCatalogFile.mockResolvedValue(null);
      mockLoader.loadTranslations.mockResolvedValue({});

      await initI18n();
      await _awaitRemoteRefreshForTesting();
      await setLocale('de');

      expect(get(currentLocale)).toBe('en');
      expect(mockLocalStorage.getItem('editme-locale')).toBeNull();
    });

    it('should resolve a persisted remote-only locale after the manifest lands', async () => {
      // Very first hosted load with a persisted 'de': init starts on English,
      // the background refresh then fetches and applies the preference.
      mockLocalStorage.setItem('editme-locale', 'de');
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockHttpSource.fetchCatalogFile.mockResolvedValue(deCatalogJson);
      mockLoader.loadTranslations.mockResolvedValue({});
      mockLoader.loadCatalog.mockResolvedValue(deCatalog);

      await initI18n();
      expect(get(currentLocale)).toBe('en'); // first paint doesn't block on the network

      await _awaitRemoteRefreshForTesting();
      expect(get(currentLocale)).toBe('de');
      expect(get(t)('Save')).toBe('Speichern');
    });

    it('should drop a stale cached catalog when the manifest hash changes', async () => {
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockLoader.loadTranslations.mockResolvedValue({ de: deCatalog });
      mockLoader.getCachedManifest.mockResolvedValue({
        version: '0.9.0',
        locales: [{ ...deManifest.locales[0], hash: 'sha256-OLD' }],
      });

      await initI18n();
      await _awaitRemoteRefreshForTesting();

      expect(mockLoader.removeCatalog).toHaveBeenCalledWith('de');
      expect(getAvailableLocales().find(l => l.code === 'de')?.availability).toBe('remote');
    });

    it('should keep a fresh cached catalog loaded when the hash is unchanged', async () => {
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockLoader.loadTranslations.mockResolvedValue({ de: deCatalog });
      mockLoader.getCachedManifest.mockResolvedValue(deManifest);

      await initI18n();
      await _awaitRemoteRefreshForTesting();

      expect(mockLoader.removeCatalog).not.toHaveBeenCalled();
      expect(getAvailableLocales().find(l => l.code === 'de')?.availability).toBe('loaded');
    });

    it('should offer a manifest-only locale with manifest metadata and switch to it', async () => {
      // 'fr' has no LOCALE_CONFIGS entry — the manifest is its metadata channel.
      const frManifest = {
        version: '1.0.0',
        locales: [
          {
            code: 'fr',
            name: 'Français',
            englishName: 'French',
            direction: 'ltr' as const,
            file: 'fr.json',
            hash: 'sha256-fr',
          },
        ],
      };
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(frManifest);
      mockHttpSource.fetchCatalogFile.mockResolvedValue(
        JSON.stringify({ '': { Language: 'fr' }, Save: 'Enregistrer' })
      );
      mockLoader.loadTranslations.mockResolvedValue({});
      mockLoader.loadCatalog.mockResolvedValue({
        locale: 'fr',
        messages: { Save: 'Enregistrer' },
        headers: { Language: 'fr' },
      });

      await initI18n();
      await _awaitRemoteRefreshForTesting();

      const fr = getAvailableLocales().find(l => l.code === 'fr');
      expect(fr).toMatchObject({ code: 'fr', name: 'Français', availability: 'remote' });

      await setLocale('fr');
      expect(get(currentLocale)).toBe('fr');
      expect(get(t)('Save')).toBe('Enregistrer');
    });

    it('should behave like file:// when the sidecar is missing', async () => {
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(null);
      mockLoader.loadTranslations.mockResolvedValue({});

      await initI18n();
      await _awaitRemoteRefreshForTesting();

      expect(getAvailableLocales().map(l => l.code)).toEqual(['en']);
      expect(mockLoader.saveManifest).not.toHaveBeenCalled();
    });

    const kaCatalog = {
      locale: 'ka',
      messages: { Save: 'შენახვა' },
      headers: { Language: 'ka' },
    };

    it('should sweep orphaned cached catalogs once the manifest lands', async () => {
      // 'ka' is cached from an earlier revision but neither the manifest nor the
      // embedded bundle delivers it — remove it from storage AND the session.
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockLoader.listCachedLocales.mockResolvedValue(['de', 'ka']);
      mockLoader.loadTranslations.mockResolvedValue({ de: deCatalog, ka: kaCatalog });
      mockLoader.getCachedManifest.mockResolvedValue(deManifest); // de hash fresh

      await initI18n();
      expect(getAvailableLocales().some(l => l.code === 'ka')).toBe(true); // pre-sweep

      await _awaitRemoteRefreshForTesting();

      expect(mockLoader.removeCatalog).toHaveBeenCalledWith('ka');
      expect(mockLoader.removeCatalog).not.toHaveBeenCalledWith('de');
      expect(
        getAvailableLocales()
          .map(l => l.code)
          .sort()
      ).toEqual(['de', 'en']);
    });

    it('should not sweep when offline (manifest unavailable)', async () => {
      // A hosted PWA offline can't know what's fetchable — the cache must survive.
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(null);
      mockLoader.listCachedLocales.mockResolvedValue(['ka']);
      mockLoader.loadTranslations.mockResolvedValue({ ka: kaCatalog });

      await initI18n();
      await _awaitRemoteRefreshForTesting();

      expect(mockLoader.removeCatalog).not.toHaveBeenCalled();
      expect(getAvailableLocales().some(l => l.code === 'ka')).toBe(true);
    });

    it('should keep the active locale working in-session when its cache is swept', async () => {
      // The user is ON the orphaned locale: storage is cleared (next startup
      // falls back) but the running session keeps its catalog and picker entry.
      mockLocalStorage.setItem('editme-locale', 'ka');
      mockHttpSource.fetchLocalesManifest.mockResolvedValue(deManifest);
      mockLoader.listCachedLocales.mockResolvedValue(['ka']);
      mockLoader.loadTranslations.mockResolvedValue({ ka: kaCatalog });

      await initI18n();
      expect(get(currentLocale)).toBe('ka');

      await _awaitRemoteRefreshForTesting();

      expect(mockLoader.removeCatalog).toHaveBeenCalledWith('ka');
      expect(get(currentLocale)).toBe('ka');
      expect(get(t)('Save')).toBe('შენახვა');
      expect(getAvailableLocales().some(l => l.code === 'ka')).toBe(true);
    });
  });
});
