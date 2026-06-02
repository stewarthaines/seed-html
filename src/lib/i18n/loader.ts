/**
 * ZIP-based translation loader with storage integration
 */

import type { I18nLoader, TranslationCatalog } from './types.js';
import { FileStorageAPI } from '../storage/index.js';
import { Zip } from '../zip/index.js';

const LOCALES_WORKSPACE_ID = 'locales';

/**
 * Create translation loader instance
 */
export function createI18nLoader(): I18nLoader {
  return new TranslationLoader();
}

class TranslationLoader implements I18nLoader {
  private storage = FileStorageAPI.getInstance();

  /**
   * Always extract translations from ZIP bundle on startup
   */
  async needsUpdate(): Promise<boolean> {
    // Always extract ZIP on startup - no caching
    return true;
  }

  /**
   * Extract translations from ZIP archive to storage
   */
  async extractTranslations(): Promise<void> {
    // Try to get embedded translation data URL from global variable
    let translationsDataUrl = (globalThis as any).__EDITME_I18N_BUNDLE__;
    let zipArrayBuffer: ArrayBuffer;

    if (!translationsDataUrl) {
      // Development fallback: try to fetch from static directory
      try {
        const response = await fetch('/i18n-bundle.zip');
        if (!response.ok) {
          throw new Error(`Failed to fetch i18n-bundle.zip: ${response.status}`);
        }
        zipArrayBuffer = await response.arrayBuffer();
      } catch {
        throw new Error(
          'Translation data not found. For single file builds, please run "npm run build" to generate a new build with embedded translations.'
        );
      }
    } else {
      // Production: decode base64 directly to avoid data URL fetch issues
      try {
        // Extract base64 data from data URL (format: "data:application/zip;base64,<base64data>")
        const base64Data = translationsDataUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid data URL format: missing base64 data');
        }

        // Decode base64 to binary string using atob()
        const binaryString = atob(base64Data);

        // Convert binary string to Uint8Array
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }

        // Convert to ArrayBuffer
        zipArrayBuffer = uint8Array.buffer;
      } catch (decodeError) {
        throw new Error(
          `Failed to decode embedded translation data: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`
        );
      } finally {
        // Clean up memory after processing the data URL
        delete (globalThis as any).__EDITME_I18N_BUNDLE__;
      }
    }

    // Parse ZIP using our ZIP library
    let zip: Zip;
    try {
      zip = new Zip(zipArrayBuffer);
    } catch (error) {
      throw new Error(
        `Failed to parse ZIP archive: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Initialize storage if needed
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }

    // Ensure workspace exists
    await this.storage.createWorkspace(LOCALES_WORKSPACE_ID);

    // Extract each JSON file from ZIP
    for (const entry of zip.entries) {
      if (!entry.fileName.endsWith('.json')) {
        continue;
      }

      // Extract file content as text
      const blob = await entry.extract();
      const content = await blob.text();

      // Validate JSON before writing
      try {
        JSON.parse(content);
      } catch (parseError) {
        throw new Error(
          `Invalid JSON in ${entry.fileName}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }

      // Write to storage
      await this.storage.writeTextFile(LOCALES_WORKSPACE_ID, entry.fileName, content);
    }
  }

  /**
   * Load translations from storage
   */
  async loadTranslations(): Promise<Record<string, TranslationCatalog>> {
    const catalogs: Record<string, TranslationCatalog> = {};

    // Initialize storage if needed
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }

    // List all JSON files in locales workspace
    const filePaths = await this.storage.listFiles(LOCALES_WORKSPACE_ID);
    const localeFiles = filePaths.filter(path => path.endsWith('.json'));

    // Load each catalog
    for (const filePath of localeFiles) {
      try {
        const content = await this.storage.readTextFile(LOCALES_WORKSPACE_ID, filePath);

        let jsonData;
        jsonData = JSON.parse(content);

        // Extract locale code from filename (e.g., 'en.json' -> 'en')
        const filename = filePath.split('/').pop() || filePath;
        const locale = filename.replace('.json', '');

        // Convert po2json format to our catalog format
        const catalog: TranslationCatalog = {
          locale,
          messages: this.extractMessages(jsonData),
          headers: jsonData[''] || {}, // po2json stores headers under empty key
        };

        catalogs[locale] = catalog;
      } catch {
        // Continue with other files
      }
    }

    return catalogs;
  }

  /**
   * Extract message strings from po2json output
   */
  private extractMessages(jsonData: any): Record<string, string> {
    const messages: Record<string, string> = {};

    for (const [key, value] of Object.entries(jsonData)) {
      // Skip empty key (contains headers)
      if (key === '') continue;

      // po2json can return arrays for plurals, we'll take the first form for now
      const translation = Array.isArray(value) ? value[0] : value;

      if (typeof translation === 'string') {
        messages[key] = translation;
      }
    }

    return messages;
  }
}
