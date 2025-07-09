import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

// TypeScript interfaces
export interface SidebarState {
  isExpanded: boolean;
  activeSection: SidebarSection;
}

export interface LayoutState {
  sidebar: SidebarState;
  isInitialized: boolean;
}

export interface LayoutStore extends Writable<LayoutState> {
  initialize(): void;
  toggleSidebar(): void;
  setSidebarSection(section: SidebarSection): void;
}

export type SidebarSection =
  | 'workspace'
  | 'metadata'
  | 'manifest'
  | 'navigation'
  | 'spine'
  | 'settings';

// Storage keys for persistence
const STORAGE_KEYS = {
  SIDEBAR_EXPANDED: 'editme_sidebar_expanded',
  SIDEBAR_SECTION: 'editme_sidebar_section',
} as const;

// Default layout state
const DEFAULT_STATE: LayoutState = {
  sidebar: {
    isExpanded: true,
    activeSection: 'workspace',
  },
  isInitialized: false,
};

// Create the writable store
function createLayoutStore(): LayoutStore {
  const { subscribe, set, update } = writable<LayoutState>(DEFAULT_STATE);

  return {
    subscribe,
    set,
    update,

    // Initialize from localStorage
    initialize(): void {
      let savedExpanded: boolean = DEFAULT_STATE.sidebar.isExpanded;
      let savedSection: SidebarSection = DEFAULT_STATE.sidebar.activeSection;

      try {
        const expandedValue = localStorage.getItem(STORAGE_KEYS.SIDEBAR_EXPANDED);
        if (expandedValue) {
          savedExpanded = JSON.parse(expandedValue) as boolean;
        }
      } catch (error) {
        // Ignore localStorage errors and use default
        // eslint-disable-next-line no-console
        console.warn('Failed to load sidebar expanded state:', error);
      }

      try {
        const sectionValue = localStorage.getItem(STORAGE_KEYS.SIDEBAR_SECTION);
        if (sectionValue && isValidSidebarSection(sectionValue)) {
          savedSection = sectionValue;
        }
      } catch (error) {
        // Ignore localStorage errors and use default
        // eslint-disable-next-line no-console
        console.warn('Failed to load sidebar section:', error);
      }

      update(state => ({
        ...state,
        sidebar: {
          isExpanded: savedExpanded,
          activeSection: savedSection,
        },
        isInitialized: true,
      }));
    },

    // Toggle sidebar expanded/collapsed
    toggleSidebar(): void {
      update(state => {
        const newExpanded = !state.sidebar.isExpanded;

        try {
          localStorage.setItem(STORAGE_KEYS.SIDEBAR_EXPANDED, JSON.stringify(newExpanded));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save sidebar expanded state:', error);
        }

        return {
          ...state,
          sidebar: {
            ...state.sidebar,
            isExpanded: newExpanded,
          },
        };
      });
    },

    // Set active sidebar section
    setSidebarSection(section: SidebarSection): void {
      update(state => {
        try {
          localStorage.setItem(STORAGE_KEYS.SIDEBAR_SECTION, section);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save sidebar section:', error);
        }

        return {
          ...state,
          sidebar: {
            ...state.sidebar,
            activeSection: section,
          },
        };
      });
    },
  };
}

// Type guard for sidebar sections
function isValidSidebarSection(value: string): value is SidebarSection {
  const validSections: SidebarSection[] = [
    'workspace',
    'metadata',
    'manifest',
    'navigation',
    'spine',
    'settings',
  ];
  return validSections.includes(value as SidebarSection);
}

export const layoutStore = createLayoutStore();

// Initialize on first import (browser only)
if (typeof window !== 'undefined') {
  layoutStore.initialize();
}
