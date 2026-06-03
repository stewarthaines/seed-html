import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@likecoin/epubcheck-ts', () => ({
  EpubCheck: { validate: vi.fn() },
}));

import { EpubCheck } from '@likecoin/epubcheck-ts';
import {
  validateEpub,
  publishLatestReport,
  clearLatestReport,
  summarizeReport,
  type ValidationReport,
} from './epub-validation.js';

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

describe('summarizeReport', () => {
  const make = (
    levels: Array<'error' | 'warning' | 'info'>,
  ): ValidationReport => ({
    filename: 'book.epub',
    isValid: levels.every((l) => l !== 'error'),
    timestamp: 1,
    errorCount: levels.filter((l) => l === 'error').length,
    warningCount: levels.filter((l) => l === 'warning').length,
    messages: levels.map((level) => ({ level, message: level })),
  });

  it('counts messages per level', () => {
    expect(
      summarizeReport(make(['error', 'warning', 'warning', 'info'])),
    ).toEqual({
      error: 1,
      warning: 2,
      info: 1,
    });
  });

  it('is all-zero for a clean report', () => {
    expect(summarizeReport(make([]))).toEqual({
      error: 0,
      warning: 0,
      info: 0,
    });
  });
});

describe('latest-report mirror (localStorage)', () => {
  const KEY = 'editme_validation_report';
  const report: ValidationReport = {
    filename: 'book.epub',
    isValid: false,
    timestamp: 123,
    errorCount: 1,
    warningCount: 0,
    messages: [{ level: 'error', message: 'boom' }],
  };

  beforeEach(() => localStorage.clear());

  it('publishLatestReport writes the serialized report to the shared key', () => {
    publishLatestReport(report);
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual(report);
  });

  it('clearLatestReport removes the mirror only when the filename matches', () => {
    publishLatestReport(report);
    clearLatestReport('other.epub');
    expect(localStorage.getItem(KEY)).not.toBeNull();
    clearLatestReport('book.epub');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
