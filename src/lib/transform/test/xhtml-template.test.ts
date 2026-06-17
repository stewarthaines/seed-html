import { describe, it, expect } from 'vitest';
import { ensureMainLandmark, generateXHTMLDocument } from '../xhtml-template.js';
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
});
