import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { get } from 'svelte/store';
import { layoutStore, type SidebarSection } from './layout';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock console.warn to avoid cluttering test output
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = vi.fn();
});

afterAll(() => {
  console.warn = originalWarn;
});

describe('Layout Store', () => {
  beforeEach(() => {
    // Clear mock localStorage before each test
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('Default State', () => {
    it('should have correct default state before initialization', () => {
      // Note: store auto-initializes, so we test the initialized state
      const state = get(layoutStore);

      expect(state.sidebar.isExpanded).toBe(true);
      expect(state.sidebar.activeSection).toBe('workspace');
      expect(state.isInitialized).toBe(true);
    });
  });

  describe('Initialize', () => {
    it('should initialize with default values when localStorage is empty', () => {
      layoutStore.initialize();
      const state = get(layoutStore);

      expect(state.sidebar.isExpanded).toBe(true);
      expect(state.sidebar.activeSection).toBe('workspace');
      expect(state.isInitialized).toBe(true);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('editme_sidebar_expanded');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('editme_sidebar_section');
    });

    it('should load saved expanded state from localStorage', () => {
      mockLocalStorage.setItem('editme_sidebar_expanded', JSON.stringify(false));

      layoutStore.initialize();
      const state = get(layoutStore);

      expect(state.sidebar.isExpanded).toBe(false);
      expect(state.isInitialized).toBe(true);
    });

    it('should load saved section from localStorage', () => {
      mockLocalStorage.setItem('editme_sidebar_section', 'metadata');

      layoutStore.initialize();
      const state = get(layoutStore);

      expect(state.sidebar.activeSection).toBe('metadata');
      expect(state.isInitialized).toBe(true);
    });

    it('should load both saved values from localStorage', () => {
      mockLocalStorage.setItem('editme_sidebar_expanded', JSON.stringify(false));
      mockLocalStorage.setItem('editme_sidebar_section', 'settings');

      layoutStore.initialize();
      const state = get(layoutStore);

      expect(state.sidebar.isExpanded).toBe(false);
      expect(state.sidebar.activeSection).toBe('settings');
      expect(state.isInitialized).toBe(true);
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      mockLocalStorage.setItem('editme_sidebar_expanded', 'invalid-json');

      // Should not throw and should use default value
      layoutStore.initialize();

      const state = get(layoutStore);
      expect(state.sidebar.isExpanded).toBe(true); // Default value
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to load sidebar expanded state:',
        expect.any(Error)
      );
    });
  });

  describe('Toggle Sidebar', () => {
    beforeEach(() => {
      layoutStore.initialize();
    });

    it('should toggle sidebar from expanded to collapsed', () => {
      const initialState = get(layoutStore);
      expect(initialState.sidebar.isExpanded).toBe(true);

      layoutStore.toggleSidebar();

      const newState = get(layoutStore);
      expect(newState.sidebar.isExpanded).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'editme_sidebar_expanded',
        JSON.stringify(false)
      );
    });

    it('should toggle sidebar from collapsed to expanded', () => {
      // Start with collapsed state
      layoutStore.toggleSidebar(); // First toggle to collapse
      layoutStore.toggleSidebar(); // Second toggle to expand

      const state = get(layoutStore);
      expect(state.sidebar.isExpanded).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenLastCalledWith(
        'editme_sidebar_expanded',
        JSON.stringify(true)
      );
    });

    it('should preserve other state when toggling', () => {
      layoutStore.setSidebarSection('manifest');

      const beforeToggle = get(layoutStore);
      expect(beforeToggle.sidebar.activeSection).toBe('manifest');

      layoutStore.toggleSidebar();

      const afterToggle = get(layoutStore);
      expect(afterToggle.sidebar.activeSection).toBe('manifest'); // Should remain unchanged
      expect(afterToggle.sidebar.isExpanded).toBe(false);
    });
  });

  describe('Set Sidebar Section', () => {
    beforeEach(() => {
      layoutStore.initialize();
    });

    it('should update active section', () => {
      layoutStore.setSidebarSection('metadata');

      const state = get(layoutStore);
      expect(state.sidebar.activeSection).toBe('metadata');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('editme_sidebar_section', 'metadata');
    });

    it('should handle all valid section types', () => {
      const validSections: SidebarSection[] = [
        'workspace',
        'metadata',
        'manifest',
        'navigation',
        'spine',
        'settings',
      ];

      validSections.forEach(section => {
        layoutStore.setSidebarSection(section);

        const state = get(layoutStore);
        expect(state.sidebar.activeSection).toBe(section);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('editme_sidebar_section', section);
      });
    });

    it('should preserve other state when changing section', () => {
      layoutStore.toggleSidebar(); // Collapse sidebar

      const beforeSectionChange = get(layoutStore);
      expect(beforeSectionChange.sidebar.isExpanded).toBe(false);

      layoutStore.setSidebarSection('navigation');

      const afterSectionChange = get(layoutStore);
      expect(afterSectionChange.sidebar.isExpanded).toBe(false); // Should remain unchanged
      expect(afterSectionChange.sidebar.activeSection).toBe('navigation');
    });
  });

  describe('State Persistence', () => {
    it('should save expanded state changes to localStorage', () => {
      layoutStore.initialize();
      layoutStore.toggleSidebar();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'editme_sidebar_expanded',
        JSON.stringify(false)
      );
    });

    it('should save section changes to localStorage', () => {
      layoutStore.initialize();
      layoutStore.setSidebarSection('spine');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('editme_sidebar_section', 'spine');
    });

    it('should persist state across store recreations', () => {
      // First store instance
      layoutStore.initialize();
      layoutStore.toggleSidebar();
      layoutStore.setSidebarSection('settings');

      // Simulate new store instance loading from localStorage
      const _newStore = get(layoutStore);

      // Mock what would be in localStorage
      mockLocalStorage.setItem('editme_sidebar_expanded', JSON.stringify(false));
      mockLocalStorage.setItem('editme_sidebar_section', 'settings');

      layoutStore.initialize();
      const loadedState = get(layoutStore);

      expect(loadedState.sidebar.isExpanded).toBe(false);
      expect(loadedState.sidebar.activeSection).toBe('settings');
    });
  });

  describe('Edge Cases', () => {
    it('should handle localStorage unavailability gracefully', () => {
      // Mock localStorage to throw errors
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      layoutStore.initialize();

      const state = get(layoutStore);
      expect(state.sidebar.isExpanded).toBe(true); // Default fallback
      expect(state.sidebar.activeSection).toBe('workspace'); // Default fallback
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to load sidebar expanded state:',
        expect.any(Error)
      );
    });

    it('should handle localStorage quota exceeded errors', () => {
      layoutStore.initialize();

      // Mock localStorage to throw quota exceeded error for saving
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw when trying to save
      layoutStore.toggleSidebar();
      layoutStore.setSidebarSection('metadata');

      expect(console.warn).toHaveBeenCalledWith(
        'Failed to save sidebar expanded state:',
        expect.any(Error)
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to save sidebar section:',
        expect.any(Error)
      );
    });

    it('should handle null localStorage values', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      layoutStore.initialize();
      const state = get(layoutStore);

      expect(state.sidebar.isExpanded).toBe(true); // Default
      expect(state.sidebar.activeSection).toBe('workspace'); // Default
    });

    it('should handle empty string localStorage values', () => {
      mockLocalStorage.getItem.mockReturnValue('');

      layoutStore.initialize();
      const state = get(layoutStore);

      expect(state.sidebar.isExpanded).toBe(true); // Default
      expect(state.sidebar.activeSection).toBe('workspace'); // Default
    });
  });
});
