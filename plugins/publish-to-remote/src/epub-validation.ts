import { EpubCheck } from '@likecoin/epubcheck-ts';

export interface ValidationReport {
  filename: string;
  isValid: boolean;
  timestamp: number;
  errorCount: number;
  warningCount: number;
  messages: Array<{
    level: 'error' | 'warning' | 'info';
    /** epubcheck rule id, e.g. "RSC-007". */
    id?: string;
    message: string;
    /** Where the issue is — the referencing file and position. */
    location?: { path: string; line?: number; column?: number };
    /** epubcheck's fix suggestion, when offered. */
    suggestion?: string;
  }>;
}

// epubcheck severities: fatal | error | warning | info | usage. Fold to the three
// the report renders so fatals count as errors and usage notes read as info.
function toLevel(severity: string): 'error' | 'warning' | 'info' {
  if (severity === 'fatal' || severity === 'error') return 'error';
  if (severity === 'warning') return 'warning';
  return 'info';
}

export async function validateEpub(file: File): Promise<ValidationReport> {
  const buffer = await file.arrayBuffer();

  try {
    const result = await EpubCheck.validate(new Uint8Array(buffer));

    const messages: ValidationReport['messages'] = (result.messages ?? []).map(
      (msg) => ({
        level: toLevel(msg.severity),
        id: msg.id || undefined,
        message: msg.message,
        // The path lives at msg.location.path (not msg.path) — this is what was missing.
        location: msg.location
          ? {
              path: msg.location.path,
              line: msg.location.line,
              column: msg.location.column,
            }
          : undefined,
        suggestion: msg.suggestion || undefined,
      }),
    );

    return {
      filename: file.name,
      isValid: result.valid,
      timestamp: Date.now(),
      // Use epubcheck's own counts so fatal errors are included.
      errorCount: result.fatalCount + result.errorCount,
      warningCount: result.warningCount,
      messages,
    };
  } catch (error) {
    return {
      filename: file.name,
      isValid: false,
      timestamp: Date.now(),
      errorCount: 1,
      warningCount: 0,
      messages: [
        {
          level: 'error',
          message: `Validation failed: ${String(error)}`,
        },
      ],
    };
  }
}

/**
 * Shared localStorage key the core reads to mirror the latest report into the
 * spine editor (same-origin host ↔ plugin). Mirrors the `editme_` convention used
 * by the core's navigation/layout stores.
 */
const LATEST_REPORT_KEY = 'editme_validation_report';

/**
 * Drop the latest report where the same-origin host can read it (the spine
 * editor's per-chapter reference panel). Best-effort: a quota/serialize failure
 * must not break validation.
 */
export function publishLatestReport(report: ValidationReport): void {
  try {
    localStorage.setItem(LATEST_REPORT_KEY, JSON.stringify(report));
  } catch {
    // Non-fatal: the report still lives in OPFS; the editor panel just won't update.
  }
}

/**
 * Remove the mirrored report, but only when it's the one for `filename` — so
 * deleting an epub the panel is referencing clears it without clobbering a newer
 * report for a different file.
 */
export function clearLatestReport(filename: string): void {
  try {
    const raw = localStorage.getItem(LATEST_REPORT_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as Partial<ValidationReport>;
    if (stored.filename === filename)
      localStorage.removeItem(LATEST_REPORT_KEY);
  } catch {
    // Malformed/absent mirror — nothing to clear.
  }
}

export async function saveValidationReport(
  report: ValidationReport,
): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const validationDir = await root.getDirectoryHandle('validations', {
    create: true,
  });

  // Sanitize filename for storage
  const reportName = `${report.filename}.json`;
  const fileHandle = await validationDir.getFileHandle(reportName, {
    create: true,
  });

  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(report, null, 2));
  await writable.close();
}

export async function loadValidationReport(
  filename: string,
): Promise<ValidationReport | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const validationDir = await root.getDirectoryHandle('validations');
    const reportName = `${filename}.json`;
    const fileHandle = await validationDir.getFileHandle(reportName);
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
}

export async function deleteValidationReport(filename: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const validationDir = await root.getDirectoryHandle('validations');
    await validationDir.removeEntry(`${filename}.json`);
  } catch (error) {
    // Idempotent: no report (or no validations dir) is fine.
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return;
    }
    throw error;
  }
}
