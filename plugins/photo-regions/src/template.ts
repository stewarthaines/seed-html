/**
 * The project's directive templates: SOURCE/settings.json →
 * photo_region_template / photo_detail_template, the same settings the
 * built-in editor exposes (EPUB Settings), read fresh at insert time so
 * mid-session settings changes apply. Read-only here — settings writes stay
 * host-side. Each falls back to its core default.
 */

import { readTextFile } from './opf.js';

export const DEFAULT_TEMPLATE = ':region:{at="<at>" of=<of> as="<as>" row="<row>" badge="<badge>"}';
export const DEFAULT_DETAIL_TEMPLATE =
  ':detail:{src="<src>" at="<at>" size="<size>" alt="<alt>" to="<to>"}';

async function loadSetting(
  handle: FileSystemDirectoryHandle,
  key: string,
  fallback: string,
): Promise<string> {
  try {
    const settings = JSON.parse(await readTextFile(handle, 'SOURCE/settings.json'));
    const value = settings[key];
    if (typeof value === 'string' && value) return value;
  } catch {
    // No/unreadable settings.json — the default applies.
  }
  return fallback;
}

export function loadTemplate(handle: FileSystemDirectoryHandle): Promise<string> {
  return loadSetting(handle, 'photo_region_template', DEFAULT_TEMPLATE);
}

export function loadDetailTemplate(handle: FileSystemDirectoryHandle): Promise<string> {
  return loadSetting(handle, 'photo_detail_template', DEFAULT_DETAIL_TEMPLATE);
}
