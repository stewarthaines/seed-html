/**
 * Transform Script Management
 *
 * Loads and validates transform scripts from the SOURCE/ directory,
 * managing settings and script files for the transformation pipeline.
 */

import type { FileStorageAPI } from '../storage/index.js';
import { TransformError } from './transform-error.js';

export interface TransformSettings {
  transform_pipeline?: {
    text_transform?: string;
    dom_transforms?: string[];
    enabled?: boolean;
    timeout_ms?: number;
  };
  [key: string]: any;
}

export interface TransformScript {
  filename: string;
  content: string;
  size: number;
  lastModified: Date;
}

export interface LoadedTransformScripts {
  settings: TransformSettings;
  textTransform?: TransformScript;
  domTransforms: TransformScript[];
}

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFunctions: string[];
}

/**
 * Manages loading and validation of transform scripts
 */
export class TransformManager {
  constructor(private fileStorage: FileStorageAPI) {}

  /**
   * Load transform settings from SOURCE/settings.json
   */
  async loadTransformSettings(workspaceId: string): Promise<TransformSettings> {
    try {
      const settingsText = await this.fileStorage.readTextFile(workspaceId, 'SOURCE/settings.json');

      if (!settingsText.trim()) {
        return {};
      }

      try {
        return JSON.parse(settingsText);
      } catch (parseError) {
        throw new Error(
          `Invalid JSON in settings file: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('File not found')) {
        return {};
      }

      if (error instanceof Error && error.message.includes('Invalid JSON')) {
        throw error;
      }

      throw new Error(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load all configured transform scripts
   */
  async loadTransformScripts(workspaceId: string): Promise<LoadedTransformScripts> {
    const settings = await this.loadTransformSettings(workspaceId);
    const result: LoadedTransformScripts = {
      settings,
      domTransforms: [],
    };

    // Load text transform script
    if (settings.transform_pipeline?.text_transform) {
      try {
        const content = await this.fileStorage.readTextFile(
          workspaceId,
          `SOURCE/scripts/${settings.transform_pipeline.text_transform}`
        );

        const metadata = await this.fileStorage.getFileInfo(
          workspaceId,
          `SOURCE/scripts/${settings.transform_pipeline.text_transform}`
        );

        result.textTransform = {
          filename: settings.transform_pipeline.text_transform,
          content,
          size: metadata.size,
          lastModified: metadata.lastModified,
        };
      } catch (error) {
        throw new Error(`File not found: ${settings.transform_pipeline.text_transform}`);
      }
    }

    // Load DOM transform scripts in order
    if (settings.transform_pipeline?.dom_transforms) {
      for (const scriptName of settings.transform_pipeline.dom_transforms) {
        try {
          const content = await this.fileStorage.readTextFile(
            workspaceId,
            `SOURCE/scripts/${scriptName}`
          );

          const metadata = await this.fileStorage.getFileInfo(
            workspaceId,
            `SOURCE/scripts/${scriptName}`
          );

          result.domTransforms.push({
            filename: scriptName,
            content,
            size: metadata.size,
            lastModified: metadata.lastModified,
          });
        } catch (error) {
          throw new Error(`File not found: ${scriptName}`);
        }
      }
    }

    return result;
  }

  /**
   * Validate transform script for required functions and syntax
   */
  validateTransformScript(
    scriptContent: string,
    requiredFunctions: string[]
  ): ScriptValidationResult {
    const result: ScriptValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      requiredFunctions,
    };

    // Check for empty content
    if (!scriptContent.trim()) {
      result.isValid = false;
      result.errors.push('Empty script content');
      return result;
    }

    // Check for syntax errors
    try {
      // Try to parse as a function body
      new Function(scriptContent);
    } catch (syntaxError) {
      result.isValid = false;
      result.errors.push(
        `Syntax error: ${syntaxError instanceof Error ? syntaxError.message : 'Unknown syntax error'}`
      );
      return result;
    }

    // Check for required functions
    for (const functionName of requiredFunctions) {
      const functionPattern = new RegExp(`function\\s+${functionName}\\s*\\(`, 'g');
      if (!functionPattern.test(scriptContent)) {
        result.isValid = false;
        result.errors.push(`Missing required function: ${functionName}`);
      }
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/g, warning: 'Use of eval() is potentially dangerous' },
      {
        pattern: /Function\s*\(/g,
        warning: 'Use of Function() constructor is potentially dangerous',
      },
      { pattern: /setTimeout\s*\(/g, warning: 'Use of setTimeout() may affect performance' },
      { pattern: /setInterval\s*\(/g, warning: 'Use of setInterval() may affect performance' },
    ];

    for (const { pattern, warning } of dangerousPatterns) {
      if (pattern.test(scriptContent)) {
        result.warnings.push(warning);
      }
    }

    return result;
  }
}
