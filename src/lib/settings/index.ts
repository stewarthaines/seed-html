/**
 * Settings Manager Public API
 * 
 * Unified interface for managing application settings across three storage tiers:
 * - Global Settings (localStorage): User preferences that persist across workspaces
 * - Workspace Settings (.workspace-metadata.json): Workspace-specific configuration
 * - EPUB Settings (SOURCE/settings.json): Book-specific settings that travel with EPUB
 */

import type { FileStorageAPI } from '../storage/index.js';
import type { ExtensionManager } from '../extensions/index.js';

// Export the implementation
export { SettingsManager } from './settings-manager.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface GlobalSettings {
  theme: 'light' | 'dark' | 'system';
  locale: string;              // e.g., 'en', 'de', 'ar', 'he', 'ja', 'ka', 'zh-hant'
  editor_font_size: number;    // Font size in pixels (8-32)
}

export interface WorkspaceSettings {
  bust_cache: boolean;         // Enable draft mode for cache busting
  draft_id: number;            // Current draft version number
  editor?: {
    preview_delay_ms: number;  // Delay before preview updates (100-2000)
    advanced_mode: boolean;    // Show advanced features and JSON preview
  };
}

export interface EPUBSettings {
  text_transform: string;      // Path to text transform script
  dom_transforms: string[];    // Array of DOM transform script paths
  spine_basename: string;      // Base name for new spine items
  cover?: {
    template: string;          // Cover template name
    background_color: string;  // Hex color for background
    text_color: string;        // Hex color for text
    font_family: string;       // Font family name
  };
}

export interface SettingsValidation {
  isValid: boolean;            // Overall validation status
  errors: string[];            // Critical errors preventing save
  warnings: string[];          // Non-critical issues
}

export interface TransformOption {
  path: string;                // Full path to script file
  extensionName: string;       // Parent extension name
  fileName: string;            // Script filename
}

// ============================================================================
// Settings Manager Interface
// ============================================================================

export interface ISettingsManager {

  // Global Settings (localStorage)
  loadGlobalSettings(): GlobalSettings;
  saveGlobalSettings(settings: GlobalSettings): void;
  getDefaultGlobalSettings(): GlobalSettings;

  // Workspace Settings (.workspace-metadata.json)
  loadWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings>;
  saveWorkspaceSettings(workspaceId: string, settings: WorkspaceSettings): Promise<void>;
  getDefaultWorkspaceSettings(): WorkspaceSettings;

  // EPUB Settings (SOURCE/settings.json)
  loadEPUBSettings(workspaceId: string): Promise<EPUBSettings>;
  saveEPUBSettings(workspaceId: string, settings: EPUBSettings): Promise<void>;
  getDefaultEPUBSettings(): EPUBSettings;

  // Draft Mode Utilities
  incrementDraftId(workspaceId: string): Promise<number>;
  generateDraftTitle(baseTitle: string, draftId: number): string;
  extractDraftInfo(title: string): { baseTitle: string; draftId: number | null };

  // Transform Management
  getAvailableTransforms(workspaceId: string): Promise<TransformOption[]>;
  resolveTransformScripts(
    workspaceId: string,
    settings: EPUBSettings
  ): Promise<{
    textTransform: string | null;
    domTransforms: string[];
  }>;

  // Validation
  validateGlobalSettings(settings: Partial<GlobalSettings>): SettingsValidation;
  validateWorkspaceSettings(settings: Partial<WorkspaceSettings>): SettingsValidation;
  validateEPUBSettings(settings: Partial<EPUBSettings>): SettingsValidation;
}

// ============================================================================
// Method Signatures
// ============================================================================

/**
 * Global Settings Methods
 */

// loadGlobalSettings(): GlobalSettings
// - Returns current global settings from localStorage or defaults
// - Synchronous operation, no side effects

// saveGlobalSettings(settings: GlobalSettings): void
// - Saves complete global settings to localStorage
// - Updates theme store and i18n system if values changed
// - Side effects: localStorage write, theme/locale changes

// getDefaultGlobalSettings(): GlobalSettings
// - Returns default global settings
// - Pure function, no side effects

/**
 * Workspace Settings Methods
 */

// loadWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings>
// - Loads workspace settings from .workspace-metadata.json
// - Returns defaults if file not found or corrupted
// - Read-only operation

// saveWorkspaceSettings(workspaceId: string, settings: WorkspaceSettings): Promise<void>
// - Saves workspace settings to .workspace-metadata.json
// - Merges with existing metadata structure
// - Side effects: file write

// getDefaultWorkspaceSettings(): WorkspaceSettings
// - Returns default workspace settings
// - Pure function, no side effects

/**
 * EPUB Settings Methods
 */

// loadEPUBSettings(workspaceId: string): Promise<EPUBSettings>
// - Loads EPUB settings from SOURCE/settings.json
// - Returns defaults if file not found or corrupted
// - Read-only operation

// saveEPUBSettings(workspaceId: string, settings: EPUBSettings): Promise<void>
// - Saves EPUB settings to SOURCE/settings.json
// - Atomic file operation
// - Side effects: file write

// getDefaultEPUBSettings(): EPUBSettings
// - Returns default EPUB settings
// - Pure function, no side effects

/**
 * Draft Mode Utilities
 */

// incrementDraftId(workspaceId: string): Promise<number>
// - Increments draft_id in workspace settings
// - Returns new draft ID value
// - Side effects: workspace settings update

// generateDraftTitle(baseTitle: string, draftId: number): string
// - Generates title with draft ID suffix (e.g., "My Book 3")
// - Pure function, no side effects

// extractDraftInfo(title: string): { baseTitle: string; draftId: number | null }
// - Extracts base title and draft ID from title string
// - Returns null draftId if no suffix found
// - Pure function, no side effects

/**
 * Transform Management
 */

// getAvailableTransforms(workspaceId: string): Promise<TransformOption[]>
// - Discovers transform scripts from SOURCE/scripts/ and extensions
// - Cached for performance (5 minute TTL)
// - Read-only operation

// resolveTransformScripts(workspaceId, settings): Promise<{textTransform, domTransforms}>
// - Validates transform script paths exist in workspace
// - Returns null/empty array for missing scripts
// - Read-only validation

/**
 * Validation Methods
 */

// validateGlobalSettings(settings: Partial<GlobalSettings>): SettingsValidation
// - Validates theme, locale, font size
// - Pure validation, no side effects

// validateWorkspaceSettings(settings: Partial<WorkspaceSettings>): SettingsValidation
// - Validates bust_cache, draft_id, editor preferences
// - Pure validation, no side effects

// validateEPUBSettings(settings: Partial<EPUBSettings>): SettingsValidation
// - Validates transform paths, spine basename, cover settings
// - Pure validation, no side effects

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Basic Usage
 * 
 * ```typescript
 * import { SettingsManager } from '$lib/settings';
 * import { FileStorageAPI } from '$lib/storage';
 * import { ExtensionManager } from '$lib/extensions';
 * 
 * // Initialize
 * const fileStorage = new FileStorageAPI();
 * await fileStorage.init();
 * const extensionManager = new ExtensionManager(fileStorage);
 * const settingsManager = new SettingsManager(fileStorage, extensionManager);
 * 
 * // Global settings
 * const globalSettings = settingsManager.loadGlobalSettings();
 * globalSettings.theme = 'dark';
 * settingsManager.saveGlobalSettings(globalSettings);
 * 
 * // Workspace settings
 * const workspaceSettings = await settingsManager.loadWorkspaceSettings('workspace-123');
 * workspaceSettings.bust_cache = true;
 * await settingsManager.saveWorkspaceSettings('workspace-123', workspaceSettings);
 * 
 * // EPUB settings
 * const epubSettings = await settingsManager.loadEPUBSettings('workspace-123');
 * epubSettings.spine_basename = 'section';
 * await settingsManager.saveEPUBSettings('workspace-123', epubSettings);
 * ```
 */

/**
 * Draft Mode Workflow
 * 
 * ```typescript
 * // During EPUB packaging
 * const workspaceSettings = await settingsManager.loadWorkspaceSettings('workspace-123');
 * if (workspaceSettings.bust_cache) {
 *   const newDraftId = await settingsManager.incrementDraftId('workspace-123');
 *   const draftTitle = settingsManager.generateDraftTitle('My Book', newDraftId);
 *   // Use draftTitle for EPUB metadata and filename
 * }
 * 
 * // During EPUB import
 * const importedTitle = 'My Book 5';
 * const draftInfo = settingsManager.extractDraftInfo(importedTitle);
 * if (draftInfo.draftId) {
 *   // Clean title: draftInfo.baseTitle, detected ID: draftInfo.draftId
 * }
 * ```
 */

/**
 * Transform Discovery
 * 
 * ```typescript
 * // Get available transforms for UI dropdown
 * const transforms = await settingsManager.getAvailableTransforms('workspace-123');
 * // Returns: [{ path: 'SOURCE/scripts/transform.js', extensionName: 'built-in', fileName: 'transform.js' }, ...]
 * 
 * // Validate selected transforms
 * const epubSettings = await settingsManager.loadEPUBSettings('workspace-123');
 * const resolved = await settingsManager.resolveTransformScripts('workspace-123', epubSettings);
 * if (!resolved.textTransform) {
 *   console.warn('Text transform script not found');
 * }
 * ```
 */

/**
 * Validation Example
 * 
 * ```typescript
 * // Validate before saving
 * const validation = settingsManager.validateEPUBSettings({
 *   text_transform: 'SOURCE/scripts/transform.js',
 *   spine_basename: 'chapter',
 *   cover: { template: 'minimal', background_color: '#ffffff' }
 * });
 * 
 * if (validation.isValid) {
 *   await settingsManager.saveEPUBSettings('workspace-123', settings);
 * } else {
 *   console.error('Validation errors:', validation.errors);
 * }
 * ```
 */