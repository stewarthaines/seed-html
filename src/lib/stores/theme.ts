import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

// TypeScript interfaces
export interface ThemeState {
  current: ThemeMode;
  systemPreference: ThemeMode;
  isInitialized: boolean;
}

export interface ThemeStore extends Writable<ThemeState> {
  initialize(): void;
  setTheme(theme: ThemeMode): void;
  toggleTheme(): void;
  useSystemPreference(): void;
}

export type ThemeMode = 'light' | 'dark';

// Storage key for persistence
const STORAGE_KEY = 'editme_theme_preference';

// Default theme state
const DEFAULT_STATE: ThemeState = {
  current: 'light',
  systemPreference: 'light',
  isInitialized: false,
};

// Create the writable store
function createThemeStore(): ThemeStore {
  const { subscribe, set, update } = writable<ThemeState>(DEFAULT_STATE);

  return {
    subscribe,
    set,
    update,

    // Initialize from localStorage and system preference
    initialize(): void {
      let savedTheme: ThemeMode | null = null;
      let systemPreference: ThemeMode = 'light';

      // Detect system preference
      if (typeof window !== 'undefined' && window.matchMedia) {
        systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      // Load saved preference
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && isValidThemeMode(saved)) {
          savedTheme = saved;
        }
      } catch (error) {
        // Ignore localStorage errors and use system preference
        // eslint-disable-next-line no-console
        console.warn('Failed to load theme preference:', error);
      }

      // Use saved theme or fall back to system preference
      const currentTheme = savedTheme || systemPreference;

      update(state => ({
        ...state,
        current: currentTheme,
        systemPreference,
        isInitialized: true,
      }));

      // Apply theme to DOM
      applyThemeToDOM(currentTheme);

      // Listen for system preference changes
      if (typeof window !== 'undefined' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          const newSystemPreference: ThemeMode = e.matches ? 'dark' : 'light';
          update(state => ({
            ...state,
            systemPreference: newSystemPreference,
          }));

          // If no saved preference, follow system
          if (!savedTheme) {
            update(state => ({
              ...state,
              current: newSystemPreference,
            }));
            applyThemeToDOM(newSystemPreference);
          }
        });
      }
    },

    // Set specific theme
    setTheme(theme: ThemeMode): void {
      update(state => {
        try {
          localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save theme preference:', error);
        }

        applyThemeToDOM(theme);

        return {
          ...state,
          current: theme,
        };
      });
    },

    // Toggle between light and dark
    toggleTheme(): void {
      update(state => {
        const newTheme: ThemeMode = state.current === 'light' ? 'dark' : 'light';

        try {
          localStorage.setItem(STORAGE_KEY, newTheme);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save theme preference:', error);
        }

        applyThemeToDOM(newTheme);

        return {
          ...state,
          current: newTheme,
        };
      });
    },

    // Clear saved preference and use system
    useSystemPreference(): void {
      update(state => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to clear theme preference:', error);
        }

        applyThemeToDOM(state.systemPreference);

        return {
          ...state,
          current: state.systemPreference,
        };
      });
    },
  };
}

// Type guard for theme modes
function isValidThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

// Apply theme to DOM by setting data-theme attribute
function applyThemeToDOM(theme: ThemeMode): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export const themeStore = createThemeStore();

// Initialize on first import (browser only)
if (typeof window !== 'undefined') {
  themeStore.initialize();
}