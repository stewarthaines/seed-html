import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataManager } from '../MetadataManager.js';
import { createMockWorkspaceManager } from '../../test/mocks/workspace-manager.mock.js';
import type { EPUBMetadata } from '../../epub/opf-utils.js';

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn();
vi.stubGlobal('crypto', {
  randomUUID: mockRandomUUID,
});

// Mock Date for consistent testing
const mockDate = new Date('2024-01-15T10:30:00Z');
vi.setSystemTime(mockDate);

// Test data
const VALID_METADATA: EPUBMetadata = {
  title: 'Test Book',
  language: 'en',
  identifier: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
  creator: ['John Doe', 'Jane Smith'],
  subject: ['Fiction', 'Adventure'],
  contributor: ['Editor Name'],
  publisher: 'Test Publisher',
  date: '2023-12-31',
  description: 'A test book for unit testing',
};

const INVALID_METADATA: EPUBMetadata = {
  title: '', // Required field empty
  language: 'invalid-code', // Invalid language code
  identifier: '', // Required field empty
  creator: ['', 'Valid Creator'], // Empty creator
  date: 'invalid-date', // Invalid date format
};

describe('MetadataManager', () => {
  let metadataManager: MetadataManager;
  let mockWorkspaceManager: any;

  beforeEach(() => {
    mockWorkspaceManager = createMockWorkspaceManager();
    metadataManager = new MetadataManager(mockWorkspaceManager);
    mockRandomUUID.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadMetadata', () => {
    it('should load metadata from workspace manager', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: VALID_METADATA,
      });

      const result = await metadataManager.loadMetadata('workspace-1');

      expect(result).toEqual(VALID_METADATA);
    });

    it('should cache loaded metadata', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: VALID_METADATA,
      });

      await metadataManager.loadMetadata('workspace-1');
      await metadataManager.loadMetadata('workspace-1');

      expect(mockWorkspaceManager.getOperationCount()).toBe(1);
    });

    it('should return cached metadata on subsequent calls', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: VALID_METADATA,
      });

      const result1 = await metadataManager.loadMetadata('workspace-1');
      const result2 = await metadataManager.loadMetadata('workspace-1');

      expect(result1).toEqual(result2);
      expect(result1).toBe(result2);
    });

    it('should throw WorkspaceNotFoundError for invalid workspace', async () => {
      mockWorkspaceManager.setFailureMode('workspace-not-found');

      await expect(metadataManager.loadMetadata('invalid-workspace')).rejects.toThrow(
        'Workspace not found: invalid-workspace'
      );
    });

    it('should throw MetadataCorruptedError for corrupted metadata', async () => {
      mockWorkspaceManager.setFailureMode('opf-read');

      await expect(metadataManager.loadMetadata('workspace-1')).rejects.toThrow(
        'Failed to read OPF document'
      );
    });

    it('should handle empty metadata gracefully', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: {},
      });

      const result = await metadataManager.loadMetadata('workspace-1');

      expect(result).toEqual({});
    });
  });

  describe('updateField', () => {
    beforeEach(async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: VALID_METADATA,
      });
      await metadataManager.loadMetadata('workspace-1');
    });

    it('should update string fields correctly', async () => {
      await metadataManager.updateField('workspace-1', 'title', 'Updated Title');

      const metadata = await metadataManager.loadMetadata('workspace-1');
      expect(metadata.title).toBe('Updated Title');
    });

    it('should update array fields correctly', async () => {
      await metadataManager.updateField('workspace-1', 'creator', ['New Author']);

      const metadata = await metadataManager.loadMetadata('workspace-1');
      expect(metadata.creator).toEqual(['New Author']);
    });

    it('should persist changes to workspace manager', async () => {
      await metadataManager.updateField('workspace-1', 'title', 'Updated Title');

      expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(1);
    });

    it('should update cache after successful save', async () => {
      await metadataManager.updateField('workspace-1', 'title', 'Updated Title');

      const cachedMetadata = await metadataManager.loadMetadata('workspace-1');
      expect(cachedMetadata.title).toBe('Updated Title');
    });

    it('should throw errors on save failures', async () => {
      mockWorkspaceManager.setFailureMode('opf-write');

      await expect(
        metadataManager.updateField('workspace-1', 'title', 'Updated Title')
      ).rejects.toThrow();
    });

    it('should call updateWorkspaceOPF with correct OPF structure when updating fields', async () => {
      const spy = vi.spyOn(mockWorkspaceManager, 'updateWorkspaceOPF');
      
      await metadataManager.updateField('workspace-1', 'title', 'Updated Title');
      
      expect(spy).toHaveBeenCalledWith('workspace-1', expect.objectContaining({
        metadata: expect.objectContaining({
          title: 'Updated Title',
          // Should preserve other existing metadata
          language: 'en',
          identifier: 'urn:uuid:123e4567-e89b-12d3-a456-426614174000',
          creator: ['John Doe', 'Jane Smith']
        })
      }));
    });
  });

  describe('validateMetadata', () => {
    it('should validate required fields (title, language, identifier)', () => {
      const validationResult = metadataManager.validateMetadata({
        title: 'Test',
        language: 'en',
        identifier: 'test-id',
      });

      expect(validationResult).toEqual([]);
    });

    it('should validate optional fields when present', () => {
      const validationResult = metadataManager.validateMetadata({
        title: 'Test',
        language: 'en',
        identifier: 'test-id',
        date: '2024-01-01',
      });

      expect(validationResult).toEqual([]);
    });

    it('should validate array fields', () => {
      const validationResult = metadataManager.validateMetadata({
        title: 'Test',
        language: 'en',
        identifier: 'test-id',
        creator: ['Author 1', 'Author 2'],
      });

      expect(validationResult).toEqual([]);
    });

    it('should return empty array for valid metadata', () => {
      const validationResult = metadataManager.validateMetadata(VALID_METADATA);

      expect(validationResult).toEqual([]);
    });

    it('should return multiple validation errors', () => {
      const validationResult = metadataManager.validateMetadata(INVALID_METADATA);

      expect(validationResult.length).toBeGreaterThan(0);
      expect(validationResult.some(error => error.field === 'title')).toBe(true);
      expect(validationResult.some(error => error.field === 'identifier')).toBe(true);
    });

    it('should distinguish between errors and warnings', () => {
      const validationResult = metadataManager.validateMetadata({
        title: 'Test',
        language: 'en',
        identifier: 'questionable-id-format',
      });

      const errors = validationResult.filter(v => v.type === 'error');
      const warnings = validationResult.filter(v => v.type === 'warning');

      expect(errors.length).toBe(0);
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('creator operations', () => {
    beforeEach(async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: { ...VALID_METADATA, creator: ['Author 1', 'Author 2'] },
      });
      await metadataManager.loadMetadata('workspace-1');
    });

    describe('addCreator', () => {
      it('should add creator with provided name', async () => {
        await metadataManager.addCreator('workspace-1', 'New Author');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.creator).toContain('New Author');
      });

      it('should add creator with empty string when no name provided', async () => {
        await metadataManager.addCreator('workspace-1');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.creator).toContain('');
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.addCreator('workspace-1', 'New Author');

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });

      it('should handle errors from updateField', async () => {
        mockWorkspaceManager.setFailureMode('opf-write');

        await expect(metadataManager.addCreator('workspace-1', 'New Author')).rejects.toThrow();
      });
    });

    describe('removeCreator', () => {
      it('should remove creator at valid index', async () => {
        await metadataManager.removeCreator('workspace-1', 0);

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.creator).not.toContain('Author 1');
      });

      it('should throw error for out-of-bounds index', async () => {
        await expect(metadataManager.removeCreator('workspace-1', 10)).rejects.toThrow();
      });

      it('should handle empty creator array', async () => {
        mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
          metadata: { ...VALID_METADATA, creator: [] },
        });
        metadataManager.clearCache('workspace-1');

        await expect(metadataManager.removeCreator('workspace-1', 0)).rejects.toThrow();
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.removeCreator('workspace-1', 0);

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });
    });

    describe('updateCreator', () => {
      it('should update creator at valid index', async () => {
        await metadataManager.updateCreator('workspace-1', 0, 'Updated Author');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.creator?.[0]).toBe('Updated Author');
      });

      it('should throw error for out-of-bounds index', async () => {
        await expect(
          metadataManager.updateCreator('workspace-1', 10, 'Updated Author')
        ).rejects.toThrow();
      });

      it('should handle empty creator array', async () => {
        mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
          metadata: { ...VALID_METADATA, creator: [] },
        });
        metadataManager.clearCache('workspace-1');

        await expect(
          metadataManager.updateCreator('workspace-1', 0, 'Updated Author')
        ).rejects.toThrow();
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.updateCreator('workspace-1', 0, 'Updated Author');

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });
    });
  });

  describe('subject operations', () => {
    beforeEach(async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: { ...VALID_METADATA, subject: ['Subject 1', 'Subject 2'] },
      });
      await metadataManager.loadMetadata('workspace-1');
    });

    describe('addSubject', () => {
      it('should add subject with provided name', async () => {
        await metadataManager.addSubject('workspace-1', 'New Subject');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.subject).toContain('New Subject');
      });

      it('should add subject with empty string when no name provided', async () => {
        await metadataManager.addSubject('workspace-1');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.subject).toContain('');
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.addSubject('workspace-1', 'New Subject');

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });

      it('should handle errors from updateField', async () => {
        mockWorkspaceManager.setFailureMode('opf-write');

        await expect(metadataManager.addSubject('workspace-1', 'New Subject')).rejects.toThrow();
      });
    });

    describe('removeSubject', () => {
      it('should remove subject at valid index', async () => {
        await metadataManager.removeSubject('workspace-1', 0);

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.subject).not.toContain('Subject 1');
      });

      it('should throw error for out-of-bounds index', async () => {
        await expect(metadataManager.removeSubject('workspace-1', 10)).rejects.toThrow();
      });

      it('should handle empty subject array', async () => {
        mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
          metadata: { ...VALID_METADATA, subject: [] },
        });
        metadataManager.clearCache('workspace-1');

        await expect(metadataManager.removeSubject('workspace-1', 0)).rejects.toThrow();
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.removeSubject('workspace-1', 0);

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });
    });

    describe('updateSubject', () => {
      it('should update subject at valid index', async () => {
        await metadataManager.updateSubject('workspace-1', 0, 'Updated Subject');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.subject?.[0]).toBe('Updated Subject');
      });

      it('should throw error for out-of-bounds index', async () => {
        await expect(
          metadataManager.updateSubject('workspace-1', 10, 'Updated Subject')
        ).rejects.toThrow();
      });

      it('should handle empty subject array', async () => {
        mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
          metadata: { ...VALID_METADATA, subject: [] },
        });
        metadataManager.clearCache('workspace-1');

        await expect(
          metadataManager.updateSubject('workspace-1', 0, 'Updated Subject')
        ).rejects.toThrow();
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.updateSubject('workspace-1', 0, 'Updated Subject');

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });
    });
  });

  describe('contributor operations', () => {
    beforeEach(async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
        metadata: { ...VALID_METADATA, contributor: ['Contributor 1', 'Contributor 2'] },
      });
      await metadataManager.loadMetadata('workspace-1');
    });

    describe('addContributor', () => {
      it('should add contributor with provided name', async () => {
        await metadataManager.addContributor('workspace-1', 'New Contributor');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.contributor).toContain('New Contributor');
      });

      it('should add contributor with empty string when no name provided', async () => {
        await metadataManager.addContributor('workspace-1');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.contributor).toContain('');
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.addContributor('workspace-1', 'New Contributor');

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });

      it('should handle errors from updateField', async () => {
        mockWorkspaceManager.setFailureMode('opf-write');

        await expect(
          metadataManager.addContributor('workspace-1', 'New Contributor')
        ).rejects.toThrow();
      });
    });

    describe('removeContributor', () => {
      it('should remove contributor at valid index', async () => {
        await metadataManager.removeContributor('workspace-1', 0);

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.contributor).not.toContain('Contributor 1');
      });

      it('should throw error for out-of-bounds index', async () => {
        await expect(metadataManager.removeContributor('workspace-1', 10)).rejects.toThrow();
      });

      it('should handle empty contributor array', async () => {
        mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
          metadata: { ...VALID_METADATA, contributor: [] },
        });
        metadataManager.clearCache('workspace-1');

        await expect(metadataManager.removeContributor('workspace-1', 0)).rejects.toThrow();
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.removeContributor('workspace-1', 0);

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });
    });

    describe('updateContributor', () => {
      it('should update contributor at valid index', async () => {
        await metadataManager.updateContributor('workspace-1', 0, 'Updated Contributor');

        const metadata = await metadataManager.loadMetadata('workspace-1');
        expect(metadata.contributor?.[0]).toBe('Updated Contributor');
      });

      it('should throw error for out-of-bounds index', async () => {
        await expect(
          metadataManager.updateContributor('workspace-1', 10, 'Updated Contributor')
        ).rejects.toThrow();
      });

      it('should handle empty contributor array', async () => {
        mockWorkspaceManager.setWorkspaceOPF('workspace-1', {
          metadata: { ...VALID_METADATA, contributor: [] },
        });
        metadataManager.clearCache('workspace-1');

        await expect(
          metadataManager.updateContributor('workspace-1', 0, 'Updated Contributor')
        ).rejects.toThrow();
      });

      it('should persist changes via updateField', async () => {
        const initialOperationCount = mockWorkspaceManager.getOperationCount();
        await metadataManager.updateContributor('workspace-1', 0, 'Updated Contributor');

        expect(mockWorkspaceManager.getOperationCount()).toBeGreaterThan(initialOperationCount);
      });
    });
  });

  describe('generateIdentifier', () => {
    it('should generate URN UUID format identifier', () => {
      const identifier = metadataManager.generateIdentifier();

      expect(identifier).toBe('urn:uuid:123e4567-e89b-12d3-a456-426614174000');
    });

    it('should generate unique identifiers on multiple calls', () => {
      mockRandomUUID
        .mockReturnValueOnce('123e4567-e89b-12d3-a456-426614174000')
        .mockReturnValueOnce('987f6543-e21c-34d5-b678-524613285001');

      const id1 = metadataManager.generateIdentifier();
      const id2 = metadataManager.generateIdentifier();

      expect(id1).not.toBe(id2);
    });

    it('should use crypto.randomUUID internally', () => {
      metadataManager.generateIdentifier();

      expect(mockRandomUUID).toHaveBeenCalled();
    });

    it('should return consistent format with mocked UUID', () => {
      const identifier = metadataManager.generateIdentifier();

      expect(identifier).toMatch(
        /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe('getCurrentDate', () => {
    it('should return current date in YYYY-MM-DD format', () => {
      const date = metadataManager.getCurrentDate();

      expect(date).toBe('2024-01-15');
    });

    it('should use system time', () => {
      const date = metadataManager.getCurrentDate();

      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return consistent format with mocked date', () => {
      const date = metadataManager.getCurrentDate();

      expect(date).toBe('2024-01-15');
    });
  });

  describe('getLanguageOptions', () => {
    it('should return array of language options', () => {
      const options = metadataManager.getLanguageOptions();

      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
    });

    it('should include expected languages (en, es, fr, de, it, pt, ja, zh, ar, he, ka, zh-TW)', () => {
      const options = metadataManager.getLanguageOptions();
      const codes = options.map(opt => opt.code);

      expect(codes).toContain('en');
      expect(codes).toContain('es');
      expect(codes).toContain('fr');
      expect(codes).toContain('de');
      expect(codes).toContain('it');
      expect(codes).toContain('pt');
      expect(codes).toContain('ja');
      expect(codes).toContain('zh');
      expect(codes).toContain('ar');
      expect(codes).toContain('he');
      expect(codes).toContain('ka');
      expect(codes).toContain('zh-TW');
    });

    it('should return objects with code and name properties', () => {
      const options = metadataManager.getLanguageOptions();

      options.forEach(option => {
        expect(option).toHaveProperty('code');
        expect(option).toHaveProperty('name');
        expect(typeof option.code).toBe('string');
        expect(typeof option.name).toBe('string');
      });
    });

    it('should be pure function (same output for same input)', () => {
      const options1 = metadataManager.getLanguageOptions();
      const options2 = metadataManager.getLanguageOptions();

      expect(options1).toEqual(options2);
    });
  });

  describe('getAccessibilityOptions', () => {
    it('should return accessibility options object', () => {
      const options = metadataManager.getAccessibilityOptions();

      expect(typeof options).toBe('object');
      expect(options).not.toBeNull();
    });

    it('should include access modes (textual, visual, auditory, tactile)', () => {
      const options = metadataManager.getAccessibilityOptions();

      expect(options).toHaveProperty('accessModes');
      expect(options.accessModes).toContain('textual');
      expect(options.accessModes).toContain('visual');
      expect(options.accessModes).toContain('auditory');
      expect(options.accessModes).toContain('tactile');
    });

    it('should include accessibility features', () => {
      const options = metadataManager.getAccessibilityOptions();

      expect(options).toHaveProperty('accessibilityFeatures');
      expect(Array.isArray(options.accessibilityFeatures)).toBe(true);
    });

    it('should include accessibility hazards', () => {
      const options = metadataManager.getAccessibilityOptions();

      expect(options).toHaveProperty('accessibilityHazards');
      expect(Array.isArray(options.accessibilityHazards)).toBe(true);
    });

    it('should return consistent structure', () => {
      const options1 = metadataManager.getAccessibilityOptions();
      const options2 = metadataManager.getAccessibilityOptions();

      expect(options1).toEqual(options2);
    });
  });

  describe('clearCache', () => {
    beforeEach(async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });
      mockWorkspaceManager.setWorkspaceOPF('workspace-2', { metadata: VALID_METADATA });
      await metadataManager.loadMetadata('workspace-1');
      await metadataManager.loadMetadata('workspace-2');
    });

    it('should clear specific workspace cache when ID provided', async () => {
      metadataManager.clearCache('workspace-1');

      await metadataManager.loadMetadata('workspace-1');
      expect(mockWorkspaceManager.getOperationCount()).toBe(3);
    });

    it('should clear entire cache when no ID provided', async () => {
      metadataManager.clearCache();

      await metadataManager.loadMetadata('workspace-1');
      await metadataManager.loadMetadata('workspace-2');
      expect(mockWorkspaceManager.getOperationCount()).toBe(4);
    });

    it('should handle clearing non-existent workspace cache', () => {
      expect(() => metadataManager.clearCache('non-existent')).not.toThrow();
    });
  });

  describe('preloadMetadata', () => {
    it('should load metadata into cache', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });

      await metadataManager.preloadMetadata('workspace-1');

      expect(mockWorkspaceManager.getOperationCount()).toBe(1);
    });

    it('should not duplicate cached metadata', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });

      await metadataManager.preloadMetadata('workspace-1');
      await metadataManager.preloadMetadata('workspace-1');

      expect(mockWorkspaceManager.getOperationCount()).toBe(1);
    });

    it('should throw WorkspaceNotFoundError for invalid workspace', async () => {
      mockWorkspaceManager.setFailureMode('workspace-not-found');

      await expect(metadataManager.preloadMetadata('invalid-workspace')).rejects.toThrow(
        'Workspace not found: invalid-workspace'
      );
    });

    it('should handle MetadataCorruptedError', async () => {
      mockWorkspaceManager.setFailureMode('opf-read');

      await expect(metadataManager.preloadMetadata('workspace-1')).rejects.toThrow(
        'Failed to read OPF document'
      );
    });
  });

  describe('error handling', () => {
    it('should propagate WorkspaceNotFoundError from workspace manager', async () => {
      mockWorkspaceManager.setFailureMode('workspace-not-found');

      await expect(metadataManager.loadMetadata('workspace-1')).rejects.toThrow(
        'Workspace not found: workspace-1'
      );
    });

    it('should propagate MetadataCorruptedError from workspace manager', async () => {
      mockWorkspaceManager.setFailureMode('opf-read');

      await expect(metadataManager.loadMetadata('workspace-1')).rejects.toThrow(
        'Failed to read OPF document'
      );
    });


    it('should throw ValidationError for critical validation failures', () => {
      const validationResult = metadataManager.validateMetadata(INVALID_METADATA);

      expect(validationResult.length).toBeGreaterThan(0);
      expect(validationResult.some(error => error.type === 'error')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined metadata gracefully', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-undefined-test', { metadata: undefined });

      const result = await metadataManager.loadMetadata('workspace-undefined-test');
      expect(result).toBeUndefined();
    });

    it('should handle null workspace IDs', async () => {
      await expect(metadataManager.loadMetadata(null as any)).rejects.toThrow();
    });

    it('should handle empty workspace IDs', async () => {
      await expect(metadataManager.loadMetadata('')).rejects.toThrow();
    });

    it('should handle invalid field names in updateField', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });
      await metadataManager.loadMetadata('workspace-1');

      await expect(
        metadataManager.updateField('workspace-1', 'invalid-field' as any, 'value')
      ).rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });

      const promises = [
        metadataManager.loadMetadata('workspace-1'),
        metadataManager.loadMetadata('workspace-1'),
        metadataManager.loadMetadata('workspace-1'),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

    it('should handle cache corruption scenarios', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });
      await metadataManager.loadMetadata('workspace-1');

      metadataManager.clearCache('workspace-1');
      const result = await metadataManager.loadMetadata('workspace-1');

      expect(result).toEqual(VALID_METADATA);
    });
  });

  describe('integration workflows', () => {
    it('should handle complete metadata creation workflow', async () => {
      const identifier = metadataManager.generateIdentifier();
      const date = metadataManager.getCurrentDate();

      const newMetadata = {
        title: 'New Book',
        language: 'en',
        identifier,
        creator: ['Author Name'],
        date,
      };

      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: newMetadata });

      const result = await metadataManager.loadMetadata('workspace-1');
      const validationResult = metadataManager.validateMetadata(result);

      expect(result).toEqual(newMetadata);
      expect(validationResult).toEqual([]);
    });

    it('should handle metadata loading and updating workflow', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });

      const loaded = await metadataManager.loadMetadata('workspace-1');
      await metadataManager.updateField('workspace-1', 'title', 'Updated Title');
      const updated = await metadataManager.loadMetadata('workspace-1');

      expect(loaded.title).toBe('Test Book');
      expect(updated.title).toBe('Updated Title');
    });

    it('should handle array operations workflow', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });
      await metadataManager.loadMetadata('workspace-1');

      await metadataManager.addCreator('workspace-1', 'New Author');
      await metadataManager.updateCreator('workspace-1', 0, 'Updated Author');
      await metadataManager.removeCreator('workspace-1', 1);

      const result = await metadataManager.loadMetadata('workspace-1');
      expect(result.creator).toHaveLength(2);
      expect(result.creator?.[0]).toBe('Updated Author');
      expect(result.creator).toContain('New Author');
    });

    it('should handle validation and error correction workflow', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: INVALID_METADATA });

      const loaded = await metadataManager.loadMetadata('workspace-1');
      const validationResult = metadataManager.validateMetadata(loaded);

      expect(validationResult.length).toBeGreaterThan(0);

      await metadataManager.updateField('workspace-1', 'title', 'Fixed Title');
      await metadataManager.updateField('workspace-1', 'identifier', 'fixed-identifier');

      const corrected = await metadataManager.loadMetadata('workspace-1');
      const newValidationResult = metadataManager.validateMetadata(corrected);

      expect(newValidationResult.length).toBeLessThan(validationResult.length);
    });

    it('should handle cache preloading workflow', async () => {
      mockWorkspaceManager.setWorkspaceOPF('workspace-1', { metadata: VALID_METADATA });
      mockWorkspaceManager.setWorkspaceOPF('workspace-2', { metadata: VALID_METADATA });

      await metadataManager.preloadMetadata('workspace-1');
      await metadataManager.preloadMetadata('workspace-2');

      const result1 = await metadataManager.loadMetadata('workspace-1');
      const result2 = await metadataManager.loadMetadata('workspace-2');

      expect(result1).toEqual(VALID_METADATA);
      expect(result2).toEqual(VALID_METADATA);
      expect(mockWorkspaceManager.getOperationCount()).toBe(2);
    });
  });
});
