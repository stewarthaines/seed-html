import { describe, it, expect } from 'vitest';
import { xmlHighlighter } from './xml-highlighter';

const SAMPLE_OPF =
  `<?xml version="1.0"?><package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
  `<dc:title>A Book</dc:title>` +
  `<meta property="belongs-to-collection" id="collection1">The Chronicles</meta>` +
  `<meta refines="#collection1" property="collection-type">series</meta>` +
  `<meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA</meta>` +
  `<meta property="schema:accessMode">textual</meta>` +
  `</metadata></package>`;

describe('xmlHighlighter — new metadata focus', () => {
  it('highlights belongs-to-collection even though the meta carries an id attribute', () => {
    const { highlightedXML } = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, {
      focusedField: 'collections',
    });
    // The collection name is wrapped in the focused-value span.
    expect(highlightedXML).toMatch(/metadata-value-focused[^>]*>The Chronicles/);
  });

  it('highlights collection refinements (collection-type) along with the collection', () => {
    const { highlightedXML } = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, {
      focusedField: 'collections',
    });
    // Both the belongs-to-collection name and its collection-type refinement
    // are highlighted as part of the same field.
    expect(highlightedXML).toMatch(/metadata-value-focused[^>]*>The Chronicles/);
    expect(highlightedXML).toMatch(/metadata-value-focused[^>]*>series/);
  });

  it('highlights dcterms:conformsTo when conformance is focused', () => {
    const { highlightedXML } = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, {
      focusedField: 'accessibilityConformance',
    });
    expect(highlightedXML).toContain('metadata-value-focused');
    expect(highlightedXML).toContain('WCAG 2.1 Level AA');
  });

  it('highlights schema:accessMode when access modes are focused', () => {
    const { highlightedXML } = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, {
      focusedField: 'accessMode',
    });
    expect(highlightedXML).toMatch(/metadata-value-focused[^>]*>textual/);
  });

  it('softly marks active-tab fields and lets the focused field win', () => {
    const tabFields = ['accessMode', 'accessibilityConformance', 'collections'];

    // No focus: tab fields get the soft tab marker on their opening tag.
    const tabOnly = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, { tabFields });
    expect(tabOnly.highlightedXML).toContain('metadata-tag-tab metadata-line');

    // Focused field within the tab is promoted to the strong (focused) marker,
    // not the soft one.
    const withFocus = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, {
      tabFields,
      focusedField: 'accessMode',
    });
    expect(withFocus.highlightedXML).toMatch(/metadata-value-focused[^>]*>textual/);
  });

  it('attributes shared refinements to the right parent by id (file-as/role)', () => {
    const xml =
      `<?xml version="1.0"?><package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
      `<dc:creator id="creator1">Jane Author</dc:creator>` +
      `<meta refines="#creator1" property="role" scheme="marc:relators">aut</meta>` +
      `<meta refines="#creator1" property="file-as">Author, Jane</meta>` +
      `<dc:contributor id="creator2">Sam Editor</dc:contributor>` +
      `<meta refines="#creator2" property="file-as">Editor, Sam</meta>` +
      `</metadata></package>`;

    const { highlightedXML } = xmlHighlighter.highlightOPFContent(xml, { focusedField: 'creator' });

    // The creator's role and file-as are highlighted with the creator…
    expect(highlightedXML).toMatch(/metadata-value-focused[^>]*>aut/);
    expect(highlightedXML).toMatch(/metadata-value-focused[^>]*>Author, Jane/);
    // …but the contributor's file-as is NOT (it belongs to a different field).
    expect(highlightedXML).not.toMatch(/metadata-value-focused[^>]*>Editor, Sam/);
  });

  it('highlights the certifier-report <link> (a self-closing element with no text)', () => {
    const xml =
      `<?xml version="1.0"?><package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
      `<dc:title>A Book</dc:title>` +
      `<link rel="a11y:certifierReport" href="https://example.com/report"/>` +
      `</metadata></package>`;

    const { highlightedXML } = xmlHighlighter.highlightOPFContent(xml, {
      focusedField: 'accessibilityCertifierReport',
    });
    // The self-closing link tag is wrapped in the focused tag span (with the bar marker).
    expect(highlightedXML).toMatch(/metadata-tag-focused metadata-line[^>]*>&lt;link/);
    expect(highlightedXML).toContain('https://example.com/report');
  });

  it('leaves unrelated fields unfocused', () => {
    const { highlightedXML } = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, {
      focusedField: 'title',
    });
    // conformsTo should not be the focused field here
    expect(highlightedXML).toContain('WCAG 2.1 Level AA');
    expect(highlightedXML).not.toMatch(/metadata-value-focused[^>]*>WCAG/);
  });
});
