/**
 * Mock translation data for testing
 */

import type { TranslationCatalog } from '../../types.js';

export const mockEnglishCatalog: TranslationCatalog = {
  locale: 'en',
  messages: {
    Save: 'Save',
    Cancel: 'Cancel',
    Delete: 'Delete',
    Edit: 'Edit',
    File: 'File',
    Settings: 'Settings',
    'Found {count} items': 'Found {count} items',
    Workspace: 'Workspace',
  },
  headers: {
    Language: 'en',
    'Content-Type': 'text/plain; charset=UTF-8',
  },
};

export const mockGermanCatalog: TranslationCatalog = {
  locale: 'de',
  messages: {
    Save: 'Speichern',
    Cancel: 'Abbrechen',
    Delete: 'Löschen',
    Edit: 'Bearbeiten',
    File: 'Datei',
    Settings: 'Einstellungen',
    'Found {count} items': '{count} Elemente gefunden',
    Workspace: 'Arbeitsbereich',
  },
  headers: {
    Language: 'de',
    'Content-Type': 'text/plain; charset=UTF-8',
  },
};

export const mockArabicCatalog: TranslationCatalog = {
  locale: 'ar',
  messages: {
    Save: 'حفظ',
    Cancel: 'إلغاء',
    Delete: 'حذف',
    Edit: 'تحرير',
    File: 'ملف',
    Settings: 'الإعدادات',
    'Found {count} items': 'تم العثور على {count} عناصر',
    Workspace: 'مساحة العمل',
  },
  headers: {
    Language: 'ar',
    'Content-Type': 'text/plain; charset=UTF-8',
  },
};

export const mockTranslationCatalogs = {
  en: mockEnglishCatalog,
  de: mockGermanCatalog,
  ar: mockArabicCatalog,
};

/**
 * Create mock po2json format data
 */
export function createMockPo2JsonData(catalog: TranslationCatalog) {
  const po2jsonData: Record<string, any> = {
    '': catalog.headers,
  };

  for (const [key, value] of Object.entries(catalog.messages)) {
    po2jsonData[key] = value;
  }

  return po2jsonData;
}

/**
 * Create mock compressed translation archive
 */
export function createMockTranslationArchive() {
  const archiveData: Record<string, string> = {};

  for (const [locale, catalog] of Object.entries(mockTranslationCatalogs)) {
    const po2jsonData = createMockPo2JsonData(catalog);
    archiveData[`${locale}.json`] = JSON.stringify(po2jsonData);
  }

  return JSON.stringify(archiveData);
}

/**
 * Create mock gzipped data for testing decompression
 */
export function createMockGzipData(): ArrayBuffer {
  // Create simple mock compressed data (not real gzip, but sufficient for testing)
  const mockData = createMockTranslationArchive();
  const encoder = new TextEncoder();
  return encoder.encode(mockData).buffer as ArrayBuffer;
}

/**
 * Create mock data URL for testing
 */
export function createMockDataUrl(): string {
  const mockData = createMockGzipData();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(mockData)));
  return `data:application/gzip;base64,${base64}`;
}

/**
 * Mock localStorage for testing
 */
export class MockLocalStorage {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock DecompressionStream for testing
 */
export class MockDecompressionStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;

  constructor() {
    let controller: ReadableStreamDefaultController<Uint8Array>;

    this.readable = new ReadableStream({
      start(c) {
        controller = c;
      },
    });

    this.writable = new WritableStream({
      write(chunk) {
        // For testing, just pass through the data (simulate decompression)
        controller.enqueue(chunk);
      },
      close() {
        controller.close();
      },
    });
  }
}
