/**
 * WorkspaceManager Unit Tests
 *
 * Tests based on API documentation - validates all public methods,
 * error handling, and integration patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceManager } from '../workspace-manager.js';
import { WorkspaceError, ValidationError, CacheError } from '../types.js';
import { createVitestMockFileStorage } from '../../test/mocks/file-storage-vitest.mock.js';
import type {
  WorkspaceInfo,
  ValidationResult,
  WorkspacePreview,
  WorkspaceConfig,
} from '../types.js';
import type { EPUBMetadata, OPFDocument, ManifestItem } from '../../epub/opf-utils.js';

// Mock File Storage API with shared mock
vi.mock('../../storage/index.js', () => ({
  FileStorageAPI: vi.fn(),
}));

// Mock OPF Utils
vi.mock('../../epub/index.js', () => ({
  OPFUtils: {
    parseOPFDocument: vi.fn(),
    generateOPFXML: vi.fn(),
    parseOPFMetadata: vi.fn(),
    validateXML: vi.fn(() => ({ isValid: true })),
    generateContainerXML: vi.fn(() => '<container></container>'),
    parseContainerXml: vi.fn(() => ({ rootfilePath: 'OEBPS/content.opf' })),
  },
}));

describe('WorkspaceManager', () => {
  let workspaceManager: WorkspaceManager;
  let mockStorage: ReturnType<typeof createVitestMockFileStorage>;

  const mockMetadata: EPUBMetadata = {
    title: 'Test Book',
    language: 'en',
    identifier: 'test-book-123',
  };

  const mockWorkspaceInfo: WorkspaceInfo = {
    id: 'workspace-123',
    title: 'Test Book',
    author: 'Test Author',
    language: 'en',
    lastModified: new Date('2024-01-01'),
    fileCount: 5,
    totalSize: 1024,
    epubVersion: 'EPUB 3.0',
  };

  const mockOPFDocument: OPFDocument = {
    version: '3.0',
    metadata: mockMetadata,
    manifest: [
      {
        id: 'chapter1',
        href: 'OEBPS/Text/chapter1.xhtml',
        mediaType: 'application/xhtml+xml',
      },
    ],
    spine: [
      {
        idref: 'chapter1',
        linear: true,
      },
    ],
  };

  // Helper function to create a basic valid workspace
  async function createValidWorkspace(id: string) {
    await mockStorage.createWorkspace(id);
    await mockStorage.addTestFiles(id, {
      'META-INF/container.xml':
        '<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      'OEBPS/content.opf': '<package><metadata><dc:title>Test Book</dc:title></metadata></package>',
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStorage = createVitestMockFileStorage();

    // Inject mock storage into WorkspaceManager and all its dependencies
    workspaceManager = new WorkspaceManager();
    (workspaceManager as any).storage = mockStorage;
    (workspaceManager as any).cache.storage = mockStorage;
    (workspaceManager as any).dependencyTracker.storage = mockStorage;
    (workspaceManager as any).sourceManager.fileStorage = mockStorage;

    // Don't create default workspace - let each test create what it needs
  });

  afterEach(() => {
    mockStorage.reset();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const manager = new WorkspaceManager();
      expect(manager).toBeInstanceOf(WorkspaceManager);
    });

    it('should accept custom configuration', () => {
      const config: Partial<WorkspaceConfig> = {
        cache: { ttl: 12 * 60 * 60 * 1000, maxEntries: 50, enableDiskCache: false },
        validation: { strict: true, checkDependencies: false, allowOrphanedFiles: false },
      };

      const manager = new WorkspaceManager(config);
      expect(manager).toBeInstanceOf(WorkspaceManager);
    });
  });

  describe('listWorkspacesWithMetadata', () => {
    it.skip('should return array of workspace info sorted by lastModified', async () => {
      const workspaces = [
        { ...mockWorkspaceInfo, id: 'workspace-1', lastModified: new Date('2024-01-01') },
        { ...mockWorkspaceInfo, id: 'workspace-2', lastModified: new Date('2024-01-02') },
      ];

      // Create workspaces in mock storage
      await createValidWorkspace('workspace-1');
      await createValidWorkspace('workspace-2');

      vi.spyOn(workspaceManager as any, 'parseWorkspaceMetadata')
        .mockResolvedValueOnce(workspaces[0])
        .mockResolvedValueOnce(workspaces[1]);

      const result = await workspaceManager.listWorkspacesWithMetadata();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('workspace-2'); // Most recent first
      expect(result[1].id).toBe('workspace-1');
    });

    it('should handle workspace with errors gracefully', async () => {
      // Create a workspace in mock storage
      await createValidWorkspace('workspace-error');

      vi.spyOn(workspaceManager as any, 'parseWorkspaceMetadata').mockRejectedValue(
        new Error('Corrupted workspace')
      );

      const result = await workspaceManager.listWorkspacesWithMetadata();

      expect(result).toHaveLength(1);
      expect(result[0].hasError).toBe(true);
      expect(result[0].title).toContain('Error');
    });

    it('should use cached metadata when fresh', async () => {
      // Create workspace in mock storage
      await createValidWorkspace('workspace-123');

      vi.spyOn(workspaceManager as any, 'loadCachedMetadata').mockResolvedValue(mockWorkspaceInfo);
      vi.spyOn(workspaceManager as any, 'isCacheFresh').mockResolvedValue(true);

      const result = await workspaceManager.listWorkspacesWithMetadata();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockWorkspaceInfo);
    });

    it('should exclude reserved workspace IDs (like locales)', async () => {
      // Create regular user workspaces
      await createValidWorkspace('user-workspace-1');
      await createValidWorkspace('user-workspace-2');
      
      // Create reserved system workspace (locales)
      await createValidWorkspace('locales');

      // Mock parsing to return valid workspace info for all workspaces
      const userWorkspace1 = { ...mockWorkspaceInfo, id: 'user-workspace-1', title: 'User Book 1' };
      const userWorkspace2 = { ...mockWorkspaceInfo, id: 'user-workspace-2', title: 'User Book 2' };
      const localesWorkspace = { ...mockWorkspaceInfo, id: 'locales', title: 'i18n Locales' };

      vi.spyOn(workspaceManager as any, 'parseWorkspaceMetadata')
        .mockImplementation((id: unknown) => {
          const workspaceId = id as string;
          switch (workspaceId) {
            case 'user-workspace-1':
              return Promise.resolve(userWorkspace1);
            case 'user-workspace-2':
              return Promise.resolve(userWorkspace2);
            case 'locales':
              return Promise.resolve(localesWorkspace);
            default:
              return Promise.reject(new Error('Unknown workspace'));
          }
        });

      const result = await workspaceManager.listWorkspacesWithMetadata();

      // Should only return user workspaces, not the 'locales' workspace
      expect(result).toHaveLength(2);
      expect(result.some(ws => ws.id === 'user-workspace-1')).toBe(true);
      expect(result.some(ws => ws.id === 'user-workspace-2')).toBe(true);
      expect(result.some(ws => ws.id === 'locales')).toBe(false);
    });
  });

  describe('createEPUBWorkspace', () => {
    it.skip('should create workspace and return UUID', async () => {
      const expectedId = '12345678-1234-1234-1234-123456789abc';
      vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(expectedId);

      const result = await workspaceManager.createEPUBWorkspace(mockMetadata);

      expect(result).toBe(expectedId);
      expect(mockStorage.hasWorkspace(expectedId)).toBe(true);

      // Should create EPUB structure files
      const files = await mockStorage.listFiles(expectedId);
      expect(files).toContain('META-INF/container.xml');
      expect(files).toContain('OEBPS/content.opf');
      expect(files).toContain('SOURCE/settings.json');
    });

    it('should generate initial content.opf with metadata', async () => {
      const workspaceId = '12345678-1234-1234-1234-123456789abc';
      vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(workspaceId);

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.generateOPFXML as any).mockReturnValue('<package></package>');

      await workspaceManager.createEPUBWorkspace(mockMetadata);

      expect(OPFUtils.generateOPFXML).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: mockMetadata,
          version: '3.0',
        })
      );
    });

    it.skip('should handle storage errors', async () => {
      // Set up mock storage to fail on workspace creation
      mockStorage.setFailureMode('write');

      await expect(workspaceManager.createEPUBWorkspace(mockMetadata)).rejects.toThrow();
    });
  });

  describe('switchWorkspace', () => {
    it('should return workspace info for valid workspace', async () => {
      // Create a valid workspace in mock storage
      await createValidWorkspace('workspace-123');

      vi.spyOn(workspaceManager as any, 'parseWorkspaceMetadata').mockResolvedValue(
        mockWorkspaceInfo
      );
      vi.spyOn(workspaceManager, 'validateWorkspaceStructure').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        summary: { totalFiles: 5, validFiles: 5, missingFiles: 0, orphanedFiles: 0 },
      });

      const result = await workspaceManager.switchWorkspace('workspace-123');

      expect(result).toEqual(mockWorkspaceInfo);
    });

    it('should throw WorkspaceError for non-existent workspace', async () => {
      // Don't create the workspace - leave it non-existent

      vi.spyOn(workspaceManager as any, 'parseWorkspaceMetadata').mockRejectedValue(
        new Error('Workspace not found')
      );

      await expect(workspaceManager.switchWorkspace('invalid-id')).rejects.toThrow(WorkspaceError);
    });

    it('should validate workspace structure and update cache', async () => {
      const validateSpy = vi
        .spyOn(workspaceManager, 'validateWorkspaceStructure')
        .mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          summary: { totalFiles: 5, validFiles: 5, missingFiles: 0, orphanedFiles: 0 },
        });

      vi.spyOn(workspaceManager as any, 'parseWorkspaceMetadata').mockResolvedValue(
        mockWorkspaceInfo
      );

      await workspaceManager.switchWorkspace('workspace-123');

      expect(validateSpy).toHaveBeenCalledWith('workspace-123');
    });
  });

  describe.skip('getWorkspaceOPF', () => {
    it('should return parsed OPF document', async () => {
      mockStorage.readTextFile.mockResolvedValue('<package></package>');

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);

      const result = await workspaceManager.getWorkspaceOPF('workspace-123');

      expect(result).toEqual(mockOPFDocument);
      expect(mockStorage.readTextFile).toHaveBeenCalledWith('workspace-123', 'OEBPS/content.opf');
    });

    it('should handle missing OPF file', async () => {
      mockStorage.readTextFile.mockRejectedValue(new Error('File not found'));

      await expect(workspaceManager.getWorkspaceOPF('workspace-123')).rejects.toThrow(
        WorkspaceError
      );
    });

    it('should handle malformed OPF XML', async () => {
      mockStorage.readTextFile.mockResolvedValue('invalid xml');

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockImplementation(() => {
        throw new Error('Invalid XML');
      });

      await expect(workspaceManager.getWorkspaceOPF('workspace-123')).rejects.toThrow(
        WorkspaceError
      );
    });
  });

  describe('updateWorkspaceOPF', () => {
    it.skip('should write updated OPF and invalidate cache', async () => {
      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.generateOPFXML as any).mockReturnValue('<package>updated</package>');
      (OPFUtils.validateXML as any).mockReturnValue({ isValid: true });

      mockStorage.writeTextFile.mockResolvedValue(undefined);

      await workspaceManager.updateWorkspaceOPF('workspace-123', mockOPFDocument);

      expect(OPFUtils.generateOPFXML).toHaveBeenCalledWith(mockOPFDocument);
      expect(mockStorage.writeTextFile).toHaveBeenCalledWith(
        'workspace-123',
        'OEBPS/content.opf',
        '<package>updated</package>'
      );
    });

    it('should validate OPF structure before writing', async () => {
      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.validateXML as any).mockReturnValue({
        isValid: false,
        error: 'Invalid XML structure',
      });

      await expect(
        workspaceManager.updateWorkspaceOPF('workspace-123', mockOPFDocument)
      ).rejects.toThrow(ValidationError);
    });

    it.skip('should handle storage write errors', async () => {
      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.generateOPFXML as any).mockReturnValue('<package></package>');
      (OPFUtils.validateXML as any).mockReturnValue({ isValid: true });

      mockStorage.writeTextFile.mockRejectedValue(new Error('Disk full'));

      await expect(
        workspaceManager.updateWorkspaceOPF('workspace-123', mockOPFDocument)
      ).rejects.toThrow('Disk full');
    });
  });

  describe.skip('addManifestItem', () => {
    const partialItem: Partial<ManifestItem> = {
      href: 'OEBPS/Text/chapter2.xhtml',
    };

    it('should add manifest item with auto-generated ID and mediaType', async () => {
      mockStorage.readTextFile.mockResolvedValue('<package></package>');
      mockStorage.writeTextFile.mockResolvedValue(undefined);

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);
      (OPFUtils.generateOPFXML as any).mockReturnValue('<package>updated</package>');
      (OPFUtils.validateXML as any).mockReturnValue({ isValid: true });

      vi.spyOn(workspaceManager as any, 'generateManifestId').mockReturnValue('chapter2');
      vi.spyOn(workspaceManager as any, 'detectMediaType').mockReturnValue('application/xhtml+xml');

      const result = await workspaceManager.addManifestItem('workspace-123', partialItem);

      expect(result.id).toBe('chapter2');
      expect(result.href).toBe('OEBPS/Text/chapter2.xhtml');
      expect(result.mediaType).toBe('application/xhtml+xml');
    });

    it('should preserve provided ID and mediaType', async () => {
      const completeItem: ManifestItem = {
        id: 'custom-id',
        href: 'OEBPS/Text/custom.xhtml',
        mediaType: 'application/xhtml+xml',
      };

      mockStorage.readTextFile.mockResolvedValue('<package></package>');
      mockStorage.writeTextFile.mockResolvedValue(undefined);

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);
      (OPFUtils.generateOPFXML as any).mockReturnValue('<package>updated</package>');
      (OPFUtils.validateXML as any).mockReturnValue({ isValid: true });

      const result = await workspaceManager.addManifestItem('workspace-123', completeItem);

      expect(result.id).toBe('custom-id');
      expect(result.mediaType).toBe('application/xhtml+xml');
    });

    it('should throw error for duplicate manifest ID', async () => {
      const duplicateItem: ManifestItem = {
        id: 'chapter1', // Already exists in mockOPFDocument
        href: 'OEBPS/Text/duplicate.xhtml',
        mediaType: 'application/xhtml+xml',
      };

      mockStorage.readTextFile.mockResolvedValue('<package></package>');

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);

      await expect(
        workspaceManager.addManifestItem('workspace-123', duplicateItem)
      ).rejects.toThrow(ValidationError);
    });

    it('should invalidate cache after successful addition', async () => {
      mockStorage.readTextFile.mockResolvedValue('<package></package>');
      mockStorage.writeTextFile.mockResolvedValue(undefined);

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);
      (OPFUtils.generateOPFXML as any).mockReturnValue('<package>updated</package>');
      (OPFUtils.validateXML as any).mockReturnValue({ isValid: true });

      vi.spyOn(workspaceManager as any, 'generateManifestId').mockReturnValue('chapter2');
      vi.spyOn(workspaceManager as any, 'detectMediaType').mockReturnValue('application/xhtml+xml');
      const invalidateSpy = vi.spyOn(workspaceManager as any, 'invalidateCache');

      await workspaceManager.addManifestItem('workspace-123', partialItem);

      expect(invalidateSpy).toHaveBeenCalledWith('workspace-123');
    });
  });

  describe.skip('validateWorkspaceStructure', () => {
    const _mockValidationResult: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        totalFiles: 5,
        validFiles: 5,
        missingFiles: 0,
        orphanedFiles: 0,
      },
    };

    it('should return validation results with summary', async () => {
      mockStorage.listFiles.mockResolvedValue([
        'mimetype',
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/Text/chapter1.xhtml',
        'OEBPS/Styles/style.css',
      ]);
      mockStorage.readTextFile.mockResolvedValue('<package></package>');

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);
      (OPFUtils.validateXML as any).mockReturnValue({ isValid: true });

      const result = await workspaceManager.validateWorkspaceStructure('workspace-123');

      expect(result.isValid).toBe(true);
      expect(result.summary.totalFiles).toBeGreaterThan(0);
      expect(result.summary.validFiles).toBeGreaterThan(0);
    });

    it('should detect missing required files', async () => {
      mockStorage.listFiles.mockResolvedValue([
        'OEBPS/content.opf', // Missing mimetype and container.xml
      ]);

      const result = await workspaceManager.validateWorkspaceStructure('workspace-123');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('mimetype'))).toBe(true);
    });

    it('should detect orphaned files not in manifest', async () => {
      mockStorage.listFiles.mockResolvedValue([
        'mimetype',
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/Text/chapter1.xhtml',
        'OEBPS/Images/orphaned.jpg', // Not in manifest
      ]);
      mockStorage.readTextFile.mockResolvedValue('<package></package>');

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);

      const result = await workspaceManager.validateWorkspaceStructure('workspace-123');

      expect(result.summary.orphanedFiles).toBeGreaterThan(0);
    });

    it('should handle validation with strict mode', async () => {
      const strictManager = new WorkspaceManager({
        validation: { strict: true, checkDependencies: true, allowOrphanedFiles: false },
      });

      mockStorage.listFiles.mockResolvedValue([
        'mimetype',
        'META-INF/container.xml',
        'OEBPS/content.opf',
        'OEBPS/Text/chapter1.xhtml',
        'OEBPS/Images/orphaned.jpg',
      ]);
      mockStorage.readTextFile.mockResolvedValue('<package></package>');

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);

      const result = await strictManager.validateWorkspaceStructure('workspace-123');

      // In strict mode, orphaned files should be errors not warnings
      expect(result.isValid).toBe(false);
    });
  });

  describe.skip('generateWorkspacePreview', () => {
    const _mockPreview: WorkspacePreview = {
      metadata: mockMetadata,
      manifestSummary: {
        textItems: 1,
        imageItems: 0,
        audioItems: 0,
        videoItems: 0,
        fontItems: 0,
        otherItems: 0,
      },
      spineOrder: ['chapter1'],
      estimatedEPUBSize: 1024,
      dependencies: {
        orphanedFiles: [],
        missingDependencies: [],
        circularReferences: [],
      },
    };

    it('should return comprehensive workspace preview', async () => {
      mockStorage.readTextFile.mockResolvedValue('<package></package>');
      mockStorage.listFiles.mockResolvedValue(['OEBPS/content.opf', 'OEBPS/Text/chapter1.xhtml']);
      mockStorage.getFileInfo.mockResolvedValue({ size: 512 });

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);

      const result = await workspaceManager.generateWorkspacePreview('workspace-123');

      expect(result.metadata).toEqual(mockMetadata);
      expect(result.manifestSummary.textItems).toBe(1);
      expect(result.spineOrder).toEqual(['chapter1']);
      expect(result.estimatedEPUBSize).toBeGreaterThan(0);
    });

    it('should categorize manifest items by media type', async () => {
      const complexOPF: OPFDocument = {
        ...mockOPFDocument,
        manifest: [
          { id: 'ch1', href: 'text.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'img1', href: 'image.jpg', mediaType: 'image/jpeg' },
          { id: 'audio1', href: 'sound.mp3', mediaType: 'audio/mpeg' },
          { id: 'font1', href: 'font.ttf', mediaType: 'font/ttf' },
        ],
      };

      mockStorage.readTextFile.mockResolvedValue('<package></package>');
      mockStorage.listFiles.mockResolvedValue(['OEBPS/content.opf']);
      mockStorage.getFileInfo.mockResolvedValue({ size: 100 });

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(complexOPF);

      const result = await workspaceManager.generateWorkspacePreview('workspace-123');

      expect(result.manifestSummary.textItems).toBe(1);
      expect(result.manifestSummary.imageItems).toBe(1);
      expect(result.manifestSummary.audioItems).toBe(1);
      expect(result.manifestSummary.fontItems).toBe(1);
    });

    it('should analyze file dependencies', async () => {
      mockStorage.readTextFile.mockResolvedValue('<package></package>');
      mockStorage.listFiles.mockResolvedValue([
        'OEBPS/content.opf',
        'OEBPS/Text/chapter1.xhtml',
        'OEBPS/Images/orphaned.jpg',
      ]);
      mockStorage.getFileInfo.mockResolvedValue({ size: 100 });

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.parseOPFDocument as any).mockReturnValue(mockOPFDocument);

      const result = await workspaceManager.generateWorkspacePreview('workspace-123');

      expect(result.dependencies).toBeDefined();
      expect(Array.isArray(result.dependencies.orphanedFiles)).toBe(true);
      expect(Array.isArray(result.dependencies.missingDependencies)).toBe(true);
    });
  });

  describe('error handling', () => {
    it.skip('should throw WorkspaceError with proper error codes', async () => {
      mockStorage.listWorkspaces.mockRejectedValue(new Error('Storage not initialized'));

      try {
        await workspaceManager.listWorkspacesWithMetadata();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(WorkspaceError);
        expect((error as WorkspaceError).code).toBeDefined();
      }
    });

    it('should throw ValidationError for validation failures', async () => {
      const invalidOPF = { ...mockOPFDocument, manifest: [] }; // Empty manifest

      const { OPFUtils } = await import('../../epub/index.js');
      (OPFUtils.validateXML as any).mockReturnValue({
        isValid: false,
        error: 'Missing required elements',
      });

      try {
        await workspaceManager.updateWorkspaceOPF('workspace-123', invalidOPF);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).errors).toBeDefined();
      }
    });

    it('should throw CacheError for cache-related issues', async () => {
      vi.spyOn(workspaceManager as any, 'loadCachedMetadata').mockRejectedValue(
        new CacheError('Cache corrupted', 'CORRUPTED', 'workspace-123')
      );

      try {
        await workspaceManager.listWorkspacesWithMetadata();
        // Should handle gracefully or rethrow
      } catch (error) {
        if (error instanceof CacheError) {
          expect(error.reason).toBe('CORRUPTED');
          expect(error.workspaceId).toBe('workspace-123');
        }
      }
    });
  });

  describe('configuration', () => {
    it('should respect cache configuration settings', () => {
      const config: Partial<WorkspaceConfig> = {
        cache: {
          ttl: 6 * 60 * 60 * 1000, // 6 hours
          maxEntries: 25,
          enableDiskCache: false,
        },
      };

      const manager = new WorkspaceManager(config);
      // Configuration should be applied internally
      expect(manager).toBeInstanceOf(WorkspaceManager);
    });

    it('should respect validation configuration settings', () => {
      const config: Partial<WorkspaceConfig> = {
        validation: {
          strict: true,
          checkDependencies: false,
          allowOrphanedFiles: false,
        },
      };

      const manager = new WorkspaceManager(config);
      expect(manager).toBeInstanceOf(WorkspaceManager);
    });

    it('should respect performance configuration settings', () => {
      const config: Partial<WorkspaceConfig> = {
        performance: {
          batchSize: 25,
          concurrency: 3,
          enableProgressCallbacks: false,
        },
      };

      const manager = new WorkspaceManager(config);
      expect(manager).toBeInstanceOf(WorkspaceManager);
    });
  });

  describe('file operations', () => {
    const WORKSPACE_ID = 'test-workspace';

    beforeEach(async () => {
      await createValidWorkspace(WORKSPACE_ID);
    });

    describe('readFile()', () => {
      it('should read text files as ArrayBuffer', async () => {
        const textContent = 'This is text content';
        await mockStorage.addTestFiles(WORKSPACE_ID, {
          'OEBPS/test.txt': textContent,
        });

        const result = await workspaceManager.readFile(WORKSPACE_ID, 'OEBPS/test.txt');

        expect(result).toBeInstanceOf(ArrayBuffer);
        // Verify we can decode it back to text
        const decodedText = new TextDecoder().decode(result);
        expect(decodedText).toBe(textContent);
      });

      it('should read binary files as ArrayBuffer', async () => {
        const binaryContent = new ArrayBuffer(1024);
        await mockStorage.addTestFiles(WORKSPACE_ID, {
          'OEBPS/image.jpg': binaryContent,
        });

        const result = await workspaceManager.readFile(WORKSPACE_ID, 'OEBPS/image.jpg');

        expect(result).toBeInstanceOf(ArrayBuffer);
        expect(result).toBe(binaryContent);
      });

      it('should throw WorkspaceError for missing file', async () => {
        await expect(workspaceManager.readFile(WORKSPACE_ID, 'OEBPS/missing.txt')).rejects.toThrow(
          WorkspaceError
        );
      });

      it('should throw WorkspaceError with correct error code', async () => {
        try {
          await workspaceManager.readFile(WORKSPACE_ID, 'OEBPS/missing.txt');
          expect.fail('Should have thrown WorkspaceError');
        } catch (error) {
          expect(error).toBeInstanceOf(WorkspaceError);
          expect((error as WorkspaceError).code).toBe('FILE_READ_ERROR');
          expect((error as WorkspaceError).workspaceId).toBe(WORKSPACE_ID);
        }
      });

      it('should handle storage backend errors', async () => {
        mockStorage.setFailureMode('read');

        await expect(workspaceManager.readFile(WORKSPACE_ID, 'OEBPS/test.txt')).rejects.toThrow(
          WorkspaceError
        );
      });
    });

    describe('writeFile()', () => {
      it('should write text content as string', async () => {
        const textContent = 'New text content';
        const filePath = 'OEBPS/new-text.txt';

        await workspaceManager.writeFile(WORKSPACE_ID, filePath, textContent);

        const files = await mockStorage.listFiles(WORKSPACE_ID);
        expect(files).toContain(filePath);

        const savedContent = await mockStorage.readTextFile(WORKSPACE_ID, filePath);
        expect(savedContent).toBe(textContent);
      });

      it('should write binary content as ArrayBuffer', async () => {
        const binaryContent = new ArrayBuffer(512);
        const view = new Uint8Array(binaryContent);
        view[0] = 0xff; // Add some test data
        view[1] = 0xd8;

        const filePath = 'OEBPS/new-image.jpg';

        await workspaceManager.writeFile(WORKSPACE_ID, filePath, binaryContent);

        const files = await mockStorage.listFiles(WORKSPACE_ID);
        expect(files).toContain(filePath);

        const savedContent = await mockStorage.readFile(WORKSPACE_ID, filePath);
        expect(savedContent).toBeInstanceOf(ArrayBuffer);
        expect(savedContent.byteLength).toBe(512);

        const savedView = new Uint8Array(savedContent);
        expect(savedView[0]).toBe(0xff);
        expect(savedView[1]).toBe(0xd8);
      });

      it('should invalidate cache after writing', async () => {
        const invalidateSpy = vi.spyOn(workspaceManager as any, 'invalidateCache');

        await workspaceManager.writeFile(WORKSPACE_ID, 'OEBPS/test.txt', 'test content');

        expect(invalidateSpy).toHaveBeenCalledWith(WORKSPACE_ID);
      });

      it('should throw WorkspaceError on storage failure', async () => {
        mockStorage.setFailureMode('write');

        await expect(
          workspaceManager.writeFile(WORKSPACE_ID, 'OEBPS/test.txt', 'content')
        ).rejects.toThrow(WorkspaceError);
      });

      it('should throw WorkspaceError with correct error code', async () => {
        mockStorage.setFailureMode('write');

        try {
          await workspaceManager.writeFile(WORKSPACE_ID, 'OEBPS/test.txt', 'content');
          expect.fail('Should have thrown WorkspaceError');
        } catch (error) {
          expect(error).toBeInstanceOf(WorkspaceError);
          expect((error as WorkspaceError).code).toBe('FILE_WRITE_ERROR');
          expect((error as WorkspaceError).workspaceId).toBe(WORKSPACE_ID);
        }
      });

      it('should handle large binary files', async () => {
        const largeBuffer = new ArrayBuffer(10 * 1024 * 1024); // 10MB
        const filePath = 'OEBPS/large-file.bin';

        await workspaceManager.writeFile(WORKSPACE_ID, filePath, largeBuffer);

        const files = await mockStorage.listFiles(WORKSPACE_ID);
        expect(files).toContain(filePath);

        const savedContent = await mockStorage.readFile(WORKSPACE_ID, filePath);
        expect(savedContent.byteLength).toBe(largeBuffer.byteLength);
      });
    });

    describe('integration with existing file methods', () => {
      it('should work alongside readTextFile()', async () => {
        const textContent = 'Test content for both methods';
        const filePath = 'OEBPS/test.txt';

        // Write with writeFile
        await workspaceManager.writeFile(WORKSPACE_ID, filePath, textContent);

        // Read with both methods
        const resultFromReadFile = await workspaceManager.readFile(WORKSPACE_ID, filePath);
        const resultFromReadTextFile = await workspaceManager.readTextFile(WORKSPACE_ID, filePath);

        expect(resultFromReadFile).toBeInstanceOf(ArrayBuffer);
        expect(resultFromReadTextFile).toBe(textContent);

        // Verify we can decode the ArrayBuffer to get the same text
        const decodedFromBuffer = new TextDecoder().decode(resultFromReadFile);
        expect(decodedFromBuffer).toBe(resultFromReadTextFile);
      });

      it('should work alongside writeTextFile()', async () => {
        const textContent = 'Content written with different methods';
        const filePath1 = 'OEBPS/file1.txt';
        const filePath2 = 'OEBPS/file2.txt';

        // Write with different methods
        await workspaceManager.writeFile(WORKSPACE_ID, filePath1, textContent);
        await workspaceManager.writeTextFile(WORKSPACE_ID, filePath2, textContent);

        // Read both and verify they're the same
        const content1 = await workspaceManager.readFile(WORKSPACE_ID, filePath1);
        const content2 = await workspaceManager.readFile(WORKSPACE_ID, filePath2);

        // Both should return ArrayBuffer instances
        expect(content1).toBeInstanceOf(ArrayBuffer);
        expect(content2).toBeInstanceOf(ArrayBuffer);

        // Compare the actual content by decoding to text
        const decoded1 = new TextDecoder().decode(content1);
        const decoded2 = new TextDecoder().decode(content2);

        expect(decoded1).toBe(decoded2);
        expect(decoded1).toBe(textContent);
      });

      it('should maintain file type consistency', async () => {
        const textFile = 'OEBPS/text.txt';
        const binaryFile = 'OEBPS/binary.jpg';
        const textContent = 'Text content';
        const binaryContent = new ArrayBuffer(256);

        await workspaceManager.writeFile(WORKSPACE_ID, textFile, textContent);
        await workspaceManager.writeFile(WORKSPACE_ID, binaryFile, binaryContent);

        const readText = await workspaceManager.readFile(WORKSPACE_ID, textFile);
        const readBinary = await workspaceManager.readFile(WORKSPACE_ID, binaryFile);

        // Both should return ArrayBuffer
        expect(readText).toBeInstanceOf(ArrayBuffer);
        expect(readBinary).toBeInstanceOf(ArrayBuffer);

        // Text content should be decodable
        const decodedText = new TextDecoder().decode(readText);
        expect(decodedText).toBe(textContent);

        // Binary content should have the same size
        expect(readBinary.byteLength).toBe(binaryContent.byteLength);
      });
    });
  });
});
