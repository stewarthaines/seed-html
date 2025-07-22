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
  private storage = new FileStorageAPI();
  private indexedDbStorage: FileStorageAPI | null = null;

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
    try {
      // Try to get embedded translation data URL from global variable
      let translationsDataUrl = (globalThis as any).__EDITME_I18N_BUNDLE__;
      let response: Response;

      if (!translationsDataUrl) {
        // Development fallback: try to fetch from static directory
        try {
          response = await fetch('/i18n-bundle.zip');
          if (!response.ok) {
            throw new Error(`Failed to fetch i18n-bundle.zip: ${response.status}`);
          }
        } catch (error) {
          throw new Error(
            'Translation data not found. For single file builds, please run "npm run build" to generate a new build with embedded translations.'
          );
        }
      } else {
        // Production: fetch from embedded data URL
        response = await fetch(translationsDataUrl);
        // Clean up memory after reading the data URL
        delete (globalThis as any).__EDITME_I18N_BUNDLE__;
        if (!response.ok) {
          throw new Error(`Failed to fetch translation data: ${response.status}`);
        }
      }

      // Get ZIP data as ArrayBuffer
      const zipArrayBuffer = await response.arrayBuffer();

      // Parse ZIP using our ZIP library
      let zip: Zip;
      try {
        zip = new Zip(zipArrayBuffer);
      } catch (error) {
        console.error('❌ ZIP parsing failed:', error);
        throw new Error(
          `Failed to parse ZIP archive: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }


      // Initialize storage if needed
      if (!this.storage.isInitialized()) {
        await this.storage.init();
      }

      // Ensure workspace exists
      try {
        await this.storage.createWorkspace(LOCALES_WORKSPACE_ID);
      } catch (workspaceError) {
        console.error(`❌ Failed to create workspace ${LOCALES_WORKSPACE_ID}:`, workspaceError);
        throw workspaceError;
      }

      // Extract each JSON file from ZIP
      for (const entry of zip.entries) {
        if (!entry.fileName.endsWith('.json')) {
          continue;
        }

        try {
          // Extract file content as text
          const blob = await entry.extract();
          const content = await blob.text();

          // Validate JSON before writing
          try {
            JSON.parse(content);
          } catch (parseError) {
            console.error(`❌ ${entry.fileName}: Invalid JSON from ZIP:`, parseError);
            throw new Error(
              `Invalid JSON in ${entry.fileName}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
            );
          }

          // Write to storage
          await this.storage.writeTextFile(LOCALES_WORKSPACE_ID, entry.fileName, content);

          // Verification
          try {
            // Add small delay to ensure write completes
            await new Promise(resolve => setTimeout(resolve, 50));

            // First check if file exists
            const fileExists = await this.storage.fileExists(LOCALES_WORKSPACE_ID, entry.fileName);

            if (fileExists) {
              // Retry read with exponential backoff handling
              let readBack = '';
              let attempts = 0;
              const maxAttempts = 3;

              while (attempts < maxAttempts) {
                try {
                  readBack = await this.storage.readTextFile(LOCALES_WORKSPACE_ID, entry.fileName);

                  if (readBack.length > 0) {
                    // Double-check by trying to parse the read-back content
                    try {
                      JSON.parse(readBack);
                      break; // Success, exit retry loop
                    } catch (jsonError) {
                      console.error(`❌ Read-back JSON invalid for ${entry.fileName}:`, jsonError);
                      break; // Don't retry JSON parse errors
                    }
                  } else {
                    attempts++;

                    if (attempts < maxAttempts) {
                      // Exponential backoff: 100ms, 200ms, 400ms
                      await new Promise(resolve =>
                        setTimeout(resolve, 100 * Math.pow(2, attempts - 1))
                      );
                    }
                  }
                } catch (readError) {
                  console.error(
                    `❌ Read attempt ${attempts + 1} failed for ${entry.fileName}:`,
                    readError
                  );
                  attempts++;

                  if (attempts < maxAttempts) {
                    await new Promise(resolve =>
                      setTimeout(resolve, 100 * Math.pow(2, attempts - 1))
                    );
                  }
                }
              }

              if (attempts >= maxAttempts && readBack.length === 0) {
                console.error(`❌ Failed to read ${entry.fileName} after ${maxAttempts} attempts`);
                console.error(`❌ Storage backend: ${this.storage.getBackendType()}`);
              }
            } else {
              console.error(`❌ File ${entry.fileName} does not exist after write!`);
            }
          } catch (error) {
            console.error(`❌ Failed to read back ${entry.fileName}:`, error);
            console.error(`❌ Storage backend type: ${this.storage.getBackendType()}`);
            console.error(`❌ Storage initialized: ${this.storage.isInitialized()}`);
          }
        } catch (extractError) {
          console.error(`❌ Failed to extract ${entry.fileName}:`, extractError);
          throw extractError;
        }
      }

      // After all writes, verify the workspace exists
      try {
        await this.storage.listFiles(LOCALES_WORKSPACE_ID);
      } catch (listError) {
        console.error(`❌ Failed to list workspace contents:`, listError);
        console.error(`❌ Storage backend: ${this.storage.getBackendType()}`);
      }

    } catch (error) {
      console.error('❌ Failed to extract translations:', error);
      throw error;
    }
  }

  /**
   * Load translations from storage
   */
  async loadTranslations(): Promise<Record<string, TranslationCatalog>> {
    try {
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
          try {
            jsonData = JSON.parse(content);
          } catch (parseError) {
            console.error(`❌ ${filePath}: JSON parse failed:`, parseError);
            throw parseError;
          }

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
        } catch (error) {
          console.error(`Failed to load ${filePath}:`, error);
          // Continue with other files
        }
      }

      // Only keep the sample key validation for debugging workspace creation
      if (catalogs.en && !Object.keys(catalogs.en.messages).filter(k => k.startsWith('sample.')).length) {
        console.warn('⚠️ No sample keys found in English catalog - workspace creation may fail');
      }

      return catalogs;
    } catch (error) {
      console.error('❌ Failed to load translations from storage:', error);
      throw error;
    }
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
