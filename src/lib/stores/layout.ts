import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

// TypeScript interfaces
export interface SidebarState {
  isExpanded: boolean;
  activeSection: SidebarSection;
  /** Whether the project nav group (Settings/Metadata/Manifest/Navigation) is shown. */
  projectNavExpanded: boolean;
}

export interface LayoutState {
  sidebar: SidebarState;
  /** Spine view only: the preview (right) pane is collapsed to a slim rail.
   *  Persisted so a writing session survives chapter switches and reloads. */
  spinePreviewCollapsed: boolean;
  isInitialized: boolean;
}

export interface LayoutStore extends Writable<LayoutState> {
  initialize(): void;
  toggleSidebar(): void;
  setSidebarSection(section: SidebarSection): void;
  toggleProjectNav(): void;
  toggleSpinePreview(): void;
}

export type SidebarSection =
  | 'about'
  | 'workspace'
  | 'metadata'
  | 'manifest'
  | 'navigation'
  | 'spine'
  | 'publish'
  | 'settings';

// Storage keys for persistence
const STORAGE_KEYS = {
  SIDEBAR_EXPANDED: 'editme_sidebar_expanded',
  SIDEBAR_SECTION: 'editme_sidebar_section',
  SIDEBAR_PROJECT_EXPANDED: 'editme_sidebar_project_expanded',
  SPINE_PREVIEW_COLLAPSED: 'editme_spine_preview_collapsed',
} as const;

// Default layout state
const DEFAULT_STATE: LayoutState = {
  sidebar: {
    isExpanded: true,
    activeSection: 'about',
    projectNavExpanded: true,
  },
  spinePreviewCollapsed: false,
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
      let savedProjectExpanded: boolean = DEFAULT_STATE.sidebar.projectNavExpanded;

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
        const projectExpandedValue = localStorage.getItem(STORAGE_KEYS.SIDEBAR_PROJECT_EXPANDED);
        if (projectExpandedValue) {
          savedProjectExpanded = JSON.parse(projectExpandedValue) as boolean;
        }
      } catch (error) {
        // Ignore localStorage errors and use default
        // eslint-disable-next-line no-console
        console.warn('Failed to load sidebar project-nav state:', error);
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

      let savedPreviewCollapsed: boolean = DEFAULT_STATE.spinePreviewCollapsed;
      try {
        const collapsedValue = localStorage.getItem(STORAGE_KEYS.SPINE_PREVIEW_COLLAPSED);
        if (collapsedValue) {
          savedPreviewCollapsed = JSON.parse(collapsedValue) as boolean;
        }
      } catch (error) {
        // Ignore localStorage errors and use default
        // eslint-disable-next-line no-console
        console.warn('Failed to load spine preview state:', error);
      }

      update(state => ({
        ...state,
        sidebar: {
          isExpanded: savedExpanded,
          activeSection: savedSection,
          projectNavExpanded: savedProjectExpanded,
        },
        spinePreviewCollapsed: savedPreviewCollapsed,
        isInitialized: true,
      }));
    },

    // Toggle the project nav group (Settings/Metadata/Manifest/Navigation)
    toggleProjectNav(): void {
      update(state => {
        const newValue = !state.sidebar.projectNavExpanded;

        try {
          localStorage.setItem(STORAGE_KEYS.SIDEBAR_PROJECT_EXPANDED, JSON.stringify(newValue));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save sidebar project-nav state:', error);
        }

        return {
          ...state,
          sidebar: {
            ...state.sidebar,
            projectNavExpanded: newValue,
          },
        };
      });
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

    // Toggle the spine view's preview pane collapsed/expanded
    toggleSpinePreview(): void {
      update(state => {
        const newCollapsed = !state.spinePreviewCollapsed;

        try {
          localStorage.setItem(STORAGE_KEYS.SPINE_PREVIEW_COLLAPSED, JSON.stringify(newCollapsed));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Failed to save spine preview state:', error);
        }

        return {
          ...state,
          spinePreviewCollapsed: newCollapsed,
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
    'about',
    'workspace',
    'metadata',
    'manifest',
    'navigation',
    'spine',
    'publish',
    'settings',
  ];
  return validSections.includes(value as SidebarSection);
}

export const layoutStore = createLayoutStore();

// Initialize on first import (browser only)
if (typeof window !== 'undefined') {
  layoutStore.initialize();
}
