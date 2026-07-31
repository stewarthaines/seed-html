/**
 * The a11y section of the seed_get_checks bridge payload
 * (process/BRIDGE_CHECKS.md). Pure assembly over a raw axe-core result:
 * violations AND the `incomplete` bucket (surfaced as `needsReview` — the
 * in-app panel discards it, but that's where color-contrast candidates live),
 * each triaged, sorted by impact, with the rendering engine and its caveats
 * stated rather than silently filtered.
 */

import { triageAxeRule, type CheckCategory, type RemedySurface } from './triage.js';

export interface AxeRuleResult {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{ target: string[]; html: string }>;
}

export interface TriagedAxeResult extends AxeRuleResult {
  category: CheckCategory;
  remedy?: RemedySurface;
}

export type PreviewEngine = 'raw' | 'foliate' | 'paged';

export type A11ySection =
  | { status: 'unavailable'; reason: string }
  | {
      status: 'ok';
      engine: PreviewEngine;
      /** 'paged-chrome': the audited document includes Paged.js wrapper markup,
       *  which can contribute findings that are not the chapter's. */
      caveats: string[];
      violations: TriagedAxeResult[];
      /** axe 'incomplete' results — checks axe could not decide (e.g. contrast
       *  over images); worth review precisely when violations is empty. */
      needsReview: TriagedAxeResult[];
    };

const IMPACT_RANK: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const impactRank = (impact: string | null): number =>
  impact && impact in IMPACT_RANK ? IMPACT_RANK[impact] : 4;

// Long outer-HTML snippets bloat the payload without helping the agent, which
// has seed_read_file / seed_get_rendered_xhtml for full context.
const HTML_SNIPPET_LIMIT = 400;

function triageAndSort(results: AxeRuleResult[]): TriagedAxeResult[] {
  return results
    .map(result => ({
      ...result,
      nodes: result.nodes.map(node => ({
        target: node.target,
        html:
          node.html.length > HTML_SNIPPET_LIMIT
            ? `${node.html.slice(0, HTML_SNIPPET_LIMIT)}…`
            : node.html,
      })),
      ...triageAxeRule(result.id),
    }))
    .sort((a, b) => impactRank(a.impact) - impactRank(b.impact));
}

export function buildA11ySection(
  engine: PreviewEngine,
  results: { violations: AxeRuleResult[]; incomplete?: AxeRuleResult[] }
): A11ySection {
  return {
    status: 'ok',
    engine,
    caveats: engine === 'paged' ? ['paged-chrome'] : [],
    violations: triageAndSort(results.violations),
    needsReview: triageAndSort(results.incomplete ?? []),
  };
}
