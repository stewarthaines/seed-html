/**
 * Locale configuration data
 */

import type { LocaleConfig } from './types.js';

export const LOCALE_CONFIGS: Record<string, LocaleConfig> = {
  en: {
    code: 'en',
    name: 'English',
    direction: 'ltr',
    englishName: 'English'
  },
  de: {
    code: 'de', 
    name: 'Deutsch',
    direction: 'ltr',
    englishName: 'German'
  },
  ka: {
    code: 'ka',
    name: 'ქართული',
    direction: 'ltr',
    englishName: 'Georgian'
  },
  ar: {
    code: 'ar',
    name: 'العربية',
    direction: 'rtl',
    englishName: 'Arabic'
  },
  he: {
    code: 'he',
    name: 'עברית',
    direction: 'rtl',
    englishName: 'Hebrew'
  },
  'zh-Hant': {
    code: 'zh-Hant',
    name: '繁體中文',
    direction: 'ltr',
    englishName: 'Traditional Chinese'
  },
  ja: {
    code: 'ja',
    name: '日本語',
    direction: 'ltr',
    englishName: 'Japanese'
  }
};

export const DEFAULT_LOCALE = 'en';

export const RTL_LOCALES = ['ar', 'he'];

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