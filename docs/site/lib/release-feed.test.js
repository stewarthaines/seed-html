import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { plainMarkdown } from './markdown.js';
import {
  ENTRY_COUNT,
  buildFeed,
  checkReleases,
  escapeXml,
  parseChangelog,
  releaseFeed,
} from './release-feed.js';

const ATOM = 'http://www.w3.org/2005/Atom';
const render = source => plainMarkdown.render(source);
const parse = source => parseChangelog(source, plainMarkdown);

const SAMPLE = `# Changelog

## [Unreleased]

### Added

- Not released yet.

## [1.1.0] - 2026-02-03

### Added

- A *new* thing with \`<url>\` & more.
  - nested detail

### Fixed

## [1.0.0] - 2026-01-02

### Removed

- An old thing.

\`\`\`
## not a heading
\`\`\`
`;

function parseXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
}

describe('parseChangelog', () => {
  it('reads dated releases, skips Unreleased, drops empty subheadings', () => {
    const releases = parse(SAMPLE);
    expect(releases.map(r => [r.version, r.date])).toEqual([
      ['1.1.0', '2026-02-03'],
      ['1.0.0', '2026-01-02'],
    ]);
    expect(releases[0].subsections.map(s => s.heading)).toEqual(['Added']);
    expect(releases[1].subsections.map(s => s.heading)).toEqual(['Removed']);
  });

  it('ignores a heading inside a code block', () => {
    expect(parse(SAMPLE)[1].subsections[0].body).toContain('## not a heading');
  });

  it('throws on a malformed version heading', () => {
    expect(() => parse('## [1.0] - 2026-01-02\n\n- x\n')).toThrow(/line 1/);
    expect(() => parse('## 1.0.0 - 2026-01-02\n\n- x\n')).toThrow(/neither/);
  });

  it('throws on an impossible date or a repeated version', () => {
    expect(() => parse('## [1.0.0] - 2026-02-30\n\n- x\n')).toThrow(/not a real date/);
    expect(() => parse('## [1.0.0] - 2026-01-02\n\n- x\n\n## [1.0.0] - 2026-01-01\n\n- y\n')).toThrow(
      /twice/
    );
  });
});

describe('checkReleases', () => {
  it('requires the newest release to match the package version', () => {
    expect(() => checkReleases(parse(SAMPLE), '1.1.0')).not.toThrow();
    expect(() => checkReleases(parse(SAMPLE), '1.2.0')).toThrow(/package.json is 1.2.0/);
  });

  it('requires list items in every published release', () => {
    const releases = parse('## [1.0.0] - 2026-01-02\n\n### Added\n\nJust prose.\n');
    expect(() => checkReleases(releases, '1.0.0')).toThrow(/no list items/);
  });

  it('requires at least one release', () => {
    expect(() => checkReleases([], '1.0.0')).toThrow(/no dated releases/);
  });
});

describe('buildFeed', () => {
  it('writes one escaped entry per release with a stable id', () => {
    const doc = parseXml(buildFeed(parse(SAMPLE), render));
    const entries = doc.getElementsByTagNameNS(ATOM, 'entry');
    expect(entries).toHaveLength(2);
    const first = entries[0];
    const text = name => first.getElementsByTagNameNS(ATOM, name)[0].textContent;
    expect(text('title')).toBe('SEED.html 1.1.0');
    expect(text('id')).toBe('tag:readitinabook.com,2026:seed-html/1.1.0');
    expect(text('updated')).toBe('2026-02-03T00:00:00Z');
    const html = text('content');
    expect(html).toContain('<h3>Added</h3>');
    expect(html).toContain('<em>new</em>');
    expect(html).toContain('<code>&lt;url&gt;</code> &amp; more');
    expect(html).toContain('<li>nested detail</li>');
    expect(doc.getElementsByTagNameNS(ATOM, 'updated')[0].textContent).toBe('2026-02-03T00:00:00Z');
  });

  it('limits the feed to the newest releases', () => {
    const doc = parseXml(buildFeed(parse(SAMPLE), render, 1));
    expect(doc.getElementsByTagNameNS(ATOM, 'entry')).toHaveLength(1);
  });
});

describe('escapeXml', () => {
  it('escapes markup characters', () => {
    expect(escapeXml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('the real CHANGELOG.md', () => {
  it('builds a well-formed feed of the newest releases with unique ids', () => {
    const doc = parseXml(releaseFeed());
    const entries = [...doc.getElementsByTagNameNS(ATOM, 'entry')];
    expect(entries).toHaveLength(ENTRY_COUNT);
    const ids = entries.map(e => e.getElementsByTagNameNS(ATOM, 'id')[0].textContent);
    expect(new Set(ids).size).toBe(ids.length);
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(ids[0]).toBe(`tag:readitinabook.com,2026:seed-html/${version}`);
  });
});
