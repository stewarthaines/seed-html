import { describe, it, expect, beforeEach } from 'vitest';
import {
  VALIDATION_REPORT_STORAGE_KEY,
  readValidationReport,
  readAddressedIndices,
  writeAddressedIndices,
  chapterIdOf,
  messagesForChapter,
  chaptersWithIssues,
  type ValidationReport,
} from './validation-report';

const report: ValidationReport = {
  filename: 'book.epub',
  isValid: false,
  timestamp: 1000,
  errorCount: 2,
  warningCount: 1,
  messages: [
    { level: 'error', id: 'RSC-007', message: 'missing', location: { path: 'OEBPS/Text/one.xhtml', line: 42, column: 10 } },
    { level: 'warning', message: 'attr', location: { path: 'OEBPS/Text/one.xhtml', line: 5 } },
    { level: 'error', message: 'broken', location: { path: 'Text/two.xhtml#frag' } },
    { level: 'info', message: 'fyi', location: { path: 'OEBPS/Text/three.xhtml' } },
    { level: 'error', message: 'opf', location: { path: 'OEBPS/content.opf', line: 1 } },
    { level: 'error', message: 'no location' },
  ],
};

describe('readValidationReport', () => {
  beforeEach(() => localStorage.clear());

  it('parses a valid stored report', () => {
    localStorage.setItem(VALIDATION_REPORT_STORAGE_KEY, JSON.stringify(report));
    expect(readValidationReport()).toEqual(report);
  });

  it('returns null when the key is absent', () => {
    expect(readValidationReport()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem(VALIDATION_REPORT_STORAGE_KEY, '{not json');
    expect(readValidationReport()).toBeNull();
  });

  it('returns null for a wrong-shaped object', () => {
    localStorage.setItem(VALIDATION_REPORT_STORAGE_KEY, JSON.stringify({ filename: 'x' }));
    expect(readValidationReport()).toBeNull();
  });
});

describe('addressed-index persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips indices for the matching report timestamp', () => {
    writeAddressedIndices(1000, [0, 2, 5]);
    expect(readAddressedIndices(1000)).toEqual([0, 2, 5]);
  });

  it('returns [] when the stored timestamp does not match (re-validated)', () => {
    writeAddressedIndices(1000, [0, 2]);
    expect(readAddressedIndices(2000)).toEqual([]);
  });

  it('returns [] when nothing is stored', () => {
    expect(readAddressedIndices(1000)).toEqual([]);
  });
});

describe('chapterIdOf', () => {
  it('strips the OEBPS prefix, extension, and fragment', () => {
    expect(chapterIdOf('OEBPS/Text/one.xhtml')).toBe('one');
    expect(chapterIdOf('Text/two.xhtml#frag')).toBe('two');
    expect(chapterIdOf('three.xhtml')).toBe('three');
  });

  it('returns null for non-xhtml paths', () => {
    expect(chapterIdOf('OEBPS/content.opf')).toBeNull();
    expect(chapterIdOf('OEBPS/Styles/main.css')).toBeNull();
  });
});

describe('messagesForChapter', () => {
  it('returns every message (incl. info) whose location resolves to the chapter', () => {
    expect(messagesForChapter(report, 'one').map((m) => m.message)).toEqual(['missing', 'attr']);
    expect(messagesForChapter(report, 'three').map((m) => m.message)).toEqual(['fyi']);
  });

  it('returns [] for a null report or null chapter', () => {
    expect(messagesForChapter(null, 'one')).toEqual([]);
    expect(messagesForChapter(report, null)).toEqual([]);
  });
});

describe('chaptersWithIssues', () => {
  it('lists error/warning chapters in first-seen order with counts', () => {
    expect(chaptersWithIssues(report)).toEqual([
      { chapterId: 'one', errorCount: 1, warningCount: 1 },
      { chapterId: 'two', errorCount: 1, warningCount: 0 },
    ]);
  });

  it('excludes info-only chapters, non-content locations, and unlocated messages', () => {
    const ids = chaptersWithIssues(report).map((c) => c.chapterId);
    expect(ids).not.toContain('three'); // info only
    expect(ids).not.toContain('content'); // .opf
  });

  it('returns [] for a null report', () => {
    expect(chaptersWithIssues(null)).toEqual([]);
  });
});
