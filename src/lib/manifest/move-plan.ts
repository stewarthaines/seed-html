/**
 * Manifest move planning — the pure half of batch file moves (plan → review →
 * commit, mirroring folder-sync's split). Everything here works on pre-read
 * strings so it unit-tests without a storage backend; `commitMovePlan`
 * (services/manifest/manifest-move.ts) performs the IO.
 *
 * The reference rewriter knows exactly TWO conventions:
 *   1. chapter SOURCE text: the XHTML-relative form with one `../` hop —
 *      `![alt](../Images/foo.png)`;
 *   2. CSS `url()`, relative to the stylesheet's own directory.
 * Generated XHTML is deliberately NOT rewritten (it regenerates on re-render),
 * and the audio clip directive's OPF-relative `src="Audio/a.mp3"` form is a
 * user-side script convention this feature does not touch (follow-on task).
 */

import type { ManifestItem } from '../epub/opf-utils.js';
import { toEpubSafeHref } from '../epub/opf-utils.js';

/** One requested move: a manifest item to a new OPF-relative href. */
export interface MoveRequest {
  id: string;
  newHref: string;
}

/** A planned (or blocked) move of one manifest item. */
export interface MoveRow {
  id: string;
  oldHref: string;
  /** Sanitized target href (meaningless when blocked). */
  newHref: string;
  /** Human reason this move cannot proceed; absent when the move is valid. */
  blocked?: string;
}

/** A single exact-string rewrite inside one file. */
export interface Rewrite {
  from: string;
  to: string;
  count: number;
}

/** All rewrites for one affected file. */
export interface FileChange {
  path: string;
  kind: 'source' | 'css';
  rewrites: Rewrite[];
}

export interface MovePlan {
  rows: MoveRow[];
  /** Files whose text must change, with per-string counts (for the review UI). */
  fileChanges: FileChange[];
}

export interface MovePlanInput {
  manifest: ManifestItem[];
  moves: MoveRequest[];
  /** Chapter sources: workspace-relative path + current text. */
  sources: { path: string; text: string }[];
  /** Stylesheets: OPF-relative href + current text. */
  stylesheets: { href: string; text: string }[];
}

/** Directory part of an OPF-relative href ('' for root-level files). */
export function hrefDir(href: string): string {
  const slash = href.lastIndexOf('/');
  return slash === -1 ? '' : href.slice(0, slash);
}

/** Basename part of an OPF-relative href. */
export function hrefBasename(href: string): string {
  const slash = href.lastIndexOf('/');
  return slash === -1 ? href : href.slice(slash + 1);
}

/**
 * The relative form of an OPF-relative `href` as written from inside `fromDir`
 * (also OPF-relative, '' = OPF root). E.g. from 'Styles' to 'Fonts/x.woff2' →
 * '../Fonts/x.woff2'; from 'Text' to 'Images/a.png' → '../Images/a.png'.
 */
export function relativeFromDir(fromDir: string, href: string): string {
  const from = fromDir ? fromDir.split('/').filter(Boolean) : [];
  const target = href.split('/').filter(Boolean);
  let common = 0;
  while (
    common < from.length &&
    common < target.length - 1 && // the last segment is the filename
    from[common] === target[common]
  ) {
    common++;
  }
  return '../'.repeat(from.length - common) + target.slice(common).join('/');
}

/**
 * Resolve a relative reference written inside `fromDir` back to an
 * OPF-relative href. Returns null for external/absolute/data/blob URLs and
 * for references that escape the OPF root.
 */
export function resolveAgainstDir(fromDir: string, ref: string): string | null {
  if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('/') || ref.startsWith('#')) {
    return null;
  }
  const stack = fromDir ? fromDir.split('/').filter(Boolean) : [];
  for (const segment of ref.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (stack.length === 0) return null; // escapes the OPF root
      stack.pop();
    } else {
      stack.push(segment);
    }
  }
  return stack.join('/');
}

/** The quote-aware url() pattern (same shape blob-url-manager uses live). */
const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

/**
 * Count non-overlapping occurrences of an exact substring.
 */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Apply exact-string rewrites in one pass. Longer `from` strings win over
 * shorter prefixes (e.g. `../Images/a.jpg.bak` before `../Images/a.jpg`), so
 * one rewrite can never corrupt a longer reference that contains it.
 */
export function applyRewrites(text: string, rewrites: { from: string; to: string }[]): string {
  const applicable = rewrites.filter(r => r.from && r.from !== r.to);
  if (applicable.length === 0) return text;
  const byLength = [...applicable].sort((a, b) => b.from.length - a.from.length);
  const escaped = byLength.map(r => r.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escaped.join('|'), 'g');
  const map = new Map(byLength.map(r => [r.from, r.to]));
  return text.replace(pattern, match => map.get(match) ?? match);
}

/** One file referencing an href, with the occurrence count. */
export interface ReferenceHit {
  path: string;
  kind: 'source' | 'css';
  count: number;
}

/**
 * Read-only usage lookup: where is this href referenced? Same two conventions
 * as the move rewriter — the `../<href>` source form and CSS url() resolved
 * against each stylesheet's directory.
 */
export function findHrefReferences(
  href: string,
  sources: { path: string; text: string }[],
  stylesheets: { href: string; text: string }[]
): ReferenceHit[] {
  const hits: ReferenceHit[] = [];
  const needle = `../${href}`;
  for (const source of sources) {
    const count = countOccurrences(source.text, needle);
    if (count > 0) hits.push({ path: source.path, kind: 'source', count });
  }
  for (const sheet of stylesheets) {
    const dir = hrefDir(sheet.href);
    let count = 0;
    for (const match of sheet.text.matchAll(CSS_URL)) {
      if (resolveAgainstDir(dir, match[2]) === href) count++;
    }
    if (count > 0) hits.push({ path: sheet.href, kind: 'css', count });
  }
  return hits;
}

/**
 * Apply CSS rewrites strictly inside url(...) — never as blind string
 * replacement, so a ref that also appears in a comment or content: string is
 * left alone. Quote style is preserved.
 */
export function applyCssRewrites(text: string, rewrites: { from: string; to: string }[]): string {
  const map = new Map(rewrites.map(r => [r.from, r.to]));
  return text.replace(CSS_URL, (match, quote: string, ref: string) => {
    const to = map.get(ref);
    return to === undefined ? match : `url(${quote}${to}${quote})`;
  });
}

/**
 * Build the move plan: sanitized targets, collision detection (manifest-wide
 * and within the batch, case-insensitive — matching updateManifestItem's
 * rule), and every reference rewrite the commit will perform.
 */
export function buildMovePlan(input: MovePlanInput): MovePlan {
  const { manifest, moves, sources, stylesheets } = input;
  const byId = new Map(manifest.map(m => [m.id, m]));

  // --- rows: sanitize + collision-check each requested move -----------------
  const rows: MoveRow[] = [];
  const movingIds = new Set(moves.map(m => m.id));
  const claimedTargets = new Map<string, string>(); // lower(newHref) -> id
  for (const move of moves) {
    const item = byId.get(move.id);
    if (!item) {
      rows.push({ id: move.id, oldHref: '', newHref: move.newHref, blocked: 'not in manifest' });
      continue;
    }
    const safe = toEpubSafeHref(move.newHref);
    if (!safe) {
      rows.push({
        id: move.id,
        oldHref: item.href,
        newHref: move.newHref,
        blocked: 'invalid path',
      });
      continue;
    }
    if (safe.toLowerCase() === item.href.toLowerCase()) {
      continue; // no-op move — nothing to plan
    }
    const row: MoveRow = { id: move.id, oldHref: item.href, newHref: safe };
    const lower = safe.toLowerCase();
    const collideExisting = manifest.find(
      m => m.id !== move.id && !movingIds.has(m.id) && m.href.toLowerCase() === lower
    );
    const collideBatch = claimedTargets.get(lower);
    if (collideExisting) {
      row.blocked = `collides with ${collideExisting.href}`;
    } else if (collideBatch) {
      row.blocked = `duplicate target within the move`;
    } else {
      claimedTargets.set(lower, move.id);
    }
    rows.push(row);
  }

  const effective = rows.filter(r => !r.blocked);
  const newHrefFor = new Map(effective.map(r => [r.oldHref, r.newHref]));

  // --- fileChanges -----------------------------------------------------------
  const fileChanges: FileChange[] = [];

  // Chapter sources: the `../<href>` XHTML-relative form, exact string.
  for (const source of sources) {
    const rewrites: Rewrite[] = [];
    for (const row of effective) {
      const from = `../${row.oldHref}`;
      const count = countOccurrences(source.text, from);
      if (count > 0) rewrites.push({ from, to: `../${row.newHref}`, count });
    }
    if (rewrites.length > 0) {
      fileChanges.push({ path: source.path, kind: 'source', rewrites });
    }
  }

  // Stylesheets: every url() resolves to some href; if that target moved OR
  // the stylesheet itself is moving (its own relative base changes), the
  // reference's correct new spelling is relativeFromDir(newSheetDir, target's
  // current-or-new href). Rewrite whenever the spelling changes.
  for (const sheet of stylesheets) {
    const oldDir = hrefDir(sheet.href);
    const sheetNewHref = newHrefFor.get(sheet.href) ?? sheet.href;
    const newDir = hrefDir(sheetNewHref);
    const rewrites = new Map<string, Rewrite>();
    for (const match of sheet.text.matchAll(CSS_URL)) {
      const ref = match[2];
      const target = resolveAgainstDir(oldDir, ref);
      if (target === null) continue;
      const movedTarget = newHrefFor.get(target) ?? target;
      const spelling = relativeFromDir(newDir, movedTarget);
      if (spelling === ref) continue;
      const existing = rewrites.get(ref);
      if (existing) {
        existing.count++;
      } else {
        rewrites.set(ref, { from: ref, to: spelling, count: 1 });
      }
    }
    if (rewrites.size > 0) {
      fileChanges.push({ path: sheet.href, kind: 'css', rewrites: [...rewrites.values()] });
    }
  }

  return { rows, fileChanges };
}
