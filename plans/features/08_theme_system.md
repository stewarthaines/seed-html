# 08. Theme System

## Overview

Implements light/dark mode theming with browser preference detection, user toggle functionality, and localStorage persistence.

## Requirements

- Light/dark mode toggle
- Browser preference detection
- localStorage persistence
- CSS custom properties for theming

## Dependencies

- None (UI foundation feature)

## Technical Approach

- CSS custom properties for theme variables
- JavaScript theme switching logic
- System preference detection via media queries
- Smooth transitions between themes

## API Design

```typescript
interface ThemeSystem {
  // Theme management
  setTheme(theme: Theme): void;
  getTheme(): Theme;
  toggleTheme(): void;

  // System integration
  detectSystemPreference(): Theme;
  watchSystemPreference(callback: (theme: Theme) => void): () => void;

  // Persistence
  saveThemePreference(theme: Theme): void;
  loadThemePreference(): Theme | null;
}

type Theme = 'light' | 'dark' | 'system';

interface ThemeConfig {
  current: Theme;
  system: Theme;
  followSystem: boolean;
}
```

## CSS Custom Properties

```css
:root {
  /* Light theme (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;

  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-muted: #adb5bd;

  --border-color: #dee2e6;
  --border-focus: #86b7fe;

  --accent-color: #0d6efd;
  --accent-hover: #0b5ed7;

  --success-color: #198754;
  --warning-color: #ffc107;
  --error-color: #dc3545;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

[data-theme='dark'] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #404040;

  --text-primary: #ffffff;
  --text-secondary: #b3b3b3;
  --text-muted: #808080;

  --border-color: #404040;
  --border-focus: #4dabf7;

  --accent-color: #4dabf7;
  --accent-hover: #339af0;

  --success-color: #51cf66;
  --warning-color: #ffd43b;
  --error-color: #ff6b6b;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

## Theme Toggle Component

```svelte
<script>
  import { themeStore } from '$lib/stores/theme';

  const toggleTheme = () => {
    themeStore.toggle();
  };
</script>

<button class="theme-toggle" on:click={toggleTheme} title="Toggle theme">
  {#if $themeStore.current === 'light'}
    <Icon name="moon" />
  {:else}
    <Icon name="sun" />
  {/if}
</button>
```

## System Preference Detection

```typescript
const detectSystemPreference = (): Theme => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const watchSystemPreference = (callback: (theme: Theme) => void) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', handler);

  return () => mediaQuery.removeEventListener('change', handler);
};
```

## Theme Application

```typescript
const applyTheme = (theme: Theme, systemTheme?: Theme) => {
  const effectiveTheme = theme === 'system' ? systemTheme || detectSystemPreference() : theme;

  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.documentElement.style.colorScheme = effectiveTheme;

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-primary')
      .trim();
    metaThemeColor.setAttribute('content', bgColor);
  }
};
```

## Smooth Transitions

```css
* {
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease;
}

/* Disable transitions during theme switch to avoid flicker */
.theme-transitioning * {
  transition: none !important;
}
```

## LocalStorage Persistence

```typescript
const STORAGE_KEY = 'editme-theme';

const saveThemePreference = (theme: Theme) => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to save theme preference:', error);
  }
};

const loadThemePreference = (): Theme | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as Theme) || null;
  } catch (error) {
    console.warn('Failed to load theme preference:', error);
    return null;
  }
};
```

## Theme Store (Svelte)

```typescript
import { writable } from 'svelte/store';

interface ThemeState {
  current: Theme;
  system: Theme;
  followSystem: boolean;
}

const createThemeStore = () => {
  const { subscribe, set, update } = writable<ThemeState>({
    current: 'system',
    system: 'light',
    followSystem: true,
  });

  return {
    subscribe,
    setTheme: (theme: Theme) => update(state => ({ ...state, current: theme })),
    toggle: () =>
      update(state => ({
        ...state,
        current: state.current === 'light' ? 'dark' : 'light',
        followSystem: false,
      })),
    followSystem: () => update(state => ({ ...state, current: 'system', followSystem: true })),
  };
};

export const themeStore = createThemeStore();
```

## Accessibility Considerations

- Respect user's motion preferences
- Provide sufficient color contrast in both themes
- Test with screen readers
- Consider users with color vision deficiencies

## Error Handling

- LocalStorage access failures
- Invalid theme values
- Media query support detection
- CSS custom property fallbacks

## Testing Considerations

- Test theme switching functionality
- Test system preference detection
- Test persistence across sessions
- Test accessibility in both themes
- Verify CSS custom property support
- Test on different browsers and devices

## Implementation Notes

- Implement CSS variables first
- Add system preference detection early
- Test theme switching thoroughly
- Consider additional theme options (high contrast, etc.)
- Ensure theme applies before content loads to avoid flicker
