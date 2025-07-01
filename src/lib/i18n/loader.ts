/**
 * ZIP-based translation loader with storage integration
 */

import type { I18nLoader, TranslationCatalog } from './types.js';
import { getFileStorage } from '../storage/index.js';
import { ZipReader } from '../zip/index.js';

// Version tracking for cache invalidation
const I18N_VERSION = '1.0.0'; // Update when translation format changes
const VERSION_KEY = 'editme-i18n-version';
const LOCALES_WORKSPACE_ID = 'locales';

/**
 * Create translation loader instance
 */
export function createI18nLoader(): I18nLoader {
  return new TranslationLoader();
}

class TranslationLoader implements I18nLoader {
  private storage = getFileStorage();
  
  /**
   * Check if translations need to be re-extracted
   */
  async needsUpdate(): Promise<boolean> {
    try {
      // Check stored version
      const storedVersion = localStorage.getItem(VERSION_KEY);
      if (storedVersion !== I18N_VERSION) {
        return true;
      }
      
      // Check if locale files exist in storage
      const files = await this.storage.listFiles(LOCALES_WORKSPACE_ID);
      const localeFiles = files.filter(file => file.name.endsWith('.json'));
      
      // We expect 7 locale files
      if (localeFiles.length < 7) {
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.warn('Error checking translation update status:', error);
      return true; // Assume update needed on error
    }
  }
  
  /**
   * Extract translations from compressed archive to storage
   */
  async extractTranslations(): Promise<void> {
    try {
      console.log('📦 Extracting translations from compressed archive...');
      
      // Fetch translations.zip from static assets
      const response = await fetch('/translations.zip');
      if (!response.ok) {
        throw new Error(`Failed to fetch translations.zip: ${response.status}`);
      }
      
      // Decompress the gzipped JSON
      const compressedData = await response.arrayBuffer();
      const decompressedData = await this.decompressGzip(compressedData);
      const archiveData = JSON.parse(decompressedData);
      
      console.log(`📄 Found ${Object.keys(archiveData).length} translation files`);
      
      // Ensure workspace exists
      await this.storage.createWorkspace(LOCALES_WORKSPACE_ID);
      
      // Extract each locale file
      for (const [filename, content] of Object.entries(archiveData)) {
        await this.storage.writeFile(
          LOCALES_WORKSPACE_ID,
          filename,
          content as string
        );
        
        console.log(`✅ Extracted ${filename}`);
      }
      
      // Update version marker
      localStorage.setItem(VERSION_KEY, I18N_VERSION);
      
      console.log('🎉 Translation extraction complete');
      
    } catch (error) {
      console.error('❌ Failed to extract translations:', error);
      throw error;
    }
  }
  
  /**
   * Decompress gzipped data in browser
   */
  private async decompressGzip(compressedData: ArrayBuffer): Promise<string> {
    // Use browser's DecompressionStream if available
    if ('DecompressionStream' in window) {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      // Write compressed data
      await writer.write(new Uint8Array(compressedData));
      await writer.close();
      
      // Read decompressed data
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      // Combine chunks and decode to string
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      return new TextDecoder().decode(combined);
    } else {
      // Fallback: assume it's already decompressed or use a different approach
      throw new Error('DecompressionStream not available and no fallback implemented');
    }
  }
  
  /**
   * Load translations from storage
   */
  async loadTranslations(): Promise<Record<string, TranslationCatalog>> {
    try {
      const catalogs: Record<string, TranslationCatalog> = {};
      
      // List all JSON files in locales workspace
      const files = await this.storage.listFiles(LOCALES_WORKSPACE_ID);
      const localeFiles = files.filter(file => file.name.endsWith('.json'));
      
      console.log(`📚 Loading ${localeFiles.length} translation catalogs...`);
      
      // Load each catalog
      for (const file of localeFiles) {
        try {
          const content = await this.storage.readFile(LOCALES_WORKSPACE_ID, file.name);
          const jsonData = JSON.parse(content);
          
          // Extract locale code from filename (e.g., 'en.json' -> 'en')
          const locale = file.name.replace('.json', '');
          
          // Convert po2json format to our catalog format
          const catalog: TranslationCatalog = {
            locale,
            messages: this.extractMessages(jsonData),
            headers: jsonData[''] || {} // po2json stores headers under empty key
          };
          
          catalogs[locale] = catalog;
          
        } catch (error) {
          console.error(`Failed to load ${file.name}:`, error);
          // Continue with other files
        }
      }
      
      console.log(`✅ Loaded ${Object.keys(catalogs).length} translation catalogs`);
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