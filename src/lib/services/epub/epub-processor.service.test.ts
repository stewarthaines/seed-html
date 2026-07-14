/**
 * Unit tests for the EPUBProcessor service wrapper.
 *
 * The processor is a thin delegation layer over EPUBUnpacker/EPUBPackager/
 * OPFUtils; the delegates carry their own suites, so these tests pin the
 * wrapper's contract: lazy storage init, error wrapping into
 * EPUBProcessorError codes, and validate-returns-instead-of-throws.
 *
 * Namespaced-OPF parsing is stubbed (happy-dom cannot parse namespaced XML);
 * only the regex/string OPFUtils paths run for real.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EPUBProcessor, EPUBProcessorError } from './epub-processor.service.js';
import { OPFUtils } from '../../epub/opf-utils.js';
import type { FileStorageAPI } from '../../storage/index.js';

const unpackEPUB = vi.fn();
const validateEPUBStructure = vi.fn();
const packageEPUB = vi.fn();

vi.mock('../../epub/EPUBUnpacker.js', () => ({
  EPUBUnpacker: vi.fn(() => ({ unpackEPUB, validateEPUBStructure })),
}));

vi.mock('../../epub/EPUBPackager.js', () => ({
  EPUBPackager: vi.fn(() => ({ packageEPUB })),
}));

// Zip's constructor parses central-directory bytes; irrelevant to the wrapper.
vi.mock('../../zip/index.js', () => ({
  Zip: vi.fn(function (this: { data: ArrayBuffer }, data: ArrayBuffer) {
    if (data.byteLength === 0) throw new Error('empty zip');
    this.data = data;
  }),
}));

function mockStorage(initialized: boolean): FileStorageAPI {
  return {
    isInitialized: vi.fn().mockReturnValue(initialized),
    init: vi.fn().mockResolvedValue(undefined),
  } as unknown as FileStorageAPI;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('unpackEPUB', () => {
  const file = new File(['zipbytes'], 'book.epub');

  it('initializes storage first when uninitialized, then delegates', async () => {
    const storage = mockStorage(false);
    const result = { success: true };
    unpackEPUB.mockResolvedValue(result);

    const processor = new EPUBProcessor(storage);

    await expect(processor.unpackEPUB(file, 'ws-1')).resolves.toBe(result);
    expect(storage.init).toHaveBeenCalledTimes(1);
    expect(unpackEPUB).toHaveBeenCalledWith(file, 'ws-1');
  });

  it('skips storage init when already initialized', async () => {
    const storage = mockStorage(true);
    unpackEPUB.mockResolvedValue({ success: true });

    await new EPUBProcessor(storage).unpackEPUB(file, 'ws-1');

    expect(storage.init).not.toHaveBeenCalled();
  });

  it('wraps delegate failures in EPUBProcessorError with EPUB_UNPACK_ERROR', async () => {
    unpackEPUB.mockRejectedValue(new Error('bad central directory'));

    const attempt = new EPUBProcessor(mockStorage(true)).unpackEPUB(file, 'ws-1');

    await expect(attempt).rejects.toBeInstanceOf(EPUBProcessorError);
    await expect(attempt).rejects.toMatchObject({
      code: 'EPUB_UNPACK_ERROR',
      message: expect.stringContaining('bad central directory'),
    });
  });
});

describe('validateEPUBStructure', () => {
  it('returns the delegate verdict for a readable zip', async () => {
    const verdict = { isValid: true, errors: [], warnings: ['no cover'] };
    validateEPUBStructure.mockResolvedValue(verdict);

    const result = await new EPUBProcessor(mockStorage(true)).validateEPUBStructure(
      new ArrayBuffer(8)
    );

    expect(result).toBe(verdict);
  });

  it('returns a validation failure instead of throwing on unreadable data', async () => {
    const result = await new EPUBProcessor(mockStorage(true)).validateEPUBStructure(
      new ArrayBuffer(0)
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('empty zip');
    expect(result.warnings).toEqual([]);
  });
});

describe('packageEPUB', () => {
  it('initializes storage first when uninitialized, then delegates with options', async () => {
    const storage = mockStorage(false);
    const result = { success: true };
    packageEPUB.mockResolvedValue(result);
    const options = { includeSource: false };

    const processor = new EPUBProcessor(storage);

    await expect(processor.packageEPUB('ws-1', options)).resolves.toBe(result);
    expect(storage.init).toHaveBeenCalledTimes(1);
    expect(packageEPUB).toHaveBeenCalledWith('ws-1', options);
  });

  it('wraps delegate failures with EPUB_PACKAGE_ERROR', async () => {
    packageEPUB.mockRejectedValue(new Error('missing content.opf'));

    const attempt = new EPUBProcessor(mockStorage(true)).packageEPUB('ws-1');

    await expect(attempt).rejects.toMatchObject({
      name: 'EPUBProcessorError',
      code: 'EPUB_PACKAGE_ERROR',
      message: expect.stringContaining('missing content.opf'),
    });
  });
});

describe('OPF document processing', () => {
  it('parseOPFDocument delegates to OPFUtils', () => {
    const doc = { metadata: {}, manifest: [], spine: [] };
    const spy = vi.spyOn(OPFUtils, 'parseOPFDocument').mockReturnValue(doc as never);

    expect(new EPUBProcessor(mockStorage(true)).parseOPFDocument('<package/>')).toBe(doc);
    expect(spy).toHaveBeenCalledWith('<package/>');
    spy.mockRestore();
  });

  it('parseOPFDocument wraps parse failures with OPF_PARSE_ERROR', () => {
    const spy = vi.spyOn(OPFUtils, 'parseOPFDocument').mockImplementation(() => {
      throw new Error('no package element');
    });

    expect(() => new EPUBProcessor(mockStorage(true)).parseOPFDocument('garbage')).toThrowError(
      expect.objectContaining({ code: 'OPF_PARSE_ERROR' })
    );
    spy.mockRestore();
  });

  it('generateOPFXML wraps generation failures with OPF_GENERATE_ERROR', () => {
    const spy = vi.spyOn(OPFUtils, 'generateOPFXML').mockImplementation(() => {
      throw new Error('unserializable');
    });

    expect(() => new EPUBProcessor(mockStorage(true)).generateOPFXML({} as never)).toThrowError(
      expect.objectContaining({ code: 'OPF_GENERATE_ERROR' })
    );
    spy.mockRestore();
  });

  it('parseOPFMetadata hands the parsed Document to OPFUtils', () => {
    const metadata = { title: 'A Book' };
    const spy = vi.spyOn(OPFUtils, 'parseOPFMetadata').mockReturnValue(metadata as never);

    const result = new EPUBProcessor(mockStorage(true)).parseOPFMetadata(
      '<package><metadata/></package>'
    );

    expect(result).toBe(metadata);
    expect(spy.mock.calls[0][0].querySelector('metadata')).not.toBeNull();
    spy.mockRestore();
  });

  it('parseOPFMetadata wraps invalid XML with OPF_METADATA_PARSE_ERROR', () => {
    expect(() =>
      new EPUBProcessor(mockStorage(true)).parseOPFMetadata('<package><unclosed')
    ).toThrowError(expect.objectContaining({ code: 'OPF_METADATA_PARSE_ERROR' }));
  });
});

describe('container and version helpers (real OPFUtils string paths)', () => {
  it('generateContainerXML embeds the rootfile path, defaulting to OEBPS/content.opf', () => {
    const processor = new EPUBProcessor(mockStorage(true));

    expect(processor.generateContainerXML()).toContain('full-path="OEBPS/content.opf"');
    expect(processor.generateContainerXML('EPUB/package.opf')).toContain(
      'full-path="EPUB/package.opf"'
    );
  });

  it('parseRootfilePath extracts the full-path attribute', () => {
    const container = new EPUBProcessor(mockStorage(true)).generateContainerXML('OPS/book.opf');

    expect(new EPUBProcessor(mockStorage(true)).parseRootfilePath(container)).toBe('OPS/book.opf');
  });

  it('parseRootfilePath wraps a missing rootfile with ROOTFILE_PARSE_ERROR', () => {
    expect(() =>
      new EPUBProcessor(mockStorage(true)).parseRootfilePath('<container></container>')
    ).toThrowError(expect.objectContaining({ code: 'ROOTFILE_PARSE_ERROR' }));
  });

  it('detectEPUBVersion reads the package version attribute', () => {
    const processor = new EPUBProcessor(mockStorage(true));

    expect(processor.detectEPUBVersion('<package version="3.0"></package>')).toBe('EPUB 3.0');
    expect(processor.detectEPUBVersion('not xml <<<')).toBeUndefined();
  });

  it('validateManifestSpineConsistency reports spine idrefs missing from the manifest', () => {
    const processor = new EPUBProcessor(mockStorage(true));
    const manifest = [{ id: 'ch1', href: 'ch1.xhtml', mediaType: 'application/xhtml+xml' }];

    const errors = processor.validateManifestSpineConsistency(
      manifest as never,
      [
        { idref: 'ch1', linear: true },
        { idref: 'ghost', linear: true },
      ] as never
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('ghost');
  });
});
