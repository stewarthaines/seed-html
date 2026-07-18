import { randomUUID } from '../utils/uuid.js';

/**
 * MetadataUtils - Utility functions for EPUB metadata
 *
 * Provides static utility methods for generating identifiers, dates,
 * and accessing language/accessibility options.
 */

export interface LanguageOption {
  code: string;
  name: string;
}

export interface AccessibilityOptions {
  accessModes: string[];
  accessibilityFeatures: string[];
  accessibilityHazards: string[];
}

export class MetadataUtils {
  /**
   * Generate a unique identifier in URN UUID format
   */
  static generateIdentifier(): string {
    const uuid = randomUUID();
    return `urn:uuid:${uuid}`;
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  static getCurrentDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Get available language options
   */
  static getLanguageOptions(): LanguageOption[] {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'he', name: 'Hebrew' },
      { code: 'ka', name: 'Georgian' },
      { code: 'zh-TW', name: 'Chinese Traditional' },
    ];
  }

  /**
   * Get accessibility metadata options
   */
  static getAccessibilityOptions(): AccessibilityOptions {
    return {
      accessModes: ['textual', 'visual', 'auditory', 'tactile'],
      accessibilityFeatures: [
        'alternativeText',
        'audioDescription',
        'captions',
        'describedMath',
        'longDescription',
        'readingOrder',
        'structuralNavigation',
        'tableOfContents',
        'index',
        'printPageNumbers',
      ],
      accessibilityHazards: [
        'flashing',
        'motionSimulation',
        'sound',
        'noFlashing',
        'noMotionSimulation',
        'noSound',
        'none',
      ],
    };
  }
}
