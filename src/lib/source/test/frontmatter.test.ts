import { describe, it, expect } from 'vitest';
import { splitFrontmatter, frontmatterStorePath } from '../frontmatter.js';

describe('splitFrontmatter', () => {
  it('splits a leading block, parses it, and hands the rest to the format', () => {
    const text = '---\ndisplay: Thomas Pattenden\nbirth: 1821\nparents: [a, b]\n---\n\n# Thomas\n';
    const split = splitFrontmatter(text);
    expect(split.hasBlock).toBe(true);
    expect(split.data).toEqual({ display: 'Thomas Pattenden', birth: 1821, parents: ['a', 'b'] });
    expect(split.body).toBe('\n# Thomas\n');
    expect(split.error).toBeUndefined();
  });

  it('keeps dates as strings (JSON schema, not the YAML core schema)', () => {
    const split = splitFrontmatter('---\nborn: 1867-04-04\nwhen: 2026-09-08T10:00:00Z\n---\nx');
    expect(split.data).toEqual({ born: '1867-04-04', when: '2026-09-08T10:00:00Z' });
  });

  it('only line 1 opens a block', () => {
    const text = '# Heading\n\n---\nkey: value\n---\n';
    const split = splitFrontmatter(text);
    expect(split.hasBlock).toBe(false);
    expect(split.data).toBeNull();
    expect(split.body).toBe(text);
  });

  it('an unclosed opener is a rule, not a block: the text is untouched', () => {
    const text = '---\n\nA chapter that starts with a thematic break.\n';
    expect(splitFrontmatter(text)).toEqual({ body: text, data: null, hasBlock: false });
  });

  it('a comments-only block strips and stores as null', () => {
    const text = '---\n# Non-linear research chapter. No person record.\n---\n\n# Notes\n';
    const split = splitFrontmatter(text);
    expect(split.hasBlock).toBe(true);
    expect(split.data).toBeNull();
    expect(split.body).toBe('\n# Notes\n');
  });

  it('a block that fails to parse is stripped anyway and reported', () => {
    const text = '---\ndisplay: "unterminated\nbirth: [1, 2\n---\n# Body\n';
    const split = splitFrontmatter(text);
    expect(split.hasBlock).toBe(true);
    expect(split.data).toBeNull();
    expect(split.error).toBeTruthy();
    expect(split.body).toBe('# Body\n');
  });

  it('tolerates CRLF and trailing spaces on the fences, keeping the body verbatim', () => {
    const text = '--- \r\nkey: v\r\n---\r\nline one\r\nline two\r\n';
    const split = splitFrontmatter(text);
    expect(split.data).toEqual({ key: 'v' });
    expect(split.body).toBe('line one\r\nline two\r\n');
  });

  it('a chapter without a block passes through untouched', () => {
    const text = 'Plain prose.\n';
    expect(splitFrontmatter(text)).toEqual({ body: text, data: null, hasBlock: false });
    expect(splitFrontmatter('')).toEqual({ body: '', data: null, hasBlock: false });
  });

  it('names the store file per chapter', () => {
    expect(frontmatterStorePath('thomas_pattenden')).toBe(
      'SOURCE/data/frontmatter/thomas_pattenden.json'
    );
  });
});
