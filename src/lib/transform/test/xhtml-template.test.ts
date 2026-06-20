import { describe, it, expect } from 'vitest';
import {
  ensureMainLandmark,
  generateXHTMLDocument,
  serializeElementAttributes,
} from '../xhtml-template.js';
import type { ChapterMetadata } from '../xhtml-template.js';

const metadata: ChapterMetadata = {
  title: 'Chapter 1',
  language: 'en',
  stylesheets: [],
  scripts: [],
};

// Count opening <main> tags only (</main> and role="main" must not match).
const mainCount = (html: string) => (html.match(/<main\b/gi) || []).length;

describe('ensureMainLandmark', () => {
  it('wraps content that lacks a main in a single <main role="main">', () => {
    const out = ensureMainLandmark('<h1>Title</h1><p>Body</p>');
    expect(mainCount(out)).toBe(1);
    expect(out).toContain('<main role="main">');
    expect(out).toContain('<h1>Title</h1>');
  });

  it('leaves content that already has a <main> untouched (no double-wrap)', () => {
    const withRole = '<main role="main"><p>x</p></main>';
    expect(ensureMainLandmark(withRole)).toBe(withRole);

    const bareMain = '<main><section>y</section></main>';
    expect(ensureMainLandmark(bareMain)).toBe(bareMain);
  });

  it('does not false-match elements whose name merely starts with "main"', () => {
    const out = ensureMainLandmark('<maintenance>not a main</maintenance>');
    expect(mainCount(out)).toBe(1); // one real <main> added around it
  });
});

describe('generateXHTMLDocument', () => {
  it('emits exactly one <main role="main"> around the content', () => {
    const xhtml = generateXHTMLDocument('<h1>T</h1><p>P</p>', metadata);
    expect(mainCount(xhtml)).toBe(1);
    expect(xhtml).toContain('<main role="main">');
    expect(xhtml).toContain('<h1>T</h1>');
  });

  it('does not add a second main when the content already has one', () => {
    const xhtml = generateXHTMLDocument('<main><section>c</section></main>', metadata);
    expect(mainCount(xhtml)).toBe(1);
  });

  it('sets dir="rtl" on <html> for a right-to-left language', () => {
    const xhtml = generateXHTMLDocument('<p>مرحبا</p>', { ...metadata, language: 'ar' });
    expect(xhtml).toContain('xml:lang="ar" lang="ar" dir="rtl">');
  });

  it('omits dir for a left-to-right language', () => {
    const xhtml = generateXHTMLDocument('<p>Hello</p>', metadata);
    expect(xhtml).not.toContain('dir="rtl"');
  });

  it('emits a bare <body> when no body attributes are given', () => {
    const xhtml = generateXHTMLDocument('<p>x</p>', metadata);
    expect(xhtml).toContain('<body>');
  });

  it('renders body attributes a transform set (e.g. a per-chapter class)', () => {
    const xhtml = generateXHTMLDocument('<p>x</p>', metadata, ' class="chapter01"');
    expect(xhtml).toContain('<body class="chapter01">');
  });

  it('declares the epub namespace so epub:type parses as well-formed XHTML', () => {
    const xhtml = generateXHTMLDocument('<p>x</p>', metadata, ' epub:type="cover"');
    expect(xhtml).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
    expect(xhtml).toContain('<body epub:type="cover">');
    // Must parse as application/xhtml+xml without a namespace error.
    const doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
  });
});

describe('serializeElementAttributes', () => {
  const bodyOf = (html: string) =>
    new DOMParser().parseFromString(html, 'text/html').body as Element;

  it('returns an empty string when the element has no attributes', () => {
    expect(serializeElementAttributes(bodyOf('<body></body>'))).toBe('');
  });

  it('serializes attributes with a leading space, ready to splice after <body', () => {
    expect(serializeElementAttributes(bodyOf('<body class="chapter01"></body>'))).toBe(
      ' class="chapter01"'
    );
  });

  it('escapes attribute values so the result stays well-formed XHTML', () => {
    const out = serializeElementAttributes(bodyOf('<body data-x="a&amp;&quot;b"></body>'));
    expect(out).toBe(' data-x="a&amp;&quot;b"');
  });

  it('drops redundant xmlns declarations (the document already declares the namespace)', () => {
    const out = serializeElementAttributes(
      bodyOf('<body xmlns="http://www.w3.org/1999/xhtml" class="chapter01"></body>')
    );
    expect(out).toBe(' class="chapter01"');
  });
});
