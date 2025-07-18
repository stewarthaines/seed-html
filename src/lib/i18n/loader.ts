/**
 * ZIP-based translation loader with storage integration
 */

import type { I18nLoader, TranslationCatalog } from './types.js';
import { FileStorageAPI } from '../storage/index.js';

// Version tracking for cache invalidation
const I18N_VERSION = '1.0.2'; // Update when translation format changes
const VERSION_KEY = 'editme-i18n-version';
const LOCALES_WORKSPACE_ID = 'locales';

/**
 * Create translation loader instance
 */
export function createI18nLoader(): I18nLoader {
  return new TranslationLoader();
}

class TranslationLoader implements I18nLoader {
  private storage = new FileStorageAPI();

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

      // Initialize storage if needed
      if (!this.storage.isInitialized()) {
        await this.storage.init();
      }

      // Check if locale files exist in storage
      const filePaths = await this.storage.listFiles(LOCALES_WORKSPACE_ID);
      const localeFiles = filePaths.filter(path => path.endsWith('.json'));

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
      console.log('📦 Extracting translations from embedded data...');

      // Try to get embedded translation data URL from global variable
      let translationsDataUrl = (globalThis as any).__EDITME_TRANSLATIONS_ZIP__;
      let response: Response;

      if (!translationsDataUrl) {
        // Development fallback: try to fetch from static directory
        console.log('⚠️ No embedded translation data found, trying static file fallback...');
        console.log('This usually means you need to rebuild the single file with: npm run build');
        try {
          response = await fetch('/translations.zip');
          if (!response.ok) {
            throw new Error(`Failed to fetch translations.zip: ${response.status}`);
          }
        } catch (error) {
          throw new Error(
            'Translation data not found. For single file builds, please run "npm run build" to generate a new build with embedded translations.'
          );
        }
      } else {
        // Production: fetch from embedded data URL
        console.log('✅ Found embedded translation data, extracting...');
        response = await fetch(translationsDataUrl);
        // Clean up memory after reading the data URL
        delete (globalThis as any).__EDITME_TRANSLATIONS_ZIP__;
        if (!response.ok) {
          throw new Error(`Failed to fetch translation data: ${response.status}`);
        }
      }

      // Decompress the gzipped JSON
      console.log('📥 Fetched compressed data, size:', response.headers.get('content-length') || 'unknown');
      const compressedData = await response.arrayBuffer();
      console.log('📦 Compressed buffer size:', compressedData.byteLength, 'bytes');
      
      // Debug: Check first few bytes to verify it's gzip format
      const firstBytes = new Uint8Array(compressedData, 0, Math.min(10, compressedData.byteLength));
      const hexString = Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log('🔍 First 10 bytes (hex):', hexString);
      console.log('🔍 Looks like gzip?', firstBytes[0] === 0x1f && firstBytes[1] === 0x8b);
      
      let decompressedData: string;
      try {
        decompressedData = await this.decompressGzip(compressedData);
        console.log('✅ Decompressed data size:', decompressedData.length, 'characters');
      } catch (error) {
        console.error('❌ Decompression failed:', error);
        throw new Error(`Failed to decompress translation data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      let archiveData: Record<string, string>;
      try {
        archiveData = JSON.parse(decompressedData);
        console.log('✅ Parsed JSON archive with', Object.keys(archiveData).length, 'files');
      } catch (error) {
        console.error('❌ JSON parsing failed:', error);
        console.error('First 200 chars of decompressed data:', decompressedData.substring(0, 200));
        throw new Error(`Failed to parse translation archive: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log(`📄 Found ${Object.keys(archiveData).length} translation files`);

      // Initialize storage if needed
      if (!this.storage.isInitialized()) {
        console.log('🔧 Initializing storage manager...');
        await this.storage.init();
      }

      // Ensure workspace exists
      await this.storage.createWorkspace(LOCALES_WORKSPACE_ID);

      // Extract each locale file
      for (const [filename, content] of Object.entries(archiveData)) {
        await this.storage.writeTextFile(LOCALES_WORKSPACE_ID, filename, content as string);

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
    console.log('🔧 Starting decompression...');
    
    // Use browser's DecompressionStream if available
    if ('DecompressionStream' in globalThis) {
      console.log('✅ DecompressionStream available');
      try {
        // Create the decompression stream
        const stream = new DecompressionStream('gzip');
        
        // Convert the compressed data to a stream and pipe it through the decompressor
        const compressedStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(compressedData));
            controller.close();
          }
        });

        console.log('📝 Piping data through decompression stream...');
        
        // Pipe the compressed stream through the decompressor
        const decompressedStream = compressedStream.pipeThrough(stream);
        const reader = decompressedStream.getReader();

        console.log('📖 Reading decompressed chunks...');
        // Read decompressed data
        const chunks: Uint8Array[] = [];
        let done = false;

        try {
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              chunks.push(value);
              console.log(`📦 Read chunk of ${value.length} bytes`);
            }
          }
        } catch (readError) {
          console.error('❌ Stream read failed:', readError);
          throw readError;
        } finally {
          reader.releaseLock();
        }

        console.log(`🔀 Combining ${chunks.length} chunks...`);
        // Combine chunks and decode to string
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        console.log(`📝 Decoding ${totalLength} bytes to text...`);
        const result = new TextDecoder().decode(combined);
        console.log('✅ Decompression complete');
        return result;
      } catch (error) {
        console.error('❌ DecompressionStream failed:', error);
        throw error;
      }
    } else {
      // Fallback: assume it's already decompressed or use a different approach
      console.error('❌ DecompressionStream not available');
      throw new Error('DecompressionStream not available and no fallback implemented');
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
      console.log(`🔍 Debug: Found ${filePaths.length} total files in locales workspace:`, filePaths);
      const localeFiles = filePaths.filter(path => path.endsWith('.json'));
      console.log(`🔍 Debug: Filtered to ${localeFiles.length} JSON files:`, localeFiles);

      console.log(`📚 Loading ${localeFiles.length} translation catalogs...`);

      // Load each catalog
      for (const filePath of localeFiles) {
        try {
          const content = await this.storage.readTextFile(LOCALES_WORKSPACE_ID, filePath);
          const jsonData = JSON.parse(content);

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

      console.log(`✅ Loaded ${Object.keys(catalogs).length} translation catalogs`);
      
      // Debug: check sample content in English catalog
      if (catalogs.en) {
        const sampleKeys = Object.keys(catalogs.en.messages).filter(k => k.startsWith('sample.'));
        console.log(`🔍 Debug: English catalog has ${Object.keys(catalogs.en.messages).length} total keys, ${sampleKeys.length} sample keys`);
        if (sampleKeys.length > 0) {
          console.log(`🔍 Sample keys found: ${sampleKeys.slice(0, 3).join(', ')}...`);
          console.log(`🔍 Sample title: "${catalogs.en.messages['sample.book.title'] || 'MISSING'}"`);
        } else {
          console.log('❌ No sample keys found in English catalog!');
        }
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
