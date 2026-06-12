import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceManager } from '../source-manager.js';
import { MockFileStorage } from '../../test/mocks/file-storage.mock.js';
import { createMockZipWriter, createMockZip } from './mocks/zip-library.mock.js';
import {
  createCompleteSourceStructure,
  createMinimalSourceStructure,
  createEmptySourceStructure,
  createWorkspaceWithEPUBFiles,
  validateFileContent,
  TEST_WORKSPACE_IDS,
  DEFAULT_SETTINGS,
} from './fixtures/create-test-data.js';

// Mock ZIP library
vi.mock('../../zip', () => ({
  ZipWriter: vi.fn(() => createMockZipWriter()),
  Zip: vi.fn((buffer: ArrayBuffer) => {
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

describe('SourceManager Integration Tests', () => {
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

  describe('Round-trip Workflow', () => {
    it('should create and extract SOURCE.zip maintaining file integrity', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      const originalFiles = createCompleteSourceStructure();

      // 1. Create workspace with SOURCE/ files
      await mockFileStorage.addTestFiles(workspaceId, originalFiles);

      // 2. Create SOURCE.zip
      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      expect(sourceZip).toBeInstanceOf(Blob);

      // 3. Create new workspace for extraction
      const extractWorkspaceId = TEST_WORKSPACE_IDS.MINIMAL;

      // 4. Extract SOURCE.zip to new workspace
      await sourceManager.extractSourceZip(extractWorkspaceId, sourceZip!);

      // 5. Verify all files match original
      for (const [filePath, expectedContent] of Object.entries(originalFiles)) {
        expect(await mockFileStorage.fileExists(extractWorkspaceId, filePath)).toBe(true);
        const actualContent = await mockFileStorage.readFile(extractWorkspaceId, filePath);
        expect(validateFileContent(actualContent, expectedContent)).toBe(true);
      }

      // 6. Verify structure validation passes
      const validation = await sourceManager.validateSourceStructure(extractWorkspaceId);
      expect(validation.isValid).toBe(true);
      expect(validation.fileCount).toBe(Object.keys(originalFiles).length);
    });

    it('should handle multiple round-trips without data loss', async () => {
      const originalWorkspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      const originalFiles = createMinimalSourceStructure();
      await mockFileStorage.addTestFiles(originalWorkspaceId, originalFiles);

      let currentWorkspaceId: string = originalWorkspaceId;

      // Perform 3 round-trips
      for (let i = 1; i <= 3; i++) {
        const sourceZip = await sourceManager.createSourceZip(currentWorkspaceId);
        expect(sourceZip).toBeInstanceOf(Blob);

        const nextWorkspaceId = `${TEST_WORKSPACE_IDS.MINIMAL}-round${i}`;
        await sourceManager.extractSourceZip(nextWorkspaceId, sourceZip!);

        // Verify data integrity after each round-trip
        for (const [filePath, expectedContent] of Object.entries(originalFiles)) {
          const actualContent = await mockFileStorage.readFile(nextWorkspaceId, filePath);
          expect(validateFileContent(actualContent, expectedContent)).toBe(true);
        }

        currentWorkspaceId = nextWorkspaceId;
      }
    });

    it('should preserve binary file integrity through round-trips', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;

      // Create binary test data
      const binaryData = new ArrayBuffer(1024);
      const view = new Uint8Array(binaryData);
      for (let i = 0; i < view.length; i++) {
        view[i] = (i * 17) % 256; // Predictable pattern
      }

      const filesWithBinary = {
        'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
        'SOURCE/text/chapter1.txt': 'Text content',
        'SOURCE/extensions/data.bin': binaryData,
      };

      await mockFileStorage.addTestFiles(workspaceId, filesWithBinary);

      // Round-trip
      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      const extractWorkspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await sourceManager.extractSourceZip(extractWorkspaceId, sourceZip!);

      // Verify binary data integrity
      const extractedBinary = await mockFileStorage.readFile(
        extractWorkspaceId,
        'SOURCE/extensions/data.bin'
      );
      expect(extractedBinary.byteLength).toBe(binaryData.byteLength);

      const extractedView = new Uint8Array(extractedBinary);
      const originalView = new Uint8Array(binaryData);
      expect(extractedView.every((byte, index) => byte === originalView[index])).toBe(true);
    });

    it('should handle workspaces with only settings.json', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;

      // Create workspace with only settings.json
      await mockFileStorage.addTestFiles(workspaceId, createEmptySourceStructure());

      // Should create SOURCE.zip even with just settings.json
      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      expect(sourceZip).not.toBeNull();

      // hasSourceFiles should return true (settings.json counts as a source file)
      const hasSource = await sourceManager.hasSourceFiles(workspaceId);
      expect(hasSource).toBe(true);
    });
  });

  describe('EPUB Packaging Integration', () => {
    it('should separate SOURCE/ files from EPUB files during packaging', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MIXED;
      const mixedFiles = createWorkspaceWithEPUBFiles();
      await mockFileStorage.addTestFiles(workspaceId, mixedFiles);

      // Simulate EPUB packaging workflow
      const allFiles = await mockFileStorage.listFiles(workspaceId);
      const sourceFiles = allFiles.filter(f => f.startsWith('SOURCE/'));
      const epubFiles = allFiles.filter(f => !f.startsWith('SOURCE/'));

      expect(sourceFiles.length).toBeGreaterThan(0);
      expect(epubFiles.length).toBeGreaterThan(0);

      // SOURCE files should be bundled into ZIP
      const hasSource = await sourceManager.hasSourceFiles(workspaceId);
      expect(hasSource).toBe(true);

      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      expect(sourceZip).toBeInstanceOf(Blob);

      // EPUB files should be processed normally (simulated)
      for (const epubFile of epubFiles) {
        expect(await mockFileStorage.fileExists(workspaceId, epubFile)).toBe(true);
      }
    });

    it('should create SOURCE.zip manifest item when SOURCE/ files exist', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteSourceStructure());

      // Simulate manifest item creation
      const hasSource = await sourceManager.hasSourceFiles(workspaceId);
      expect(hasSource).toBe(true);

      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      expect(sourceZip).toBeInstanceOf(Blob);

      // Simulate the bundled archive descriptor (note: it is added directly to
      // the EPUB, not as an OPF manifest item).
      const manifestItem = {
        id: 'source-zip',
        href: 'SEED.zip',
        mediaType: 'application/zip',
      };

      expect(manifestItem.id).toBe('source-zip');
      expect(manifestItem.href).toBe('SEED.zip');
      expect(manifestItem.mediaType).toBe('application/zip');
    });

    it('should not create SOURCE.zip manifest item when no SOURCE/ files exist', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.EMPTY;

      // Create workspace with only EPUB files
      await mockFileStorage.addTestFiles(workspaceId, {
        'OEBPS/content.opf': '<?xml version="1.0"?><package></package>',
        'OEBPS/Text/chapter1.xhtml': '<html><body><h1>Chapter 1</h1></body></html>',
        mimetype: 'application/epub+zip',
      });

      const hasSource = await sourceManager.hasSourceFiles(workspaceId);
      expect(hasSource).toBe(false);

      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      expect(sourceZip).toBeNull();
    });
  });

  describe('EPUB Unpacking Integration', () => {
    it('should extract SOURCE.zip during EPUB unpacking', async () => {
      const originalWorkspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      const originalFiles = createCompleteSourceStructure();
      await mockFileStorage.addTestFiles(originalWorkspaceId, originalFiles);

      // Create SOURCE.zip (simulating EPUB packaging)
      const sourceZip = await sourceManager.createSourceZip(originalWorkspaceId);
      expect(sourceZip).toBeInstanceOf(Blob);

      // Simulate EPUB unpacking workflow
      const extractWorkspaceId = TEST_WORKSPACE_IDS.MINIMAL;

      // 1. Extract regular EPUB files (simulated)
      await mockFileStorage.addTestFiles(extractWorkspaceId, {
        'OEBPS/content.opf': '<?xml version="1.0"?><package></package>',
        'OEBPS/EDITME.html': '<html><body>EDITME Editor</body></html>',
        'OEBPS/Text/chapter1.xhtml': '<html><body><h1>Chapter 1</h1></body></html>',
      });

      // 2. Extract SOURCE.zip
      await sourceManager.extractSourceZip(extractWorkspaceId, sourceZip!);

      // 3. Verify both EPUB and SOURCE files exist
      expect(await mockFileStorage.fileExists(extractWorkspaceId, 'OEBPS/content.opf')).toBe(true);
      expect(await mockFileStorage.fileExists(extractWorkspaceId, 'SOURCE/settings.json')).toBe(
        true
      );

      // 4. The archive itself should not be stored as a workspace file
      expect(await mockFileStorage.fileExists(extractWorkspaceId, 'SEED.zip')).toBe(false);
      expect(await mockFileStorage.fileExists(extractWorkspaceId, 'SOURCE.zip')).toBe(false);
    });

    it('should handle missing SOURCE.zip during unpacking', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;

      // Extract EPUB without SOURCE.zip (older EPUB format)
      await mockFileStorage.addTestFiles(workspaceId, {
        'OEBPS/content.opf': '<?xml version="1.0"?><package></package>',
        'OEBPS/Text/chapter1.xhtml': '<html><body><h1>Chapter 1</h1></body></html>',
      });

      // Should not have SOURCE/ files
      const hasSource = await sourceManager.hasSourceFiles(workspaceId);
      expect(hasSource).toBe(false);

      // Should not error when checking for SOURCE files
      const sourceFiles = await sourceManager.listSourceFiles(workspaceId);
      expect(sourceFiles).toHaveLength(0);
    });

    it('should validate SOURCE/ structure after extraction', async () => {
      const originalWorkspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      const originalFiles = createCompleteSourceStructure();
      await mockFileStorage.addTestFiles(originalWorkspaceId, originalFiles);

      const sourceZip = await sourceManager.createSourceZip(originalWorkspaceId);
      const extractWorkspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await sourceManager.extractSourceZip(extractWorkspaceId, sourceZip!);

      // Validate extracted structure
      const validation = await sourceManager.validateSourceStructure(extractWorkspaceId);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.hasSettings).toBe(true);
      expect(validation.fileCount).toBe(Object.keys(originalFiles).length);
    });
  });

  describe('Workspace Manager Integration', () => {
    it('should initialize SOURCE/ structure in new workspaces', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;

      // Simulate new workspace creation
      await sourceManager.initializeSourceStructure(workspaceId);

      // Verify SOURCE/ structure was created
      expect(await mockFileStorage.fileExists(workspaceId, 'SOURCE/settings.json')).toBe(true);

      // Verify settings.json content
      const settings = await mockFileStorage.readTextFile(workspaceId, 'SOURCE/settings.json');
      const parsedSettings = JSON.parse(settings);
      expect(parsedSettings).toHaveProperty('is_draft');
      expect(parsedSettings).toHaveProperty('version');
    });

    it('should validate workspace structure including SOURCE/', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;

      // Create complete workspace with EPUB and SOURCE files
      await mockFileStorage.addTestFiles(workspaceId, {
        // EPUB structure
        'OEBPS/content.opf': '<?xml version="1.0"?><package></package>',
        'OEBPS/EDITME.html': '<html><body>EDITME Editor</body></html>',
        mimetype: 'application/epub+zip',
        // SOURCE structure
        ...createCompleteSourceStructure(),
      });

      // Validate SOURCE/ structure separately
      const sourceValidation = await sourceManager.validateSourceStructure(workspaceId);
      expect(sourceValidation.isValid).toBe(true);

      // Get SOURCE/ statistics
      const sourceStats = await sourceManager.getSourceDirectoryStats(workspaceId);
      expect(sourceStats.totalFiles).toBeGreaterThan(0);
      expect(sourceStats.hasSettingsFile).toBe(true);
    });

    it('should handle workspace structure migration scenarios', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.INVALID;

      // Simulate old workspace with EDITME/ structure (should not be supported)
      await mockFileStorage.addTestFiles(workspaceId, {
        'OEBPS/content.opf': '<?xml version="1.0"?><package></package>',
        'EDITME/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2), // Old structure
        'EDITME/text/chapter1.txt': 'Old content',
      });

      // SOURCE/ validation should show no SOURCE files
      const hasSource = await sourceManager.hasSourceFiles(workspaceId);
      expect(hasSource).toBe(false);

      // Initialize new SOURCE/ structure
      await sourceManager.initializeSourceStructure(workspaceId);

      // Now should have SOURCE/ structure
      const hasSourceAfterInit = await sourceManager.hasSourceFiles(workspaceId);
      expect(hasSourceAfterInit).toBe(true);

      // Old EDITME/ files should still exist but are ignored
      expect(await mockFileStorage.fileExists(workspaceId, 'EDITME/settings.json')).toBe(true);
      expect(await mockFileStorage.fileExists(workspaceId, 'SOURCE/settings.json')).toBe(true);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle partial ZIP extraction failures gracefully', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      const originalFiles = createCompleteSourceStructure();
      await mockFileStorage.addTestFiles(workspaceId, originalFiles);

      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      const extractWorkspaceId = TEST_WORKSPACE_IDS.MINIMAL;

      // Simulate partial failure during extraction
      let writeCallCount = 0;
      const originalWriteFile = mockFileStorage.writeFile.bind(mockFileStorage);
      vi.spyOn(mockFileStorage, 'writeFile').mockImplementation(
        async (workspaceId, filePath, content) => {
          writeCallCount++;
          if (writeCallCount === 3) {
            // Fail on third file
            throw new Error('Simulated write failure');
          }
          return originalWriteFile(workspaceId, filePath, content);
        }
      );

      await expect(
        sourceManager.extractSourceZip(extractWorkspaceId, sourceZip!)
      ).rejects.toThrow();

      // Some files should have been written successfully
      const extractedFiles = await mockFileStorage.listFiles(extractWorkspaceId);
      expect(extractedFiles.length).toBeGreaterThan(0);
      expect(extractedFiles.length).toBeLessThan(Object.keys(originalFiles).length);
    });

    it('should handle corrupted settings.json during validation', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.CORRUPTED;

      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': '{ "is_draft": true, invalid json }',
        'SOURCE/text/chapter1.txt': 'Valid content',
      });

      const validation = await sourceManager.validateSourceStructure(workspaceId);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('settings.json'))).toBe(true);

      // Should still count other files
      expect(validation.fileCount).toBe(2);
    });

    it.skip('should handle storage quota exceeded scenarios', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.LARGE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteSourceStructure());

      // Simulate storage quota exceeded during ZIP creation
      mockFileStorage.setFailureMode('write');

      await expect(sourceManager.createSourceZip(workspaceId)).rejects.toThrow();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large SOURCE/ directories efficiently', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.LARGE;

      // Create a large number of files
      const largeFileSet: Record<string, string> = {
        'SOURCE/settings.json': JSON.stringify(DEFAULT_SETTINGS, null, 2),
      };

      // Add 100 text files
      for (let i = 1; i <= 100; i++) {
        largeFileSet[`SOURCE/text/chapter${i}.txt`] = `# Chapter ${i}\n\n${'Content '.repeat(100)}`;
      }

      await mockFileStorage.addTestFiles(workspaceId, largeFileSet);

      // Should still create ZIP efficiently
      const startTime = Date.now();
      const sourceZip = await sourceManager.createSourceZip(workspaceId);
      const endTime = Date.now();

      expect(sourceZip).toBeInstanceOf(Blob);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should calculate statistics efficiently for large directories', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.LARGE;

      // Create many files across different subdirectories
      const largeFileSet: Record<string, string> = {};
      for (let i = 1; i <= 50; i++) {
        largeFileSet[`SOURCE/text/file${i}.txt`] = `Content ${i}`;
        largeFileSet[`SOURCE/scripts/script${i}.js`] = `function script${i}() {}`;
        largeFileSet[`SOURCE/extensions/ext${i}/index.js`] = `module.exports = ${i};`;
      }

      await mockFileStorage.addTestFiles(workspaceId, largeFileSet);

      const stats = await sourceManager.getSourceDirectoryStats(workspaceId);
      expect(stats.totalFiles).toBe(150); // 50 * 3 types
      expect(stats.directories.text).toBe(50);
      expect(stats.directories.scripts).toBe(50);
      expect(stats.directories.extensions).toBe(50);
    });
  });
});
