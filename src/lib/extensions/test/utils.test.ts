/**
 * Extension Manager Utility Functions Tests
 *
 * Tests for name detection, file validation, and other utility functions
 * used by the Extension Manager.
 */

import { describe, it, expect } from 'vitest';
import { ExtensionManager } from '../extension-manager.js';
import { MockFileStorage } from './mocks/file-storage.mock.js';
import {
  FILENAME_PATTERNS,
  FILE_VALIDATION_CASES,
  createMockFile
} from './fixtures/create-test-data.js';
import {
  VERSIONED_EXTENSIONS,
  SPECIAL_CHAR_EXTENSIONS
} from './fixtures/extension-samples.js';

describe('Extension Manager Utilities', () => {
  let extensionManager: ExtensionManager;

  beforeEach(() => {
    const mockFileStorage = new MockFileStorage();
    extensionManager = new ExtensionManager(mockFileStorage as any);
  });

  describe('detectExtensionName()', () => {
    it('should detect names from standard filename patterns', () => {
      for (const pattern of FILENAME_PATTERNS) {
        const result = extensionManager.detectExtensionName(pattern.input);
        expect(result).toBe(pattern.expected);
      }
    });

    it('should handle versioned filenames correctly', () => {
      for (const versionedExt of VERSIONED_EXTENSIONS) {
        const result = extensionManager.detectExtensionName(versionedExt.filename);
        expect(result).toBe(versionedExt.expectedName);
      }
    });

    it('should normalize special characters', () => {
      for (const specialExt of SPECIAL_CHAR_EXTENSIONS) {
        const result = extensionManager.detectExtensionName(specialExt.filename);
        expect(result).toBe(specialExt.expectedName);
      }
    });

    it('should handle edge cases gracefully', () => {
      // Empty filename
      expect(() => extensionManager.detectExtensionName('')).toThrow('Invalid filename');
      
      // Only extension
      expect(() => extensionManager.detectExtensionName('.js')).toThrow('Invalid filename');
      
      // No extension
      expect(() => extensionManager.detectExtensionName('filename')).toThrow('Invalid filename');
      
      // Very long filename
      const longName = 'a'.repeat(200) + '.js';
      const result = extensionManager.detectExtensionName(longName);
      expect(result.length).toBeLessThanOrEqual(50); // Should be truncated
    });

    it('should preserve semantic meaning in complex names', () => {
      const testCases = [
        { input: 'three.js', expected: 'three' },
        { input: 'socket.io.min.js', expected: 'socket-io' },
        { input: 'web-animations.min.js', expected: 'web-animations' },
        { input: 'pdf.worker.min.js', expected: 'pdf-worker' }
      ];

      for (const testCase of testCases) {
        const result = extensionManager.detectExtensionName(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle numeric extensions consistently', () => {
      const numericCases = [
        { input: 'lib123.js', expected: 'lib123' },
        { input: '123lib.js', expected: '123lib' },
        { input: 'lib-v2.js', expected: 'lib-v2' },
        { input: 'version-2.0.js', expected: 'version' } // Version number stripped
      ];

      for (const testCase of numericCases) {
        const result = extensionManager.detectExtensionName(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('validateExtensionFile()', () => {
    it('should validate file types correctly', () => {
      for (const testCase of FILE_VALIDATION_CASES) {
        const file = createMockFile(testCase.name, 'content', testCase.type);
        const result = extensionManager.validateExtensionFile(file);
        
        expect(result.isValid).toBe(testCase.valid);
        expect(result.fileType).toBe(testCase.fileType);
        
        if (!testCase.valid) {
          expect(result.error).toBeDefined();
        }
      }
    });

    it('should validate JavaScript files with various extensions', () => {
      const jsVariants = [
        'script.js',
        'library.min.js',
        'module.esm.js',
        'bundle.umd.js'
      ];

      for (const filename of jsVariants) {
        const file = createMockFile(filename, 'function test() {}', 'text/javascript');
        const result = extensionManager.validateExtensionFile(file);
        
        expect(result.isValid).toBe(true);
        expect(result.fileType).toBe('javascript');
      }
    });

    it('should validate LICENSE files with different formats', () => {
      const licenseVariants = [
        { name: 'LICENSE', type: 'text/plain' },
        { name: 'LICENSE.txt', type: 'text/plain' },
        { name: 'LICENCE', type: 'text/plain' }, // British spelling
        { name: 'COPYING', type: 'text/plain' }
      ];

      for (const variant of licenseVariants) {
        const file = createMockFile(variant.name, 'MIT License', variant.type);
        const result = extensionManager.validateExtensionFile(file);
        
        if (variant.name === 'LICENSE' || variant.name === 'LICENSE.txt') {
          expect(result.isValid).toBe(true);
          expect(result.fileType).toBe('license');
        } else {
          // Other license formats not supported
          expect(result.isValid).toBe(false);
        }
      }
    });

    it('should reject files with dangerous extensions', () => {
      const dangerousFiles = [
        { name: 'script.exe', type: 'application/octet-stream' },
        { name: 'library.bat', type: 'application/x-msdos-program' },
        { name: 'module.sh', type: 'text/x-shellscript' },
        { name: 'plugin.php', type: 'application/x-php' },
        { name: 'widget.asp', type: 'text/asp' }
      ];

      for (const dangerous of dangerousFiles) {
        const file = createMockFile(dangerous.name, 'content', dangerous.type);
        const result = extensionManager.validateExtensionFile(file);
        
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid file type');
      }
    });

    it('should handle empty files appropriately', () => {
      const emptyJsFile = createMockFile('empty.js', '', 'text/javascript');
      const result1 = extensionManager.validateExtensionFile(emptyJsFile);
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('File is empty');

      const emptyLicenseFile = createMockFile('LICENSE.txt', '', 'text/plain');
      const result2 = extensionManager.validateExtensionFile(emptyLicenseFile);
      expect(result2.isValid).toBe(true); // Empty license files are OK
    });

    it('should handle very large files', () => {
      const largeContent = 'a'.repeat(15 * 1024 * 1024); // 15MB
      const largeFile = createMockFile('large.js', largeContent, 'text/javascript');
      const result = extensionManager.validateExtensionFile(largeFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should validate MIME types strictly', () => {
      // Correct MIME type for JS
      const validJs = createMockFile('valid.js', 'function test() {}', 'text/javascript');
      expect(extensionManager.validateExtensionFile(validJs).isValid).toBe(true);

      // Incorrect MIME type for JS file
      const invalidMime = createMockFile('script.js', 'function test() {}', 'text/plain');
      expect(extensionManager.validateExtensionFile(invalidMime).isValid).toBe(false);

      // Application/javascript should also be accepted
      const appJs = createMockFile('app.js', 'function test() {}', 'application/javascript');
      expect(extensionManager.validateExtensionFile(appJs).isValid).toBe(true);
    });
  });

  describe('normalizeExtensionName()', () => {
    it('should normalize names consistently', () => {
      const normalizationCases = [
        { input: 'Simple Name', expected: 'simple-name' },
        { input: 'CamelCaseName', expected: 'camelcasename' },
        { input: 'kebab-case-name', expected: 'kebab-case-name' },
        { input: 'snake_case_name', expected: 'snake-case-name' },
        { input: 'Mixed_Case-Name', expected: 'mixed-case-name' },
        { input: '  spaced  name  ', expected: 'spaced-name' },
        { input: 'name@with@symbols', expected: 'name-with-symbols' },
        { input: 'dots.in.name', expected: 'dots-in-name' },
        { input: 'multiple---dashes', expected: 'multiple-dashes' },
        { input: '-leading-trailing-', expected: 'leading-trailing' }
      ];

      for (const testCase of normalizationCases) {
        const result = (extensionManager as any).normalizeExtensionName(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle edge cases in normalization', () => {
      // All special characters
      expect((extensionManager as any).normalizeExtensionName('!@#$%^&*()'))
        .toBe('');

      // Numbers only
      expect((extensionManager as any).normalizeExtensionName('123456'))
        .toBe('123456');

      // Single character
      expect((extensionManager as any).normalizeExtensionName('a'))
        .toBe('a');

      // Very long name
      const longName = 'a'.repeat(100);
      const normalized = (extensionManager as any).normalizeExtensionName(longName);
      expect(normalized.length).toBeLessThanOrEqual(50);
    });

    it('should preserve essential semantic meaning', () => {
      const semanticCases = [
        { input: 'jQuery', expected: 'jquery' },
        { input: 'Vue.js', expected: 'vue-js' },
        { input: 'React-DOM', expected: 'react-dom' },
        { input: 'Three.JS', expected: 'three-js' },
        { input: 'Socket.IO', expected: 'socket-io' }
      ];

      for (const testCase of semanticCases) {
        const result = (extensionManager as any).normalizeExtensionName(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('compareExtensions()', () => {
    it('should detect identical extensions', () => {
      const signature1 = {
        files: [
          { name: 'library.js', size: 1000 },
          { name: 'LICENSE.txt', size: 500 }
        ],
        totalSize: 1500
      };

      const signature2 = {
        files: [
          { name: 'library.js', size: 1000 },
          { name: 'LICENSE.txt', size: 500 }
        ],
        totalSize: 1500
      };

      const result = (extensionManager as any).compareExtensions(signature1, signature2);
      expect(result).toBe(true);
    });

    it('should detect different total sizes', () => {
      const signature1 = {
        files: [{ name: 'library.js', size: 1000 }],
        totalSize: 1000
      };

      const signature2 = {
        files: [{ name: 'library.js', size: 1001 }],
        totalSize: 1001
      };

      const result = (extensionManager as any).compareExtensions(signature1, signature2);
      expect(result).toBe(false);
    });

    it('should detect different file counts', () => {
      const signature1 = {
        files: [
          { name: 'library.js', size: 1000 },
          { name: 'LICENSE.txt', size: 500 }
        ],
        totalSize: 1500
      };

      const signature2 = {
        files: [{ name: 'library.js', size: 1000 }],
        totalSize: 1000
      };

      const result = (extensionManager as any).compareExtensions(signature1, signature2);
      expect(result).toBe(false);
    });

    it('should detect different filenames', () => {
      const signature1 = {
        files: [{ name: 'library.js', size: 1000 }],
        totalSize: 1000
      };

      const signature2 = {
        files: [{ name: 'different.js', size: 1000 }],
        totalSize: 1000
      };

      const result = (extensionManager as any).compareExtensions(signature1, signature2);
      expect(result).toBe(false);
    });

    it('should handle different file order correctly', () => {
      const signature1 = {
        files: [
          { name: 'a.js', size: 500 },
          { name: 'b.js', size: 300 },
          { name: 'LICENSE.txt', size: 200 }
        ],
        totalSize: 1000
      };

      const signature2 = {
        files: [
          { name: 'LICENSE.txt', size: 200 },
          { name: 'b.js', size: 300 },
          { name: 'a.js', size: 500 }
        ],
        totalSize: 1000
      };

      const result = (extensionManager as any).compareExtensions(signature1, signature2);
      expect(result).toBe(true); // Should be true despite different order
    });

    it('should handle empty extensions', () => {
      const emptySignature = {
        files: [],
        totalSize: 0
      };

      const nonEmptySignature = {
        files: [{ name: 'file.js', size: 100 }],
        totalSize: 100
      };

      expect((extensionManager as any).compareExtensions(emptySignature, emptySignature))
        .toBe(true);
      expect((extensionManager as any).compareExtensions(emptySignature, nonEmptySignature))
        .toBe(false);
    });
  });

  describe('sanitizeFilename()', () => {
    it('should sanitize dangerous filenames', () => {
      const dangerousCases = [
        { input: '../../../etc/passwd', expected: 'etc-passwd' },
        { input: '..\\windows\\system32', expected: 'windows-system32' },
        { input: 'file<>:"|?*.js', expected: 'file-js' },
        { input: '.hidden', expected: 'hidden' },
        { input: 'CON.js', expected: 'con-js' }, // Windows reserved name
        { input: 'file\x00null.js', expected: 'file-null-js' } // Null byte
      ];

      for (const testCase of dangerousCases) {
        const result = (extensionManager as any).sanitizeFilename(testCase.input);
        expect(result).toBe(testCase.expected);
        expect(result).not.toContain('../');
        expect(result).not.toContain('..\\');
        expect(result).not.toMatch(/[<>:"|?*\x00-\x1f]/);
      }
    });

    it('should preserve safe filenames', () => {
      const safeCases = [
        'library.js',
        'my-extension.min.js',
        'LICENSE.txt',
        'file_name.js',
        'jQuery-3.6.0.js'
      ];

      for (const safeCase of safeCases) {
        const result = (extensionManager as any).sanitizeFilename(safeCase);
        expect(result).toBe(safeCase);
      }
    });
  });
});