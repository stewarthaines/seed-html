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
  const pathInfo = {
    rootfilePath: 'OEBPS/content.opf',
    basePath: 'OEBPS',
    opfFileName: 'content.opf',
  };

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
    // (The non-linear item's file is still read, for page markers: a marker
    // belongs in the page-list wherever it is in the spine.)
  });
});

describe('OutlineGenerator.processUserContent nav blocks', () => {
  const pathInfo = {
    rootfilePath: 'OEBPS/content.opf',
    basePath: 'OEBPS',
    opfFileName: 'content.opf',
  };
  const navs = (xhtml: string) =>
    Array.from(
      new DOMParser().parseFromString(xhtml, 'application/xhtml+xml').getElementsByTagName('nav')
    ).map(nav => ({
      type: nav.getAttribute('epub:type'),
      hidden: nav.hasAttribute('hidden'),
      id: nav.getAttribute('id'),
      links: Array.from(nav.getElementsByTagName('a')).map(a => a.getAttribute('href')),
    }));

  // A djot-rendered nav.txt with a toc block, a landmarks block and a page-list block.
  const blocksHtml = `<div class="toc">
<h1 id="Contents">Contents</h1>
<ul>
<li><p><a href="Text/foreword.xhtml">Foreword</a></p></li>
<li><p><a href="Text/essay01.xhtml">Essay 1</a></p>
<ul><li><a href="Text/essay01.xhtml#S">Section</a></li></ul>
</li>
</ul>
</div>
<div class="landmarks">
<ul>
<li><a href="nav.xhtml#toc" epub:type="toc">Contents</a></li>
<li><a href="Text/foreword.xhtml" epub:type="bodymatter">Start reading</a></li>
</ul>
</div>
<div class="page-list">
<ul><li><a href="Text/foreword.xhtml#page7">7</a></li></ul>
</div>`;

  it('runs the text transform only', async () => {
    const pipeline = mockPipeline(navBody);
    await OutlineGenerator.processUserContent('x', pipeline, 'ws-1');
    expect(pipeline.executeTransform).toHaveBeenCalledWith('x', 2000, 'nav', undefined, {
      textOnly: true,
    });
  });

  it('writes the toc and a hidden landmarks nav, and leaves an authored page-list out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = await OutlineGenerator.processUserContent('x', mockPipeline(blocksHtml), 'ws-1');
    expect(navs(doc.xhtmlContent)).toEqual([
      {
        type: 'toc',
        hidden: false,
        id: 'toc',
        links: ['Text/foreword.xhtml', 'Text/essay01.xhtml', 'Text/essay01.xhtml#S'],
      },
      {
        type: 'landmarks',
        hidden: true,
        id: null,
        links: ['nav.xhtml#toc', 'Text/foreword.xhtml'],
      },
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('page-list block is left out'));
    warn.mockRestore();
  });

  it('lifts the paragraph out of a loose list item that has a nested list', async () => {
    const doc = await OutlineGenerator.processUserContent('x', mockPipeline(blocksHtml), 'ws-1');
    expect(doc.xhtmlContent).not.toMatch(/<li>\s*<p>/);
    expect(doc.xhtmlContent).not.toContain('<ul');
  });

  it('builds the toc from the spine when nav.txt holds only landmarks', async () => {
    const landmarksOnly = blocksHtml.slice(blocksHtml.indexOf('<div class="landmarks">'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = await OutlineGenerator.processUserContent(
      'x',
      mockPipeline(landmarksOnly),
      'ws-1',
      {
        spine: {
          items: [spineItem('intro', true), spineItem('ch1', true)],
          workspaceService: mockWorkspace(),
          pathInfo,
        },
      }
    );
    const [toc, landmarks] = navs(doc.xhtmlContent);
    expect(toc.links).toEqual(['intro.xhtml', 'ch1.xhtml']);
    expect(landmarks.type).toBe('landmarks');
    vi.restoreAllMocks();
  });

  it('adds a page-list from the chapters when given the spine', async () => {
    const ws = {
      readFile: vi.fn(async () =>
        new TextEncoder().encode(
          '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>c</title></head><body><h1><span id="page1" role="doc-pagebreak" title="1"></span>One</h1></body></html>'
        )
      ),
    } as unknown as WorkspaceService;
    const doc = await OutlineGenerator.processUserContent('x', mockPipeline(navBody), 'ws-1', {
      spine: { items: [spineItem('ch1', true)], workspaceService: ws, pathInfo },
    });
    expect(navs(doc.xhtmlContent).map(n => [n.type, n.hidden, n.links])).toEqual([
      ['toc', false, ['ch1.xhtml']],
      ['page-list', true, ['ch1.xhtml#page1']],
    ]);
  });
});

describe('OutlineGenerator.generateFromSpine page-list', () => {
  const pathInfo = {
    rootfilePath: 'OEBPS/content.opf',
    basePath: 'OEBPS',
    opfFileName: 'content.opf',
  };

  it('writes no page-list for a book without page markers', async () => {
    const doc = await OutlineGenerator.generateFromSpine(
      [spineItem('ch1', true)],
      mockWorkspace(),
      'ws-1',
      pathInfo
    );
    expect(doc.xhtmlContent).not.toContain('page-list');
    expect(doc.xhtmlContent).toContain('<nav epub:type="toc" role="doc-toc" id="toc">');
  });
});

describe('OutlineGenerator start-reading landmarks', () => {
  const pathInfo = {
    rootfilePath: 'OEBPS/content.opf',
    basePath: 'OEBPS',
    opfFileName: 'content.opf',
  };
  const landmarks = (xhtml: string) => {
    const nav = Array.from(
      new DOMParser().parseFromString(xhtml, 'application/xhtml+xml').getElementsByTagName('nav')
    ).find(n => n.getAttribute('epub:type') === 'landmarks');
    return nav
      ? Array.from(nav.getElementsByTagName('a')).map(a => [
          a.getAttribute('epub:type'),
          a.getAttribute('href'),
          a.textContent,
        ])
      : null;
  };
  const spine = () => ({
    items: [spineItem('intro', true), spineItem('ch1', true)],
    workspaceService: mockWorkspace(),
    pathInfo,
  });

  it('adds a bodymatter landmark to the generated nav, labelled from the book', async () => {
    const doc = await OutlineGenerator.generateFromSpine(
      [spineItem('intro', true), spineItem('ch1', true)],
      mockWorkspace(),
      'ws-1',
      pathInfo,
      undefined,
      { startReading: 'ch1' }
    );
    expect(landmarks(doc.xhtmlContent)).toEqual([['bodymatter', 'ch1.xhtml', 'ch1']]);
  });

  it('writes no landmarks when nothing is chosen, or the chapter has left the spine', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const startReading of [undefined, 'gone']) {
      const doc = await OutlineGenerator.generateFromSpine(
        [spineItem('ch1', true)],
        mockWorkspace(),
        'ws-1',
        pathInfo,
        undefined,
        { startReading }
      );
      expect(landmarks(doc.xhtmlContent)).toBeNull();
    }
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('adds it to a hand-written nav', async () => {
    const html = '<h1>Contents</h1><ol><li><a href="intro.xhtml">Intro</a></li></ol>';
    const doc = await OutlineGenerator.processUserContent('x', mockPipeline(html), 'ws-1', {
      spine: spine(),
      startReading: 'intro',
    });
    expect(landmarks(doc.xhtmlContent)).toEqual([['bodymatter', 'intro.xhtml', 'intro']]);
  });

  it("keeps a hand-written nav's own landmarks block over the choice", async () => {
    const html = `<div class="toc"><ol><li><a href="intro.xhtml">Intro</a></li></ol></div>
<div class="landmarks"><ul><li><a href="ch1.xhtml" epub:type="bodymatter">Begin</a></li></ul></div>`;
    const doc = await OutlineGenerator.processUserContent('x', mockPipeline(html), 'ws-1', {
      spine: spine(),
      startReading: 'intro',
    });
    expect(landmarks(doc.xhtmlContent)).toEqual([['bodymatter', 'ch1.xhtml', 'Begin']]);
  });

  it('refuses a nav.txt that did not transform, rather than writing an empty toc', async () => {
    const failing = {
      executeTransform: vi.fn(async () => ({ success: false, error: { message: 'boom' } })),
    } as unknown as SpineTransformPipeline;
    await expect(OutlineGenerator.processUserContent('x', failing, 'ws-1')).rejects.toThrow('boom');
  });
});
