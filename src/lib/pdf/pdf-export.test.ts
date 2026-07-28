import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coverImageHref, buildPagedDocument } from './pdf-export.js';
import type { ManifestItem } from '../epub/opf-utils.js';
import type { PrintSettings } from '../services/settings/settings.service.js';

const onPrint: PrintSettings = {
  page_size: 'A4',
  margin: 'normal',
  page_numbers: true,
  cover_page: true,
};
const offPrint: PrintSettings = { ...onPrint, cover_page: false };

const item = (over: Partial<ManifestItem>): ManifestItem => ({
  id: over.href ?? 'id',
  href: 'x',
  mediaType: 'application/octet-stream',
  ...over,
});

describe('coverImageHref', () => {
  const coverPng = item({
    href: 'Images/cover.png',
    mediaType: 'image/png',
    properties: ['cover-image'],
  });

  it('returns null when cover_page is off', () => {
    expect(coverImageHref([coverPng], offPrint)).toBeNull();
  });

  it('returns null when there is no cover-image item', () => {
    const manifest = [item({ href: 'Text/ch1.xhtml', mediaType: 'application/xhtml+xml' })];
    expect(coverImageHref(manifest, onPrint)).toBeNull();
  });

  it('prefers the SVG sibling of the cover-image item (generated cover)', () => {
    const manifest = [item({ href: 'Images/cover.svg', mediaType: 'image/svg+xml' }), coverPng];
    expect(coverImageHref(manifest, onPrint)).toBe('Images/cover.svg');
  });

  it('falls back to the cover-image item when there is no SVG sibling (imported raster)', () => {
    const manifest = [
      item({ href: 'images/mycover.jpg', mediaType: 'image/jpeg', properties: ['cover-image'] }),
    ];
    expect(coverImageHref(manifest, onPrint)).toBe('images/mycover.jpg');
  });

  it('defaults to on when print settings are undefined', () => {
    expect(coverImageHref([coverPng], undefined)).toBe('Images/cover.png');
  });
});

describe('buildPagedDocument @page rule', () => {
  const sections = ['<section class="pdf-chapter">x</section>'];

  it('uses the presets when no custom values are set', () => {
    const html = buildPagedDocument(sections, { print: onPrint });
    expect(html).toContain('size: A4;');
    expect(html).toContain('margin: 18mm;');
  });

  it('passes custom size and margin strings through verbatim', () => {
    const html = buildPagedDocument(sections, {
      print: { ...onPrint, custom_size: '140mm 216mm', custom_margin: '20mm 15mm 25mm 15mm' },
    });
    expect(html).toContain('size: 140mm 216mm;');
    expect(html).toContain('margin: 20mm 15mm 25mm 15mm;');
  });

  it('falls back to the presets when custom values are blank', () => {
    const html = buildPagedDocument(sections, {
      print: { ...onPrint, custom_size: '  ', custom_margin: '' },
    });
    expect(html).toContain('size: A4;');
    expect(html).toContain('margin: 18mm;');
  });
});

describe('buildPagedDocument text direction', () => {
  it('sets dir="rtl" on <html> for a right-to-left book language', () => {
    const html = buildPagedDocument(['<section class="pdf-chapter">x</section>'], { lang: 'ar' });
    expect(html).toContain('lang="ar" xml:lang="ar" dir="rtl">');
  });

  it('omits dir for a left-to-right book language', () => {
    const html = buildPagedDocument(['<section class="pdf-chapter">x</section>'], { lang: 'en' });
    expect(html).not.toContain('dir="rtl"');
  });
});

describe('buildPagedDocument preview bridge', () => {
  const section = '<section class="pdf-chapter">x</section>';

  it('installs window.seed and fires the paginated hook only when previewBridge is set', () => {
    const withBridge = buildPagedDocument([section], { previewBridge: { idref: 'chap-03' } });
    expect(withBridge).toContain('window.seed=');
    expect(withBridge).toContain("type:'seed-save-data'");
    // The realm is stamped with its idref at injection time and every
    // saveData message echoes it (the handler drops mismatched echoes).
    expect(withBridge).toContain('var idref="chap-03"');
    expect(withBridge).toContain('idref:idref');
    expect(withBridge).toContain('window.seed.hooks');
    expect(withBridge).toContain('.paginated({idref:"chap-03",document:document})');

    const noBridge = buildPagedDocument([section], {});
    expect(noBridge).not.toContain('window.seed=');
    expect(noBridge).not.toContain('.paginated(');
  });

  it('defines the bridge before the injected head fragment so head.xml can use it', () => {
    const html = buildPagedDocument([section], {
      previewBridge: { idref: 'c1' },
      headExtra: '<script data-head-xml="1"></script>',
    });
    expect(html.indexOf('window.seed=')).toBeLessThan(html.indexOf('data-head-xml'));
  });

  it('escapes the idref for the XHTML-reparsed export document', () => {
    const html = buildPagedDocument([section], { previewBridge: { idref: 'a<b&c' } });
    expect(html).not.toContain('idref:"a<b&c"');
    expect(html).toContain('\\u003c'); // < escaped inside the JS string literal
  });
});

// ---------------------------------------------------------------------------
// Coverage-review regressions: XHTML-safe embedding, running-header title
// selection, blob-URL ownership on a failed window hand-off, and skipped-
// chapter reporting.
// ---------------------------------------------------------------------------

// Hostile-locale stand-in: every label comes back carrying the two characters
// (& and <) that bare JSON.stringify leaves raw inside the inline script.
vi.mock('../i18n/index.js', () => ({
  translate: (msgid: string) => `${msgid} & <hostile>`,
}));

// Capture BlobURLManager instances so ownership/cleanup can be asserted.
const blobInstances: Array<{ processXHTMLForPreview: any; cleanup: any; setActiveWorkspace: any }> =
  [];
vi.mock('../blob-url/blob-url-manager.js', () => ({
  BlobURLManager: vi.fn(function (this: any) {
    this.setActiveWorkspace = vi.fn();
    this.processXHTMLForPreview = vi.fn(async (master: string) => master);
    this.cleanup = vi.fn();
    blobInstances.push(this);
  }),
}));

import { chapterToSection, exportPdf } from './pdf-export.js';

const CH_XHTML = (body: string, head = '') =>
  `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head>${head}</head><body>${body}</body></html>`;

describe('buildPagedDocument XHTML safety', () => {
  it('escapes stylesheet hrefs (getAttribute returns the decoded value)', () => {
    const html = buildPagedDocument(['<section>x</section>'], {
      stylesheetHrefs: ['Styles/a&b.css'],
    });

    expect(html).toContain('href="Styles/a&amp;b.css"');
    expect(html).not.toContain('href="Styles/a&b.css"');
  });

  it('survives an XHTML re-parse with translated toolbar labels containing & and <', () => {
    const html = buildPagedDocument(['<section class="pdf-chapter">x</section>'], {
      afterMode: 'print-button',
    });

    const doc = new DOMParser().parseFromString(html, 'application/xhtml+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    // The hostile characters are embedded as \uXXXX escapes, never raw.
    expect(html).toContain('\\u0026 \\u003chostile\\u003e');
  });
});

describe('chapterToSection running-header title', () => {
  it('uses the head <title>, not an inline SVG accessibility <title>', () => {
    const xhtml = CH_XHTML(
      '<svg><title>decorative fleuron</title><rect/></svg><p>text</p>',
      '<title>Chapter One</title>'
    );

    const result = chapterToSection(xhtml, 'ch1');

    expect(result?.section).toContain('>Chapter One</span>');
    expect(result?.section).not.toContain('>decorative fleuron</span>');
  });

  it('falls back to the first heading when the only <title> is an SVG one', () => {
    const xhtml = CH_XHTML('<svg><title>decorative</title></svg><h1>Real Heading</h1>');

    const result = chapterToSection(xhtml, 'ch1');

    expect(result?.section).toContain('>Real Heading</span>');
  });
});

describe('exportPdf', () => {
  const workspace = {
    id: 'ws-1',
    pathInfo: { basePath: 'OEBPS' },
    opf: { metadata: {}, manifest: [], spine: [] },
  } as any;

  function makeWin(overrides: Partial<Record<'open' | 'write' | 'close', () => void>> = {}) {
    return {
      closed: false,
      close: vi.fn(),
      document: {
        open: vi.fn(overrides.open),
        write: vi.fn(overrides.write),
        close: vi.fn(overrides.close),
      },
    } as unknown as Window;
  }

  const chapter = (id: string, xhtmlContent: string) => ({ id, xhtmlContent });
  const service = (chapters: Array<{ id: string; xhtmlContent: string }>) =>
    ({ loadAllLinearChapterContents: vi.fn(async () => chapters) }) as any;

  beforeEach(() => {
    blobInstances.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports unparseable chapters instead of silently omitting them', async () => {
    const win = makeWin();
    vi.spyOn(window, 'open').mockReturnValue(win);

    const result = await exportPdf(
      workspace,
      {} as any,
      service([
        chapter('good', CH_XHTML('<p>fine</p>')),
        chapter('broken', '<html><body><p>unclosed'),
      ])
    );

    expect(result.skippedChapterIds).toEqual(['broken']);
    expect(win.document.write).toHaveBeenCalled();
  });

  it('frees blob URLs when the hand-off to the print window fails', async () => {
    const win = makeWin({
      open: () => {
        throw new Error('window gone');
      },
    });
    vi.spyOn(window, 'open').mockReturnValue(win);

    await expect(
      exportPdf(workspace, {} as any, service([chapter('ch1', CH_XHTML('<p>x</p>'))]))
    ).rejects.toThrow('window gone');

    expect(blobInstances).toHaveLength(1);
    expect(blobInstances[0].cleanup).toHaveBeenCalledTimes(1);
  });

  it('keeps blob URLs alive until the print window closes, then revokes them', async () => {
    const win = makeWin();
    vi.spyOn(window, 'open').mockReturnValue(win);

    await exportPdf(workspace, {} as any, service([chapter('ch1', CH_XHTML('<p>x</p>'))]));

    expect(blobInstances).toHaveLength(1);
    expect(blobInstances[0].cleanup).not.toHaveBeenCalled();

    (win as any).closed = true;
    await vi.advanceTimersByTimeAsync(1100);
    expect(blobInstances[0].cleanup).toHaveBeenCalledTimes(1);
  });
});
