/**
 * Simplified translation loader for Storybook
 * Loads translations directly from static files instead of using the ZIP compression system
 */

import type { TranslationCatalog } from '../src/lib/i18n/types.js';
import { LOCALE_CONFIGS } from '../src/lib/i18n/locale-config.js';

// Translation data will be loaded dynamically at runtime

/**
 * Load all translation catalogs for Storybook asynchronously
 */
export async function loadStorybookTranslations(): Promise<Record<string, TranslationCatalog>> {
  const catalogs: Record<string, TranslationCatalog> = {};

  // Define the locales we want to load
  const locales = ['en', 'de', 'ar', 'he', 'ja', 'ka', 'zh-Hant'];

  for (const locale of locales) {
    try {
      // Dynamically import each translation file
      const translationModule = await import(`../src/lib/i18n/locales/${locale}.json`);
      const translations = translationModule.default || translationModule;

      catalogs[locale] = {
        locale,
        messages: translations as Record<string, string>,
        headers: {},
      };
    } catch (error) {
      console.warn(`Failed to load ${locale} translations for Storybook:`, error);
      // Provide minimal fallback
      catalogs[locale] = {
        locale,
        messages: {},
        headers: {},
      };
    }
  }

  return catalogs;
}

/**
 * Get locale configuration for Storybook toolbar
 */
export function getStorybookLocaleItems() {
  return Object.entries(LOCALE_CONFIGS).map(([code, config]) => ({
    value: code,
    title: config.name,
    right: config.name.includes('العربية')
      ? '🇸🇦'
      : config.name.includes('עברית')
        ? '🇮🇱'
        : config.name.includes('Deutsch')
          ? '🇩🇪'
          : config.name.includes('日本語')
            ? '🇯🇵'
            : config.name.includes('ქართული')
              ? '🇬🇪'
              : config.name.includes('繁體中文')
                ? '🇹🇼'
                : '🇺🇸', // Default to US flag for English
  }));
}
