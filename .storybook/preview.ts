import type { Preview } from '@storybook/svelte-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { loadStorybookTranslations, getStorybookLocaleItems } from './i18n-loader';
import { setLocale, i18nState } from '../src/lib/i18n/index.js';
import { isRTL, LOCALE_CONFIGS, DEFAULT_LOCALE } from '../src/lib/i18n/locale-config.js';
import type { AvailableLocale, TranslationCatalog } from '../src/lib/i18n/types.js';

// Mirror the runtime's availability semantics: every catalog Storybook seeds is
// in memory, so it is switchable ('loaded'). Without this, setLocale refuses
// every locale (availability is the runtime gate since the multi-source i18n
// delivery change).
function availableFromCatalogs(
  catalogs: Record<string, TranslationCatalog>
): Record<string, AvailableLocale> {
  const available: Record<string, AvailableLocale> = {
    [DEFAULT_LOCALE]: { ...LOCALE_CONFIGS[DEFAULT_LOCALE], availability: 'loaded' },
  };
  for (const code of Object.keys(catalogs)) {
    if (LOCALE_CONFIGS[code]) available[code] = { ...LOCALE_CONFIGS[code], availability: 'loaded' };
  }
  return available;
}

// Import the design system CSS
import '../src/styles/index.css';

const preview: Preview = {
  // Global loader to initialize i18n before any story renders
  loaders: [
    async () => {
      try {
        // Load all translation catalogs
        const translations = await loadStorybookTranslations();

        // Set up i18n state with loaded translations
        i18nState.set({
          currentLocale: DEFAULT_LOCALE,
          locales: LOCALE_CONFIGS,
          catalogs: translations,
          availableLocales: availableFromCatalogs(translations),
          initialized: true,
          loading: false,
        });

        console.log(
          '📦 Storybook i18n initialized with',
          Object.keys(translations).length,
          'locales'
        );

        // Return translations for story access if needed
        return { translations };
      } catch (error) {
        console.error('Failed to load Storybook translations:', error);

        // Fallback with minimal translations
        i18nState.set({
          currentLocale: DEFAULT_LOCALE,
          locales: LOCALE_CONFIGS,
          catalogs: { en: { locale: 'en', messages: {}, headers: {} } },
          availableLocales: availableFromCatalogs({}),
          initialized: true,
          loading: false,
        });

        return { translations: {} };
      }
    },
  ],
  // Global types for toolbar controls
  globalTypes: {
    locale: {
      name: 'Locale',
      description: 'Internationalization locale',
      toolbar: {
        icon: 'globe',
        items: getStorybookLocaleItems(),
        showName: true,
        dynamicTitle: true,
      },
    },
  },

  // Initial global values
  initialGlobals: {
    locale: 'en',
  },

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },

    // Set backgrounds to match our theme colors
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f0f0f0' },
        { name: 'dark', value: '#222222' },
      ],
    },
  },

  decorators: [
    // i18n decorator - handles locale switching (translations already loaded by loader)
    (Story, { globals }) => {
      const { locale = 'en' } = globals;

      if (typeof window !== 'undefined') {
        // Set document direction using data attribute for RTL languages
        const direction = isRTL(locale) ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('data-dir', direction);
        document.documentElement.setAttribute('data-locale', locale);

        // Defer locale switching to avoid state mutation during render
        setTimeout(() => {
          try {
            setLocale(locale);
          } catch (error) {
            console.warn('Failed to set locale in Storybook:', error);
          }
        }, 0);
      }

      return Story();
    },

    // Theme decorator. 'light' must be the literal attribute value: an empty
    // string leaves data-theme="" on <html>, which matches neither
    // [data-theme='light'] nor the :root:not([data-theme]) fallback — no theme
    // tokens apply and components render with base fallbacks (visible #ccc
    // borders and the like).
    withThemeByDataAttribute({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
