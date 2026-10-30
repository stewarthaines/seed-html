import { describe, it, expect, vi } from 'vitest';
import { collectPageTargets, pageListMarkup, withPageList } from './page-list.js';
import type { SpineItemWithSource } from '../spine/types.js';
import type { WorkspaceService } from '../services/workspace/workspace.service.js';

function spineItem(id: string, href: string, linear = true): SpineItemWithSource {
  return { idref: id, id, href, linear, mediaType: 'application/xhtml+xml', hasSourceFile: true };
}

// Serves each path's body inside a minimal XHTML chapter; unknown paths throw.
function mockWorkspace(bodies: Record<string, string>): WorkspaceService {
  return {
    readFile: vi.fn(async (_ws: string, path: string) => {
      if (!(path in bodies)) throw new Error('not found');
      return new TextEncoder().encode(
        `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>x</title></head><body>${bodies[path]}</body></html>`
      );
    }),
  } as unknown as WorkspaceService;
}

const marker = (n: string) =>
  `<span id="page${n}" epub:type="pagebreak" role="doc-pagebreak" title="${n}"></span>`;

describe('collectPageTargets', () => {
  it('lists every marker in spine order, relative to the nav, including non-linear chapters', async () => {
    const ws = mockWorkspace({
      'OEBPS/Text/a.xhtml': `<h1>${marker('1')}A</h1><p>One${marker('2')} two.</p>`,
      'OEBPS/Text/b.xhtml': `<p>${marker('iii')}Plate</p>`,
    });
    const targets = await collectPageTargets(
      [spineItem('a', 'Text/a.xhtml'), spineItem('b', 'Text/b.xhtml', false)],
      ws,
      'ws-1',
      'OEBPS'
    );
    expect(targets).toEqual([
      { href: 'Text/a.xhtml#page1', label: '1' },
      { href: 'Text/a.xhtml#page2', label: '2' },
      { href: 'Text/b.xhtml#pageiii', label: 'iii' },
    ]);
  });

  it('takes the label from title, then aria-label, then text, and skips markers without id or label', async () => {
    const ws = mockWorkspace({
      'OEBPS/a.xhtml': [
        '<hr id="p5" role="doc-pagebreak" aria-label="5"/>',
        '<span id="p6" epub:type="pagebreak">6</span>',
        '<span role="doc-pagebreak" title="7"></span>',
        '<span id="p8" role="doc-pagebreak"></span>',
      ].join(''),
    });
    const targets = await collectPageTargets([spineItem('a', 'a.xhtml')], ws, 'ws-1', 'OEBPS');
    expect(targets).toEqual([
      { href: 'a.xhtml#p5', label: '5' },
      { href: 'a.xhtml#p6', label: '6' },
    ]);
  });

  it('makes hrefs relative to a nav in another directory and skips unreadable chapters', async () => {
    const ws = mockWorkspace({ 'OEBPS/Text/a.xhtml': marker('1') });
    const targets = await collectPageTargets(
      [spineItem('a', 'Text/a.xhtml'), spineItem('gone', 'Text/gone.xhtml')],
      ws,
      'ws-1',
      'OEBPS',
      'Nav/nav.xhtml'
    );
    expect(targets).toEqual([{ href: '../Text/a.xhtml#page1', label: '1' }]);
  });
});

describe('pageListMarkup', () => {
  it('is empty without targets, and escapes labels and hrefs', () => {
    expect(pageListMarkup([])).toBe('');
    const markup = pageListMarkup([{ href: 'a.xhtml#p1', label: '1 & 2' }]);
    expect(markup).toContain('<nav epub:type="page-list" hidden="hidden">');
    expect(markup).toContain('<li><a href="a.xhtml#p1">1 &amp; 2</a></li>');
  });
});

const NAV = (extra = '') => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Contents</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" role="doc-toc" id="toc"><ol><li><a href="a.xhtml">A</a></li></ol></nav>
${extra}
</body>
</html>`;

describe('withPageList', () => {
  const pageLinks = (xhtml: string) =>
    Array.from(
      new DOMParser().parseFromString(xhtml, 'application/xhtml+xml').getElementsByTagName('nav')
    )
      .filter(nav => nav.getAttribute('epub:type') === 'page-list')
      .map(nav => Array.from(nav.getElementsByTagName('a')).map(a => a.getAttribute('href')));

  it('adds a page-list after the other navs, keeping the toc', () => {
    const out = withPageList(NAV(), [{ href: 'a.xhtml#page1', label: '1' }]);
    expect(pageLinks(out)).toEqual([['a.xhtml#page1']]);
    expect(out).toContain('<a href="a.xhtml">A</a>');
    expect(out.startsWith('<?xml')).toBe(true);
  });

  it('replaces a stale page-list and removes it when there are no markers', () => {
    const stale = NAV(pageListMarkup([{ href: 'a.xhtml#page9', label: '9' }]));
    expect(pageLinks(withPageList(stale, [{ href: 'a.xhtml#page1', label: '1' }]))).toEqual([
      ['a.xhtml#page1'],
    ]);
    expect(pageLinks(withPageList(stale, []))).toEqual([]);
  });

  it('returns the document unchanged when its page-list is current', () => {
    const current = NAV(pageListMarkup([{ href: 'a.xhtml#page1', label: '1' }]));
    expect(withPageList(current, [{ href: 'a.xhtml#page1', label: '1' }])).toBe(current);
    expect(withPageList(NAV(), [])).toBe(NAV());
  });
});
