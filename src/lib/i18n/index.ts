/**
 * Main i18n runtime system
 */

import { writable, derived, get } from 'svelte/store';
import type {
  I18nState,
  TranslationFunction,
  TranslationCatalog,
  AvailableLocale,
} from './types.js';
import { LOCALE_CONFIGS, DEFAULT_LOCALE, getEnabledBrowserLocale, isRTL } from './locale-config.js';
import { createI18nLoader } from './loader.js';

/** localStorage key for the persisted locale preference (load-bearing — do not rename) */
const LOCALE_STORAGE_KEY = 'editme-locale';

// Internal state store
const i18nState = writable<I18nState>({
  currentLocale: DEFAULT_LOCALE,
  locales: LOCALE_CONFIGS,
  catalogs: {},
  availableLocales: {},
  initialized: false,
  loading: false,
});

// Public stores
export const currentLocale = derived(i18nState, $state => $state.currentLocale);
export const isLoading = derived(i18nState, $state => $state.loading);
export const isInitialized = derived(i18nState, $state => $state.initialized);
export const documentDirection = derived(currentLocale, $locale =>
  isRTL($locale) ? 'rtl' : 'ltr'
);
/** Locales the picker can offer — the union of what all catalog sources can supply */
export const availableLocales = derived(i18nState, $state =>
  Object.values($state.availableLocales)
);

// English fallback catalog (bundled for immediate availability)
const englishFallback: TranslationCatalog = {
  locale: 'en',
  messages: {
    Save: 'Save',
    Cancel: 'Cancel',
    Delete: 'Delete',
    Edit: 'Edit',
    File: 'File',
    Settings: 'Settings',
    Workspace: 'Workspace',
    Metadata: 'Metadata',
    Manifest: 'Manifest',
    Navigation: 'Navigation',
    'Spine Items': 'Spine Items',
  },
  headers: {},
};

/**
 * Non-reactive translation function (for non-component usage)
 */
export const translate: TranslationFunction = (key: string, params: Record<string, any> = {}) => {
  const state = get(i18nState);

  // Get translation from current locale catalog
  const catalog = state.catalogs[state.currentLocale];
  let translation = catalog?.messages[key];

  // Fallback to English if not found
  if (!translation && state.currentLocale !== 'en') {
    translation = state.catalogs.en?.messages[key] || englishFallback.messages[key];
  }

  // Ultimate fallback to key itself
  if (!translation) {
    translation = key;
  }

  // Simple parameter interpolation
  if (Object.keys(params).length > 0) {
    for (const [param, value] of Object.entries(params)) {
      translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
    }
  }

  return translation;
};

/**
 * Reactive translation store for Svelte components
 * Usage: {$t('key')} or {$t('key', { param: value })}
 */
export const t = derived(
  i18nState,
  ($state): TranslationFunction =>
    (key: string, params: Record<string, any> = {}) => {
      // Get translation from current locale catalog
      const catalog = $state.catalogs[$state.currentLocale];
      let translation = catalog?.messages[key];

      // Fallback to English if not found
      if (!translation && $state.currentLocale !== 'en') {
        translation = $state.catalogs.en?.messages[key] || englishFallback.messages[key];
      }

      // Ultimate fallback to key itself
      if (!translation) {
        translation = key;
      }

      // Simple parameter interpolation
      if (Object.keys(params).length > 0) {
        for (const [param, value] of Object.entries(params)) {
          translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
        }
      }

      return translation;
    }
);

/**
 * Reflect the active UI locale on the <html> element: the real `lang`/`dir`
 * attributes (read by screen readers, hyphenation, `:lang()`, translation tools)
 * plus the `data-*` hooks the stylesheets key off.
 */
function applyDocumentLocale(locale: string): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  const dir = isRTL(locale) ? 'rtl' : 'ltr';
  el.lang = locale;
  el.dir = dir;
  el.setAttribute('data-dir', dir);
  el.setAttribute('data-locale', locale);
}

/**
 * Compute the availability union: English is always available (msgids are the
 * English content), plus every locale a source supplied a catalog for. A catalog
 * whose code has no LOCALE_CONFIGS entry is skipped — we don't invent display
 * metadata for unknown codes.
 */
function computeAvailableLocales(
  catalogs: Record<string, TranslationCatalog>
): Record<string, AvailableLocale> {
  const available: Record<string, AvailableLocale> = {
    [DEFAULT_LOCALE]: { ...LOCALE_CONFIGS[DEFAULT_LOCALE], availability: 'loaded' },
  };

  for (const locale of Object.keys(catalogs)) {
    const config = LOCALE_CONFIGS[locale];
    if (config && !available[locale]) {
      available[locale] = { ...config, availability: 'loaded' };
    }
  }

  return available;
}

/**
 * Read the persisted locale preference, or null when absent/unreadable
 */
function getPersistedLocale(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

/**
 * Initialize the i18n system
 */
export async function initI18n(): Promise<void> {
  const state = get(i18nState);

  if (state.initialized || state.loading) {
    return;
  }

  i18nState.update(s => ({ ...s, loading: true }));

  try {
    const loader = createI18nLoader();

    // Extract embedded catalogs (if this build carries any) into the workspace,
    // then load everything the workspace holds — whatever source put it there.
    await loader.extractEmbeddedBundle();
    const catalogs = await loader.loadTranslations();

    // Ensure English fallback is available
    if (!catalogs.en) {
      catalogs.en = englishFallback;
    }

    const available = computeAvailableLocales(catalogs);

    // Initial locale: the persisted preference wins when a source can supply it,
    // then the browser preference (already restricted to shipped locales), then
    // English. Availability is the gate — never start on a locale we can't render.
    const persisted = getPersistedLocale();
    const preferred = persisted && available[persisted] ? persisted : getEnabledBrowserLocale();
    const initialLocale = available[preferred] ? preferred : DEFAULT_LOCALE;

    // Reflect the resolved locale on <html> (real lang/dir + data-* hooks).
    applyDocumentLocale(initialLocale);

    i18nState.update(s => ({
      ...s,
      currentLocale: initialLocale,
      catalogs,
      availableLocales: available,
      initialized: true,
      loading: false,
    }));
  } catch (error) {
    console.error('Failed to initialize i18n:', error);

    // Fallback to English only
    applyDocumentLocale(DEFAULT_LOCALE);
    i18nState.update(s => ({
      ...s,
      currentLocale: DEFAULT_LOCALE,
      catalogs: { en: englishFallback },
      availableLocales: computeAvailableLocales({}),
      initialized: true,
      loading: false,
    }));
  }
}

/**
 * Switch to a different locale
 */
export async function setLocale(locale: string): Promise<void> {
  const state = get(i18nState);

  if (!state.initialized) {
    throw new Error('i18n system not initialized');
  }

  if (!LOCALE_CONFIGS[locale]) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  // No source can supply this locale's catalog (scaffolded-only, or not delivered
  // to this deployment): refuse to switch so a stale preference or a programmatic
  // call can't surface placeholder/English-stub UI.
  const availability = state.availableLocales[locale]?.availability;
  if (!availability) {
    console.warn(`Locale ${locale} is not available; ignoring switch.`);
    return;
  }

  // Catalog cached in storage but not in memory yet: load it before switching.
  if (availability === 'cached' && !state.catalogs[locale]) {
    const catalog = await createI18nLoader().loadCatalog(locale);
    if (!catalog) {
      console.warn(`Translation catalog for ${locale} could not be loaded; ignoring switch.`);
      return;
    }
    i18nState.update(s => ({
      ...s,
      catalogs: { ...s.catalogs, [locale]: catalog },
      availableLocales: {
        ...s.availableLocales,
        [locale]: { ...s.availableLocales[locale], availability: 'loaded' },
      },
    }));
  }

  // Reflect the new locale on <html> (real lang/dir + data-* hooks).
  applyDocumentLocale(locale);

  // Store preference — only after a successful switch
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  } catch {
    // Persistence is best-effort; the in-session switch still applies.
  }

  i18nState.update(s => ({ ...s, currentLocale: locale }));
}

/**
 * Get available locales — the union of what all catalog sources can supply
 */
export function getAvailableLocales() {
  const state = get(i18nState);
  return Object.values(state.availableLocales);
}

/**
 * Get current locale configuration
 */
export function getCurrentLocaleConfig() {
  const state = get(i18nState);
  return state.locales[state.currentLocale];
}

/**
 * Reset i18n system for testing (internal use only)
 * @internal
 */
export function _resetI18nForTesting() {
  i18nState.set({
    currentLocale: DEFAULT_LOCALE,
    locales: LOCALE_CONFIGS,
    catalogs: {},
    availableLocales: {},
    initialized: false,
    loading: false,
  });
}

// Export i18nState for Storybook and testing
export { i18nState };

/**
 * Unified i18n service for non-component usage
 * Provides all i18n functionality through a single service object
 */
export const i18nService = {
  translate,
  getCurrentLocale: () => get(currentLocale),
  setLocale,
  getAvailableLocales,
  hasTranslation: (locale: string, key: string) => {
    const state = get(i18nState);
    return !!state.catalogs[locale]?.messages[key];
  },
  isLocaleSupported: (locale: string) => !!LOCALE_CONFIGS[locale],
  isRTL,
  getCatalogs: () => {
    const state = get(i18nState);
    return state.catalogs;
  },
  isInitialized: () => {
    const state = get(i18nState);
    return state.initialized;
  },
  init: initI18n,
};
