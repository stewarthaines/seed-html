import { writable } from 'svelte/store';
import { layoutStore } from '../stores/layout';
import type { SidebarSection } from '../stores/layout';
import type {
  ViewType,
  NavigationState,
  NavigationOptions,
  NavigationGuard,
  NavigationStore,
} from './types';

// Storage keys for persistence
const STORAGE_KEYS = {
  CURRENT_VIEW: 'editme_nav_current_view',
  VIEW_HISTORY: 'editme_nav_view_history',
  VIEW_DATA: 'editme_nav_view_data',
} as const;

// Maximum history entries to prevent memory leaks
const MAX_HISTORY_SIZE = 20;

// Default navigation state
const DEFAULT_STATE: NavigationState = {
  currentView: 'workspace',
  previousView: null,
  viewHistory: ['workspace'],
  viewData: {},
  isTransitioning: false,
  canNavigateBack: false,
  canNavigateForward: false,
};

// Valid view types for validation
const VALID_VIEW_TYPES: ViewType[] = [
  'workspace',
  'metadata',
  'manifest',
  'navigation',
  'spine',
  'settings',
];

// Guard management
interface GuardManager {
  guards: Map<string, NavigationGuard>;
  nextId: number;
}

// Create the navigation store
function createNavigationStore(): NavigationStore {
  const { subscribe, set, update } = writable<NavigationState>(DEFAULT_STATE);

  // Guard management
  const guardManager: GuardManager = {
    guards: new Map(),
    nextId: 1,
  };

  // History navigation state
  let historyPosition = 0;

  return {
    subscribe,
    set,
    update,

    // Initialize from localStorage and sync with layout store
    initialize(): void {
      let savedCurrentView: ViewType = DEFAULT_STATE.currentView;
      let savedHistory: ViewType[] = [...DEFAULT_STATE.viewHistory];
      let savedViewData: Partial<Record<ViewType, any>> = {};

      // Load saved state
      try {
        const savedView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW);
        if (savedView && isValidViewType(savedView)) {
          savedCurrentView = savedView;
        }

        const savedHistoryStr = localStorage.getItem(STORAGE_KEYS.VIEW_HISTORY);
        if (savedHistoryStr) {
          const parsedHistory = JSON.parse(savedHistoryStr);
          if (Array.isArray(parsedHistory) && parsedHistory.every(isValidViewType)) {
            savedHistory = parsedHistory;
          }
        }

        const savedDataStr = localStorage.getItem(STORAGE_KEYS.VIEW_DATA);
        if (savedDataStr) {
          const parsedData = JSON.parse(savedDataStr);
          if (typeof parsedData === 'object' && parsedData !== null) {
            savedViewData = parsedData;
          }
        }
      } catch (error) {
        // Ignore localStorage errors and use defaults
        // eslint-disable-next-line no-console
        console.warn('Failed to load navigation state:', error);
      }

      // Calculate history position and navigation flags
      historyPosition = savedHistory.length - 1;
      const canNavigateBack = historyPosition > 0;
      const canNavigateForward = false; // No forward history on init

      // Set initial state
      update(state => ({
        ...state,
        currentView: savedCurrentView,
        previousView: savedHistory.length > 1 ? savedHistory[savedHistory.length - 2] : null,
        viewHistory: savedHistory,
        viewData: savedViewData,
        canNavigateBack,
        canNavigateForward,
        isInitialized: true,
      }));

      // Sync with layout store
      syncToLayoutStore(savedCurrentView);

      // Listen for layout store changes
      layoutStore.subscribe(({ sidebar }) => {
        // Get the actual current state instead of using savedCurrentView
        let currentView: ViewType | null = null;
        const unsubscribe = this.subscribe(state => {
          currentView = state.currentView;
        });
        unsubscribe(); // Immediately unsubscribe after getting current value

        if (sidebar.activeSection !== currentView) {
          // Firefox-specific fix: Add microtask delay to handle async timing issues
          if (navigator.userAgent.includes('Firefox')) {
            queueMicrotask(() => {
              this.navigateTo(sidebar.activeSection as ViewType, { replaceHistory: true });
            });
          } else {
            // Layout store changed, update navigation
            this.navigateTo(sidebar.activeSection as ViewType, { replaceHistory: true });
          }
        }
      });
    },

    // Navigate to a specific view
    async navigateTo(view: ViewType, options: NavigationOptions = {}): Promise<boolean> {
      if (!isValidViewType(view)) {
        console.error('Invalid view type:', view);
        return false;
      }

      const currentState = getCurrentState();

      // Check if already on target view
      if (currentState.currentView === view && !options.force) {
        return true;
      }

      // Set transitioning state
      update(state => ({ ...state, isTransitioning: true }));

      try {
        // Check navigation guards (unless forced)
        if (!options.force) {
          const canNav = await executeGuards(currentState.currentView, view);
          if (!canNav) {
            update(state => ({ ...state, isTransitioning: false }));
            return false;
          }
        }

        // Clear spine item selection when navigating away from spine view
        if (currentState.currentView === 'spine' && view !== 'spine') {
          const clearEvent = new CustomEvent('clear-spine-selection');
          window.dispatchEvent(clearEvent);
        }

        // Perform navigation
        await performNavigation(view, options);

        return true;
      } catch (error) {
        console.error('Navigation error:', error);
        update(state => ({ ...state, isTransitioning: false }));
        return false;
      }
    },

    // Check if navigation is allowed
    async canNavigate(targetView?: ViewType): Promise<boolean> {
      const currentState = getCurrentState();
      const target = targetView || currentState.currentView;

      if (!isValidViewType(target)) {
        return false;
      }

      try {
        return await executeGuards(currentState.currentView, target);
      } catch (error) {
        console.error('Guard execution error:', error);
        return false;
      }
    },

    // Navigate back in history
    async goBack(): Promise<boolean> {
      const currentState = getCurrentState();

      if (!currentState.canNavigateBack || historyPosition <= 0) {
        return false;
      }

      const targetView = currentState.viewHistory[historyPosition - 1];
      if (!targetView) {
        return false;
      }

      // Check guards
      const canNav = await executeGuards(currentState.currentView, targetView);
      if (!canNav) {
        return false;
      }

      // Navigate back
      historyPosition--;
      await updateNavigationState(targetView, { isHistoryNavigation: true });

      return true;
    },

    // Navigate forward in history
    async goForward(): Promise<boolean> {
      const currentState = getCurrentState();

      if (
        !currentState.canNavigateForward ||
        historyPosition >= currentState.viewHistory.length - 1
      ) {
        return false;
      }

      const targetView = currentState.viewHistory[historyPosition + 1];
      if (!targetView) {
        return false;
      }

      // Check guards
      const canNav = await executeGuards(currentState.currentView, targetView);
      if (!canNav) {
        return false;
      }

      // Navigate forward
      historyPosition++;
      await updateNavigationState(targetView, { isHistoryNavigation: true });

      return true;
    },

    // Set view-specific data
    setViewData(view: ViewType, data: any): void {
      if (!isValidViewType(view)) {
        console.error('Invalid view type for setViewData:', view);
        return;
      }

      update(state => {
        const newViewData = { ...state.viewData, [view]: data };

        // Persist view data to localStorage
        try {
          localStorage.setItem(STORAGE_KEYS.VIEW_DATA, JSON.stringify(newViewData));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save view data:', error);
        }

        return {
          ...state,
          viewData: newViewData,
        };
      });
    },

    // Get view-specific data
    getViewData<T = any>(view: ViewType): T | null {
      if (!isValidViewType(view)) {
        console.error('Invalid view type for getViewData:', view);
        return null;
      }

      const currentState = getCurrentState();
      return (currentState.viewData[view] as T) || null;
    },

    // Clear view-specific data
    clearViewData(view: ViewType): void {
      if (!isValidViewType(view)) {
        console.error('Invalid view type for clearViewData:', view);
        return;
      }

      update(state => {
        const newViewData = { ...state.viewData };
        delete newViewData[view];

        // Persist updated view data
        try {
          localStorage.setItem(STORAGE_KEYS.VIEW_DATA, JSON.stringify(newViewData));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save view data:', error);
        }

        return {
          ...state,
          viewData: newViewData,
        };
      });
    },

    // Add navigation guard
    addNavigationGuard(guard: NavigationGuard): string {
      const guardId = `guard_${guardManager.nextId++}`;
      guardManager.guards.set(guardId, guard);
      return guardId;
    },

    // Remove navigation guard
    removeNavigationGuard(guardId: string): boolean {
      return guardManager.guards.delete(guardId);
    },
  };

  // Helper functions
  function getCurrentState(): NavigationState {
    let state: NavigationState;
    subscribe(s => (state = s))();
    return state!;
  }

  function isValidViewType(value: string): value is ViewType {
    return VALID_VIEW_TYPES.includes(value as ViewType);
  }

  async function executeGuards(from: ViewType, to: ViewType): Promise<boolean> {
    const guards = Array.from(guardManager.guards.values());

    for (const guard of guards) {
      try {
        const result = await guard(from, to);
        if (!result) {
          return false;
        }
      } catch (error) {
        console.error('Navigation guard error:', error);
        return false; // Block navigation on guard error
      }
    }

    return true;
  }

  async function performNavigation(view: ViewType, options: NavigationOptions): Promise<void> {
    const currentState = getCurrentState();

    // Set view data if provided
    if (options.viewData) {
      update(state => ({
        ...state,
        viewData: { ...state.viewData, [view]: options.viewData },
      }));
    }

    // Update history
    let newHistory = [...currentState.viewHistory];

    if (options.replaceHistory) {
      // Replace current history entry
      newHistory[newHistory.length - 1] = view;
      historyPosition = newHistory.length - 1;
    } else {
      // Add to history, truncating any forward history
      newHistory = newHistory.slice(0, historyPosition + 1);
      newHistory.push(view);
      historyPosition = newHistory.length - 1;

      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory = newHistory.slice(-MAX_HISTORY_SIZE);
        historyPosition = newHistory.length - 1;
      }
    }

    await updateNavigationState(view, { newHistory });
  }

  async function updateNavigationState(
    view: ViewType,
    options: { newHistory?: ViewType[]; isHistoryNavigation?: boolean } = {}
  ): Promise<void> {
    const currentState = getCurrentState();

    const newHistory = options.newHistory || currentState.viewHistory;
    const canNavigateBack = historyPosition > 0;
    const canNavigateForward = historyPosition < newHistory.length - 1;

    // Update state
    update(state => ({
      ...state,
      currentView: view,
      previousView: state.currentView,
      viewHistory: newHistory,
      canNavigateBack,
      canNavigateForward,
      isTransitioning: false,
    }));

    // Persist navigation state
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_VIEW, view);
      localStorage.setItem(STORAGE_KEYS.VIEW_HISTORY, JSON.stringify(newHistory));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to save navigation state:', error);
    }

    // Sync to layout store (avoid loops)
    if (!options.isHistoryNavigation) {
      syncToLayoutStore(view);
    }
  }

  function syncToLayoutStore(view: ViewType): void {
    try {
      layoutStore.setSidebarSection(view as SidebarSection);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to sync to layout store:', error);
    }
  }
}

export const navigationStore = createNavigationStore();

// Initialize on first import (browser only)
if (typeof window !== 'undefined') {
  navigationStore.initialize();
}
