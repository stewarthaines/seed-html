/**
 * SettingsService - Clean Service Architecture Implementation
 *
 * Manages application settings across three storage tiers following
 * the clean service architecture with single responsibility principle.
 */

import type { FileStorageAPI } from '../../storage/index.js';
import { DEFAULT_FILENAME_TEMPLATE } from '../../epub/opf-utils.js';
import { resolveTransformPath } from '../../settings/dom-transforms.js';

// Service-specific types
export interface GlobalSettings {
  theme: 'light' | 'dark' | 'system';
  locale: string;
  editor_font_size: number; // 8-32 pixels
  /** Ids of plugins the user has enabled (global scope). */
  enabled_plugins: string[];
}

export interface WorkspaceSettings {
  bust_cache: boolean;
  draft_id: number;
  editor?: {
    preview_delay_ms: number; // 100-2000ms
  };
}

/**
 * Minimal print/PDF page settings exposed to novice users (the PDF export and the
 * print preview read these). Overridable by the book's own @page CSS. `page_size`
 * is a CSS `@page size` token (e.g. 'A4', 'A5', 'letter', 'legal').
 */
export interface PrintSettings {
  page_size: string;
  margin: 'narrow' | 'normal' | 'wide';
  /**
   * Advanced mode: free-form CSS `@page size` value (e.g. '140mm 216mm') passed
   * through verbatim to Paged.js. When set (non-empty) it overrides `page_size`,
   * which is preserved so switching back to a preset round-trips.
   */
  custom_size?: string;
  /**
   * Advanced mode: free-form CSS `margin` value (e.g. '20mm 15mm 25mm 15mm')
   * passed through verbatim to Paged.js. When set (non-empty) it overrides the
   * `margin` preset, which is preserved for round-tripping.
   */
  custom_margin?: string;
  page_numbers: boolean;
  /** Print the chapter title as a running header at the top of each page. */
  running_header?: boolean;
  /** Prepend the project's cover image as a full-bleed first page of the PDF. */
  cover_page: boolean;
}

/**
 * The three preview "types" the preview pane renders. Several device presets map to
 * `device` (phone/tablet/e-ink); the responsive "Fill" preset is `responsive`; the
 * Paged.js print preview is `pdf`.
 */
export type PreviewType = 'responsive' | 'device' | 'pdf';

/**
 * Authoring-time preview settings (preview pane only — these never affect the
 * packaged EPUB or any exported file).
 *
 * - `autoUpdate`: per-type, whether the preview re-renders live on every edit. When
 *   off, the author refreshes on demand (the preview shows a stale → Refresh badge).
 * - `head`: workspace-relative path to an XHTML fragment (default
 *   `preview/head.xml`, i.e. `SOURCE/preview/head.xml`) whose inline `<style>`/
 *   `<script>` is injected into the preview `<head>` for authoring-time feedback.
 * - `includeHead`: per-type, whether to inject the `head` fragment for that preview.
 */
export interface PreviewSettings {
  autoUpdate: Record<PreviewType, boolean>;
  head: string;
  includeHead: Record<PreviewType, boolean>;
}

/**
 * Default preview settings. Reproduces the historical hard-coded behaviour: the
 * Responsive and Device previews auto-update; the PDF preview does not.
 */
export const DEFAULT_PREVIEW: PreviewSettings = {
  autoUpdate: { responsive: true, device: true, pdf: false },
  head: 'preview/head.xml',
  includeHead: { responsive: true, device: false, pdf: false },
};

/**
 * Map a preview device preset's `category` to its preview type. Responsive "Fill"
 * is `responsive`, the Paged.js print preview is `pdf`, and every other category
 * (commute / home / travel) is a `device`.
 */
export function previewTypeForDevice(category: string): PreviewType {
  if (category === 'responsive') return 'responsive';
  if (category === 'print') return 'pdf';
  return 'device';
}

export interface EPUBSettings {
  text_transform: string;
  dom_transforms: string[];
  spine_basename: string;
  audio_clip_template?: string;
  /** Template for the packaged .epub filename. Placeholders: <title>, <author>, <date>. */
  filename_template?: string;
  /** Embed the editor (SEED.html) into the packaged EPUB as a non-manifest payload,
      making it self-editing. */
  include_seed_html_in_package?: boolean;
  cover?: {
    template?: string;
    background_color?: string;
    text_color?: string;
    font_family?: string;
    /** Persisted hue (0–359) for the generated cover — the slider value. Once set,
        the cover colour sticks to this rather than being re-derived from the title. */
    hue?: number;
    /** Persisted light/dark choice for the generated cover. */
    mode?: 'dark' | 'light';
    /** Title/author the cover was last generated with — a snapshot used to detect when
        the metadata has drifted from the saved cover (drives the live before/after). */
    title?: string;
    author?: string;
  };
  print?: PrintSettings;
  /** Authoring-time preview settings (preview pane only; never in the packaged EPUB). */
  preview?: PreviewSettings;
  /** Track-changes / review mode. When on, the project is locked to editing existing
      content (no structural or metadata changes) and edits are captured against a base
      snapshot under SOURCE/main. Travels with the EPUB so recipients inherit review mode. */
  track_changes?: boolean;
}

export interface SettingsValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TransformOption {
  path: string;
  extensionName: string;
  fileName: string;
}

// Service error types
export class SettingsServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'SettingsServiceError';
  }
}

// Mock interfaces for dependencies
interface ThemeStore {
  setTheme: (theme: 'light' | 'dark') => void;
  useSystemPreference: () => void;
  getCurrentTheme: () => string;
}

interface I18nStore {
  setLocale: (locale: string) => void;
  getCurrentLocale: () => string;
}

interface ExtensionManager {
  getAvailableTransforms: (workspaceId: string) => Promise<TransformOption[]>;
  getAvailableTextTransforms: (workspaceId: string) => Promise<TransformOption[]>;
  readTransformScript?: (workspaceId: string, path: string) => Promise<string>;
}

/**
 * SettingsService - Single responsibility for settings management across three tiers
 */
export class SettingsService {
  private static readonly GLOBAL_SETTINGS_KEY = 'editme_global_settings';
  private static readonly SUPPORTED_LOCALES = new Set([
    'en',
    'de',
    'ar',
    'he',
    'ja',
    'ka',
    'zh-hant',
    'fr',
    'es',
    'it',
    'pt',
    'ru',
    'pl',
    'nl',
    'sv',
  ]);
  private static readonly VALID_THEMES = new Set(['light', 'dark', 'system']);

  constructor(
    private fileStorage: FileStorageAPI,
    private extensionManager: ExtensionManager,
    private themeStore: ThemeStore,
    private i18nStore: I18nStore
  ) {}

  // ============================================================================
  // Global Settings (localStorage)
  // ============================================================================

  /**
   * Load global settings from localStorage
   */
  loadGlobalSettings(): GlobalSettings {
    try {
      if (typeof localStorage === 'undefined') {
        return this.getDefaultGlobalSettings();
      }

      const stored = localStorage.getItem(SettingsService.GLOBAL_SETTINGS_KEY);
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
        editor_font_size: this.isValidFontSize(parsed.editor_font_size)
          ? parsed.editor_font_size
          : defaults.editor_font_size,
        enabled_plugins: Array.isArray(parsed.enabled_plugins)
          ? parsed.enabled_plugins.filter((id: unknown) => typeof id === 'string')
          : defaults.enabled_plugins,
      };
    } catch {
      // Return defaults on any error (corrupted data, access denied, etc.)
      return this.getDefaultGlobalSettings();
    }
  }

  /**
   * Save global settings to localStorage and update stores
   */
  saveGlobalSettings(settings: GlobalSettings): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      // Save to localStorage
      localStorage.setItem(SettingsService.GLOBAL_SETTINGS_KEY, JSON.stringify(settings));

      // Update theme store
      if (settings.theme === 'system') {
        this.themeStore.useSystemPreference();
      } else {
        this.themeStore.setTheme(settings.theme);
      }

      // Update i18n store
      this.i18nStore.setLocale(settings.locale);
    } catch (error) {
      throw new SettingsServiceError(
        `Failed to save global settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GLOBAL_SETTINGS_SAVE_ERROR'
      );
    }
  }

  /**
   * Get default global settings
   */
  getDefaultGlobalSettings(): GlobalSettings {
    return {
      theme: 'system',
      locale: 'en',
      editor_font_size: 14,
      enabled_plugins: [],
    };
  }

  /** Ids of plugins the user has enabled (global scope). */
  getEnabledPlugins(): string[] {
    return this.loadGlobalSettings().enabled_plugins;
  }

  /** Enable or disable a plugin by id, persisting the global setting. */
  setPluginEnabled(id: string, enabled: boolean): void {
    const settings = this.loadGlobalSettings();
    const ids = new Set(settings.enabled_plugins);
    if (enabled) {
      ids.add(id);
    } else {
      ids.delete(id);
    }
    this.saveGlobalSettings({ ...settings, enabled_plugins: [...ids] });
  }

  // ============================================================================
  // Workspace Settings (.workspace-metadata.json)
  // ============================================================================

  /**
   * Load workspace settings from metadata file
   */
  async loadWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
    try {
      const metadataContent = await this.fileStorage.readTextFile(
        workspaceId,
        '.workspace-metadata.json'
      );
      const metadata = JSON.parse(metadataContent);

      // Extract settings from metadata, use defaults for missing fields
      const defaults = this.getDefaultWorkspaceSettings();
      return {
        bust_cache: metadata.bust_cache ?? defaults.bust_cache,
        draft_id: metadata.draft_id ?? defaults.draft_id,
        editor: {
          preview_delay_ms: metadata.editor?.preview_delay_ms ?? defaults.editor!.preview_delay_ms,
        },
      };
    } catch {
      // Return defaults when file doesn't exist or is corrupted
      return this.getDefaultWorkspaceSettings();
    }
  }

  /**
   * Save workspace settings to metadata file
   */
  async saveWorkspaceSettings(workspaceId: string, settings: WorkspaceSettings): Promise<void> {
    try {
      // Read existing metadata to preserve other fields
      let existingMetadata = {};
      try {
        const existingContent = await this.fileStorage.readTextFile(
          workspaceId,
          '.workspace-metadata.json'
        );
        existingMetadata = JSON.parse(existingContent);
      } catch {
        // File doesn't exist, use empty object
      }

      // Merge settings with existing metadata
      const updatedMetadata = {
        ...existingMetadata,
        bust_cache: settings.bust_cache,
        draft_id: settings.draft_id,
        editor: settings.editor,
      };

      await this.fileStorage.writeTextFile(
        workspaceId,
        '.workspace-metadata.json',
        JSON.stringify(updatedMetadata, null, 2)
      );
    } catch (error) {
      throw new SettingsServiceError(
        `Failed to save workspace settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WORKSPACE_SETTINGS_SAVE_ERROR'
      );
    }
  }

  /**
   * Get default workspace settings
   */
  getDefaultWorkspaceSettings(): WorkspaceSettings {
    return {
      bust_cache: false,
      draft_id: 0,
      editor: {
        preview_delay_ms: 500,
      },
    };
  }

  // ============================================================================
  // EPUB Settings (SOURCE/settings.json)
  // ============================================================================

  /**
   * Load EPUB settings from SOURCE/settings.json
   */
  async loadEPUBSettings(workspaceId: string): Promise<EPUBSettings> {
    try {
      const settingsContent = await this.fileStorage.readTextFile(
        workspaceId,
        'SOURCE/settings.json'
      );
      const settings = JSON.parse(settingsContent);

      // Merge with defaults for missing fields. Transform paths are canonicalized
      // to full SOURCE/… paths (bare filenames are assumed under SOURCE/scripts/)
      // so the editor, settings UI, validation and pipeline all agree.
      const defaults = this.getDefaultEPUBSettings();
      return {
        text_transform: resolveTransformPath(settings.text_transform ?? defaults.text_transform),
        dom_transforms: (settings.dom_transforms ?? defaults.dom_transforms).map(
          resolveTransformPath
        ),
        spine_basename: settings.spine_basename ?? defaults.spine_basename,
        audio_clip_template: settings.audio_clip_template ?? defaults.audio_clip_template,
        filename_template: settings.filename_template ?? defaults.filename_template,
        include_seed_html_in_package:
          settings.include_seed_html_in_package ?? defaults.include_seed_html_in_package,
        track_changes: settings.track_changes ?? defaults.track_changes,
        // Pass the cover block through as-is (carrying hue/mode and any legacy
        // fields) — we no longer fabricate vestigial template/colour defaults.
        cover: settings.cover ? { ...settings.cover } : undefined,
        print: settings.print
          ? {
              page_size: settings.print.page_size ?? 'A4',
              margin: settings.print.margin ?? 'normal',
              custom_size: settings.print.custom_size || undefined,
              custom_margin: settings.print.custom_margin || undefined,
              page_numbers: settings.print.page_numbers ?? true,
              running_header: settings.print.running_header ?? false,
              cover_page: settings.print.cover_page ?? true,
            }
          : undefined,
        // Always return a populated `preview` (defaults filled per-field) so the
        // preview pane and settings UI needn't null-check.
        preview: {
          autoUpdate: {
            responsive:
              settings.preview?.autoUpdate?.responsive ?? DEFAULT_PREVIEW.autoUpdate.responsive,
            device: settings.preview?.autoUpdate?.device ?? DEFAULT_PREVIEW.autoUpdate.device,
            pdf: settings.preview?.autoUpdate?.pdf ?? DEFAULT_PREVIEW.autoUpdate.pdf,
          },
          head: settings.preview?.head ?? DEFAULT_PREVIEW.head,
          includeHead: {
            responsive:
              settings.preview?.includeHead?.responsive ?? DEFAULT_PREVIEW.includeHead.responsive,
            device: settings.preview?.includeHead?.device ?? DEFAULT_PREVIEW.includeHead.device,
            pdf: settings.preview?.includeHead?.pdf ?? DEFAULT_PREVIEW.includeHead.pdf,
          },
        },
      };
    } catch {
      // Return defaults when file doesn't exist or is corrupted
      return this.getDefaultEPUBSettings();
    }
  }

  /**
   * Save EPUB settings to SOURCE/settings.json
   */
  async saveEPUBSettings(workspaceId: string, settings: EPUBSettings): Promise<void> {
    try {
      await this.fileStorage.writeTextFile(
        workspaceId,
        'SOURCE/settings.json',
        JSON.stringify(settings, null, 2)
      );
    } catch (error) {
      throw new SettingsServiceError(
        `Failed to save EPUB settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EPUB_SETTINGS_SAVE_ERROR'
      );
    }
  }

  /**
   * Get default EPUB settings
   */
  getDefaultEPUBSettings(): EPUBSettings {
    return {
      text_transform: 'SOURCE/scripts/transformText.js',
      dom_transforms: ['SOURCE/scripts/transformDom.js'],
      spine_basename: 'chapter',
      audio_clip_template: ':clip[<label>]{src=<href> begin=<begin> end=<end>}',
      filename_template: DEFAULT_FILENAME_TEMPLATE,
      include_seed_html_in_package: false,
      track_changes: false,
      preview: DEFAULT_PREVIEW,
    };
  }

  // ============================================================================
  // Draft Mode Utilities
  // ============================================================================

  /**
   * Increment draft ID and save
   */
  async incrementDraftId(workspaceId: string): Promise<number> {
    const settings = await this.loadWorkspaceSettings(workspaceId);
    const newDraftId = settings.draft_id + 1;

    await this.saveWorkspaceSettings(workspaceId, {
      ...settings,
      draft_id: newDraftId,
    });

    return newDraftId;
  }

  /**
   * Generate draft title from base title and draft ID
   */
  generateDraftTitle(baseTitle: string, draftId: number): string {
    return `${baseTitle} (Draft ${draftId})`;
  }

  /**
   * Extract draft information from title
   */
  extractDraftInfo(title: string): { baseTitle: string; draftId: number | null } {
    const draftMatch = title.match(/^(.+?)\s+\(Draft\s+(\d+)\)$/);

    if (draftMatch) {
      return {
        baseTitle: draftMatch[1],
        draftId: parseInt(draftMatch[2], 10),
      };
    }

    return {
      baseTitle: title,
      draftId: null,
    };
  }

  // ============================================================================
  // Transform Management
  // ============================================================================

  /**
   * Get available transform scripts
   */
  async getAvailableTransforms(workspaceId: string): Promise<TransformOption[]> {
    try {
      return await this.extensionManager.getAvailableTransforms(workspaceId);
    } catch (error) {
      throw new SettingsServiceError(
        `Failed to get available transforms: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFORM_DISCOVERY_ERROR'
      );
    }
  }

  /**
   * Get available text-transform scripts (the single text_transform slot).
   */
  async getAvailableTextTransforms(workspaceId: string): Promise<TransformOption[]> {
    try {
      return await this.extensionManager.getAvailableTextTransforms(workspaceId);
    } catch (error) {
      throw new SettingsServiceError(
        `Failed to get available text transforms: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFORM_DISCOVERY_ERROR'
      );
    }
  }

  /**
   * Resolve transform scripts to their content
   */
  async resolveTransformScripts(
    workspaceId: string,
    settings: EPUBSettings
  ): Promise<{
    textTransform: string | null;
    domTransforms: string[];
  }> {
    try {
      let textTransform: string | null = null;
      const domTransforms: string[] = [];

      // Load text transform
      if (settings.text_transform) {
        try {
          textTransform = await this.fileStorage.readTextFile(workspaceId, settings.text_transform);
        } catch {
          // Transform file doesn't exist, use null
        }
      }

      // Load DOM transforms
      for (const transformPath of settings.dom_transforms) {
        try {
          const transformContent = await this.fileStorage.readTextFile(workspaceId, transformPath);
          domTransforms.push(transformContent);
        } catch {
          // Transform file doesn't exist, skip it
        }
      }

      return {
        textTransform,
        domTransforms,
      };
    } catch (error) {
      throw new SettingsServiceError(
        `Failed to resolve transform scripts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRANSFORM_RESOLUTION_ERROR'
      );
    }
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate global settings
   */
  validateGlobalSettings(settings: Partial<GlobalSettings>): SettingsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate theme
    if (settings.theme !== undefined && !this.isValidTheme(settings.theme)) {
      errors.push(`Invalid theme: ${settings.theme}`);
    }

    // Validate locale
    if (settings.locale !== undefined && !this.isValidLocale(settings.locale)) {
      warnings.push(`Unsupported locale: ${settings.locale}`);
    }

    // Validate font size
    if (
      settings.editor_font_size !== undefined &&
      !this.isValidFontSize(settings.editor_font_size)
    ) {
      errors.push(`Font size must be between 8-32 pixels`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate workspace settings
   */
  validateWorkspaceSettings(settings: Partial<WorkspaceSettings>): SettingsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate draft ID
    if (
      settings.draft_id !== undefined &&
      (settings.draft_id < 0 || !Number.isInteger(settings.draft_id))
    ) {
      errors.push('Draft ID must be a non-negative integer');
    }

    // Validate editor settings
    if (settings.editor) {
      const { preview_delay_ms } = settings.editor;
      if (preview_delay_ms !== undefined) {
        if (preview_delay_ms < 100 || preview_delay_ms > 2000) {
          errors.push('Preview delay must be between 100-2000ms');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate EPUB settings
   */
  validateEPUBSettings(settings: Partial<EPUBSettings>): SettingsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate text transform path
    if (settings.text_transform !== undefined && settings.text_transform) {
      if (!settings.text_transform.startsWith('SOURCE/')) {
        errors.push('Text transform must start with SOURCE/');
      }
    }

    // Validate DOM transforms
    if (settings.dom_transforms !== undefined) {
      for (const transform of settings.dom_transforms) {
        if (!transform.startsWith('SOURCE/')) {
          errors.push(`DOM transform must start with SOURCE/: ${transform}`);
        }
      }
    }

    // Validate spine basename
    if (settings.spine_basename !== undefined && !settings.spine_basename.trim()) {
      errors.push('Spine basename cannot be empty');
    }

    // Validate audio clip template
    if (settings.audio_clip_template !== undefined && settings.audio_clip_template) {
      const template = settings.audio_clip_template;
      const requiredPlaceholders = ['<href>', '<begin>', '<end>'];
      const missingPlaceholders = requiredPlaceholders.filter(
        placeholder => !template.includes(placeholder)
      );

      if (missingPlaceholders.length > 0) {
        errors.push(
          `Audio clip template missing required placeholders: ${missingPlaceholders.join(', ')}`
        );
      }
    }

    // Validate filename template
    if (settings.filename_template !== undefined) {
      const template = settings.filename_template;
      if (!template.trim()) {
        errors.push('Filename template cannot be empty');
      } else if (!/<(title|author|date)>/.test(template)) {
        warnings.push(
          'Filename template has no <title>, <author> or <date> placeholder; every export will share the same filename'
        );
      }
    }

    // Validate cover settings
    if (settings.cover) {
      const { background_color, text_color, hue, mode } = settings.cover;

      if (background_color && !this.isValidColor(background_color)) {
        errors.push('Invalid background color format');
      }

      if (text_color && !this.isValidColor(text_color)) {
        errors.push('Invalid text color format');
      }

      if (hue !== undefined && (typeof hue !== 'number' || !Number.isFinite(hue) || hue < 0 || hue > 359)) {
        errors.push('Cover hue must be a number between 0 and 359');
      }

      if (mode !== undefined && mode !== 'dark' && mode !== 'light') {
        errors.push("Cover mode must be 'dark' or 'light'");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Private helper methods

  private isValidTheme(value: any): value is 'light' | 'dark' | 'system' {
    return SettingsService.VALID_THEMES.has(value);
  }

  private isValidLocale(value: any): boolean {
    return typeof value === 'string' && value.length > 0;
  }

  private isValidFontSize(value: any): boolean {
    return typeof value === 'number' && value >= 8 && value <= 32 && Number.isInteger(value);
  }

  private isValidColor(value: string): boolean {
    // Simple hex color validation
    return /^#[0-9A-Fa-f]{6}$/.test(value);
  }
}
