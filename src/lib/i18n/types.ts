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

export interface I18nState {
  /** Currently active locale */
  currentLocale: string;
  /** Available locale configurations */
  locales: Record<string, LocaleConfig>;
  /** Loaded translation catalogs */
  catalogs: Record<string, TranslationCatalog>;
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
  /** Load translations from storage or ZIP */
  loadTranslations(): Promise<Record<string, TranslationCatalog>>;
  /** Check if translations need to be re-extracted */
  needsUpdate(): Promise<boolean>;
  /** Extract translations from ZIP to storage */
  extractTranslations(): Promise<void>;
}
