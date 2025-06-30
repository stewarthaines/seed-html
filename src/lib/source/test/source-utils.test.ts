import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifySourceFile,
  validateSourcePath,
  isSourceFile,
  getSourceFileType,
  validateSettingsJson,
  calculateDirectoryStats,
  sanitizeSourcePath,
} from '../source-utils.js';
import { MockFileStorage } from './mocks/file-storage.mock.js';
import {
  createCompleteSourceStructure,
  createFileTypeTestData,
  DEFAULT_SETTINGS,
  TEST_WORKSPACE_IDS,
} from './fixtures/create-test-data.js';

describe('source-utils', () => {
  let mockFileStorage: MockFileStorage;

  beforeEach(() => {
    mockFileStorage = new MockFileStorage();
  });

  describe('classifySourceFile()', () => {
    it('should classify settings.json as settings type', () => {
      const result = classifySourceFile('SOURCE/settings.json');
      expect(result).toBe('settings');
    });

    it('should classify text files correctly', () => {
      expect(classifySourceFile('SOURCE/text/chapter1.txt')).toBe('text');
      expect(classifySourceFile('SOURCE/text/story.md')).toBe('text');
      expect(classifySourceFile('SOURCE/text/notes.rst')).toBe('text');
      expect(classifySourceFile('SOURCE/text/data.csv')).toBe('text');
    });

    it('should classify script files correctly', () => {
      expect(classifySourceFile('SOURCE/scripts/transform.js')).toBe('script');
      expect(classifySourceFile('SOURCE/scripts/helper.ts')).toBe('script');
      expect(classifySourceFile('SOURCE/scripts/build.py')).toBe('script');
      expect(classifySourceFile('SOURCE/scripts/process.sh')).toBe('script');
    });

    it('should classify extension files correctly', () => {
      expect(classifySourceFile('SOURCE/extensions/plugin/package.json')).toBe('extension');
      expect(classifySourceFile('SOURCE/extensions/plugin/index.js')).toBe('extension');
      expect(classifySourceFile('SOURCE/extensions/theme/style.css')).toBe('extension');
      expect(classifySourceFile('SOURCE/extensions/lib/helper.py')).toBe('extension');
    });

    it('should classify other files as other type', () => {
      expect(classifySourceFile('SOURCE/README.md')).toBe('other');
      expect(classifySourceFile('SOURCE/config.yaml')).toBe('other');
      expect(classifySourceFile('SOURCE/data.xml')).toBe('other');
      expect(classifySourceFile('SOURCE/unknown.xyz')).toBe('other');
    });

    it('should handle .gitkeep files as other type', () => {
      expect(classifySourceFile('SOURCE/text/.gitkeep')).toBe('other');
      expect(classifySourceFile('SOURCE/scripts/.gitkeep')).toBe('other');
      expect(classifySourceFile('SOURCE/extensions/.gitkeep')).toBe('other');
    });

    it('should handle paths without extensions', () => {
      expect(classifySourceFile('SOURCE/text/chapter')).toBe('text');
      expect(classifySourceFile('SOURCE/scripts/transform')).toBe('script');
      expect(classifySourceFile('SOURCE/extensions/plugin/main')).toBe('extension');
      expect(classifySourceFile('SOURCE/README')).toBe('other');
    });

    it('should handle nested directories', () => {
      expect(classifySourceFile('SOURCE/text/chapters/chapter1.txt')).toBe('text');
      expect(classifySourceFile('SOURCE/scripts/utils/helper.js')).toBe('script');
      expect(classifySourceFile('SOURCE/extensions/plugin/lib/index.js')).toBe('extension');
    });

    it('should handle case sensitivity', () => {
      expect(classifySourceFile('SOURCE/text/Chapter1.TXT')).toBe('text');
      expect(classifySourceFile('SOURCE/scripts/Transform.JS')).toBe('script');
      expect(classifySourceFile('SOURCE/extensions/Plugin/Index.JS')).toBe('extension');
    });
  });

  describe('validateSourcePath()', () => {
    it('should accept valid SOURCE/ paths', () => {
      expect(validateSourcePath('SOURCE/settings.json')).toBe(true);
      expect(validateSourcePath('SOURCE/text/chapter1.txt')).toBe(true);
      expect(validateSourcePath('SOURCE/scripts/transform.js')).toBe(true);
      expect(validateSourcePath('SOURCE/extensions/plugin/index.js')).toBe(true);
    });

    it('should reject paths with directory traversal', () => {
      expect(validateSourcePath('SOURCE/../../../etc/passwd')).toBe(false);
      expect(validateSourcePath('SOURCE/text/../../config.txt')).toBe(false);
      expect(validateSourcePath('SOURCE/scripts/../../../bin')).toBe(false);
    });

    it('should reject absolute paths', () => {
      expect(validateSourcePath('/SOURCE/settings.json')).toBe(false);
      expect(validateSourcePath('/etc/passwd')).toBe(false);
      expect(validateSourcePath('C:\\Windows\\System32')).toBe(false);
    });

    it('should reject paths outside SOURCE/', () => {
      expect(validateSourcePath('OEBPS/content.opf')).toBe(false);
      expect(validateSourcePath('META-INF/container.xml')).toBe(false);
      expect(validateSourcePath('mimetype')).toBe(false);
    });

    it('should reject empty or null paths', () => {
      expect(validateSourcePath('')).toBe(false);
      expect(validateSourcePath('   ')).toBe(false);
    });

    it('should handle various path separators', () => {
      expect(validateSourcePath('SOURCE\\text\\chapter1.txt')).toBe(true);
      expect(validateSourcePath('SOURCE/text\\chapter1.txt')).toBe(true);
    });

    it('should reject suspicious file names', () => {
      expect(validateSourcePath('SOURCE/text/con.txt')).toBe(false); // Windows reserved
      expect(validateSourcePath('SOURCE/text/aux.txt')).toBe(false); // Windows reserved
      expect(validateSourcePath('SOURCE/text/.DS_Store')).toBe(false); // macOS system file
    });
  });

  describe('isSourceFile()', () => {
    it('should identify SOURCE/ files correctly', () => {
      expect(isSourceFile('SOURCE/settings.json')).toBe(true);
      expect(isSourceFile('SOURCE/text/chapter1.txt')).toBe(true);
      expect(isSourceFile('SOURCE/scripts/transform.js')).toBe(true);
    });

    it('should identify non-SOURCE/ files correctly', () => {
      expect(isSourceFile('OEBPS/content.opf')).toBe(false);
      expect(isSourceFile('OEBPS/Text/chapter1.xhtml')).toBe(false);
      expect(isSourceFile('mimetype')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isSourceFile('')).toBe(false);
      expect(isSourceFile('SOURCE')).toBe(false);
      expect(isSourceFile('SOURCE/')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isSourceFile('source/settings.json')).toBe(false);
      expect(isSourceFile('Source/settings.json')).toBe(false);
      expect(isSourceFile('SOURCE/settings.json')).toBe(true);
    });
  });

  describe('getSourceFileType()', () => {
    it('should return correct file type for SOURCE/ files', () => {
      expect(getSourceFileType('SOURCE/settings.json')).toBe('settings');
      expect(getSourceFileType('SOURCE/text/chapter1.txt')).toBe('text');
      expect(getSourceFileType('SOURCE/scripts/transform.js')).toBe('script');
      expect(getSourceFileType('SOURCE/extensions/plugin/index.js')).toBe('extension');
    });

    it('should return null for non-SOURCE/ files', () => {
      expect(getSourceFileType('OEBPS/content.opf')).toBeNull();
      expect(getSourceFileType('mimetype')).toBeNull();
      expect(getSourceFileType('')).toBeNull();
    });

    it('should handle invalid paths', () => {
      expect(getSourceFileType('SOURCE/../../../etc/passwd')).toBeNull();
      expect(getSourceFileType('/SOURCE/settings.json')).toBeNull();
    });
  });

  describe('validateSettingsJson()', () => {
    it('should validate correct settings.json structure', () => {
      const validSettings = JSON.stringify(DEFAULT_SETTINGS, null, 2);
      const result = validateSettingsJson(validSettings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid JSON syntax', () => {
      const invalidJson = '{ "is_draft": true, "invalid": json }';
      const result = validateSettingsJson(invalidJson);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Invalid JSON syntax'));
    });

    it('should validate required fields', () => {
      const missingFields = JSON.stringify(
        {
          is_draft: true,
          // Missing required fields
        },
        null,
        2
      );
      const result = validateSettingsJson(missingFields);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });

    it('should validate field types', () => {
      const wrongTypes = JSON.stringify(
        {
          is_draft: 'not_boolean',
          draft_id: 'not_number',
          text_transform: 123,
          dom_transforms: 'not_array',
          version: true,
        },
        null,
        2
      );
      const result = validateSettingsJson(wrongTypes);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about unknown fields', () => {
      const extraFields = JSON.stringify(
        {
          ...DEFAULT_SETTINGS,
          unknown_field: 'value',
          another_unknown: 123,
        },
        null,
        2
      );
      const result = validateSettingsJson(extraFields);

      expect(result.isValid).toBe(true); // Still valid, just warnings
      expect(result.warnings).toContain(expect.stringContaining('unknown_field'));
      expect(result.warnings).toContain(expect.stringContaining('another_unknown'));
    });

    it('should handle empty string', () => {
      const result = validateSettingsJson('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Empty settings'));
    });

    it('should handle null values correctly', () => {
      const nullValues = JSON.stringify(
        {
          is_draft: null,
          draft_id: null,
          text_transform: null,
          dom_transforms: null,
          version: null,
        },
        null,
        2
      );
      const result = validateSettingsJson(nullValues);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('calculateDirectoryStats()', () => {
    it('should calculate statistics for complete directory structure', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteSourceStructure());

      const result = await calculateDirectoryStats(mockFileStorage as any, workspaceId);

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.directories.text).toBeGreaterThan(0);
      expect(result.directories.scripts).toBeGreaterThan(0);
      expect(result.directories.extensions).toBeGreaterThan(0);
      expect(result.hasSettingsFile).toBe(true);
    });

    it('should handle empty directories', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/text/.gitkeep': '',
        'SOURCE/scripts/.gitkeep': '',
        'SOURCE/extensions/.gitkeep': '',
      });

      const result = await calculateDirectoryStats(mockFileStorage as any, workspaceId);

      expect(result.totalFiles).toBe(3);
      expect(result.directories.text).toBe(1);
      expect(result.directories.scripts).toBe(1);
      expect(result.directories.extensions).toBe(1);
      expect(result.hasSettingsFile).toBe(false);
    });

    it('should handle workspace without SOURCE/ files', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, {
        'OEBPS/content.opf': '<?xml version="1.0"?><package></package>',
        'OEBPS/Text/chapter1.xhtml': '<html><body><h1>Chapter 1</h1></body></html>',
      });

      const result = await calculateDirectoryStats(mockFileStorage as any, workspaceId);

      expect(result.totalFiles).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.directories.text).toBe(0);
      expect(result.directories.scripts).toBe(0);
      expect(result.directories.extensions).toBe(0);
      expect(result.hasSettingsFile).toBe(false);
    });

    it('should calculate file sizes accurately', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      const testData = createFileTypeTestData();
      await mockFileStorage.addTestFiles(workspaceId, testData);

      const result = await calculateDirectoryStats(mockFileStorage as any, workspaceId);

      const expectedSize = Object.values(testData).reduce(
        (sum, content) => sum + new TextEncoder().encode(content).length,
        0
      );

      expect(result.totalSize).toBe(expectedSize);
    });

    it('should handle storage access errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteSourceStructure());
      mockFileStorage.setFailureMode('list');

      await expect(calculateDirectoryStats(mockFileStorage as any, workspaceId)).rejects.toThrow(
        'Failed to list files'
      );
    });
  });

  describe('sanitizeSourcePath()', () => {
    it('should normalize path separators', () => {
      expect(sanitizeSourcePath('SOURCE\\text\\chapter1.txt')).toBe('SOURCE/text/chapter1.txt');
      expect(sanitizeSourcePath('SOURCE/text\\chapter1.txt')).toBe('SOURCE/text/chapter1.txt');
    });

    it('should remove redundant path segments', () => {
      expect(sanitizeSourcePath('SOURCE/./text/chapter1.txt')).toBe('SOURCE/text/chapter1.txt');
      expect(sanitizeSourcePath('SOURCE/text/./chapter1.txt')).toBe('SOURCE/text/chapter1.txt');
    });

    it('should handle trailing slashes', () => {
      expect(sanitizeSourcePath('SOURCE/text/')).toBe('SOURCE/text');
      expect(sanitizeSourcePath('SOURCE/text/chapter1.txt/')).toBe('SOURCE/text/chapter1.txt');
    });

    it('should preserve valid paths unchanged', () => {
      expect(sanitizeSourcePath('SOURCE/settings.json')).toBe('SOURCE/settings.json');
      expect(sanitizeSourcePath('SOURCE/text/chapter1.txt')).toBe('SOURCE/text/chapter1.txt');
    });

    it('should handle empty paths', () => {
      expect(sanitizeSourcePath('')).toBe('');
      expect(sanitizeSourcePath('   ')).toBe('');
    });

    it('should not modify dangerous path traversal (for validation)', () => {
      // Sanitization should not fix security issues - they should be caught by validation
      expect(sanitizeSourcePath('SOURCE/../../../etc/passwd')).toBe('SOURCE/../../../etc/passwd');
    });
  });
});
