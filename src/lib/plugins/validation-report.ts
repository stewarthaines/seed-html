/**
 * Read boundary for the latest epubcheck report that the publish plugin drops into
 * localStorage (same-origin host ↔ plugin iframe). The core spine editor mirrors this
 * read-only copy into its per-chapter reference panel.
 *
 * The plugin owns the canonical report (OPFS) and its own `ValidationReport` type; the
 * contract between the two is the JSON shape below — the same arrangement by which
 * `plugins/publish-to-remote/src/types.ts` mirrors the postMessage `contract.ts`.
 */

/** localStorage key the plugin writes and the core reads (the `editme_` convention). */
export const VALIDATION_REPORT_STORAGE_KEY = 'editme_validation_report';

export interface ValidationMessage {
  level: 'error' | 'warning' | 'info';
  /** epubcheck rule id, e.g. "RSC-007". */
  id?: string;
  message: string;
  /** Where the issue is — the referencing file and position. */
  location?: { path: string; line?: number; column?: number };
  /** epubcheck's fix suggestion, when offered. */
  suggestion?: string;
}

export interface ValidationReport {
  filename: string;
  isValid: boolean;
  timestamp: number;
  errorCount: number;
  warningCount: number;
  messages: ValidationMessage[];
}

function isValidationReport(value: unknown): value is ValidationReport {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.filename === 'string' && Array.isArray(v.messages);
}

/**
 * Read the mirrored report, or `null` when absent or malformed/legacy. Never throws —
 * a bad value just reads as "no report".
 */
export function readValidationReport(): ValidationReport | null {
  try {
    const raw = localStorage.getItem(VALIDATION_REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidationReport(parsed) ? parsed : null;
  } catch {
    // Unavailable or unparseable storage — treat as no report.
    return null;
  }
}

/**
 * The spine-item / chapter id for a content-document path — its basename without the
 * `.xhtml` extension or `#fragment`. Matches the nav preview's click-to-navigate and
 * PublishView's location link, and drops any `OEBPS/` prefix for free. Returns null
 * for non-`.xhtml` paths (OPF/CSS/NAV), which aren't chapter-attributable.
 */
export function chapterIdOf(path: string): string | null {
  const match = path.match(/([^/]+)\.xhtml(?:#.*)?$/);
  return match ? match[1] : null;
}

/** Messages whose location resolves to `chapterId`. */
export function messagesForChapter(
  report: ValidationReport | null,
  chapterId: string | null
): ValidationMessage[] {
  if (!report || !chapterId) return [];
  return report.messages.filter(
    (m) => m.location != null && chapterIdOf(m.location.path) === chapterId
  );
}

export interface ChapterIssueSummary {
  chapterId: string;
  errorCount: number;
  warningCount: number;
}

/**
 * Every content-document chapter that has at least one issue, in first-seen order,
 * with per-chapter error/warning counts. Drives the "other chapters with issues"
 * jump list and overall progress.
 */
export function chaptersWithIssues(report: ValidationReport | null): ChapterIssueSummary[] {
  if (!report) return [];
  const order: string[] = [];
  const byChapter = new Map<string, ChapterIssueSummary>();
  for (const m of report.messages) {
    // Only error/warning chapters are "to fix" — skip info so the jump list stays
    // actionable (the current chapter still shows info via messagesForChapter).
    if (m.level !== 'error' && m.level !== 'warning') continue;
    if (!m.location) continue;
    const chapterId = chapterIdOf(m.location.path);
    if (!chapterId) continue;
    let summary = byChapter.get(chapterId);
    if (!summary) {
      summary = { chapterId, errorCount: 0, warningCount: 0 };
      byChapter.set(chapterId, summary);
      order.push(chapterId);
    }
    if (m.level === 'error') summary.errorCount += 1;
    else if (m.level === 'warning') summary.warningCount += 1;
  }
  return order.map((id) => byChapter.get(id)!);
}
