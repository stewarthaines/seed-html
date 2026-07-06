/**
 * ZIP-based translation loader with storage integration
 */

import type { I18nLoader, TranslationCatalog, LocalesManifest } from './types.js';
import { FileStorageAPI } from '../storage/index.js';
import { Zip } from '../zip/index.js';

const LOCALES_WORKSPACE_ID = 'locales';

/**
 * Workspace file persisting the last fetched locales manifest. Dot-prefixed so
 * listCachedLocales never mistakes it for a catalog.
 */
const MANIFEST_CACHE_FILE = '.manifest.json';

/**
 * Create translation loader instance
 */
export function createI18nLoader(): I18nLoader {
  return new TranslationLoader();
}

class TranslationLoader implements I18nLoader {
  private storage = FileStorageAPI.getInstance();

  /**
   * Extract the embedded ZIP bundle into the locales workspace. Only ever WRITES
   * catalogs — never deletes — so catalogs cached from other sources survive.
   * Builds without embedded catalogs (global null/absent) return [] untouched.
   */
  async extractEmbeddedBundle(): Promise<string[]> {
    const translationsDataUrl = (globalThis as any).__EDITME_I18N_BUNDLE__;
    if (typeof translationsDataUrl !== 'string' || translationsDataUrl === '') {
      return [];
    }

    let zipArrayBuffer: ArrayBuffer;
    // Decode base64 directly rather than fetching the data URL — fetch of data:
    // URLs is unreliable on file:// (the single-file deployment target).
    try {
      // Data URL format: "data:application/zip;base64,<base64data>"
      const base64Data = translationsDataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid data URL format: missing base64 data');
      }

      const binaryString = atob(base64Data);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      zipArrayBuffer = uint8Array.buffer;
    } catch (decodeError) {
      throw new Error(
        `Failed to decode embedded translation data: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`
      );
    } finally {
      // Clean up memory after processing the data URL
      delete (globalThis as any).__EDITME_I18N_BUNDLE__;
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
    const locales: string[] = [];
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
      locales.push(entry.fileName.replace(/\.json$/, ''));
    }

    return locales;
  }

  /**
   * Locale codes with a catalog cached in the locales workspace
   */
  async listCachedLocales(): Promise<string[]> {
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }

    try {
      const filePaths = await this.storage.listFiles(LOCALES_WORKSPACE_ID);
      return filePaths
        .filter(path => path.endsWith('.json'))
        .map(path => (path.split('/').pop() || path).replace(/\.json$/, ''))
        .filter(locale => !locale.startsWith('.'));
    } catch {
      // Workspace doesn't exist yet — nothing cached
      return [];
    }
  }

  /**
   * Load a single cached catalog, or null if absent/unreadable
   */
  async loadCatalog(locale: string): Promise<TranslationCatalog | null> {
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }

    try {
      const content = await this.storage.readTextFile(LOCALES_WORKSPACE_ID, `${locale}.json`);
      const jsonData = JSON.parse(content);

      // Convert po2json format to our catalog format
      return {
        locale,
        messages: this.extractMessages(jsonData),
        headers: jsonData[''] || {}, // po2json stores headers under empty key
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate and cache a fetched catalog (raw po2json text) into storage
   */
  async cacheCatalog(locale: string, jsonText: string): Promise<void> {
    // Validate JSON before writing — a broken download must not poison the cache
    JSON.parse(jsonText);

    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }
    await this.storage.createWorkspace(LOCALES_WORKSPACE_ID);
    await this.storage.writeTextFile(LOCALES_WORKSPACE_ID, `${locale}.json`, jsonText);
  }

  /**
   * Remove a cached catalog (e.g. it went stale against a fresh manifest)
   */
  async removeCatalog(locale: string): Promise<void> {
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }
    try {
      await this.storage.deleteFile(LOCALES_WORKSPACE_ID, `${locale}.json`);
    } catch {
      // Already absent — nothing to remove
    }
  }

  /**
   * The locales manifest persisted from the last successful fetch, if any
   */
  async getCachedManifest(): Promise<LocalesManifest | null> {
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }
    try {
      const content = await this.storage.readTextFile(LOCALES_WORKSPACE_ID, MANIFEST_CACHE_FILE);
      const manifest = JSON.parse(content);
      return manifest && Array.isArray(manifest.locales) ? manifest : null;
    } catch {
      return null;
    }
  }

  /**
   * Persist the fetched locales manifest for hash comparison on later startups
   */
  async saveManifest(manifest: LocalesManifest): Promise<void> {
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }
    await this.storage.createWorkspace(LOCALES_WORKSPACE_ID);
    await this.storage.writeTextFile(
      LOCALES_WORKSPACE_ID,
      MANIFEST_CACHE_FILE,
      JSON.stringify(manifest)
    );
  }

  /**
   * Load all storage-cached translation catalogs
   */
  async loadTranslations(): Promise<Record<string, TranslationCatalog>> {
    const catalogs: Record<string, TranslationCatalog> = {};

    for (const locale of await this.listCachedLocales()) {
      const catalog = await this.loadCatalog(locale);
      if (catalog) {
        catalogs[locale] = catalog;
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
