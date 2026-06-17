import { describe, it, expect, vi } from 'vitest';
import { OutlineGenerator } from './outline-generator.js';
import type { SpineTransformPipeline } from '$lib/transform/spine-transform-pipeline';

// Minimal transform pipeline: returns the given nav body HTML unchanged.
function mockPipeline(html: string): SpineTransformPipeline {
  return { executeTransform: vi.fn(async () => ({ html })) } as unknown as SpineTransformPipeline;
}

const navBody = '<ol><li><a href="ch1.xhtml">Chapter One</a></li></ol>';

describe('OutlineGenerator nav language/direction', () => {
  it('stamps xml:lang/lang and dir="rtl" on the nav <html> for an RTL book', async () => {
    const doc = await OutlineGenerator.processUserContent(
      '* Chapter One',
      mockPipeline(navBody),
      'ws-1',
      { language: 'ar' }
    );
    expect(doc.xhtmlContent).toContain('xml:lang="ar" lang="ar" dir="rtl">');
  });

  it('stamps xml:lang/lang without dir for an LTR book', async () => {
    const doc = await OutlineGenerator.processUserContent(
      '* Chapter One',
      mockPipeline(navBody),
      'ws-1',
      { language: 'en' }
    );
    expect(doc.xhtmlContent).toContain('xml:lang="en" lang="en">');
    expect(doc.xhtmlContent).not.toContain('dir="rtl"');
  });

  it('omits the language attributes (no stale lang="en") when no language is given', async () => {
    const doc = await OutlineGenerator.processUserContent(
      '* Chapter One',
      mockPipeline(navBody),
      'ws-1'
    );
    expect(doc.xhtmlContent).not.toContain('lang=');
  });
});
