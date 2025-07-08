/**
 * Settings Manager Implementation
 * 
 * Manages application settings across three storage tiers:
 * - Global Settings (localStorage)
 * - Workspace Settings (.workspace-metadata.json)
 * - EPUB Settings (SOURCE/settings.json)
 */

import type { FileStorageAPI } from '../storage/index.js';
import type { ExtensionManager } from '../extensions/index.js';
import type {
  GlobalSettings,
  WorkspaceSettings,
  EPUBSettings,
  SettingsValidation,
  TransformOption,
  ISettingsManager
} from './index.js';
import { themeStore } from '../stores/theme.js';
import { setLocale } from '../i18n/index.js';

// Storage key for global settings
const GLOBAL_SETTINGS_KEY = 'editme_global_settings';

// Supported locales
const SUPPORTED_LOCALES = ['en', 'de', 'ar', 'he', 'ja', 'ka', 'zh-hant'];

// Cache for transform options
interface TransformCache {
  workspaceId: string;
  transforms: TransformOption[];
  timestamp: number;
}

export class SettingsManager implements ISettingsManager {
  private fileStorage: FileStorageAPI;
  private extensionManager: ExtensionManager;
  private transformCache: TransformCache | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(fileStorage: FileStorageAPI, extensionManager: ExtensionManager) {
    this.fileStorage = fileStorage;
    this.extensionManager = extensionManager;
  }

  // ============================================================================
  // Global Settings (localStorage)
  // ============================================================================

  loadGlobalSettings(): GlobalSettings {
    try {
      if (typeof localStorage === 'undefined') {
        return this.getDefaultGlobalSettings();
      }

      const stored = localStorage.getItem(GLOBAL_SETTINGS_KEY);
      if (!stored) {
        return this.getDefaultGlobalSettings();
      }

      const parsed = JSON.parse(stored);
      
      // Validate parsed data has expected shape
      if (typeof parsed !== 'object' || !parsed) {
        return this.getDefaultGlobalSettings();
      }

      // Merge with defaults to handle missing fields
      const defaults = this.getDefaultGlobalSettings();
      return {
        theme: this.isValidTheme(parsed.theme) ? parsed.theme : defaults.theme,
        locale: this.isValidLocale(parsed.locale) ? parsed.locale : defaults.locale,
        editor_font_size: this.isValidFontSize(parsed.editor_font_size) ? parsed.editor_font_size : defaults.editor_font_size
      };
    } catch (error) {
      // Return defaults on any error (corrupted data, access denied, etc.)
      return this.getDefaultGlobalSettings();
    }
  }

  saveGlobalSettings(settings: GlobalSettings): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      // Save to localStorage
      localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));

      // Update theme store if theme changed
      const currentSettings = this.loadGlobalSettings();
      if (settings.theme !== currentSettings.theme) {
        if (settings.theme === 'system') {
          themeStore.useSystemPreference();
        } else {
          themeStore.setTheme(settings.theme);
        }
      }

      // Update locale if changed
      if (settings.locale !== currentSettings.locale) {
        setLocale(settings.locale).catch(error => {
          console.error('Failed to set locale:', error);
        });
      }
    } catch (error) {
      // Silently handle quota exceeded or access denied errors
      console.warn('Failed to save global settings:', error);
    }
  }

  getDefaultGlobalSettings(): GlobalSettings {
    return {
      theme: 'system',
      locale: 'en',
      editor_font_size: 14
    };
  }

  // ============================================================================
  // Workspace Settings (.workspace-metadata.json)
  // ============================================================================

  async loadWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
    try {
      const content = await this.fileStorage.readTextFile(workspaceId, '.workspace-metadata.json');
      const metadata = JSON.parse(content);
      
      if (!metadata || typeof metadata !== 'object') {
        return this.getDefaultWorkspaceSettings();
      }

      // Extract settings from metadata structure
      const settings = metadata.settings || {};
      
      // Merge with defaults
      const defaults = this.getDefaultWorkspaceSettings();
      return {
        bust_cache: typeof settings.bust_cache === 'boolean' ? settings.bust_cache : defaults.bust_cache,
        draft_id: this.isValidDraftId(settings.draft_id) ? settings.draft_id : defaults.draft_id,
        editor: settings.editor ? {
          preview_delay_ms: this.isValidPreviewDelay(settings.editor.preview_delay_ms) 
            ? settings.editor.preview_delay_ms 
            : defaults.editor!.preview_delay_ms,
          advanced_mode: typeof settings.editor.advanced_mode === 'boolean' 
            ? settings.editor.advanced_mode 
            : defaults.editor!.advanced_mode
        } : defaults.editor
      };
    } catch (error) {
      // Return defaults on any error (file not found, corrupted JSON, etc.)
      return this.getDefaultWorkspaceSettings();
    }
  }

  async saveWorkspaceSettings(workspaceId: string, settings: WorkspaceSettings): Promise<void> {
    try {
      // Read existing metadata or create new
      let metadata: any = {};
      try {
        const content = await this.fileStorage.readTextFile(workspaceId, '.workspace-metadata.json');
        metadata = JSON.parse(content);
      } catch {
        // File doesn't exist or is corrupted, start fresh
        metadata = {
          version: '1.0',
          created: new Date().toISOString()
        };
      }

      // Update metadata with new settings
      metadata.lastModified = new Date().toISOString();
      metadata.settings = settings;

      // Write back to file
      await this.fileStorage.writeTextFile(
        workspaceId,
        '.workspace-metadata.json',
        JSON.stringify(metadata, null, 2)
      );
    } catch (error) {
      // Re-throw write errors so caller can handle
      throw error;
    }
  }

  getDefaultWorkspaceSettings(): WorkspaceSettings {
    return {
      bust_cache: false,
      draft_id: 0,
      editor: {
        preview_delay_ms: 500,
        advanced_mode: false
      }
    };
  }

  // ============================================================================
  // EPUB Settings (SOURCE/settings.json)
  // ============================================================================

  async loadEPUBSettings(workspaceId: string): Promise<EPUBSettings> {
    try {
      const content = await this.fileStorage.readTextFile(workspaceId, 'SOURCE/settings.json');
      const settings = JSON.parse(content);
      
      if (!settings || typeof settings !== 'object') {
        return this.getDefaultEPUBSettings();
      }

      // Merge with defaults
      const defaults = this.getDefaultEPUBSettings();
      return {
        text_transform: typeof settings.text_transform === 'string' ? settings.text_transform : defaults.text_transform,
        dom_transforms: Array.isArray(settings.dom_transforms) ? settings.dom_transforms : defaults.dom_transforms,
        spine_basename: typeof settings.spine_basename === 'string' ? settings.spine_basename : defaults.spine_basename,
        cover: settings.cover ? {
          template: settings.cover.template || defaults.cover!.template,
          background_color: settings.cover.background_color || defaults.cover!.background_color,
          text_color: settings.cover.text_color || defaults.cover!.text_color,
          font_family: settings.cover.font_family || defaults.cover!.font_family
        } : defaults.cover
      };
    } catch (error) {
      // Return defaults on any error
      return this.getDefaultEPUBSettings();
    }
  }

  async saveEPUBSettings(workspaceId: string, settings: EPUBSettings): Promise<void> {
    await this.fileStorage.writeTextFile(
      workspaceId,
      'SOURCE/settings.json',
      JSON.stringify(settings, null, 2)
    );
  }

  getDefaultEPUBSettings(): EPUBSettings {
    return {
      text_transform: 'SOURCE/scripts/transform.js',
      dom_transforms: [],
      spine_basename: 'chapter',
      cover: {
        template: 'minimal',
        background_color: '#ffffff',
        text_color: '#000000',
        font_family: 'serif'
      }
    };
  }

  // ============================================================================
  // Draft Mode Utilities
  // ============================================================================

  async incrementDraftId(workspaceId: string): Promise<number> {
    const settings = await this.loadWorkspaceSettings(workspaceId);
    const newDraftId = (settings.draft_id || 0) + 1;
    
    settings.draft_id = newDraftId;
    await this.saveWorkspaceSettings(workspaceId, settings);
    
    return newDraftId;
  }

  generateDraftTitle(baseTitle: string, draftId: number): string {
    return `${baseTitle} ${draftId}`;
  }

  extractDraftInfo(title: string): { baseTitle: string; draftId: number | null } {
    const match = title.match(/^(.+)\s+(\d+)$/);
    
    if (match) {
      const baseTitle = match[1];
      const draftId = parseInt(match[2], 10);
      
      if (!isNaN(draftId)) {
        return { baseTitle, draftId };
      }
    }
    
    return { baseTitle: title, draftId: null };
  }

  // ============================================================================
  // Transform Management
  // ============================================================================

  async getAvailableTransforms(workspaceId: string): Promise<TransformOption[]> {
    // Check cache first
    if (this.transformCache && 
        this.transformCache.workspaceId === workspaceId &&
        Date.now() - this.transformCache.timestamp < this.CACHE_TTL) {
      return this.transformCache.transforms;
    }

    const transforms: TransformOption[] = [];

    // Get built-in scripts from SOURCE/scripts/
    try {
      const files = await this.fileStorage.listFiles(workspaceId, 'SOURCE/scripts');
      for (const file of files) {
        if (file.endsWith('.js')) {
          transforms.push({
            path: `SOURCE/scripts/${file}`,
            extensionName: 'built-in',
            fileName: file
          });
        }
      }
    } catch (error) {
      // Directory might not exist, continue
    }

    // Get scripts from extensions
    try {
      const extensions = await this.extensionManager.listWorkspaceExtensions(workspaceId);
      for (const extension of extensions) {
        for (const file of extension.files) {
          if (file.filename.endsWith('.js')) {
            transforms.push({
              path: `SOURCE/extensions/${extension.name}/${file.filename}`,
              extensionName: extension.name,
              fileName: file.filename
            });
          }
        }
      }
    } catch (error) {
      // Extension discovery failed, continue with what we have
    }

    // Update cache
    this.transformCache = {
      workspaceId,
      transforms,
      timestamp: Date.now()
    };

    return transforms;
  }

  async resolveTransformScripts(
    workspaceId: string,
    settings: EPUBSettings
  ): Promise<{
    textTransform: string | null;
    domTransforms: string[];
  }> {
    const result = {
      textTransform: null as string | null,
      domTransforms: [] as string[]
    };

    try {
      // Check text transform
      if (settings.text_transform) {
        const exists = await this.fileStorage.fileExists(workspaceId, settings.text_transform);
        if (exists) {
          result.textTransform = settings.text_transform;
        }
      }

      // Check DOM transforms
      if (Array.isArray(settings.dom_transforms)) {
        for (const transform of settings.dom_transforms) {
          try {
            const exists = await this.fileStorage.fileExists(workspaceId, transform);
            if (exists) {
              result.domTransforms.push(transform);
            }
          } catch {
            // Skip this transform
          }
        }
      }
    } catch (error) {
      // Return empty result on any error
    }

    return result;
  }

  // ============================================================================
  // Validation
  // ============================================================================

  validateGlobalSettings(settings: Partial<GlobalSettings>): SettingsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Handle null/undefined/invalid input
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return {
        isValid: true,
        errors,
        warnings
      };
    }

    if ('theme' in settings && !this.isValidTheme(settings.theme)) {
      errors.push('Theme must be light, dark, or system');
    }

    if ('locale' in settings && !this.isValidLocale(settings.locale)) {
      errors.push(`Locale ${settings.locale} is not supported`);
    }

    if ('editor_font_size' in settings) {
      if (typeof settings.editor_font_size !== 'number') {
        errors.push('Font size must be a number');
      } else if (!Number.isInteger(settings.editor_font_size)) {
        errors.push('Font size must be an integer');
      } else if (!this.isValidFontSize(settings.editor_font_size)) {
        errors.push('Font size must be between 8 and 32 pixels');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateWorkspaceSettings(settings: Partial<WorkspaceSettings>): SettingsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Handle null/undefined/invalid input
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return {
        isValid: true,
        errors,
        warnings
      };
    }

    if ('bust_cache' in settings && typeof settings.bust_cache !== 'boolean') {
      errors.push('Bust cache must be a boolean');
    }

    if ('draft_id' in settings) {
      if (typeof settings.draft_id !== 'number') {
        errors.push('Draft ID must be a number');
      } else if (!Number.isInteger(settings.draft_id)) {
        errors.push('Draft ID must be an integer');
      } else if (!this.isValidDraftId(settings.draft_id)) {
        errors.push('Draft ID must be non-negative');
      }
    }

    if (settings.editor) {
      if ('preview_delay_ms' in settings.editor) {
        if (typeof settings.editor.preview_delay_ms !== 'number') {
          errors.push('Preview delay must be a number');
        } else if (!Number.isInteger(settings.editor.preview_delay_ms)) {
          errors.push('Preview delay must be an integer');
        } else if (!this.isValidPreviewDelay(settings.editor.preview_delay_ms)) {
          errors.push('Preview delay must be between 100-2000ms');
        }
      }

      if ('advanced_mode' in settings.editor && typeof settings.editor.advanced_mode !== 'boolean') {
        errors.push('Advanced mode must be a boolean');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateEPUBSettings(settings: Partial<EPUBSettings>): SettingsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Handle null/undefined/invalid input
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return {
        isValid: true,
        errors,
        warnings
      };
    }

    if ('text_transform' in settings && settings.text_transform !== undefined) {
      if (!this.isValidTransformPath(settings.text_transform)) {
        if (!settings.text_transform.startsWith('SOURCE/')) {
          errors.push('Transform path must start with SOURCE/');
        } else if (!settings.text_transform.endsWith('.js')) {
          errors.push('Transform path must end with .js');
        }
      }
    }

    if ('dom_transforms' in settings && Array.isArray(settings.dom_transforms)) {
      for (const transform of settings.dom_transforms) {
        if (!this.isValidTransformPath(transform)) {
          if (!transform.startsWith('SOURCE/')) {
            errors.push('DOM transform path must start with SOURCE/');
          } else if (!transform.endsWith('.js')) {
            errors.push('DOM transform path must end with .js');
          }
          break; // Only report first error
        }
      }
    }

    if ('spine_basename' in settings) {
      if (!settings.spine_basename) {
        errors.push('Spine basename cannot be empty');
      } else if (!this.isValidBasename(settings.spine_basename)) {
        errors.push('Spine basename contains invalid characters');
      }
    }

    if (settings.cover) {
      if ('template' in settings.cover && !settings.cover.template) {
        errors.push('Cover template cannot be empty');
      }

      if ('background_color' in settings.cover && !this.isValidHexColor(settings.cover.background_color)) {
        errors.push('Background color must be a valid hex color (#RRGGBB)');
      }

      if ('text_color' in settings.cover && !this.isValidHexColor(settings.cover.text_color)) {
        errors.push('Text color must be a valid hex color (#RRGGBB)');
      }

      if ('font_family' in settings.cover && !settings.cover.font_family) {
        errors.push('Font family cannot be empty');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ============================================================================
  // Private Validation Helpers
  // ============================================================================

  private isValidTheme(value: any): value is GlobalSettings['theme'] {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  private isValidLocale(value: any): boolean {
    return typeof value === 'string' && SUPPORTED_LOCALES.includes(value);
  }

  private isValidFontSize(value: any): boolean {
    return typeof value === 'number' && value >= 8 && value <= 32;
  }

  private isValidDraftId(value: any): boolean {
    return typeof value === 'number' && value >= 0;
  }

  private isValidPreviewDelay(value: any): boolean {
    return typeof value === 'number' && value >= 100 && value <= 2000;
  }

  private isValidTransformPath(path: string): boolean {
    return path.startsWith('SOURCE/') && path.endsWith('.js');
  }

  private isValidBasename(basename: string): boolean {
    // Allow alphanumeric, dash, underscore
    return /^[a-zA-Z0-9_-]+$/.test(basename);
  }

  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }
}