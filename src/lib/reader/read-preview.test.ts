import { describe, it, expect } from 'vitest';
import {
  buildReadDocument,
  readerSimCss,
  FOLIATE_CLOSE_HOOK,
  FOLIATE_VIEW_GLOBAL,
} from './read-preview.js';

const base = {
  sectionUrl: 'blob:http://localhost/abc-123',
  sectionSize: 4321,
  flow: 'paginated' as const,
  maxColumnCount: '2' as const,
  doneMessage: 'preview-read',
  relocateMessage: 'preview-read-relocate',
};

describe('buildReadDocument', () => {
  it('imports the vendored renderer from the app origin and mounts foliate-view', () => {
    const doc = buildReadDocument(base);
    expect(doc).toContain('foliate/view.js');
    expect(doc).toContain("document.createElement('foliate-view')");
  });

  it('embeds the one-section book with the section blob URL and size', () => {
    const doc = buildReadDocument(base);
    expect(doc).toContain('"blob:http://localhost/abc-123"');
    expect(doc).toContain('size: 4321');
    expect(doc).toContain("linear: 'yes'");
  });

  it('applies flow and column settings between open and init', () => {
    const doc = buildReadDocument({ ...base, flow: 'scrolled', maxColumnCount: '1' });
    const open = doc.indexOf('await view.open(book)');
    const flow = doc.indexOf(`setAttribute('flow', "scrolled")`);
    const cols = doc.indexOf(`setAttribute('max-column-count', "1")`);
    const init = doc.indexOf('await view.init({})');
    expect(open).toBeGreaterThan(-1);
    expect(flow).toBeGreaterThan(open);
    expect(cols).toBeGreaterThan(open);
    expect(init).toBeGreaterThan(cols);
  });

  it('installs the teardown hook and live-view global on the iframe window', () => {
    const doc = buildReadDocument(base);
    expect(doc).toContain(`window.${FOLIATE_CLOSE_HOOK} = () =>`);
    expect(doc).toContain(`window.${FOLIATE_VIEW_GLOBAL} = view`);
    expect(doc).toContain('view.close()');
  });

  it('derives page direction from the language', () => {
    expect(buildReadDocument({ ...base, lang: 'he' })).toContain('dir: "rtl"');
    expect(buildReadDocument({ ...base, lang: 'de' })).toContain('dir: "ltr"');
    expect(buildReadDocument(base)).toContain('dir: "ltr"');
  });

  it('always posts the done message, success or failure', () => {
    const doc = buildReadDocument(base);
    const finallyBlock = doc.slice(doc.indexOf('} finally {'));
    expect(finallyBlock).toContain(`parent.postMessage("preview-read", '*')`);
  });

  it('reader-sim CSS mirrors the raw preview theme, with a force-colors variant', () => {
    const soft = readerSimCss({
      basePx: 17,
      bg: '#f4ecd8',
      fg: '#5b4636',
      scheme: 'light',
      force: false,
    });
    expect(soft).toContain(':root { font-size: 17px; color-scheme: light; }');
    expect(soft).toContain('html { background: #f4ecd8; }');
    expect(soft).toContain('body { color: #5b4636; }');
    expect(soft).not.toContain('!important');
    const forced = readerSimCss({
      basePx: 23,
      bg: '#14161a',
      fg: '#c9c9c9',
      scheme: 'dark',
      force: true,
    });
    expect(forced).toContain('html { background: #14161a !important; }');
    expect(forced).toContain('body, body * { color: #c9c9c9 !important; }');
  });

  it('reports every relocation to the parent for the page indicator', () => {
    const doc = buildReadDocument(base);
    const handler = doc.slice(doc.indexOf(`view.addEventListener('relocate'`));
    expect(handler).toContain('"preview-read-relocate"');
    expect(handler).toContain('page: r.page');
    expect(handler).toContain('pages: r.pages');
    expect(handler).toContain('scrolled: !!r.scrolled');
    // Scrolled-flow position, for restoring the reading position across renders.
    expect(handler).toContain('fraction: r.scrolled && r.viewSize ? r.start / r.viewSize : 0');
  });

  it('applies reader-sim styles between open and init, only when provided', () => {
    const plain = buildReadDocument(base);
    expect(plain).not.toContain('setStyles');
    const styled = buildReadDocument({ ...base, styles: ':root { font-size: 17px; }' });
    const call = styled.indexOf('view.renderer.setStyles?.(":root { font-size: 17px; }")');
    expect(call).toBeGreaterThan(styled.indexOf('await view.open(book)'));
    expect(call).toBeLessThan(styled.indexOf('await view.init({})'));
  });

  it('refocuses the view on wrapper clicks so arrow keys resume after a deixis click', () => {
    const doc = buildReadDocument(base);
    expect(doc).toContain(`view.setAttribute('tabindex', '-1')`);
    expect(doc).toContain(`document.addEventListener('click', () =>`);
    expect(doc).toContain('view.focus({ preventScroll: true })');
  });

  it('wires arrow-key page turns on the wrapper window and each section document', () => {
    const doc = buildReadDocument(base);
    expect(doc).toContain(`window.addEventListener('keydown', onKey)`);
    expect(doc).toContain(`event.detail.doc.addEventListener('keydown', onKey)`);
    expect(doc).toContain(`case 'ArrowLeft':`);
    expect(doc).toContain(`case 'ArrowRight':`);
    expect(doc).toContain('view.goLeft()');
    expect(doc).toContain('view.goRight()');
    // Listeners attach before open(), so the first section load is caught.
    expect(doc.indexOf(`window.addEventListener('keydown'`)).toBeLessThan(
      doc.indexOf('await view.open(book)')
    );
  });
});
