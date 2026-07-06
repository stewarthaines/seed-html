/**
 * Locale metadata — the single source of truth shared by the runtime
 * (src/lib/i18n/locale-config.ts re-exports it) and the Node build scripts
 * (build-scripts/*.js import it by relative path). Plain JS so both sides can
 * consume it without a compile step; tsconfig's checkJs keeps it type-checked.
 */

/** @type {Record<string, import('./types.js').LocaleConfig>} */
export const LOCALE_CONFIGS = {
  en: {
    code: 'en',
    name: 'English',
    direction: 'ltr',
    englishName: 'English',
  },
  de: {
    code: 'de',
    name: 'Deutsch',
    direction: 'ltr',
    englishName: 'German',
  },
  ka: {
    code: 'ka',
    name: 'ქართული',
    direction: 'ltr',
    englishName: 'Georgian',
  },
  ar: {
    code: 'ar',
    name: 'العربية',
    direction: 'rtl',
    englishName: 'Arabic',
  },
  he: {
    code: 'he',
    name: 'עברית',
    direction: 'rtl',
    englishName: 'Hebrew',
  },
  'zh-Hant': {
    code: 'zh-Hant',
    name: '繁體中文',
    direction: 'ltr',
    englishName: 'Traditional Chinese',
  },
  ja: {
    code: 'ja',
    name: '日本語',
    direction: 'ltr',
    englishName: 'Japanese',
  },
};

export const DEFAULT_LOCALE = 'en';

/**
 * Locales we actually ship to users. The others in LOCALE_CONFIGS are scaffolded
 * (display names, RTL flags, .po files) but NOT yet genuinely translated, so they
 * are kept out of the published catalogs and locale auto-detection — a not-enabled
 * locale must never surface as broken/placeholder UI. Re-enable a code here once
 * it has a real, reviewed translation.
 */
export const ENABLED_LOCALES = ['en', 'de'];

export const RTL_LOCALES = ['ar', 'he'];
