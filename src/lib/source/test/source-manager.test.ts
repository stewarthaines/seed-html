import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceManager } from '../source-manager.js';
import { MockFileStorage } from '../../test/mocks/file-storage.mock.js';
import {
  createMockZipWriter,
  createMockZip,
  extractMockZipContent,
} from './mocks/zip-library.mock.js';
import {
  createCompleteSourceStructure,
  createMinimalSourceStructure,
  createEmptySourceStructure,
  createLargeSourceStructure,
  createCorruptedSettings,
  createFileTypeTestData,
  validateFileContent,
  TEST_WORKSPACE_IDS,
  DEFAULT_SETTINGS,
} from './fixtures/create-test-data.js';

// Mock ZIP library
vi.mock('../../zip', () => ({
  ZipWriter: vi.fn(() => createMockZipWriter()),
  Zip: vi.fn((buffer: ArrayBuffer) => {
    // Parse mock ZIP data from buffer
    try {
      const text = new TextDecoder().decode(buffer);
      const mockData = JSON.parse(text);
      return createMockZip(
        mockData.files.map((f: any) => ({
          fileName: f.filename,
          content: new Uint8Array(f.content).buffer,
        }))
      );
    } catch {
      return createMockZip([]);
    }
  }),
}));

describe('SourceManager', () => {
  let sourceManager: SourceManager;
  let mockFileStorage: MockFileStorage;

  beforeEach(() => {
    mockFileStorage = new MockFileStorage();
    sourceManager = new SourceManager(mockFileStorage as any);
  });

  afterEach(() => {
    mockFileStorage.reset();
    vi.clearAllMocks();
  });

  describe('createSourceZip()', () => {
    it.skip('should return null for empty SOURCE/ directory', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, createEmptySourceStructure());

      const result = await sourceManager.createSourceZip(workspaceId);

      expect(result).toBeNull();
    });

    it('should create valid ZIP for single file in SOURCE/', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      const files = {
        'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
        'SOURCE/text/chapter1.txt': 'Test content',
      };
      await mockFileStorage.addTestFiles(workspaceId, files);

      const result = await sourceManager.createSourceZip(workspaceId);

      expect(result).toBeInstanceOf(Blob);
      expect(result!.type).toBe('application/zip');
      expect(result!.size).toBeGreaterThan(0);
    });

    it('should create ZIP with multiple files across subdirectories', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteSourceStructure());

      const result = await sourceManager.createSourceZip(workspaceId);

      expect(result).toBeInstanceOf(Blob);

      // Verify ZIP contains expected files
      const zipContent = await extractMockZipContent(result!);
      expect(zipContent).toHaveProperty('SOURCE/settings.json');
      expect(zipContent).toHaveProperty('SOURCE/text/chapter1.txt');
      expect(zipContent).toHaveProperty('SOURCE/scripts/markdown-transform.js');
      expect(zipContent).toHaveProperty('SOURCE/extensions/markdown-it/package.json');
    });

    it('should handle binary and text files correctly', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MIXED;
      const binaryData = new ArrayBuffer(1024);
      new Uint8Array(binaryData).fill(42);

      const files = {
        'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
        'SOURCE/text/chapter1.txt': 'Text content',
        'SOURCE/extensions/data.bin': binaryData,
      };
      await mockFileStorage.addTestFiles(workspaceId, files);

      const result = await sourceManager.createSourceZip(workspaceId);

      expect(result).toBeInstanceOf(Blob);

      const zipContent = await extractMockZipContent(result!);
      expect(zipContent).toHaveProperty('SOURCE/settings.json');
      expect(zipContent).toHaveProperty('SOURCE/text/chapter1.txt');
      expect(zipContent).toHaveProperty('SOURCE/extensions/data.bin');

      // Verify binary data integrity
      const extractedBinary = zipContent['SOURCE/extensions/data.bin'];
      expect(extractedBinary.byteLength).toBe(1024);
    });

    it('should handle large files within memory limits', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.LARGE;
      await mockFileStorage.addTestFiles(workspaceId, createLargeSourceStructure());

      const result = await sourceManager.createSourceZip(workspaceId);

      expect(result).toBeInstanceOf(Blob);
      expect(result!.size).toBeGreaterThan(1024 * 1024); // Should be > 1MB
    });

    it('should throw error for workspace not found', async () => {
      const workspaceId = 'non-existent-workspace';

      await expect(sourceManager.createSourceZip(workspaceId)).rejects.toThrow(
        'Workspace non-existent-workspace not found'
      );
    });

    it('should handle file access errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalSourceStructure());

      // Simulate file read failure
      mockFileStorage.setFailureMode('read');

      await expect(sourceManager.createSourceZip(workspaceId)).rejects.toThrow(
        'Failed to read file'
      );
    });

    it.skip('should handle ZIP creation errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalSourceStructure());

      // Mock ZIP library failure
      vi.mocked(vi.fn(() => createMockZipWriter())).mockImplementation(() => {
        const mockWriter = createMockZipWriter();
        mockWriter.setFailureMode('buildBlob');
        return mockWriter;
      });

      await expect(sourceManager.createSourceZip(workspaceId)).rejects.toThrow(
        'Failed to build ZIP blob'
      );
    });
  });

  describe('extractSourceZip()', () => {
    it('should extract valid SOURCE.zip to workspace', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      const originalFiles = createMinimalSourceStructure();

      // Create a mock ZIP blob
      const mockZip = createMockZip(
        Object.entries(originalFiles).map(([path, content]) => ({
          fileName: path,
          content,
        }))
      );
      const zipBlob = new Blob(
        [
          JSON.stringify({
            files: mockZip.entries.map(e => ({
              filename: e.fileName,
              content: Array.from(new Uint8Array(e.content)),
              size: e.content.byteLength,
            })),
          }),
        ],
        { type: 'application/zip' }
      );

      await sourceManager.extractSourceZip(workspaceId, zipBlob);

      // Verify all files were extracted
      for (const [path, expectedContent] of Object.entries(originalFiles)) {
        expect(await mockFileStorage.fileExists(workspaceId, path)).toBe(true);
        const actualContent = await mockFileStorage.readFile(workspaceId, path);
        expect(validateFileContent(actualContent, expectedContent)).toBe(true);
      }
    });

    it('should handle empty ZIP file', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      const emptyZip = createMockZip([]);
      const zipBlob = new Blob([JSON.stringify({ files: [] })], { type: 'application/zip' });

      await sourceManager.extractSourceZip(workspaceId, zipBlob);

      // Should not throw error, but no files should be created
      const files = await mockFileStorage.listFiles(workspaceId);
      expect(files.length).toBe(0);
    });

    it.skip('should handle corrupted ZIP file', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.CORRUPTED;
      const corruptedBlob = new Blob(['INVALID ZIP DATA'], { type: 'application/zip' });

      await expect(sourceManager.extractSourceZip(workspaceId, corruptedBlob)).rejects.toThrow();
    });

    it('should reject invalid file paths (security)', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.INVALID;
      const maliciousZip = createMockZip([
        { fileName: 'SOURCE/../../../etc/passwd', content: 'malicious content' },
        { fileName: 'SOURCE/normal.txt', content: 'normal content' },
      ]);
      const zipBlob = new Blob(
        [
          JSON.stringify({
            files: maliciousZip.entries.map(e => ({
              filename: e.fileName,
              content: Array.from(new Uint8Array(e.content)),
              size: e.content.byteLength,
            })),
          }),
        ],
        { type: 'application/zip' }
      );

      await expect(sourceManager.extractSourceZip(workspaceId, zipBlob)).rejects.toThrow(
        'Invalid file path'
      );
    });

    it('should overwrite existing SOURCE/ files', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;

      // Create existing files
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({ old: 'settings' }, null, 2),
        'SOURCE/text/chapter1.txt': 'Old content',
      });

      // Create new ZIP with updated content
      const newFiles = {
        'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
        'SOURCE/text/chapter1.txt': 'New content',
      };
      const newZip = createMockZip(
        Object.entries(newFiles).map(([path, content]) => ({
          fileName: path,
          content,
        }))
      );
      const zipBlob = new Blob(
        [
          JSON.stringify({
            files: newZip.entries.map(e => ({
              filename: e.fileName,
              content: Array.from(new Uint8Array(e.content)),
              size: e.content.byteLength,
            })),
          }),
        ],
        { type: 'application/zip' }
      );

      await sourceManager.extractSourceZip(workspaceId, zipBlob);

      // Verify files were overwritten
      const settings = await mockFileStorage.readTextFile(workspaceId, 'SOURCE/settings.json');
      expect(JSON.parse(settings)).toEqual(DEFAULT_SETTINGS);

      const chapter = await mockFileStorage.readTextFile(workspaceId, 'SOURCE/text/chapter1.txt');
      expect(chapter).toBe('New content');
    });

    it('should handle file write permission errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      mockFileStorage.setFailureMode('write');

      const files = createMinimalSourceStructure();
      const mockZip = createMockZip(
        Object.entries(files).map(([path, content]) => ({
          fileName: path,
          content,
        }))
      );
      const zipBlob = new Blob(
        [
          JSON.stringify({
            files: mockZip.entries.map(e => ({
              filename: e.fileName,
              content: Array.from(new Uint8Array(e.content)),
              size: e.content.byteLength,
            })),
          }),
        ],
        { type: 'application/zip' }
      );

      await expect(sourceManager.extractSourceZip(workspaceId, zipBlob)).rejects.toThrow(
        'Failed to write file'
      );
    });

    it('should handle large ZIP extraction within memory limits', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.LARGE;
      const largeFiles = createLargeSourceStructure();

      const mockZip = createMockZip(
        Object.entries(largeFiles).map(([path, content]) => ({
          fileName: path,
          content,
        }))
      );
      const zipBlob = new Blob(
        [
          JSON.stringify({
            files: mockZip.entries.map(e => ({
              filename: e.fileName,
              content: Array.from(new Uint8Array(e.content)),
              size: e.content.byteLength,
            })),
          }),
        ],
        { type: 'application/zip' }
      );

      await sourceManager.extractSourceZip(workspaceId, zipBlob);

      // Verify large binary file was extracted correctly
      expect(
        await mockFileStorage.fileExists(workspaceId, 'SOURCE/extensions/binary-data/data.bin')
      ).toBe(true);
    });
  });

  describe('hasSourceFiles()', () => {
    it('should return false for empty workspace', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.createWorkspace(workspaceId);

      const result = await sourceManager.hasSourceFiles(workspaceId);

      expect(result).toBe(false);
    });

    it.skip('should return false for empty SOURCE/ directory', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, createEmptySourceStructure());

      const result = await sourceManager.hasSourceFiles(workspaceId);

      expect(result).toBe(false);
    });

    it('should return false for SOURCE/ with only .gitkeep files', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/text/.gitkeep': '',
        'SOURCE/scripts/.gitkeep': '',
        'SOURCE/extensions/.gitkeep': '',
      });

      const result = await sourceManager.hasSourceFiles(workspaceId);

      expect(result).toBe(false);
    });

    it('should return true for SOURCE/ with actual content files', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalSourceStructure());

      const result = await sourceManager.hasSourceFiles(workspaceId);

      expect(result).toBe(true);
    });

    it('should handle storage access errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalSourceStructure());
      mockFileStorage.setFailureMode('list');

      await expect(sourceManager.hasSourceFiles(workspaceId)).rejects.toThrow(
        'Failed to list files'
      );
    });
  });

  describe('initializeSourceStructure()', () => {
    it('should create default SOURCE/ structure in new workspace', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;

      await sourceManager.initializeSourceStructure(workspaceId);

      // Verify directory structure was created
      expect(await mockFileStorage.fileExists(workspaceId, 'SOURCE/settings.json')).toBe(true);
      expect(await mockFileStorage.fileExists(workspaceId, 'SOURCE/text/.gitkeep')).toBe(true);
      expect(await mockFileStorage.fileExists(workspaceId, 'SOURCE/scripts/.gitkeep')).toBe(true);
      expect(await mockFileStorage.fileExists(workspaceId, 'SOURCE/extensions/.gitkeep')).toBe(
        true
      );

      // Verify default settings.json content
      const settings = await mockFileStorage.readTextFile(workspaceId, 'SOURCE/settings.json');
      const parsedSettings = JSON.parse(settings);
      expect(parsedSettings).toHaveProperty('is_draft');
      expect(parsedSettings).toHaveProperty('version');
    });

    it('should not overwrite existing SOURCE/ directory', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      const existingSettings = { custom: 'settings', version: '2.0.0' };
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify(existingSettings, null, 2),
        'SOURCE/text/existing.txt': 'Existing content',
      });

      await sourceManager.initializeSourceStructure(workspaceId);

      // Verify existing files were not overwritten
      const settings = await mockFileStorage.readTextFile(workspaceId, 'SOURCE/settings.json');
      expect(JSON.parse(settings)).toEqual(existingSettings);

      expect(await mockFileStorage.fileExists(workspaceId, 'SOURCE/text/existing.txt')).toBe(true);
    });

    it('should handle file write permission errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      mockFileStorage.setFailureMode('write');

      await expect(sourceManager.initializeSourceStructure(workspaceId)).rejects.toThrow(
        'Failed to write file'
      );
    });
  });

  describe('validateSourceStructure()', () => {
    it('should validate correct SOURCE/ structure', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteSourceStructure());

      const result = await sourceManager.validateSourceStructure(workspaceId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileCount).toBeGreaterThan(0);
      expect(result.hasSettings).toBe(true);
    });

    it('should warn about missing settings.json', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/text/chapter1.txt': 'Content without settings',
      });

      const result = await sourceManager.validateSourceStructure(workspaceId);

      expect(result.isValid).toBe(true); // Still valid, just warnings
      expect(result.warnings).toContain('Missing settings.json file');
      expect(result.hasSettings).toBe(false);
    });

    it.skip('should error on invalid settings.json format', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.CORRUPTED;
      await mockFileStorage.addTestFiles(workspaceId, createCorruptedSettings());

      const result = await sourceManager.validateSourceStructure(workspaceId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Invalid settings.json format'));
    });

    it('should warn about extra files/directories', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.INVALID;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
        'SOURCE/unexpected-file.txt': 'Should not be here',
        'SOURCE/unknown-dir/file.txt': 'Unknown directory',
      });

      const result = await sourceManager.validateSourceStructure(workspaceId);

      expect(result.isValid).toBe(true); // Still valid, just warnings
      expect(result.warnings.some(w => w.includes('unexpected-file.txt'))).toBe(true);
    });

    it('should handle empty directories as valid', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, createEmptySourceStructure());

      const result = await sourceManager.validateSourceStructure(workspaceId);

      expect(result.isValid).toBe(true);
      expect(result.fileCount).toBe(4); // settings.json + 3 .gitkeep files
    });

    it('should calculate file count and total size correctly', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      const files = createCompleteSourceStructure();
      await mockFileStorage.addTestFiles(workspaceId, files);

      const result = await sourceManager.validateSourceStructure(workspaceId);

      expect(result.fileCount).toBe(Object.keys(files).length);
      expect(result.totalSize).toBeGreaterThan(0);
    });
  });

  describe('listSourceFiles()', () => {
    it('should classify files correctly by type', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createFileTypeTestData());

      const result = await sourceManager.listSourceFiles(workspaceId);

      const settingsFiles = result.filter(f => f.type === 'settings');
      const textFiles = result.filter(f => f.type === 'text');
      const scriptFiles = result.filter(f => f.type === 'script');
      const extensionFiles = result.filter(f => f.type === 'extension');
      const otherFiles = result.filter(f => f.type === 'other');

      expect(settingsFiles.length).toBe(1);
      expect(textFiles.length).toBeGreaterThan(0);
      expect(scriptFiles.length).toBeGreaterThan(0);
      expect(extensionFiles.length).toBeGreaterThan(0);
      expect(otherFiles.length).toBeGreaterThan(0);
    });

    it('should calculate file sizes accurately', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      const files = createMinimalSourceStructure();
      await mockFileStorage.addTestFiles(workspaceId, files);

      const result = await sourceManager.listSourceFiles(workspaceId);

      for (const fileInfo of result) {
        const expectedSize =
          typeof files[fileInfo.path] === 'string'
            ? new TextEncoder().encode(files[fileInfo.path] as string).length
            : (files[fileInfo.path] as ArrayBuffer).byteLength;
        expect(fileInfo.size).toBe(expectedSize);
      }
    });

    it('should handle empty directories', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, createEmptySourceStructure());

      const result = await sourceManager.listSourceFiles(workspaceId);

      expect(result.length).toBe(4); // settings.json + 3 .gitkeep files
    });

    it('should include file metadata when available', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalSourceStructure());

      const result = await sourceManager.listSourceFiles(workspaceId);

      for (const fileInfo of result) {
        expect(fileInfo).toHaveProperty('path');
        expect(fileInfo).toHaveProperty('size');
        expect(fileInfo).toHaveProperty('type');
        expect(fileInfo.size).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getSourceDirectoryStats()', () => {
    it('should calculate directory statistics correctly', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteSourceStructure());

      const result = await sourceManager.getSourceDirectoryStats(workspaceId);

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.directories.text).toBeGreaterThan(0);
      expect(result.directories.scripts).toBeGreaterThan(0);
      expect(result.directories.extensions).toBeGreaterThan(0);
      expect(result.hasSettingsFile).toBe(true);
    });

    it('should handle empty subdirectories', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;
      await mockFileStorage.addTestFiles(workspaceId, createEmptySourceStructure());

      const result = await sourceManager.getSourceDirectoryStats(workspaceId);

      expect(result.totalFiles).toBe(4); // settings.json + 3 .gitkeep files
      expect(result.directories.text).toBe(1); // .gitkeep file
      expect(result.directories.scripts).toBe(1); // .gitkeep file
      expect(result.directories.extensions).toBe(1); // .gitkeep file
      expect(result.hasSettingsFile).toBe(true);
    });

    it('should handle missing settings file', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/text/chapter1.txt': 'Content without settings',
        'SOURCE/scripts/transform.js': 'function transform() {}',
      });

      const result = await sourceManager.getSourceDirectoryStats(workspaceId);

      expect(result.totalFiles).toBe(2);
      expect(result.directories.text).toBe(1);
      expect(result.directories.scripts).toBe(1);
      expect(result.directories.extensions).toBe(0);
      expect(result.hasSettingsFile).toBe(false);
    });
  });
});
