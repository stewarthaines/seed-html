import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@likecoin/epubcheck-ts', () => ({
  EpubCheck: { validate: vi.fn() },
}));

import { EpubCheck } from '@likecoin/epubcheck-ts';
import { validateEpub } from './epub-validation.js';

const mockValidate = vi.mocked(EpubCheck.validate);

const epubFile = () => new File([new Uint8Array([1, 2, 3])], 'book.epub');

const baseResult = {
  valid: true,
  messages: [],
  fatalCount: 0,
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,
  usageCount: 0,
  elapsedMs: 1,
};

describe('validateEpub mapping', () => {
  beforeEach(() => mockValidate.mockReset());

  it('surfaces location (path + line/col), rule id, and suggestion', async () => {
    mockValidate.mockResolvedValue({
      ...baseResult,
      valid: false,
      errorCount: 1,
      messages: [
        {
          id: 'RSC-007',
          severity: 'error',
          message: 'Referenced resource not found',
          location: { path: 'OEBPS/Text/index.xhtml', line: 42, column: 10 },
          suggestion: 'Add the missing file',
        },
      ],
    });

    const report = await validateEpub(epubFile());
    expect(report.isValid).toBe(false);
    expect(report.errorCount).toBe(1);
    expect(report.messages[0]).toEqual({
      level: 'error',
      id: 'RSC-007',
      message: 'Referenced resource not found',
      location: { path: 'OEBPS/Text/index.xhtml', line: 42, column: 10 },
      suggestion: 'Add the missing file',
    });
  });

  it('counts fatal as an error and folds usage to info', async () => {
    mockValidate.mockResolvedValue({
      ...baseResult,
      valid: false,
      fatalCount: 1,
      usageCount: 1,
      messages: [
        { id: 'F', severity: 'fatal', message: 'boom' },
        { id: 'U', severity: 'usage', message: 'fyi' },
      ],
    });

    const report = await validateEpub(epubFile());
    expect(report.errorCount).toBe(1); // fatalCount + errorCount
    expect(report.messages.map((m) => m.level)).toEqual(['error', 'info']);
  });

  it('omits location when epubcheck provides none', async () => {
    mockValidate.mockResolvedValue({
      ...baseResult,
      messages: [{ id: 'PKG-001', severity: 'info', message: 'note' }],
    });

    const report = await validateEpub(epubFile());
    expect(report.messages[0].location).toBeUndefined();
  });
});
