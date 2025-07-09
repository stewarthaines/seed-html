/**
 * Story template utilities for creating consistent workspace-based Storybook demos
 *
 * Provides higher-level patterns and templates for common story configurations
 */

import { onMount } from 'svelte';
import type { WorkspaceManager } from '../../lib/workspace';
import { layoutStore } from '../../lib/stores/layout';
import type { SidebarSection } from '../../lib/stores/layout';
import {
  createInitialStoryState,
  initializeStoryWorkspace,
  withWorkspaceErrorHandling,
  type WorkspaceSetupOptions,
  type WorkspaceStoryState,
} from './workspace-story-utils';
import { createLogger, type Logger } from './story-logging';
import { generateTestScenarios, type TestScenario } from './demo-content';

// Common story configuration types
export interface StoryConfiguration {
  scenario: keyof ReturnType<typeof generateTestScenarios> | TestScenario;
  layout?: {
    startCollapsed?: boolean;
    activeSection?: SidebarSection;
    sidebarWidth?: string;
  };
  logging?: {
    enabled?: boolean;
    showDetails?: boolean;
  };
  errorHandling?: {
    simulateError?: boolean;
    errorMessage?: string;
  };
}

export interface WorkspaceStoryComposition {
  // Core state
  state: WorkspaceStoryState;
  logger: Logger;

  // Initialization
  initializeStory: (config: StoryConfiguration) => Promise<void>;
  resetStory: () => Promise<void>;

  // Common actions
  refreshWorkspace: () => Promise<void>;
  handleError: (error: Error) => void;

  // Layout management
  setLayoutState: (layout: StoryConfiguration['layout']) => void;

  // Content management
  selectedItemId: string | null;
  setSelectedItem: (itemId: string | null) => void;
}

/**
 * Create a complete story composition with all common functionality
 */
export function createWorkspaceStoryComposition(): WorkspaceStoryComposition {
  // Initialize core components
  const state = createInitialStoryState();
  const logger = createLogger();
  let selectedItemId: string | null = null;

  // Current configuration
  let currentConfig: StoryConfiguration | null = null;

  /**
   * Initialize the story with given configuration
   */
  const initializeStory = async (config: StoryConfiguration): Promise<void> => {
    console.log('🎬 Story initializeStory called with config:', config);
    currentConfig = config;

    // Reset state
    Object.assign(state, createInitialStoryState());
    logger.clearLogs();
    selectedItemId = null;

    console.log('🔄 State reset, starting initialization...');

    // Start initialization
    state.isLoading = true;
    logger.addLog('info', 'Initializing workspace story...');
    console.log('⏳ Set isLoading to true');

    try {
      // Handle error simulation
      if (config.errorHandling?.simulateError) {
        console.log('❌ Simulating error as requested');
        throw new Error(config.errorHandling.errorMessage || 'Simulated error for testing');
      }

      // Get scenario configuration
      console.log('📖 Processing scenario:', config.scenario);
      const scenario =
        typeof config.scenario === 'string'
          ? generateTestScenarios()[config.scenario]
          : config.scenario;

      console.log('📋 Generated scenario object:', scenario);

      if (!scenario) {
        console.log('❌ No scenario found!');
        throw new Error('Invalid scenario configuration');
      }

      logger.addLog('info', `Loading scenario: ${scenario.name}`);
      console.log(
        `✅ Scenario "${scenario.name}" loaded with ${scenario.chapters.length} chapters`
      );

      // Create workspace with scenario content
      const setupOptions: WorkspaceSetupOptions = {
        metadata: scenario.metadata,
        chapters: scenario.chapters,
        skipMissingChapters: scenario.skipMissingChapters,
        includeCSS: scenario.includeCSS,
        includeImages: false, // Keep demos lightweight
      };

      console.log('🛠️ Setup options:', setupOptions);
      console.log('🚀 Calling initializeStoryWorkspace...');

      const result = await initializeStoryWorkspace(setupOptions);

      console.log('✅ initializeStoryWorkspace completed:', result);

      // Update state
      state.workspaceManager = result.workspaceManager;
      state.workspaceId = result.workspaceId;
      state.initialized = true;
      state.error = null;

      console.log('📝 State updated:');
      console.log('  - workspaceManager:', state.workspaceManager);
      console.log('  - workspaceId:', state.workspaceId);
      console.log('  - initialized:', state.initialized);

      logger.addLog('success', `Workspace created: ${result.workspaceId}`);
      logger.addLog('info', `Added ${scenario.chapters.length} chapters`);

      // Apply layout configuration
      if (config.layout) {
        setLayoutState(config.layout);
      }
    } catch (error) {
      console.log('❌ Error in initializeStory:', error);
      handleError(error as Error);
    } finally {
      state.isLoading = false;
      console.log('🏁 initializeStory complete. Final state isLoading:', state.isLoading);
    }
  };

  /**
   * Reset the story to initial state
   */
  const resetStory = async (): Promise<void> => {
    logger.addLog('info', 'Resetting story...');

    try {
      // Clean up existing workspace
      if (state.workspaceManager && state.workspaceId) {
        await withWorkspaceErrorHandling(async () => {
          await state.workspaceManager!.deleteWorkspace(state.workspaceId!);
        });
      }

      // Reinitialize if we have a config
      if (currentConfig) {
        await initializeStory(currentConfig);
      } else {
        Object.assign(state, createInitialStoryState());
        selectedItemId = null;
        logger.addLog('info', 'Story reset to initial state');
      }
    } catch (error) {
      handleError(error as Error);
    }
  };

  /**
   * Refresh workspace data
   */
  const refreshWorkspace = async (): Promise<void> => {
    if (!state.workspaceManager || !state.workspaceId) {
      logger.addLog('warning', 'No workspace to refresh');
      return;
    }

    logger.addLog('info', 'Refreshing workspace data...');

    try {
      // Trigger any necessary refreshes
      // This is a placeholder for specific refresh logic
      logger.addLog('success', 'Workspace data refreshed');
    } catch (error) {
      handleError(error as Error);
    }
  };

  /**
   * Handle errors consistently
   */
  const handleError = (error: Error): void => {
    state.error = error.message;
    state.isLoading = false;
    logger.addLog('error', `Error: ${error.message}`, error);
    console.error('Story error:', error);
  };

  /**
   * Set layout state
   */
  const setLayoutState = (layout: StoryConfiguration['layout']): void => {
    if (!layout) return;

    // Apply sidebar state
    if (layout.startCollapsed && layoutStore) {
      layoutStore.toggleSidebar();
    }

    // Set active section
    if (layout.activeSection && layoutStore) {
      layoutStore.setSidebarSection(layout.activeSection);
    }

    logger.addLog('info', `Layout configured: ${JSON.stringify(layout)}`);
  };

  /**
   * Set selected item
   */
  const setSelectedItem = (itemId: string | null): void => {
    selectedItemId = itemId;
    if (itemId) {
      logger.addLog('info', `Selected item: ${itemId}`);
    }
  };

  return {
    // State access
    get state() {
      return state;
    },
    logger,

    // Actions
    initializeStory,
    resetStory,
    refreshWorkspace,
    handleError,
    setLayoutState,

    // Selected item management
    get selectedItemId() {
      return selectedItemId;
    },
    setSelectedItem,
  };
}

/**
 * Create a story setup function for onMount usage
 */
export function createStorySetup(config: StoryConfiguration) {
  return (composition: WorkspaceStoryComposition) => {
    onMount(() => {
      // Initialize story
      composition.initializeStory(config);

      // Set up event listeners if needed
      const handleSelectSpineItem = (event: Event) => {
        const customEvent = event as CustomEvent<{ itemId: string }>;
        composition.setSelectedItem(customEvent.detail.itemId);
      };

      window.addEventListener('select-spine-item', handleSelectSpineItem);

      return () => {
        window.removeEventListener('select-spine-item', handleSelectSpineItem);
      };
    });
  };
}

/**
 * Common story configurations
 */
export const STORY_CONFIGS = {
  // Basic working demo
  basic: {
    scenario: 'basicNovel' as const,
    layout: {
      startCollapsed: false,
      activeSection: 'spine',
    },
    logging: {
      enabled: true,
      showDetails: false,
    },
  },

  // Demo with validation errors
  withErrors: {
    scenario: 'withErrors' as const,
    layout: {
      startCollapsed: false,
      activeSection: 'spine',
    },
    logging: {
      enabled: true,
      showDetails: true,
    },
  },

  // Collapsed sidebar demo
  collapsed: {
    scenario: 'basicNovel' as const,
    layout: {
      startCollapsed: true,
      activeSection: 'spine',
    },
    logging: {
      enabled: true,
    },
  },

  // Error simulation
  errorState: {
    scenario: 'basicNovel' as const,
    layout: {
      startCollapsed: false,
      activeSection: 'spine',
    },
    errorHandling: {
      simulateError: true,
      errorMessage: 'Simulated error for testing error handling',
    },
    logging: {
      enabled: true,
      showDetails: true,
    },
  },

  // Minimal content
  minimal: {
    scenario: 'minimal' as const,
    layout: {
      startCollapsed: false,
      activeSection: 'workspace',
    },
    logging: {
      enabled: false,
    },
  },

  // Comprehensive demo
  comprehensive: {
    scenario: 'comprehensive' as const,
    layout: {
      startCollapsed: false,
      activeSection: 'spine',
    },
    logging: {
      enabled: true,
      showDetails: true,
    },
  },
} satisfies Record<string, StoryConfiguration>;

/**
 * Helper to create story args from configuration
 */
export function createStoryArgs(config: StoryConfiguration) {
  return {
    scenario: typeof config.scenario === 'string' ? config.scenario : 'custom',
    startCollapsed: config.layout?.startCollapsed || false,
    simulateError: config.errorHandling?.simulateError || false,
    enableLogging: config.logging?.enabled !== false,
  };
}

/**
 * Create a standardized story play function
 */
export function createStoryPlayFunction(actions: string[] = []) {
  return async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = {
      getByTitle: (title: string) => canvasElement.querySelector(`[title="${title}"]`),
    };

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Execute actions
    for (const action of actions) {
      try {
        switch (action) {
          case 'toggleSidebar':
            const toggleBtn = canvas.getByTitle('Toggle sidebar');
            if (toggleBtn) (toggleBtn as HTMLElement).click();
            break;

          case 'navigateSpine':
            const spineBtn = canvas.getByTitle('Spine Items');
            if (spineBtn) (spineBtn as HTMLElement).click();
            break;

          case 'navigateWorkspace':
            const workspaceBtn = canvas.getByTitle('Workspace');
            if (workspaceBtn) (workspaceBtn as HTMLElement).click();
            break;

          // Add more actions as needed
        }

        // Wait between actions
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.warn(`Story play action "${action}" failed:`, error);
      }
    }
  };
}
