import { describe, it, expect, vi } from 'vitest';
import { OutlineGenerator } from './outline-generator.js';
import type { SpineTransformPipeline } from '$lib/transform/spine-transform-pipeline';
import type { SpineItemWithSource } from '../spine/types.js';
import type { WorkspaceService } from '../services/workspace/workspace.service.js';

// Minimal transform pipeline: returns the given nav body HTML unchanged.
function mockPipeline(html: string): SpineTransformPipeline {
  return { executeTransform: vi.fn(async () => ({ html })) } as unknown as SpineTransformPipeline;
}

const navBody = '<ol><li><a href="ch1.xhtml">Chapter One</a></li></ol>';

// A spine item whose stored XHTML the mock workspace serves a heading for.
function spineItem(idref: string, linear: boolean): SpineItemWithSource {
  return {
    idref,
    linear,
    id: idref,
    href: `${idref}.xhtml`,
    mediaType: 'application/xhtml+xml',
    hasSourceFile: true,
  };
}

// Mock workspace returning a minimal valid XHTML doc with an <h1> per chapter.
function mockWorkspace(): WorkspaceService {
  return {
    readFile: vi.fn(async (_ws: string, path: string) => {
      const id = path.split('/').pop()?.replace('.xhtml', '') ?? 'x';
      const xhtml = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${id}</title></head><body><h1>${id}</h1></body></html>`;
      return new TextEncoder().encode(xhtml);
    }),
  } as unknown as WorkspaceService;
}

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

describe('OutlineGenerator.generateFromSpine linear filtering', () => {
  const pathInfo = { rootfilePath: 'OEBPS/content.opf', basePath: 'OEBPS', opfFileName: 'content.opf' };

  it('excludes spine items with linear="no" from the table of contents', async () => {
    const spine = [
      spineItem('intro', true),
      spineItem('cover-aux', false), // linear="no" — must be skipped
      spineItem('ch1', true),
    ];
    const ws = mockWorkspace();

    const doc = await OutlineGenerator.generateFromSpine(spine, ws, 'ws-1', pathInfo);

    expect(doc.xhtmlContent).toContain('href="intro.xhtml"');
    expect(doc.xhtmlContent).toContain('href="ch1.xhtml"');
    expect(doc.xhtmlContent).not.toContain('cover-aux.xhtml');
    // The non-linear item's file is never read.
    expect(ws.readFile).not.toHaveBeenCalledWith('ws-1', 'OEBPS/cover-aux.xhtml');
  });
});
