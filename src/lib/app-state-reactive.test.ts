/**
 * Reactive AppState Pattern Tests
 *
 * Tests the key reactive patterns and service integration concepts
 * for the enhanced AppState implementation.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the core reactive patterns that would be used in the enhanced AppState
class MockReactiveAppState {
  // Core reactive state (using regular properties for testing, would be $state in real implementation)
  workspace: { id: string; title: string; manifest: any[]; spine: any[] } | null = null;
  selectedChapterId: string | null = null;
  isLoading: boolean = false;
  errorMessage: string | null = null;

  // Settings state
  globalSettings: { theme: 'light' | 'dark' | 'system'; locale: string } | null = null;

  // Mock services
  private mockWorkspaceService: any;
  private mockSettingsService: any;

  constructor(workspaceService: any, settingsService: any) {
    this.mockWorkspaceService = workspaceService;
    this.mockSettingsService = settingsService;

    // Initialize global settings
    this.globalSettings = this.mockSettingsService.loadGlobalSettings();
  }

  // Computed properties (would use $derived in real implementation)
  get hasWorkspace(): boolean {
    return this.workspace !== null;
  }

  get currentWorkspaceId(): string | null {
    return this.workspace?.id || null;
  }

  get currentTheme(): 'light' | 'dark' | 'system' {
    return this.globalSettings?.theme || 'system';
  }

  get availableChapters(): Array<{ id: string; title: string }> {
    if (!this.workspace) return [];

    return this.workspace.manifest
      .filter(item => item.mediaType === 'application/xhtml+xml')
      .map(item => ({ id: item.id, title: item.id }));
  }

  // Public API methods
  async loadWorkspace(workspaceId: string): Promise<void> {
    try {
      this.isLoading = true;
      this.errorMessage = null;

      const workspace = await this.mockWorkspaceService.loadWorkspace(workspaceId);
      this.workspace = workspace;

      // Clear selections when loading new workspace
      this.selectedChapterId = null;
    } catch (error) {
      this.errorMessage = `Failed to load workspace: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  selectChapter(chapterId: string | null): void {
    this.selectedChapterId = chapterId;
  }

  updateGlobalSettings(
    settings: Partial<{ theme: 'light' | 'dark' | 'system'; locale: string }>
  ): void {
    if (!this.globalSettings) return;

    const updatedSettings = { ...this.globalSettings, ...settings };

    try {
      this.mockSettingsService.saveGlobalSettings(updatedSettings);
      this.globalSettings = updatedSettings;
    } catch (error) {
      this.errorMessage = `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  cleanup(): void {
    this.workspace = null;
    this.selectedChapterId = null;
    this.isLoading = false;
    this.errorMessage = null;
  }
}

describe('Reactive AppState Patterns', () => {
  let appState: MockReactiveAppState;
  let mockWorkspaceService: any;
  let mockSettingsService: any;

  beforeEach(() => {
    mockWorkspaceService = {
      loadWorkspace: vi.fn().mockResolvedValue({
        id: 'test-workspace',
        title: 'Test Book',
        manifest: [
          { id: 'chapter1', mediaType: 'application/xhtml+xml' },
          { id: 'chapter2', mediaType: 'application/xhtml+xml' },
        ],
        spine: [{ idref: 'chapter1' }, { idref: 'chapter2' }],
      }),
    };

    mockSettingsService = {
      loadGlobalSettings: vi.fn().mockReturnValue({
        theme: 'system',
        locale: 'en',
      }),
      saveGlobalSettings: vi.fn(),
    };

    appState = new MockReactiveAppState(mockWorkspaceService, mockSettingsService);
  });

  describe('Reactive State Management', () => {
    test('initializes with correct default state', () => {
      expect(appState.workspace).toBeNull();
      expect(appState.selectedChapterId).toBeNull();
      expect(appState.isLoading).toBe(false);
      expect(appState.errorMessage).toBeNull();
      expect(appState.globalSettings).toEqual({
        theme: 'system',
        locale: 'en',
      });
    });

    test('computed properties react to state changes', async () => {
      // Initially no workspace
      expect(appState.hasWorkspace).toBe(false);
      expect(appState.currentWorkspaceId).toBeNull();
      expect(appState.availableChapters).toEqual([]);

      // Load workspace
      await appState.loadWorkspace('test-workspace');

      // Computed properties should update
      expect(appState.hasWorkspace).toBe(true);
      expect(appState.currentWorkspaceId).toBe('test-workspace');
      expect(appState.availableChapters).toEqual([
        { id: 'chapter1', title: 'chapter1' },
        { id: 'chapter2', title: 'chapter2' },
      ]);
    });

    test('loading state updates during async operations', async () => {
      expect(appState.isLoading).toBe(false);

      const loadPromise = appState.loadWorkspace('test-workspace');

      // Should be loading during async operation
      expect(appState.isLoading).toBe(true);

      await loadPromise;

      // Should not be loading after completion
      expect(appState.isLoading).toBe(false);
    });

    test('error state updates on failures', async () => {
      mockWorkspaceService.loadWorkspace.mockRejectedValue(new Error('Workspace not found'));

      await expect(appState.loadWorkspace('invalid-id')).rejects.toThrow('Workspace not found');

      expect(appState.errorMessage).toContain('Failed to load workspace');
      expect(appState.isLoading).toBe(false);
    });
  });

  describe('Selection State', () => {
    beforeEach(async () => {
      await appState.loadWorkspace('test-workspace');
    });

    test('chapter selection updates state', () => {
      expect(appState.selectedChapterId).toBeNull();

      appState.selectChapter('chapter1');
      expect(appState.selectedChapterId).toBe('chapter1');

      appState.selectChapter('chapter2');
      expect(appState.selectedChapterId).toBe('chapter2');

      appState.selectChapter(null);
      expect(appState.selectedChapterId).toBeNull();
    });

    test('selections clear when workspace changes', async () => {
      appState.selectChapter('chapter1');
      expect(appState.selectedChapterId).toBe('chapter1');

      // Load different workspace
      await appState.loadWorkspace('different-workspace');

      // Selection should be cleared
      expect(appState.selectedChapterId).toBeNull();
    });
  });

  describe('Settings Management', () => {
    test('global settings computed properties', () => {
      expect(appState.currentTheme).toBe('system');

      appState.updateGlobalSettings({ theme: 'dark' });
      expect(appState.currentTheme).toBe('dark');

      appState.updateGlobalSettings({ theme: 'light' });
      expect(appState.currentTheme).toBe('light');
    });

    test('settings updates call service layer', () => {
      appState.updateGlobalSettings({ theme: 'dark', locale: 'fr' });

      expect(mockSettingsService.saveGlobalSettings).toHaveBeenCalledWith({
        theme: 'dark',
        locale: 'fr',
      });

      expect(appState.globalSettings).toEqual({
        theme: 'dark',
        locale: 'fr',
      });
    });

    test('settings errors update error state', () => {
      mockSettingsService.saveGlobalSettings.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      appState.updateGlobalSettings({ theme: 'dark' });

      expect(appState.errorMessage).toContain('Failed to save settings');
    });
  });

  describe('Service Integration', () => {
    test('workspace operations delegate to service layer', async () => {
      await appState.loadWorkspace('test-workspace');

      expect(mockWorkspaceService.loadWorkspace).toHaveBeenCalledWith('test-workspace');
      expect(appState.workspace?.id).toBe('test-workspace');
    });

    test('settings operations delegate to service layer', () => {
      expect(mockSettingsService.loadGlobalSettings).toHaveBeenCalled();

      appState.updateGlobalSettings({ theme: 'dark' });
      expect(mockSettingsService.saveGlobalSettings).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('cleanup resets all state', async () => {
      // Set up some state first
      await appState.loadWorkspace('test-workspace');
      appState.selectChapter('chapter1');
      appState.updateGlobalSettings({ theme: 'dark' });

      // Cleanup should reset reactive state but preserve global settings
      appState.cleanup();

      expect(appState.workspace).toBeNull();
      expect(appState.selectedChapterId).toBeNull();
      expect(appState.isLoading).toBe(false);
      expect(appState.errorMessage).toBeNull();
      // Global settings should persist across cleanup
      expect(appState.globalSettings).toEqual({ theme: 'dark', locale: 'en' });
    });
  });

  describe('Reactive Data Flow', () => {
    test('state changes flow through computed properties', async () => {
      // Test the reactive data flow pattern
      const stateChanges: string[] = [];

      // Track state changes (would use $effect in real implementation)
      const trackWorkspaceChanges = () => {
        if (appState.hasWorkspace) {
          stateChanges.push(`workspace-loaded:${appState.currentWorkspaceId}`);
        } else {
          stateChanges.push('workspace-cleared');
        }
      };

      const trackSelectionChanges = () => {
        if (appState.selectedChapterId) {
          stateChanges.push(`chapter-selected:${appState.selectedChapterId}`);
        } else {
          stateChanges.push('chapter-cleared');
        }
      };

      // Initial state
      trackWorkspaceChanges();
      trackSelectionChanges();

      // Load workspace
      await appState.loadWorkspace('test-workspace');
      trackWorkspaceChanges();
      trackSelectionChanges();

      // Select chapter
      appState.selectChapter('chapter1');
      trackSelectionChanges();

      // Cleanup
      appState.cleanup();
      trackWorkspaceChanges();
      trackSelectionChanges();

      expect(stateChanges).toEqual([
        'workspace-cleared',
        'chapter-cleared',
        'workspace-loaded:test-workspace',
        'chapter-cleared',
        'chapter-selected:chapter1',
        'workspace-cleared',
        'chapter-cleared',
      ]);
    });
  });
});
