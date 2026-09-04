/**
 * Triage for checker findings served over the agent bridge
 * (process/BRIDGE_CHECKS.md). Maps axe-core rule ids and EPUBCheck message ids
 * to the judgment an agent needs: who can act on the finding, and where.
 *
 * - `fixable`        — remedy lives in author-editable surfaces the bridge
 *                      reaches (SOURCE text, book CSS, metadata, nav.txt).
 * - `explainable`    — real issue; remedy is outside the author's source
 *                      (asset production, design policy, distribution).
 * - `app-bug`        — symptom of SEED's own pipeline (generated OPF/nav/
 *                      packaging, transform output); report, don't coach.
 * - `not-applicable` — web-app-oriented rules with no purchase on book
 *                      content, or preview-chrome noise.
 *
 * Unknown ids default to `explainable` with no remedy — the agent can still
 * reason from the message text; it just gets no routing hint.
 */

export type CheckCategory = 'fixable' | 'explainable' | 'app-bug' | 'not-applicable';

export type RemedySurface = 'source-text' | 'stylesheet' | 'metadata' | 'nav' | 'chapter-title';

export interface CheckTriage {
  category: CheckCategory;
  remedy?: RemedySurface;
}

const DEFAULT_TRIAGE: CheckTriage = { category: 'explainable' };

// --- axe-core (default ruleset) --------------------------------------------------

const AXE_EXACT: Record<string, CheckTriage> = {
  // Authored content — the remedy is an edit to the chapter's plain text.
  'image-alt': { category: 'fixable', remedy: 'source-text' },
  // A :detail: crop is an inline SVG named by its <title> (the directive's
  // alt=); an empty alt is an edit to the directive line.
  'svg-img-alt': { category: 'fixable', remedy: 'source-text' },
  'role-img-alt': { category: 'fixable', remedy: 'source-text' },
  'input-image-alt': { category: 'fixable', remedy: 'source-text' },
  'area-alt': { category: 'fixable', remedy: 'source-text' },
  'image-redundant-alt': { category: 'fixable', remedy: 'source-text' },
  'link-name': { category: 'fixable', remedy: 'source-text' },
  'heading-order': { category: 'fixable', remedy: 'source-text' },
  'empty-heading': { category: 'fixable', remedy: 'source-text' },
  list: { category: 'fixable', remedy: 'source-text' },
  listitem: { category: 'fixable', remedy: 'source-text' },
  'definition-list': { category: 'fixable', remedy: 'source-text' },
  dlitem: { category: 'fixable', remedy: 'source-text' },
  'td-headers-attr': { category: 'fixable', remedy: 'source-text' },
  'th-has-data-cells': { category: 'fixable', remedy: 'source-text' },
  'scope-attr-valid': { category: 'fixable', remedy: 'source-text' },
  // Author anchors are the common case; transform-minted duplicate ids exist
  // but can't be told apart statically — the agent guidance covers the split.
  'duplicate-id': { category: 'fixable', remedy: 'source-text' },
  'duplicate-id-active': { category: 'fixable', remedy: 'source-text' },
  'duplicate-id-aria': { category: 'fixable', remedy: 'source-text' },

  // The book stylesheet the author owns (design judgment applies).
  'color-contrast': { category: 'fixable', remedy: 'stylesheet' },
  'color-contrast-enhanced': { category: 'fixable', remedy: 'stylesheet' },
  'link-in-text-block': { category: 'fixable', remedy: 'stylesheet' },

  // Stamped by the app from dc:language / the chapter title — remedy is the
  // metadata field or title input, not markup.
  'html-has-lang': { category: 'fixable', remedy: 'metadata' },
  'html-lang-valid': { category: 'fixable', remedy: 'metadata' },
  'html-xml-lang-mismatch': { category: 'fixable', remedy: 'metadata' },
  'valid-lang': { category: 'fixable', remedy: 'metadata' },
  'document-title': { category: 'fixable', remedy: 'chapter-title' },

  // Real, but the remedy is producing media alternatives — a project, not an edit.
  'video-caption': { category: 'explainable' },

  // Web-app structure policy: books express structure via epub:type, chapters
  // may legitimately not start at h1 — usually correct to ignore, and the
  // agent should say so.
  region: { category: 'explainable' },
  'page-has-heading-one': { category: 'explainable' },
  bypass: { category: 'explainable' },

  // Interactive-app rules: only reachable via scripted EPUBs or preview chrome.
  'button-name': { category: 'not-applicable' },
  'select-name': { category: 'not-applicable' },
  label: { category: 'not-applicable' },
  'label-title-only': { category: 'not-applicable' },
  'form-field-multiple-labels': { category: 'not-applicable' },
  'autocomplete-valid': { category: 'not-applicable' },
  tabindex: { category: 'not-applicable' },
  'scrollable-region-focusable': { category: 'not-applicable' },
  'nested-interactive': { category: 'not-applicable' },
  'meta-viewport': { category: 'not-applicable' },
  'meta-refresh': { category: 'not-applicable' },
};

/** Triage an axe-core rule id. */
export function triageAxeRule(ruleId: string): CheckTriage {
  const exact = AXE_EXACT[ruleId];
  if (exact) return exact;
  // Authors never write ARIA — a violation means a transform/extension
  // emitted bad markup.
  if (ruleId.startsWith('aria-')) return { category: 'app-bug' };
  if (ruleId.startsWith('landmark-')) return { category: 'explainable' };
  if (ruleId.startsWith('frame-')) return { category: 'not-applicable' };
  return DEFAULT_TRIAGE;
}

// --- EPUBCheck messages ----------------------------------------------------------

const EPUBCHECK_EXACT: Record<string, CheckTriage> = {
  // Broken references and fragments trace to source links — prime agent territory.
  'RSC-007': { category: 'fixable', remedy: 'source-text' },
  'RSC-012': { category: 'fixable', remedy: 'source-text' },
  // Content-document schema errors: author raw-XHTML passthrough is the
  // actionable case; transform-emitted markup is an app bug (guidance covers
  // the split — statically indistinguishable).
  'RSC-005': { category: 'fixable', remedy: 'source-text' },
  // Remote resources: a distribution decision, not an edit.
  'RSC-006': { category: 'explainable' },

  // Metadata whose *content* is the author's even though the OPF is generated.
  // The exact set grows as messages are met in the wild; unlisted OPF-* codes
  // fall to the structural default below.
  'OPF-025': { category: 'fixable', remedy: 'metadata' },
  'OPF-026': { category: 'fixable', remedy: 'metadata' },
  'OPF-027': { category: 'fixable', remedy: 'metadata' },
  'OPF-053': { category: 'fixable', remedy: 'metadata' },
  'OPF-054': { category: 'fixable', remedy: 'metadata' },
  'OPF-085': { category: 'fixable', remedy: 'metadata' },
  'OPF-092': { category: 'fixable', remedy: 'metadata' },
};

const EPUBCHECK_PREFIX: Record<string, CheckTriage> = {
  // Author-owned stylesheets.
  CSS: { category: 'fixable', remedy: 'stylesheet' },
  // schema.org accessibility metadata suggestions — high value, info-level.
  ACC: { category: 'fixable', remedy: 'metadata' },
  // Hand-authored nav.txt is the common case; generated-nav failures are app
  // bugs (guidance covers the split).
  NAV: { category: 'fixable', remedy: 'nav' },
  // Media type/fallback problems: re-encode or replace assets.
  MED: { category: 'explainable' },
  // SEED generates the OPF, the packaging, and the transform-emitted XHTML —
  // errors here are SEED's, not the author's.
  OPF: { category: 'app-bug' },
  PKG: { category: 'app-bug' },
  HTM: { category: 'app-bug' },
  NCX: { category: 'app-bug' },
};

/** Triage an EPUBCheck message id (e.g. "RSC-007"); tolerant of absent ids. */
export function triageEpubcheckMessage(messageId: string | undefined): CheckTriage {
  if (!messageId) return DEFAULT_TRIAGE;
  const exact = EPUBCHECK_EXACT[messageId];
  if (exact) return exact;
  const prefix = EPUBCHECK_PREFIX[messageId.split('-')[0]];
  if (prefix) return prefix;
  return DEFAULT_TRIAGE;
}
