import { describe, it, expect } from 'vitest';
import {
  hrefDir,
  hrefBasename,
  relativeFromDir,
  resolveAgainstDir,
  applyRewrites,
  applyCssRewrites,
  buildMovePlan,
  findHrefReferences,
} from './move-plan.js';
import type { ManifestItem } from '../epub/opf-utils.js';

const item = (id: string, href: string, mediaType = 'image/jpeg'): ManifestItem => ({
  id,
  href,
  mediaType,
});

describe('path helpers', () => {
  it('splits dir and basename', () => {
    expect(hrefDir('Images/a.jpg')).toBe('Images');
    expect(hrefDir('Images/c01/a.jpg')).toBe('Images/c01');
    expect(hrefDir('cover.jpg')).toBe('');
    expect(hrefBasename('Images/c01/a.jpg')).toBe('a.jpg');
    expect(hrefBasename('cover.jpg')).toBe('cover.jpg');
  });

  it('relativeFromDir produces referrer-relative spellings', () => {
    expect(relativeFromDir('Text', 'Images/a.jpg')).toBe('../Images/a.jpg');
    expect(relativeFromDir('Styles', 'Fonts/x.woff2')).toBe('../Fonts/x.woff2');
    expect(relativeFromDir('', 'Images/a.jpg')).toBe('Images/a.jpg');
    expect(relativeFromDir('Images', 'Images/c01/a.jpg')).toBe('c01/a.jpg');
    expect(relativeFromDir('Images/c01', 'Images/a.jpg')).toBe('../a.jpg');
    expect(relativeFromDir('Styles/sub', 'Fonts/x.woff2')).toBe('../../Fonts/x.woff2');
  });

  it('resolveAgainstDir resolves and rejects correctly', () => {
    expect(resolveAgainstDir('Styles', '../Fonts/x.woff2')).toBe('Fonts/x.woff2');
    expect(resolveAgainstDir('Styles', 'img/dot.png')).toBe('Styles/img/dot.png');
    expect(resolveAgainstDir('', 'Images/a.jpg')).toBe('Images/a.jpg');
    expect(resolveAgainstDir('Styles', './same.css')).toBe('Styles/same.css');
    expect(resolveAgainstDir('Styles', '../../escape.png')).toBeNull();
    expect(resolveAgainstDir('Styles', 'https://x.example/f.woff')).toBeNull();
    expect(resolveAgainstDir('Styles', 'data:font/woff;base64,AAAA')).toBeNull();
    expect(resolveAgainstDir('Styles', '/absolute.png')).toBeNull();
    expect(resolveAgainstDir('Styles', '#frag')).toBeNull();
  });
});

describe('applyRewrites', () => {
  it('rewrites exact strings, longest first (no prefix corruption)', () => {
    const text = 'a ../Images/x.jpg b ../Images/x.jpg.bak c';
    const out = applyRewrites(text, [
      { from: '../Images/x.jpg', to: '../Images/c01/x.jpg' },
      { from: '../Images/x.jpg.bak', to: '../Backups/x.jpg.bak' },
    ]);
    expect(out).toBe('a ../Images/c01/x.jpg b ../Backups/x.jpg.bak c');
  });

  it('escapes regex metacharacters in refs', () => {
    const out = applyRewrites('see ../Images/a(1).jpg here', [
      { from: '../Images/a(1).jpg', to: '../Images/c01/a-1.jpg' },
    ]);
    expect(out).toBe('see ../Images/c01/a-1.jpg here');
  });

  it('is a no-op for empty or identity rewrites', () => {
    expect(applyRewrites('text', [])).toBe('text');
    expect(applyRewrites('text ../a.jpg', [{ from: '../a.jpg', to: '../a.jpg' }])).toBe(
      'text ../a.jpg'
    );
  });
});

describe('applyCssRewrites', () => {
  it('rewrites only inside url(), preserving quote style', () => {
    const css = [
      "@font-face { src: url('../Fonts/x.woff2'); }",
      '.a { background: url(../Fonts/x.woff2); }',
      '/* mention of ../Fonts/x.woff2 in a comment stays */',
      '.b::before { content: "../Fonts/x.woff2"; }',
    ].join('\n');
    const out = applyCssRewrites(css, [{ from: '../Fonts/x.woff2', to: '../../Fonts/x.woff2' }]);
    expect(out).toContain("url('../../Fonts/x.woff2')");
    expect(out).toContain('url(../../Fonts/x.woff2)');
    expect(out).toContain('mention of ../Fonts/x.woff2 in a comment stays');
    expect(out).toContain('content: "../Fonts/x.woff2"');
  });
});

describe('findHrefReferences', () => {
  it('counts source and css references for one href', () => {
    const hits = findHrefReferences(
      'Images/a.jpg',
      [
        { path: 'SOURCE/text/ch1.txt', text: '![](../Images/a.jpg) and ![](../Images/a.jpg)' },
        { path: 'SOURCE/text/ch2.txt', text: 'nothing' },
      ],
      [{ href: 'Styles/page.css', text: '.x { background: url(../Images/a.jpg); }' }]
    );
    expect(hits).toEqual([
      { path: 'SOURCE/text/ch1.txt', kind: 'source', count: 2 },
      { path: 'Styles/page.css', kind: 'css', count: 1 },
    ]);
  });

  it('returns empty for an unreferenced href', () => {
    expect(
      findHrefReferences(
        'Images/lonely.jpg',
        [{ path: 'SOURCE/text/ch1.txt', text: '![](../Images/other.jpg)' }],
        []
      )
    ).toEqual([]);
  });
});

describe('buildMovePlan', () => {
  const manifest = [
    item('img-a', 'Images/a.jpg'),
    item('img-b', 'Images/b.jpg'),
    item('img-c', 'Images/sub/c.jpg'),
    item('font', 'Fonts/serif.woff2', 'font/woff2'),
    item('css', 'Styles/page.css', 'text/css'),
    item('ch1', 'Text/ch1.xhtml', 'application/xhtml+xml'),
  ];

  it('plans moves with sanitized targets and finds source references', () => {
    const plan = buildMovePlan({
      manifest,
      moves: [
        { id: 'img-a', newHref: 'Images/c01/a.jpg' },
        { id: 'img-b', newHref: 'Images/c01/b.jpg' },
      ],
      sources: [
        { path: 'SOURCE/text/ch1.txt', text: '![x](../Images/a.jpg)\n![y](../Images/b.jpg)\n' },
        { path: 'SOURCE/text/ch2.txt', text: 'no refs here\n' },
      ],
      stylesheets: [],
    });

    expect(plan.rows).toEqual([
      { id: 'img-a', oldHref: 'Images/a.jpg', newHref: 'Images/c01/a.jpg' },
      { id: 'img-b', oldHref: 'Images/b.jpg', newHref: 'Images/c01/b.jpg' },
    ]);
    expect(plan.fileChanges).toEqual([
      {
        path: 'SOURCE/text/ch1.txt',
        kind: 'source',
        rewrites: [
          { from: '../Images/a.jpg', to: '../Images/c01/a.jpg', count: 1 },
          { from: '../Images/b.jpg', to: '../Images/c01/b.jpg', count: 1 },
        ],
      },
    ]);
  });

  it('does NOT match the audio clip directive form (OPF-relative, no ../)', () => {
    const plan = buildMovePlan({
      manifest: [item('clip', 'Audio/a.mp3', 'audio/mpeg')],
      moves: [{ id: 'clip', newHref: 'Audio/c01/a.mp3' }],
      sources: [
        {
          path: 'SOURCE/text/ch1.txt',
          text: ':clip[label]{src="Audio/a.mp3" begin="0:00:01.00" end="0:00:02.00"}\n',
        },
      ],
      stylesheets: [],
    });
    expect(plan.rows).toHaveLength(1);
    expect(plan.fileChanges).toEqual([]); // deliberately untouched — follow-on task
  });

  it('blocks collisions with unmoved manifest items (case-insensitive)', () => {
    const plan = buildMovePlan({
      manifest,
      moves: [{ id: 'img-a', newHref: 'Images/B.JPG' }],
      sources: [],
      stylesheets: [],
    });
    expect(plan.rows[0].blocked).toBe('collides with Images/b.jpg');
    expect(plan.fileChanges).toEqual([]);
  });

  it('allows a swap-adjacent case: target vacated by another move in the batch', () => {
    const plan = buildMovePlan({
      manifest,
      moves: [
        { id: 'img-a', newHref: 'Images/b.jpg' }, // b.jpg is moving away
        { id: 'img-b', newHref: 'Images/b2.jpg' },
      ],
      sources: [],
      stylesheets: [],
    });
    expect(plan.rows.every(r => !r.blocked)).toBe(true);
  });

  it('blocks duplicate targets within the batch', () => {
    const plan = buildMovePlan({
      manifest,
      moves: [
        { id: 'img-a', newHref: 'Images/same.jpg' },
        { id: 'img-b', newHref: 'Images/SAME.jpg' },
      ],
      sources: [],
      stylesheets: [],
    });
    expect(plan.rows[0].blocked).toBeUndefined();
    expect(plan.rows[1].blocked).toBe('duplicate target within the move');
  });

  it('drops no-op moves and sanitizes typed paths', () => {
    const plan = buildMovePlan({
      manifest,
      moves: [
        { id: 'img-a', newHref: 'Images/a.jpg' }, // no-op
        { id: 'img-b', newHref: 'Images/My Folder/b image.jpg' }, // sanitized
      ],
      sources: [],
      stylesheets: [],
    });
    expect(plan.rows).toEqual([
      { id: 'img-b', oldHref: 'Images/b.jpg', newHref: 'Images/My-Folder/b-image.jpg' },
    ]);
  });

  it('rewrites css url() refs to a moved font, quote variants included', () => {
    const plan = buildMovePlan({
      manifest,
      moves: [{ id: 'font', newHref: 'Fonts/body/serif.woff2' }],
      sources: [],
      stylesheets: [
        {
          href: 'Styles/page.css',
          text: '@font-face { src: url(\'../Fonts/serif.woff2\'); }\n.x { background: url("../Fonts/serif.woff2"); }',
        },
      ],
    });
    expect(plan.fileChanges).toEqual([
      {
        path: 'Styles/page.css',
        kind: 'css',
        rewrites: [{ from: '../Fonts/serif.woff2', to: '../Fonts/body/serif.woff2', count: 2 }],
      },
    ]);
  });

  it("rewrites a moving stylesheet's own url() refs for its new location", () => {
    const plan = buildMovePlan({
      manifest,
      moves: [{ id: 'css', newHref: 'Styles/sub/page.css' }],
      sources: [],
      stylesheets: [
        { href: 'Styles/page.css', text: '@font-face { src: url(../Fonts/serif.woff2); }' },
      ],
    });
    expect(plan.fileChanges).toEqual([
      {
        path: 'Styles/page.css',
        kind: 'css',
        rewrites: [{ from: '../Fonts/serif.woff2', to: '../../Fonts/serif.woff2', count: 1 }],
      },
    ]);
  });

  it('leaves external and data urls alone', () => {
    const plan = buildMovePlan({
      manifest,
      moves: [{ id: 'font', newHref: 'Assets/serif.woff2' }],
      sources: [],
      stylesheets: [
        {
          href: 'Styles/page.css',
          text: '.x { background: url(https://x.example/i.png); } .y { src: url(data:font/woff;base64,AA); }',
        },
      ],
    });
    expect(plan.fileChanges).toEqual([]);
  });
});
