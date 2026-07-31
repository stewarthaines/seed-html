import { describe, it, expect } from 'vitest';
import { buildEpubcheckSection } from './epubcheck-section.js';
import type { ValidationReport } from '../plugins/validation-report.js';

const report = (overrides: Partial<ValidationReport> = {}): ValidationReport => ({
  filename: 'Bulletin.epub',
  identifier: 'urn:uuid:abc',
  isValid: false,
  timestamp: 1000,
  errorCount: 1,
  warningCount: 0,
  messages: [
    {
      level: 'error',
      id: 'RSC-007',
      message: 'Referenced resource could not be found',
      location: { path: 'OEBPS/Text/chapter01.xhtml', line: 12 },
    },
    { level: 'info', id: 'ACC-004', message: 'Add schema:accessMode' },
  ],
  ...overrides,
});

const metadata = { identifier: 'urn:uuid:abc', modifiedDate: new Date(500).toISOString() };

describe('buildEpubcheckSection', () => {
  it('reports none without a report', () => {
    expect(buildEpubcheckSection(null, metadata)).toEqual({ status: 'none' });
  });

  it('reports different-project on identifier mismatch or absence, without messages', () => {
    const mismatch = buildEpubcheckSection(report(), {
      ...metadata,
      identifier: 'urn:uuid:other',
    });
    expect(mismatch.status).toBe('different-project');
    expect(mismatch.messages).toBeUndefined();
    expect(mismatch.filename).toBe('Bulletin.epub');

    expect(buildEpubcheckSection(report({ identifier: undefined }), metadata).status).toBe(
      'different-project'
    );
    expect(buildEpubcheckSection(report(), { modifiedDate: metadata.modifiedDate }).status).toBe(
      'different-project'
    );
  });

  it('reports stale when the project was modified after validation', () => {
    const section = buildEpubcheckSection(report(), {
      ...metadata,
      modifiedDate: new Date(2000).toISOString(),
    });
    expect(section.status).toBe('stale');
    expect(section.validatedAt).toBe(1000);
    expect(section.projectModified).toBe(new Date(2000).toISOString());
    // Stale still returns messages — the agent judges with the verdict in hand.
    expect(section.messages).toHaveLength(2);
  });

  it('reports current otherwise, including when modifiedDate is unparseable', () => {
    expect(buildEpubcheckSection(report(), metadata).status).toBe('current');
    expect(
      buildEpubcheckSection(report(), { ...metadata, modifiedDate: 'not-a-date' }).status
    ).toBe('current');
    expect(buildEpubcheckSection(report(), { identifier: 'urn:uuid:abc' }).status).toBe('current');
  });

  it('tags messages with triage and chapter attribution, keeping info level', () => {
    const section = buildEpubcheckSection(report(), metadata);
    expect(section.messages?.[0]).toMatchObject({
      id: 'RSC-007',
      chapterId: 'chapter01',
      category: 'fixable',
      remedy: 'source-text',
    });
    // Info-level ACC message survives (that's where accessibility-metadata
    // suggestions live) and has no chapter attribution.
    expect(section.messages?.[1]).toMatchObject({
      level: 'info',
      category: 'fixable',
      remedy: 'metadata',
    });
    expect(section.messages?.[1].chapterId).toBeUndefined();
    expect(section.isValid).toBe(false);
    expect(section.errorCount).toBe(1);
  });
});
