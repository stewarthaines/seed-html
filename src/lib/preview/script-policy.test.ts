import { describe, it, expect } from 'vitest';
import { stripScripts, hasScripts } from './script-policy';

const chapter = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head>
<link rel="stylesheet" href="../../css/base.css" />
<script src="../../js/kotobeeInteractive.js"></script>
<script>window.x = 1;</script>
</head><body onload="init()">
<div class="kInteractive video" data-kotobee="abc" onclick="play()">widget</div>
<a href="javascript:void(0)">link</a>
<a href="ch2.xhtml" onmouseover="hover()">next</a>
<img src="../../imgs/a.png" alt="" />
<svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script><a xlink:href="javascript:x()"><text>t</text></a></svg>
</body></html>`;

describe('stripScripts', () => {
  const out = stripScripts(chapter);

  it('removes script elements, including inside SVG', () => {
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain('evil()');
  });

  it('removes inline event handlers and javascript: links', () => {
    expect(out).not.toMatch(/\son[a-z]+=/i);
    expect(out).not.toMatch(/javascript:/i);
  });

  it('keeps the content, the stylesheet and the widget data', () => {
    expect(out).toContain('../../css/base.css');
    expect(out).toContain('data-kotobee="abc"');
    expect(out).toContain('href="ch2.xhtml"');
    expect(out).toContain('<img src="../../imgs/a.png" alt="">');
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});

describe('hasScripts', () => {
  it('spots the three forms and ignores plain chapters', () => {
    expect(hasScripts(chapter)).toBe(true);
    expect(hasScripts('<html><body onload="x()"></body></html>')).toBe(true);
    expect(hasScripts('<html><body><a href="javascript:x()">x</a></body></html>')).toBe(true);
    expect(
      hasScripts('<html><body><p>Only prose, and a description of scripts.</p></body></html>')
    ).toBe(false);
  });
});
