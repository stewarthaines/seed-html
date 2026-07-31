import { describe, it, expect } from 'vitest';
import { buildA11ySection, type AxeRuleResult } from './a11y-section.js';

const rule = (overrides: Partial<AxeRuleResult>): AxeRuleResult => ({
  id: 'image-alt',
  impact: 'critical',
  description: 'Images must have alternate text',
  help: 'Images must have alternate text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
  nodes: [{ target: ['img'], html: '<img src="cover.png">' }],
  ...overrides,
});

describe('buildA11ySection', () => {
  it('triages and sorts violations by impact severity', () => {
    const section = buildA11ySection('foliate', {
      violations: [
        rule({ id: 'landmark-one-main', impact: 'moderate' }),
        rule({ id: 'image-alt', impact: 'critical' }),
        rule({ id: 'color-contrast', impact: 'serious' }),
      ],
    });
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section.engine).toBe('foliate');
    expect(section.caveats).toEqual([]);
    expect(section.violations.map(v => v.id)).toEqual([
      'image-alt',
      'color-contrast',
      'landmark-one-main',
    ]);
    expect(section.violations[0]).toMatchObject({ category: 'fixable', remedy: 'source-text' });
    expect(section.violations[1]).toMatchObject({ category: 'fixable', remedy: 'stylesheet' });
    expect(section.violations[2]).toMatchObject({ category: 'explainable' });
  });

  it('surfaces the incomplete bucket as needsReview and flags paged chrome', () => {
    const section = buildA11ySection('paged', {
      violations: [],
      incomplete: [rule({ id: 'color-contrast', impact: null })],
    });
    if (section.status !== 'ok') throw new Error('expected ok');
    expect(section.caveats).toEqual(['paged-chrome']);
    expect(section.violations).toEqual([]);
    expect(section.needsReview).toHaveLength(1);
    expect(section.needsReview[0]).toMatchObject({
      id: 'color-contrast',
      category: 'fixable',
      remedy: 'stylesheet',
    });
  });

  it('reports a clean run explicitly, and trims oversized html snippets', () => {
    const clean = buildA11ySection('raw', { violations: [], incomplete: [] });
    expect(clean).toEqual({
      status: 'ok',
      engine: 'raw',
      caveats: [],
      violations: [],
      needsReview: [],
    });

    const long = buildA11ySection('raw', {
      violations: [rule({ nodes: [{ target: ['p'], html: 'x'.repeat(500) }] })],
    });
    if (long.status !== 'ok') throw new Error('expected ok');
    expect(long.violations[0].nodes[0].html).toHaveLength(401);
    expect(long.violations[0].nodes[0].html.endsWith('…')).toBe(true);
  });
});
