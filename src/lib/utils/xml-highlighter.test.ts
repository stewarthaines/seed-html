import { describe, it, expect } from 'vitest';
import { xmlHighlighter } from './xml-highlighter';

const SAMPLE_OPF = `<?xml version="1.0"?><package><metadata>` +
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

  it('leaves unrelated fields unfocused', () => {
    const { highlightedXML } = xmlHighlighter.highlightOPFContent(SAMPLE_OPF, {
      focusedField: 'title',
    });
    // conformsTo should not be the focused field here
    expect(highlightedXML).toContain('WCAG 2.1 Level AA');
    expect(highlightedXML).not.toMatch(/metadata-value-focused[^>]*>WCAG/);
  });
});
