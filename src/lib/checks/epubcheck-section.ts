/**
 * The epubcheck section of the seed_get_checks bridge payload
 * (process/BRIDGE_CHECKS.md). Pure assembly: takes the mirrored validation
 * report and the live OPF metadata, returns the report's messages triaged and
 * chapter-attributed under an explicit freshness verdict — the tool never
 * pretends a report is fresher or more relevant than it can prove.
 */

import type { ValidationReport } from '../plugins/validation-report.js';
import { chapterIdOf } from '../plugins/validation-report.js';
import { triageEpubcheckMessage, type CheckCategory, type RemedySurface } from './triage.js';

/**
 * Freshness of the stored report relative to the open project:
 * - `none`              — no (readable) report exists in this browser profile.
 * - `different-project` — the report's dc:identifier doesn't match the open
 *                         project (or either side lacks one — legacy reports).
 * - `stale`             — identifiers match, but the project was modified
 *                         after validation; package + validate to refresh.
 * - `current`           — identifiers match and no edit postdates validation.
 */
export type EpubcheckStatus = 'none' | 'different-project' | 'stale' | 'current';

export interface TriagedValidationMessage {
  level: 'error' | 'warning' | 'info';
  id?: string;
  message: string;
  location?: { path: string; line?: number; column?: number };
  suggestion?: string;
  /** The spine chapter the finding attributes to, when the location is a content document. */
  chapterId?: string;
  category: CheckCategory;
  remedy?: RemedySurface;
}

export interface EpubcheckSection {
  status: EpubcheckStatus;
  /** report.timestamp — when the author last validated (absent for `none`). */
  validatedAt?: number;
  /** The live OPF dcterms:modified, for the agent's own judgment. */
  projectModified?: string;
  filename?: string;
  isValid?: boolean;
  errorCount?: number;
  warningCount?: number;
  messages?: TriagedValidationMessage[];
}

export function buildEpubcheckSection(
  report: ValidationReport | null,
  metadata: { identifier?: string; modifiedDate?: string } | undefined
): EpubcheckSection {
  if (!report) return { status: 'none' };

  const projectModified = metadata?.modifiedDate;
  if (!report.identifier || !metadata?.identifier || report.identifier !== metadata.identifier) {
    // Wrong (or unknowable) project — the messages would be misleading noise.
    return {
      status: 'different-project',
      validatedAt: report.timestamp,
      ...(projectModified ? { projectModified } : {}),
      filename: report.filename,
    };
  }

  const modifiedMs = Date.parse(projectModified ?? '');
  const status: EpubcheckStatus =
    Number.isFinite(modifiedMs) && report.timestamp < modifiedMs ? 'stale' : 'current';

  const messages: TriagedValidationMessage[] = report.messages.map(message => {
    const chapterId = message.location ? chapterIdOf(message.location.path) : null;
    return {
      ...message,
      ...(chapterId ? { chapterId } : {}),
      ...triageEpubcheckMessage(message.id),
    };
  });

  return {
    status,
    validatedAt: report.timestamp,
    ...(projectModified ? { projectModified } : {}),
    filename: report.filename,
    isValid: report.errorCount === 0,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    messages,
  };
}
