/**
 * Ids from the djot extension: generated section ids are made XML-legal,
 * an id the author chose is kept, and repeat footnote references are unique. Runs
 * the extension's own djot bundle and transformText, so this is the parse →
 * filter → render path a chapter takes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';

const context = createContext({});
runInContext(readFileSync('extensions/djot/djot.js', 'utf8'), context);
runInContext(
  `${readFileSync('extensions/djot/transformDjot.js', 'utf8')}\nthis.transformText = transformText;`,
  context
);
const transformText = (context as { transformText: (text: string) => string }).transformText;

const sectionIds = (html: string) => [...html.matchAll(/<section id="([^"]*)"/g)].map(m => m[1]);
const linkTargets = (html: string) => [...html.matchAll(/<a href="#([^"]*)"/g)].map(m => m[1]);

describe('djot section ids', () => {
  it('keeps an id the author set above the heading, and links to it resolve', () => {
    const html = transformText(
      "{#emma-arrival}\n## Emma's arrival\n\nSee [her arrival](#emma-arrival)."
    );
    expect(sectionIds(html)).toEqual(['emma-arrival']);
    expect(linkTargets(html)).toEqual(['emma-arrival']);
  });

  it('still makes a generated id XML-legal', () => {
    const html = transformText("## Emma's arrival\n\nSee [her arrival](#Emma's-arrival).");
    expect(sectionIds(html)).toEqual(['Emma-s-arrival']);
    expect(linkTargets(html)).toEqual(['Emma-s-arrival']);
  });

  it('normalises an illegal explicit id the same way as a link to it', () => {
    const html = transformText('{#1880s}\n## The eighties\n\nSee [then](#1880s).');
    expect(sectionIds(html)).toEqual(['_1880s']);
    expect(linkTargets(html)).toEqual(['_1880s']);
  });

  it('numbers repeated generated ids but leaves explicit ones alone', () => {
    const html = transformText(
      '## Notes\n\nOne.\n\n## Notes\n\nTwo.\n\n{#sources}\n## Notes\n\nThree.'
    );
    expect(sectionIds(html)).toEqual(['Notes', 'Notes-2', 'sources']);
  });
});

describe('djot footnote references', () => {
  it('gives each repeat reference to one note its own id', () => {
    const html = transformText(
      'One[^a] and again[^a], then[^b] and[^a].\n\n[^a]: The note.\n\n[^b]: Other.'
    );
    const refIds = [...html.matchAll(/<a id="(fnref[^"]*)"/g)].map(m => m[1]);
    expect(refIds).toEqual(['fnref1', 'fnref1-2', 'fnref2', 'fnref1-3']);
    expect(html).toContain('href="#fnref1" role="doc-backlink"');
  });

  it('marks every reference for Apple Books pop-ups, repeats included', () => {
    const html = transformText('One[^a] and again[^a].\n\n[^a]: The note.');
    const refs = [...html.matchAll(/<a id="fnref[^"]*"[^>]*>/g)].map(m => m[0]);
    expect(refs).toHaveLength(2);
    for (const ref of refs) {
      expect(ref).toContain('role="doc-noteref"');
      expect(ref).toContain('epub:type="noteref"');
    }
  });
});

describe('djot footnotes', () => {
  const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');

  it('puts each note in a footnote div, with the backlink outside it', () => {
    const notes = doc(transformText('A claim.[^a]\n\n[^a]: The source.'));
    const item = notes.querySelector('section[role="doc-endnotes"] li');
    const [note, back] = [...(item?.children ?? [])];
    expect(item?.hasAttribute('id')).toBe(false);
    expect(note?.tagName).toBe('DIV');
    expect(note?.id).toBe('fn1');
    expect(note?.getAttribute('epub:type')).toBe('footnote');
    expect(note?.textContent?.trim()).toBe('The source.');
    expect(note?.querySelector('a[role="doc-backlink"]')).toBeNull();
    expect(back?.getAttribute('role')).toBe('doc-backlink');
    expect(back?.getAttribute('href')).toBe('#fnref1');
  });

  it('lists notes in the order they are first cited, as djot does', () => {
    const notes = doc(transformText('First[^b], second[^a].\n\n[^a]: Note a.\n\n[^b]: Note b.'));
    const divs = [...notes.querySelectorAll('section[role="doc-endnotes"] li > div')];
    expect(divs.every(div => div.getAttribute('epub:type') === 'footnote')).toBe(true);
    const listed = divs.map(div => [div.id, div.textContent?.trim()]);
    expect(listed).toEqual([
      ['fn1', 'Note b.'],
      ['fn2', 'Note a.'],
    ]);
  });

  it('renders no notes section for a chapter without footnotes', () => {
    expect(transformText('No notes here.')).not.toContain('doc-endnotes');
  });
});
