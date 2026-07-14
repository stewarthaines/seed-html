/**
 * Unit tests for the navigation store — the reference implementation of the
 * state-persistence pattern (localStorage keys, restore-on-init, self-healing
 * on corrupt state).
 *
 * The store is a module-level singleton that initializes on import, so every
 * test gets a fresh instance via vi.resetModules() + dynamic import, seeding
 * localStorage BEFORE the import when testing restoration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { NavigationStore, ViewType } from './types';

const layoutMock = vi.hoisted(() => ({
  setSidebarSection: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}));

vi.mock('../stores/layout', () => ({ layoutStore: layoutMock }));

const KEYS = {
  CURRENT_VIEW: 'seedhtml_nav_current_view',
  VIEW_HISTORY: 'seedhtml_nav_view_history',
  VIEW_DATA: 'seedhtml_nav_view_data',
} as const;

/** Fresh singleton; initialize() runs on import and reads localStorage. */
async function freshStore(): Promise<NavigationStore> {
  vi.resetModules();
  const mod = await import('./navigation-store');
  return mod.navigationStore;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('initialize', () => {
  it('defaults to the about view with empty storage', async () => {
    const store = await freshStore();
    const state = get(store);

    expect(state.currentView).toBe('about');
    expect(state.viewHistory).toEqual(['about']);
    expect(state.previousView).toBeNull();
    expect(state.canNavigateBack).toBe(false);
    expect(state.canNavigateForward).toBe(false);
    expect(state.isTransitioning).toBe(false);
  });

  it('restores view, history, and view data from localStorage', async () => {
    localStorage.setItem(KEYS.CURRENT_VIEW, 'metadata');
    localStorage.setItem(KEYS.VIEW_HISTORY, JSON.stringify(['about', 'metadata']));
    localStorage.setItem(KEYS.VIEW_DATA, JSON.stringify({ metadata: { tab: 'advanced' } }));

    const store = await freshStore();
    const state = get(store);

    expect(state.currentView).toBe('metadata');
    expect(state.viewHistory).toEqual(['about', 'metadata']);
    expect(state.previousView).toBe('about');
    expect(state.canNavigateBack).toBe(true);
    expect(store.getViewData('metadata')).toEqual({ tab: 'advanced' });
  });

  it('falls back to defaults when the saved view is not a valid view type', async () => {
    localStorage.setItem(KEYS.CURRENT_VIEW, 'not-a-view');

    const store = await freshStore();

    expect(get(store).currentView).toBe('about');
  });

  it('rejects a saved history containing invalid view types', async () => {
    localStorage.setItem(KEYS.VIEW_HISTORY, JSON.stringify(['about', 'bogus']));

    const store = await freshStore();

    expect(get(store).viewHistory).toEqual(['about']);
  });

  it('survives corrupt JSON in storage and uses defaults', async () => {
    localStorage.setItem(KEYS.VIEW_HISTORY, '{not json');
    localStorage.setItem(KEYS.VIEW_DATA, '{not json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const store = await freshStore();
    const state = get(store);

    expect(state.viewHistory).toEqual(['about']);
    expect(state.viewData).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('syncs the restored view to the layout store', async () => {
    localStorage.setItem(KEYS.CURRENT_VIEW, 'spine');

    await freshStore();

    expect(layoutMock.setSidebarSection).toHaveBeenCalledWith('spine');
  });
});

describe('navigateTo', () => {
  it('updates the view, pushes history, and persists both keys', async () => {
    const store = await freshStore();

    const ok = await store.navigateTo('workspace');
    const state = get(store);

    expect(ok).toBe(true);
    expect(state.currentView).toBe('workspace');
    expect(state.previousView).toBe('about');
    expect(state.viewHistory).toEqual(['about', 'workspace']);
    expect(state.canNavigateBack).toBe(true);
    expect(state.isTransitioning).toBe(false);
    expect(localStorage.getItem(KEYS.CURRENT_VIEW)).toBe('workspace');
    expect(JSON.parse(localStorage.getItem(KEYS.VIEW_HISTORY)!)).toEqual(['about', 'workspace']);
  });

  it('rejects an invalid view type without touching state', async () => {
    const store = await freshStore();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ok = await store.navigateTo('nonsense' as ViewType);

    expect(ok).toBe(false);
    expect(get(store).currentView).toBe('about');
    error.mockRestore();
  });

  it('is a no-op returning true when already on the target view', async () => {
    const store = await freshStore();

    const ok = await store.navigateTo('about');

    expect(ok).toBe(true);
    expect(get(store).viewHistory).toEqual(['about']);
  });

  it('replaces the last history entry with replaceHistory', async () => {
    const store = await freshStore();
    await store.navigateTo('workspace');

    await store.navigateTo('settings', { replaceHistory: true });

    expect(get(store).viewHistory).toEqual(['about', 'settings']);
  });

  it('stores viewData passed with the navigation', async () => {
    const store = await freshStore();

    await store.navigateTo('manifest', { viewData: { filter: 'images' } });

    expect(store.getViewData('manifest')).toEqual({ filter: 'images' });
  });

  it('caps history at 20 entries', async () => {
    const store = await freshStore();
    const views: ViewType[] = ['workspace', 'metadata'];
    for (let i = 0; i < 25; i++) {
      await store.navigateTo(views[i % 2]);
    }

    const state = get(store);
    expect(state.viewHistory.length).toBeLessThanOrEqual(20);
    expect(state.currentView).toBe(views[24 % 2]);
  });

  it('syncs the new view to the layout store', async () => {
    const store = await freshStore();
    layoutMock.setSidebarSection.mockClear();

    await store.navigateTo('publish');

    expect(layoutMock.setSidebarSection).toHaveBeenCalledWith('publish');
  });

  it('dispatches clear-spine-selection when leaving the spine view', async () => {
    const store = await freshStore();
    await store.navigateTo('spine');
    const listener = vi.fn();
    window.addEventListener('clear-spine-selection', listener);

    await store.navigateTo('about');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('clear-spine-selection', listener);
  });

  it('still navigates when localStorage writes fail', async () => {
    const store = await freshStore();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const ok = await store.navigateTo('workspace');

    expect(ok).toBe(true);
    expect(get(store).currentView).toBe('workspace');
    expect(warn).toHaveBeenCalled();
    setItem.mockRestore();
    warn.mockRestore();
  });
});

describe('history navigation', () => {
  it('goBack returns to the previous view and enables goForward', async () => {
    const store = await freshStore();
    await store.navigateTo('workspace');
    await store.navigateTo('metadata');

    const ok = await store.goBack();
    const state = get(store);

    expect(ok).toBe(true);
    expect(state.currentView).toBe('workspace');
    expect(state.canNavigateForward).toBe(true);
    expect(state.canNavigateBack).toBe(true);
  });

  it('goForward re-enters the view left by goBack', async () => {
    const store = await freshStore();
    await store.navigateTo('workspace');
    await store.goBack();

    const ok = await store.goForward();

    expect(ok).toBe(true);
    expect(get(store).currentView).toBe('workspace');
    expect(get(store).canNavigateForward).toBe(false);
  });

  it('goBack at the start of history returns false', async () => {
    const store = await freshStore();

    expect(await store.goBack()).toBe(false);
    expect(get(store).currentView).toBe('about');
  });

  it('goForward with no forward history returns false', async () => {
    const store = await freshStore();
    await store.navigateTo('workspace');

    expect(await store.goForward()).toBe(false);
  });

  it('navigating after goBack truncates the forward history', async () => {
    const store = await freshStore();
    await store.navigateTo('workspace');
    await store.navigateTo('metadata');
    await store.goBack();

    await store.navigateTo('settings');
    const state = get(store);

    expect(state.viewHistory).toEqual(['about', 'workspace', 'settings']);
    expect(state.canNavigateForward).toBe(false);
  });
});

describe('navigation guards', () => {
  it('runs guards with from/to and navigates when they allow', async () => {
    const store = await freshStore();
    const guard = vi.fn().mockResolvedValue(true);
    store.addNavigationGuard(guard);

    const ok = await store.navigateTo('workspace');

    expect(ok).toBe(true);
    expect(guard).toHaveBeenCalledWith('about', 'workspace');
  });

  it('blocks navigation when a guard returns false', async () => {
    const store = await freshStore();
    store.addNavigationGuard(() => false);

    const ok = await store.navigateTo('workspace');
    const state = get(store);

    expect(ok).toBe(false);
    expect(state.currentView).toBe('about');
    expect(state.isTransitioning).toBe(false);
  });

  it('blocks navigation when a guard throws', async () => {
    const store = await freshStore();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.addNavigationGuard(() => {
      throw new Error('guard exploded');
    });

    expect(await store.navigateTo('workspace')).toBe(false);
    expect(get(store).currentView).toBe('about');
    error.mockRestore();
  });

  it('force bypasses guards', async () => {
    const store = await freshStore();
    const guard = vi.fn().mockResolvedValue(false);
    store.addNavigationGuard(guard);

    const ok = await store.navigateTo('workspace', { force: true });

    expect(ok).toBe(true);
    expect(guard).not.toHaveBeenCalled();
    expect(get(store).currentView).toBe('workspace');
  });

  it('removed guards no longer run', async () => {
    const store = await freshStore();
    const guard = vi.fn().mockReturnValue(false);
    const id = store.addNavigationGuard(guard);

    expect(store.removeNavigationGuard(id)).toBe(true);
    expect(await store.navigateTo('workspace')).toBe(true);
    expect(guard).not.toHaveBeenCalled();
    expect(store.removeNavigationGuard('guard_nope')).toBe(false);
  });

  it('canNavigate consults guards without navigating', async () => {
    const store = await freshStore();
    store.addNavigationGuard((_from, to) => to !== 'publish');

    expect(await store.canNavigate('workspace')).toBe(true);
    expect(await store.canNavigate('publish')).toBe(false);
    expect(get(store).currentView).toBe('about');
  });
});

describe('view data', () => {
  it('round-trips view data and persists it', async () => {
    const store = await freshStore();

    store.setViewData('spine', { itemId: 'chapter-2' });

    expect(store.getViewData('spine')).toEqual({ itemId: 'chapter-2' });
    expect(JSON.parse(localStorage.getItem(KEYS.VIEW_DATA)!)).toEqual({
      spine: { itemId: 'chapter-2' },
    });
  });

  it('clearViewData removes the entry and updates storage', async () => {
    const store = await freshStore();
    store.setViewData('spine', { itemId: 'chapter-2' });
    store.setViewData('metadata', { tab: 'basic' });

    store.clearViewData('spine');

    expect(store.getViewData('spine')).toBeNull();
    expect(JSON.parse(localStorage.getItem(KEYS.VIEW_DATA)!)).toEqual({
      metadata: { tab: 'basic' },
    });
  });

  it('rejects invalid view types', async () => {
    const store = await freshStore();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    store.setViewData('bogus' as ViewType, { x: 1 });

    expect(store.getViewData('bogus' as ViewType)).toBeNull();
    expect(localStorage.getItem(KEYS.VIEW_DATA)).toBeNull();
    error.mockRestore();
  });
});
