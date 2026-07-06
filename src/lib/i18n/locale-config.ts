/**
 * Locale configuration helpers. The data itself lives in locale-meta.js — the
 * single source shared with the Node build scripts — and is re-exported here.
 */

import type { LocaleConfig } from './types.js';
import { LOCALE_CONFIGS, DEFAULT_LOCALE, ENABLED_LOCALES, RTL_LOCALES } from './locale-meta.js';

export { LOCALE_CONFIGS, DEFAULT_LOCALE, ENABLED_LOCALES, RTL_LOCALES };

/**
 * Whether a locale is shipped/enabled (vs merely known/scaffolded).
 */
export function isLocaleEnabled(locale: string): boolean {
  return ENABLED_LOCALES.includes(locale);
}

/**
 * Get locale configuration
 */
export function getLocaleConfig(locale: string): LocaleConfig | undefined {
  return LOCALE_CONFIGS[locale];
}

/**
 * Check if locale uses RTL text direction
 */
export function isRTL(locale: string): boolean {
  return RTL_LOCALES.includes(locale);
}

/**
 * Get browser's preferred locale from available options
 */
export function getBrowserLocale(): string {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE;
  }

  // Get browser language preferences
  const languages = navigator.languages || [navigator.language];

  for (const lang of languages) {
    // Try exact match first
    if (LOCALE_CONFIGS[lang]) {
      return lang;
    }

    // Try language code only (e.g., 'en' from 'en-US')
    const langCode = lang.split('-')[0];
    if (LOCALE_CONFIGS[langCode]) {
      return langCode;
    }

    // Try region-specific variants (e.g., 'zh-Hant' from 'zh-TW')
    if (langCode === 'zh') {
      // Traditional Chinese for HK, TW, MO
      if (['zh-TW', 'zh-HK', 'zh-MO'].includes(lang)) {
        return 'zh-Hant';
      }
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * The browser's preferred locale for the *UI*, restricted to enabled locales.
 *
 * Distinct from getBrowserLocale(): that one maps the browser language to any known
 * locale (used to seed a new book's dc:language, which should reflect the user's real
 * language). This one only returns a locale we actually ship, so a Japanese/Arabic/…
 * browser falls back to English UI instead of a not-yet-translated catalog.
 */
export function getEnabledBrowserLocale(): string {
  const preferred = getBrowserLocale();
  return isLocaleEnabled(preferred) ? preferred : DEFAULT_LOCALE;
}
