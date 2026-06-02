/**
 * XML Highlighter Utility
 *
 * Syntax-highlights the EPUB content.opf for the metadata preview. Parses the
 * OPF with DOMParser and re-serialises it with highlight spans, so refinements
 * (<meta refines="#id">) are attributed to their parent element by id — e.g. a
 * creator's file-as highlights with that creator, not with every file-as.
 *
 * Highlight levels: the focused field is strongest, the active tab's fields get
 * a soft group marker, everything else is plain. Manifest/spine (and the
 * package tags) are de-emphasised as structural.
 */

import type { EPUBMetadata } from '../epub/opf-utils.js';

type HighlightLevel = 'focused' | 'tab' | 'none';

interface PrimaryMapping {
  field: keyof EPUBMetadata;
  /** Dublin Core element name, e.g. "dc:title". */
  tag?: string;
  /** Standalone meta property, e.g. "rendition:layout" or "schema:accessMode". */
  metaProperty?: string;
  /** rel of a <link> element, e.g. "a11y:certifierReport". */
  linkRel?: string;
}

// Primary metadata elements only. Refinements (file-as, role, collection-type,
// authority, term, …) are NOT listed here — they inherit the field of the
// element they refine, resolved by id at runtime.
const PRIMARY_MAPPINGS: PrimaryMapping[] = [
  { field: 'title', tag: 'dc:title' },
  { field: 'language', tag: 'dc:language' },
  { field: 'identifier', tag: 'dc:identifier' },
  { field: 'creator', tag: 'dc:creator' },
  { field: 'contributor', tag: 'dc:contributor' },
  { field: 'subject', tag: 'dc:subject' },
  { field: 'publisher', tag: 'dc:publisher' },
  { field: 'date', tag: 'dc:date' },
  { field: 'description', tag: 'dc:description' },
  { field: 'rights', tag: 'dc:rights' },
  { field: 'source', tag: 'dc:source' },
  { field: 'relation', tag: 'dc:relation' },
  { field: 'coverage', tag: 'dc:coverage' },
  { field: 'type', tag: 'dc:type' },
  { field: 'format', tag: 'dc:format' },
  { field: 'renditionLayout', metaProperty: 'rendition:layout' },
  { field: 'renditionOrientation', metaProperty: 'rendition:orientation' },
  { field: 'renditionSpread', metaProperty: 'rendition:spread' },
  { field: 'renditionViewport', metaProperty: 'rendition:viewport' },
  { field: 'renditionFlow', metaProperty: 'rendition:flow' },
  { field: 'collections', metaProperty: 'belongs-to-collection' },
  { field: 'accessMode', metaProperty: 'schema:accessMode' },
  { field: 'accessModeSufficient', metaProperty: 'schema:accessModeSufficient' },
  { field: 'accessibilityFeature', metaProperty: 'schema:accessibilityFeature' },
  { field: 'accessibilityHazard', metaProperty: 'schema:accessibilityHazard' },
  { field: 'accessibilityControl', metaProperty: 'schema:accessibilityControl' },
  { field: 'accessibilityAPI', metaProperty: 'schema:accessibilityAPI' },
  { field: 'accessibilitySummary', metaProperty: 'schema:accessibilitySummary' },
  { field: 'accessibilityConformance', metaProperty: 'dcterms:conformsTo' },
  { field: 'accessibilityCertifiedBy', metaProperty: 'a11y:certifiedBy' },
  { field: 'accessibilityCertifierCredential', metaProperty: 'a11y:certifierCredential' },
  { field: 'accessibilityCertifierReport', linkRel: 'a11y:certifierReport' },
  { field: 'ibooksSpecifiedFonts', metaProperty: 'ibooks:specified-fonts' },
];

export interface HighlightingOptions {
  focusedField?: keyof EPUBMetadata | null;
  /** Fields owned by the active editor tab — softly highlighted as a group. */
  tabFields?: string[];
  highlightValues?: boolean;
  highlightTags?: boolean;
  pageProgressionDirection?: string;
}

export interface HighlightResult {
  highlightedXML: string;
}

interface RenderContext {
  fieldFor: (el: Element) => keyof EPUBMetadata | null;
  levelFor: (field: keyof EPUBMetadata | null) => HighlightLevel;
  spineStructural: boolean;
  highlightValues: boolean;
  highlightTags: boolean;
}

const INDENT = '  ';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * DOM-based highlighter for EPUB OPF content.
 */
export class XMLHighlighter {
  highlightOPFContent(xmlContent: string, options: HighlightingOptions = {}): HighlightResult {
    const {
      focusedField = null,
      tabFields = [],
      highlightValues = true,
      highlightTags = true,
      pageProgressionDirection,
    } = options;

    try {
      const doc = new DOMParser().parseFromString(xmlContent, 'application/xml');
      if (doc.querySelector('parsererror') || !doc.documentElement) {
        return { highlightedXML: esc(this.stripDeclaration(xmlContent)) };
      }

      const idToField = this.buildIdMap(doc.documentElement);
      const fieldFor = (el: Element): keyof EPUBMetadata | null => {
        if (el.tagName === 'meta') {
          const refines = el.getAttribute('refines');
          if (refines) return idToField.get(refines.replace(/^#/, '')) ?? null;
        }
        return this.primaryField(el);
      };
      const levelFor = (field: keyof EPUBMetadata | null): HighlightLevel => {
        if (!field) return 'none';
        if (focusedField === field) return 'focused';
        return tabFields.includes(field) ? 'tab' : 'none';
      };
      const spineStructural = !(
        pageProgressionDirection &&
        pageProgressionDirection !== 'default' &&
        pageProgressionDirection !== ''
      );

      const ctx: RenderContext = {
        fieldFor,
        levelFor,
        spineStructural,
        highlightValues,
        highlightTags,
      };
      return { highlightedXML: this.renderElement(doc.documentElement, 0, false, ctx).trimStart() };
    } catch (error) {
      console.warn('XML highlighting failed:', error);
      return { highlightedXML: esc(xmlContent) };
    }
  }

  /** Field a primary element represents (by tag for DC, by property for standalone metas). */
  private primaryField(el: Element): keyof EPUBMetadata | null {
    if (el.tagName === 'meta') {
      if (el.getAttribute('refines')) return null; // refinements resolve by id
      const property = el.getAttribute('property');
      const byProp = PRIMARY_MAPPINGS.find(m => m.metaProperty && m.metaProperty === property);
      return byProp?.field ?? null;
    }
    if (el.tagName === 'link') {
      const rel = el.getAttribute('rel');
      const byRel = PRIMARY_MAPPINGS.find(m => m.linkRel && m.linkRel === rel);
      return byRel?.field ?? null;
    }
    const byTag = PRIMARY_MAPPINGS.find(m => m.tag && m.tag === el.tagName);
    return byTag?.field ?? null;
  }

  /** Map each id-bearing primary element to its field, so refinements can inherit it. */
  private buildIdMap(root: Element): Map<string, keyof EPUBMetadata> {
    const map = new Map<string, keyof EPUBMetadata>();
    const walk = (el: Element) => {
      const id = el.getAttribute('id');
      if (id) {
        const field = this.primaryField(el);
        if (field) map.set(id, field);
      }
      for (const child of Array.from(el.children)) walk(child);
    };
    walk(root);
    return map;
  }

  private renderAttrs(el: Element): string {
    let out = '';
    for (const attr of Array.from(el.attributes)) {
      out += ` ${attr.name}=&quot;${esc(attr.value)}&quot;`;
    }
    return out;
  }

  private renderElement(
    el: Element,
    depth: number,
    inheritedStructural: boolean,
    ctx: RenderContext
  ): string {
    const indent = INDENT.repeat(depth);
    const tag = el.tagName;
    const attrs = this.renderAttrs(el);
    const children = Array.from(el.children);

    // Manifest and (usually) spine are de-emphasised wholesale.
    const becomesStructural =
      !inheritedStructural && (tag === 'manifest' || (tag === 'spine' && ctx.spineStructural));
    const structural = inheritedStructural || becomesStructural;

    let block: string;

    if (children.length > 0) {
      const inner = children.map(c => this.renderElement(c, depth + 1, structural, ctx)).join('\n');
      let openTag = `&lt;${tag}${attrs}&gt;`;
      let closeTag = `&lt;/${tag}&gt;`;
      // The package element keeps highlighted metadata inside, so only its own
      // tags are de-emphasised (not the whole subtree).
      if (tag === 'package') {
        openTag = `<span class="structural-element">${openTag}</span>`;
        closeTag = `<span class="structural-element">${closeTag}</span>`;
      }
      block = `${indent}${openTag}\n${inner}\n${indent}${closeTag}`;
    } else {
      block = `${indent}${this.renderLeaf(el, tag, attrs, structural, ctx)}`;
    }

    // Wrap a newly-structural subtree (manifest/spine) so it reads as a unit.
    if (becomesStructural) {
      return `${indent}<span class="structural-element">${block.slice(indent.length)}</span>`;
    }
    return block;
  }

  private renderLeaf(
    el: Element,
    tag: string,
    attrs: string,
    structural: boolean,
    ctx: RenderContext
  ): string {
    const value = (el.textContent ?? '').trim();
    const selfTag = `&lt;${tag}${attrs}/&gt;`;
    const openTag = `&lt;${tag}${attrs}&gt;`;
    const closeTag = `&lt;/${tag}&gt;`;

    if (structural) {
      return value ? `${openTag}${esc(value)}${closeTag}` : selfTag;
    }

    const level = ctx.levelFor(ctx.fieldFor(el));
    const tagClass = this.tagClassFor(level);

    // Empty element with no text value (e.g. the certifier-report <link>):
    // highlight the self-closing tag itself.
    if (!value) {
      return ctx.highlightTags
        ? `<span class="${tagClass} metadata-line">${selfTag}</span>`
        : selfTag;
    }

    const valueClass = this.valueClassFor(level);

    let out = ctx.highlightTags
      ? `<span class="${tagClass} metadata-line">${openTag}</span>`
      : openTag;
    out += ctx.highlightValues ? `<span class="${valueClass}">${esc(value)}</span>` : esc(value);
    out += ctx.highlightTags ? `<span class="${tagClass}">${closeTag}</span>` : closeTag;
    return out;
  }

  private tagClassFor(level: HighlightLevel): string {
    return level === 'focused'
      ? 'metadata-tag-focused'
      : level === 'tab'
        ? 'metadata-tag-tab'
        : 'metadata-tag';
  }

  private valueClassFor(level: HighlightLevel): string {
    return level === 'focused' ? 'metadata-value-focused' : 'metadata-value';
  }

  private stripDeclaration(xml: string): string {
    return xml.replace(/^<\?xml[^>]+\?>\s*/, '');
  }
}

/**
 * Default instance for easy importing
 */
export const xmlHighlighter = new XMLHighlighter();
