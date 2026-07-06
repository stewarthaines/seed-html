/**
 * Type definitions for internationalization system
 */

export interface LocaleConfig {
  /** Locale code (e.g., 'en', 'ar', 'zh-Hant') */
  code: string;
  /** Human-readable name in the locale's own language */
  name: string;
  /** Text direction for layout */
  direction: 'ltr' | 'rtl';
  /** English name for reference */
  englishName: string;
}

export interface TranslationCatalog {
  /** Locale code this catalog is for */
  locale: string;
  /** Key-value pairs of translation strings */
  messages: Record<string, string>;
  /** Metadata from .po file */
  headers: Record<string, string>;
}

/**
 * How a locale's catalog can be obtained:
 * - 'loaded' — catalog is in memory, switching is synchronous
 * - 'cached' — catalog is in the locales storage workspace, loaded on demand
 * - 'remote' — catalog is fetchable over http (manifest sidecar), fetched on demand
 */
export type LocaleAvailability = 'loaded' | 'cached' | 'remote';

/** A locale the user can actually switch to, with how its catalog is sourced */
export interface AvailableLocale extends LocaleConfig {
  availability: LocaleAvailability;
}

export interface I18nState {
  /** Currently active locale */
  currentLocale: string;
  /** Available locale configurations */
  locales: Record<string, LocaleConfig>;
  /** Loaded translation catalogs */
  catalogs: Record<string, TranslationCatalog>;
  /** Locales whose catalogs some source can supply (union of all sources) */
  availableLocales: Record<string, AvailableLocale>;
  /** Whether the i18n system is initialized */
  initialized: boolean;
  /** Loading state */
  loading: boolean;
}

export interface TranslationFunction {
  /**
   * Translate a message
   * @param key - Translation key
   * @param params - Interpolation parameters
   * @returns Translated string
   */
  (key: string, params?: Record<string, any>): string;
}

export interface I18nLoader {
  /** Load all storage-cached translation catalogs */
  loadTranslations(): Promise<Record<string, TranslationCatalog>>;
  /**
   * Extract the embedded ZIP bundle (window.__EDITME_I18N_BUNDLE__) into storage,
   * returning the locale codes it contained. A null/absent bundle is not an error —
   * builds without embedded catalogs return [].
   */
  extractEmbeddedBundle(): Promise<string[]>;
  /** Locale codes with a catalog cached in the locales storage workspace */
  listCachedLocales(): Promise<string[]>;
  /** Load a single cached catalog, or null if absent/unreadable */
  loadCatalog(locale: string): Promise<TranslationCatalog | null>;
}
