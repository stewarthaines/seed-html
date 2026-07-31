import { describe, it, expect } from 'vitest';
import { triageAxeRule, triageEpubcheckMessage } from './triage.js';

describe('triageAxeRule', () => {
  it('routes authored-content rules to source text', () => {
    expect(triageAxeRule('image-alt')).toEqual({ category: 'fixable', remedy: 'source-text' });
    expect(triageAxeRule('heading-order')).toEqual({
      category: 'fixable',
      remedy: 'source-text',
    });
  });

  it('routes design rules to the stylesheet and app-stamped attributes to metadata', () => {
    expect(triageAxeRule('color-contrast')).toEqual({
      category: 'fixable',
      remedy: 'stylesheet',
    });
    expect(triageAxeRule('html-has-lang')).toEqual({ category: 'fixable', remedy: 'metadata' });
    expect(triageAxeRule('document-title')).toEqual({
      category: 'fixable',
      remedy: 'chapter-title',
    });
  });

  it('marks ARIA validity as app bugs and web-app rules as not applicable', () => {
    expect(triageAxeRule('aria-valid-attr-value')).toEqual({ category: 'app-bug' });
    expect(triageAxeRule('button-name')).toEqual({ category: 'not-applicable' });
    expect(triageAxeRule('frame-title')).toEqual({ category: 'not-applicable' });
  });

  it('treats structure-policy rules and unknown rules as explainable', () => {
    expect(triageAxeRule('landmark-one-main')).toEqual({ category: 'explainable' });
    expect(triageAxeRule('page-has-heading-one')).toEqual({ category: 'explainable' });
    expect(triageAxeRule('some-future-rule')).toEqual({ category: 'explainable' });
  });
});

describe('triageEpubcheckMessage', () => {
  it('routes broken references to source text and CSS to the stylesheet', () => {
    expect(triageEpubcheckMessage('RSC-007')).toEqual({
      category: 'fixable',
      remedy: 'source-text',
    });
    expect(triageEpubcheckMessage('CSS-001')).toEqual({
      category: 'fixable',
      remedy: 'stylesheet',
    });
  });

  it('routes accessibility metadata and metadata-content codes to metadata', () => {
    expect(triageEpubcheckMessage('ACC-004')).toEqual({ category: 'fixable', remedy: 'metadata' });
    expect(triageEpubcheckMessage('OPF-092')).toEqual({ category: 'fixable', remedy: 'metadata' });
  });

  it('marks generated-container families as app bugs', () => {
    expect(triageEpubcheckMessage('OPF-030')).toEqual({ category: 'app-bug' });
    expect(triageEpubcheckMessage('PKG-006')).toEqual({ category: 'app-bug' });
    expect(triageEpubcheckMessage('HTM-009')).toEqual({ category: 'app-bug' });
    expect(triageEpubcheckMessage('NCX-001')).toEqual({ category: 'app-bug' });
  });

  it('defaults unknown families, unknown ids, and absent ids to explainable', () => {
    expect(triageEpubcheckMessage('MED-003')).toEqual({ category: 'explainable' });
    expect(triageEpubcheckMessage('RSC-006')).toEqual({ category: 'explainable' });
    expect(triageEpubcheckMessage('ZZZ-999')).toEqual({ category: 'explainable' });
    expect(triageEpubcheckMessage(undefined)).toEqual({ category: 'explainable' });
  });
});
