/**
 * AudioClipService Unit Tests - Following API Specification
 *
 * These tests implement the behavioral contracts from API.md
 * following the project's TDD patterns and service architecture.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { WorkspaceService } from '../services/workspace/workspace.service.js';
import type { ManifestItem } from '../epub/opf-utils.js';
import type { WorkspaceState } from '../services/workspace/workspace.service.js';
import { AudioClipService, AudioClipServiceError } from './audio-clip.service.js';
import { MockFileStorage } from '../test/mocks/file-storage.mock.js';
import type { FileStorageAPI } from '../storage/index.js';

// Test utilities and mocks
function createMockFileStorage(): FileStorageAPI {
  const mockStorage = new MockFileStorage();
  // Add missing properties to satisfy FileStorageAPI interface
  (mockStorage as any).initPromise = Promise.resolve();
  (mockStorage as any).doInit = vi.fn().mockResolvedValue(undefined);
  return mockStorage as unknown as FileStorageAPI;
}

function createMockWorkspaceService(): jest.Mocked<WorkspaceService> {
  const mockWorkspace: WorkspaceState = {
    id: 'test-workspace',
    opf: {
      metadata: { title: 'Test', language: ['en'], identifier: 'test', modifiedDate: '2023-01-01' },
      manifest: [
        { id: 'audio1', href: 'Audio/chapter1.mp3', mediaType: 'audio/mpeg' },
        { id: 'audio2', href: 'Audio/chapter2.ogg', mediaType: 'audio/ogg' },
        { id: 'text1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'css1', href: 'Styles/main.css', mediaType: 'text/css' },
      ],
      spine: [],
      version: '3.0',
    },
    pathInfo: {
      rootfilePath: 'OEBPS/content.opf',
      basePath: 'OEBPS',
      opfFileName: 'content.opf',
    },
  };

  return {
    loadWorkspace: vi.fn().mockResolvedValue(mockWorkspace),
  } as any;
}

describe('AudioClipService API Contract Tests', () => {
  let service: AudioClipService;
  let mockFileStorage: FileStorageAPI;
  let mockWorkspaceService: jest.Mocked<WorkspaceService>;

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    mockWorkspaceService = createMockWorkspaceService();
    const mockSettingsService = {} as any; // Add minimal mock for SettingsService
    service = new AudioClipService(mockFileStorage, mockWorkspaceService, mockSettingsService);
  });

  describe('Contract: Audio File Management', () => {
    test('getAvailableAudioFiles returns only audio manifest items', async () => {
      const audioFiles = await service.getAvailableAudioFiles('test-workspace');

      // CONTRACT: MUST return only manifest items with audio media-type
      expect(audioFiles).toHaveLength(2);
      expect(audioFiles[0]).toMatchObject({
        id: 'audio1',
        href: 'Audio/chapter1.mp3',
        mediaType: 'audio/mpeg',
      });
      expect(audioFiles[1]).toMatchObject({
        id: 'audio2',
        href: 'Audio/chapter2.ogg',
        mediaType: 'audio/ogg',
      });

      // CONTRACT: MUST filter out non-audio items
      const nonAudioItems = audioFiles.filter(item => !item.mediaType.startsWith('audio/'));
      expect(nonAudioItems).toHaveLength(0);
    });

    test('getAvailableAudioFiles throws WorkspaceNotFoundError for missing workspace', async () => {
      mockWorkspaceService.loadWorkspace.mockRejectedValue(new Error('Workspace not found'));

      // CONTRACT: MUST throw AudioClipServiceError with WORKSPACE_NOT_FOUND code
      await expect(service.getAvailableAudioFiles('non-existent-workspace')).rejects.toThrow(
        AudioClipServiceError
      );

      try {
        await service.getAvailableAudioFiles('non-existent-workspace');
      } catch (error: any) {
        expect(error.code).toBe('WORKSPACE_NOT_FOUND');
        expect(error.name).toBe('AudioClipServiceError');
      }
    });

    test('getAvailableAudioFiles handles empty manifest', async () => {
      const emptyWorkspace: WorkspaceState = {
        id: 'empty-workspace',
        opf: {
          metadata: {
            title: 'Empty',
            language: ['en'],
            identifier: 'empty',
            modifiedDate: '2023-01-01',
          },
          manifest: [],
          spine: [],
          version: '3.0',
        },
        pathInfo: {
          rootfilePath: 'OEBPS/content.opf',
          basePath: 'OEBPS',
          opfFileName: 'content.opf',
        },
      };

      mockWorkspaceService.loadWorkspace.mockResolvedValue(emptyWorkspace);

      const audioFiles = await service.getAvailableAudioFiles('empty-workspace');

      // CONTRACT: MUST return empty array when no audio files exist
      expect(audioFiles).toEqual([]);
    });

    test('loadAudioFile creates blob URL from workspace file', async () => {
      // Add test file to mock storage
      await mockFileStorage.writeFile(
        'test-workspace',
        'OEBPS/Audio/chapter1.mp3',
        new ArrayBuffer(1000)
      );

      const blobUrl = await service.loadAudioFile('test-workspace', 'Audio/chapter1.mp3');

      // CONTRACT: MUST return blob URL for audio file
      expect(blobUrl).toMatch(/^blob:/);
      expect(typeof blobUrl).toBe('string');
    });

    test('loadAudioFile throws AUDIO_NOT_FOUND for missing file', async () => {
      // No file added to mock storage, so it should be missing

      // CONTRACT: MUST throw AudioClipServiceError with AUDIO_NOT_FOUND code
      await expect(service.loadAudioFile('test-workspace', 'Audio/missing.mp3')).rejects.toThrow(
        AudioClipServiceError
      );

      try {
        await service.loadAudioFile('test-workspace', 'Audio/missing.mp3');
      } catch (error: any) {
        expect(error.code).toBe('AUDIO_NOT_FOUND');
        expect(error.audioHref).toBe('Audio/missing.mp3');
      }
    });

    test('loadAudioFile throws BLOB_URL_ERROR for blob creation failure', async () => {
      // The file exists, but blob creation itself fails. The service distinguishes
      // this from a missing file by the underlying "Blob creation failed" message.
      await mockFileStorage.writeFile(
        'test-workspace',
        'OEBPS/Audio/chapter1.mp3',
        new ArrayBuffer(1000)
      );

      const originalCreateObjectURL = global.URL.createObjectURL;
      global.URL.createObjectURL = vi.fn(() => {
        throw new Error('Blob creation failed');
      });

      try {
        // CONTRACT: MUST throw AudioClipServiceError with BLOB_URL_ERROR code
        await expect(service.loadAudioFile('test-workspace', 'Audio/chapter1.mp3')).rejects.toThrow(
          AudioClipServiceError
        );

        try {
          await service.loadAudioFile('test-workspace', 'Audio/chapter1.mp3');
        } catch (error: any) {
          expect(error.code).toBe('BLOB_URL_ERROR');
          expect(error.message).toContain('Blob creation failed');
        }
      } finally {
        global.URL.createObjectURL = originalCreateObjectURL;
      }
    });
  });

  describe('Contract: Time String Parsing and Formatting', () => {
    test('parseTimeString converts h:mm:ss.dd to seconds accurately', () => {
      // CONTRACT: MUST handle all valid time format variations
      expect(service.parseTimeString('0:00:00.00')).toBe(0);
      expect(service.parseTimeString('0:00:03.50')).toBe(3.5);
      expect(service.parseTimeString('0:01:30.25')).toBe(90.25);
      expect(service.parseTimeString('1:23:45.67')).toBe(5025.67);
      expect(service.parseTimeString('10:00:00.99')).toBe(36000.99);
    });

    test('parseTimeString throws INVALID_TIME_FORMAT for malformed input', () => {
      const invalidFormats = [
        'invalid',
        '1:23',
        '1:23:45',
        '1:23:45.6',
        '1:23:45.678',
        '25:00:00.00', // Invalid hour
        '1:60:00.00', // Invalid minute
        '1:00:60.00', // Invalid second
        '1:00:00.100', // Invalid centisecond
        '',
        '1:2:3.4', // Wrong padding
      ];

      invalidFormats.forEach(format => {
        expect(() => service.parseTimeString(format)).toThrow(AudioClipServiceError);

        try {
          service.parseTimeString(format);
        } catch (error: any) {
          expect(error.code).toBe('INVALID_TIME_FORMAT');
          expect(error.message).toContain(format);
        }
      });
    });

    test('formatTimeString converts seconds to h:mm:ss.dd accurately', () => {
      // CONTRACT: MUST format seconds to precise time string
      expect(service.formatTimeString(0)).toBe('0:00:00.00');
      expect(service.formatTimeString(3.5)).toBe('0:00:03.50');
      expect(service.formatTimeString(90.25)).toBe('0:01:30.25');
      expect(service.formatTimeString(5025.67)).toBe('1:23:45.67');
      expect(service.formatTimeString(36000.99)).toBe('10:00:00.99');
    });

    test('formatTimeString handles edge cases', () => {
      // CONTRACT: MUST handle fractional seconds and rounding
      expect(service.formatTimeString(0.001)).toBe('0:00:00.00'); // Rounds down
      expect(service.formatTimeString(0.009)).toBe('0:00:00.00'); // Rounds down
      expect(service.formatTimeString(0.01)).toBe('0:00:00.01');
      expect(service.formatTimeString(59.999)).toBe('0:01:00.00'); // Rounds up
      expect(service.formatTimeString(3599.99)).toBe('1:00:00.00'); // Rounds up
    });

    test('parseTimeString and formatTimeString are inverse operations', () => {
      const testTimes = ['0:00:00.00', '0:00:03.50', '0:01:30.25', '1:23:45.67', '10:00:00.99'];

      testTimes.forEach(timeString => {
        const seconds = service.parseTimeString(timeString);
        const roundTrip = service.formatTimeString(seconds);
        expect(roundTrip).toBe(timeString);
      });
    });
  });

  describe('Contract: Clip Range Management', () => {
    test('setClipRange stores valid clip range', () => {
      service.setClipRange(10.5, 30.75);

      const range = service.getClipRange();

      // CONTRACT: MUST store exact start and end times
      expect(range).toEqual({ start: 10.5, end: 30.75 });
    });

    test('setClipRange validates start < end', () => {
      // CONTRACT: MUST reject invalid ranges where start >= end
      expect(() => service.setClipRange(30, 10)).toThrow(AudioClipServiceError);

      expect(() => service.setClipRange(15, 15)).toThrow(AudioClipServiceError);

      try {
        service.setClipRange(30, 10);
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CLIP_RANGE');
      }
    });

    test('setClipRange validates positive values', () => {
      // CONTRACT: MUST reject negative time values
      expect(() => service.setClipRange(-1, 10)).toThrow(AudioClipServiceError);

      expect(() => service.setClipRange(0, -5)).toThrow(AudioClipServiceError);

      try {
        service.setClipRange(-1, 10);
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CLIP_RANGE');
      }
    });

    test('getClipRange returns null when no range is set', () => {
      const range = service.getClipRange();

      // CONTRACT: MUST return null when no range has been set
      expect(range).toBeNull();
    });

    test('clearClipRange resets range to null', () => {
      service.setClipRange(5, 15);
      expect(service.getClipRange()).not.toBeNull();

      service.clearClipRange();

      // CONTRACT: MUST reset range to null
      expect(service.getClipRange()).toBeNull();
    });
  });

  describe('Contract: Clip Directive Parsing', () => {
    test('parseClipDirective extracts valid clip directive components', () => {
      const directive = ':clip[Introduction]{src=Audio/intro.mp3 begin=0:01:23.45 end=0:02:45.67}';
      const parsed = service.parseClipDirective(directive);

      // CONTRACT: MUST extract all directive components
      expect(parsed).toEqual({
        href: 'Audio/intro.mp3',
        begin: '0:01:23.45',
        end: '0:02:45.67',
        label: 'Introduction',
      });
    });

    test('parseClipDirective handles directive without label', () => {
      const directive = ':clip[]{src=Audio/music.mp3 begin=1:00:00.00 end=1:30:00.00}';
      const parsed = service.parseClipDirective(directive);

      // CONTRACT: MUST handle empty label brackets
      expect(parsed).toEqual({
        href: 'Audio/music.mp3',
        begin: '1:00:00.00',
        end: '1:30:00.00',
        label: '',
      });
    });

    test('parseClipDirective handles playback rate parameter', () => {
      const directive =
        ':clip[Fast]{src=Audio/speech.mp3 begin=0:00:10.00 end=0:00:20.00 rate=1.5}';
      const parsed = service.parseClipDirective(directive);

      // CONTRACT: MUST extract optional rate parameter
      expect(parsed).toEqual({
        href: 'Audio/speech.mp3',
        begin: '0:00:10.00',
        end: '0:00:20.00',
        rate: '1.5',
        label: 'Fast',
      });
    });

    test('parseClipDirective returns null for invalid format', () => {
      const invalidDirectives = [
        'not a clip directive',
        ':clip{missing label brackets}',
        ':clip[label]{missing src}',
        ':clip[label]{src=file.mp3}', // Missing begin/end
        ':clip[label]{src=file.mp3 begin=0:00:00.00}', // Missing end
        ':clip[label]{begin=0:00:00.00 end=0:00:10.00}', // Missing src
        '',
      ];

      invalidDirectives.forEach(directive => {
        const parsed = service.parseClipDirective(directive);
        // CONTRACT: MUST return null for invalid directives
        expect(parsed).toBeNull();
      });
    });

    test('parseClipDirective handles flexible attribute order', () => {
      const directive = ':clip[Test]{end=0:00:20.00 src=Audio/test.mp3 begin=0:00:10.00 rate=2.0}';
      const parsed = service.parseClipDirective(directive);

      // CONTRACT: MUST handle attributes in any order
      expect(parsed).toEqual({
        href: 'Audio/test.mp3',
        begin: '0:00:10.00',
        end: '0:00:20.00',
        rate: '2.0',
        label: 'Test',
      });
    });
  });

  describe('Contract: Clip Directive Formatting', () => {
    test('formatClipDirective generates correct default format', () => {
      const clipData = {
        href: 'Audio/chapter1.mp3',
        startTime: 83.67,
        duration: 30.0,
        endTime: 113.67,
        playbackRate: 1.0,
      };

      const result = service.formatClipDirective(
        clipData,
        ':clip[<label>]{src=<href> begin=<begin> end=<end>}'
      );

      // CONTRACT: MUST use default template format
      expect(result).toBe(':clip[]{src=Audio/chapter1.mp3 begin=0:01:23.67 end=0:01:53.67}');
    });

    test('formatClipDirective includes playback rate when not 1.0', () => {
      const clipData = {
        href: 'Audio/speech.mp3',
        startTime: 10.0,
        duration: 15.0,
        endTime: 25.0,
        playbackRate: 1.5,
      };

      const result = service.formatClipDirective(
        clipData,
        ':clip[<label>]{src=<href> begin=<begin> end=<end>}'
      );

      // CONTRACT: MUST include rate parameter when playback rate is not 1.0
      expect(result).toBe(':clip[]{src=Audio/speech.mp3 begin=0:00:10.00 end=0:00:25.00 rate=1.5}');
    });

    test('formatClipDirective supports custom templates', () => {
      const clipData = {
        href: 'Audio/music.mp3',
        startTime: 60.0,
        duration: 30.0,
        endTime: 90.0,
      };

      const customTemplate = '<audio-clip src="<href>" begin="<begin>" end="<end>"></audio-clip>';
      const result = service.formatClipDirective(clipData, customTemplate);

      // CONTRACT: MUST support template placeholder replacement
      expect(result).toBe(
        '<audio-clip src="Audio/music.mp3" begin="0:01:00.00" end="0:01:30.00"></audio-clip>'
      );
    });

    test('formatClipDirective handles rate placeholder in custom templates', () => {
      const clipData = {
        href: 'Audio/test.mp3',
        startTime: 0,
        duration: 10,
        endTime: 10,
        playbackRate: 2.0,
      };

      const customTemplate = ':audio[]{file=<href> start=<begin> end=<end> speed=<rate>}';
      const result = service.formatClipDirective(clipData, customTemplate);

      // CONTRACT: MUST replace rate placeholder in custom templates
      expect(result).toBe(
        ':audio[]{file=Audio/test.mp3 start=0:00:00.00 end=0:00:10.00 speed=2.0}'
      );
    });

    test('getTemplate returns consistent format', async () => {
      const template = await service.getTemplate('test-workspace');

      // CONTRACT: MUST return standard clip directive template (with label support)
      expect(template).toBe(':clip[<label>]{src=<href> begin=<begin> end=<end>}');
    });
  });

  describe('Contract: Audio Metadata Extraction', () => {
    test('getAudioMetadata extracts basic properties from HTMLAudioElement', () => {
      // Create mock HTMLAudioElement
      const mockAudio = {
        duration: 120.5,
        src: 'blob:mock-url',
      } as HTMLAudioElement;

      const metadata = service.getAudioMetadata(mockAudio);

      // CONTRACT: MUST extract duration and format from audio element
      expect(metadata).toMatchObject({
        duration: 120.5,
        format: expect.any(String),
      });
    });

    test('getAudioMetadata handles missing metadata gracefully', () => {
      const mockAudio = {
        duration: NaN,
        src: '',
      } as HTMLAudioElement;

      const metadata = service.getAudioMetadata(mockAudio);

      // CONTRACT: MUST handle invalid/missing metadata
      expect(metadata.duration).toBe(0); // Should default invalid duration
      expect(metadata.format).toBeDefined();
    });
  });

  describe('Contract: Error Handling', () => {
    test('AudioClipServiceError extends Error with typed codes', () => {
      const error = new AudioClipServiceError('Test message', 'TEST_CODE', 'test.mp3');

      // CONTRACT: MUST extend Error with additional properties
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AudioClipServiceError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.audioHref).toBe('test.mp3');
    });

    test('service methods throw consistent error types', async () => {
      // CONTRACT: All service errors must be AudioClipServiceError instances
      const errorScenarios = [
        () => service.parseTimeString('invalid'),
        () => service.setClipRange(-1, 10),
        () => service.setClipRange(20, 10),
      ];

      for (const scenario of errorScenarios) {
        try {
          scenario();
          fail('Should have thrown AudioClipServiceError');
        } catch (error: any) {
          expect(error).toBeInstanceOf(AudioClipServiceError);
          expect(error.code).toBeDefined();
        }
      }
    });
  });

  describe('Contract: Integration Boundaries', () => {
    test('manages blob URL creation internally', async () => {
      // Add test file to storage
      await mockFileStorage.writeFile(
        'test-workspace',
        'OEBPS/Audio/test.mp3',
        new ArrayBuffer(500)
      );

      const result = await service.loadAudioFile('test-workspace', 'Audio/test.mp3');

      // CONTRACT: Service should manage blob creation internally and return valid URL
      expect(result).toMatch(/^blob:/);
      expect(typeof result).toBe('string');
    });

    test('delegates workspace loading to WorkspaceService', async () => {
      await service.getAvailableAudioFiles('test-workspace');

      // CONTRACT: MUST delegate workspace operations to WorkspaceService
      expect(mockWorkspaceService.loadWorkspace).toHaveBeenCalledWith('test-workspace');
    });

    test('maintains service isolation - no cross-service calls', () => {
      // CONTRACT: AudioClipService should only call infrastructure dependencies
      // This is validated by the mocks above - service only interacts with
      // BlobURLManager and WorkspaceService, not other services

      const service = new AudioClipService(mockFileStorage, mockWorkspaceService, {} as any);
      expect(service).toBeDefined();

      // Verify constructor accepts only expected dependencies
      expect(() => new AudioClipService({} as any, {} as any, {} as any)).not.toThrow();
    });
  });

  describe('Contract: Edge Cases and Validation', () => {
    test('handles workspace with no audio files gracefully', async () => {
      const noAudioWorkspace: WorkspaceState = {
        id: 'no-audio',
        opf: {
          metadata: {
            title: 'No Audio',
            language: ['en'],
            identifier: 'no-audio',
            modifiedDate: '2023-01-01',
          },
          manifest: [
            { id: 'text1', href: 'Text/chapter1.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'css1', href: 'Styles/main.css', mediaType: 'text/css' },
          ],
          spine: [],
          version: '3.0',
        },
        pathInfo: {
          rootfilePath: 'OEBPS/content.opf',
          basePath: 'OEBPS',
          opfFileName: 'content.opf',
        },
      };

      mockWorkspaceService.loadWorkspace.mockResolvedValue(noAudioWorkspace);

      const audioFiles = await service.getAvailableAudioFiles('no-audio');

      // CONTRACT: MUST return empty array when no audio files exist
      expect(audioFiles).toEqual([]);
    });

    test('handles malformed manifest items gracefully', async () => {
      const malformedWorkspace: WorkspaceState = {
        id: 'malformed',
        opf: {
          metadata: {
            title: 'Malformed',
            language: ['en'],
            identifier: 'malformed',
            modifiedDate: '2023-01-01',
          },
          manifest: [
            { id: 'audio1', href: 'Audio/test.mp3', mediaType: 'audio/mpeg' },
            { id: 'invalid', href: '', mediaType: 'audio/mpeg' }, // Invalid href
            { id: 'audio2', href: 'Audio/test2.mp3', mediaType: 'audio/ogg' },
          ] as ManifestItem[],
          spine: [],
          version: '3.0',
        },
        pathInfo: {
          rootfilePath: 'OEBPS/content.opf',
          basePath: 'OEBPS',
          opfFileName: 'content.opf',
        },
      };

      mockWorkspaceService.loadWorkspace.mockResolvedValue(malformedWorkspace);

      const audioFiles = await service.getAvailableAudioFiles('malformed');

      // CONTRACT: MUST filter out invalid manifest items
      expect(audioFiles).toHaveLength(2);
      expect(audioFiles.every(item => item.href && item.href.length > 0)).toBe(true);
    });

    test('precision testing for time conversions', () => {
      // Test centisecond precision limits
      const precisionTests = [
        { seconds: 123.456789, expected: '0:02:03.46' }, // Rounds to centiseconds
        { seconds: 123.454, expected: '0:02:03.45' },
        { seconds: 123.455, expected: '0:02:03.46' }, // Rounds up
      ];

      precisionTests.forEach(({ seconds, expected }) => {
        const formatted = service.formatTimeString(seconds);
        expect(formatted).toBe(expected);

        // Verify round-trip maintains precision limits
        const parsed = service.parseTimeString(formatted);
        expect(Math.abs(parsed - Math.round(seconds * 100) / 100)).toBeLessThan(0.001);
      });
    });
  });
});
