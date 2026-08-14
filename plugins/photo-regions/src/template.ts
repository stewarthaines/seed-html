/**
 * The project's directive template: SOURCE/settings.json → photo_region_template,
 * the same setting the built-in editor exposes (EPUB Settings), read fresh at
 * insert time so mid-session settings changes apply. Read-only here — settings
 * writes stay host-side. Falls back to the core default.
 */

import { readTextFile } from './opf.js';

export const DEFAULT_TEMPLATE = ':region:{at="<at>" of=<of> as="<as>" row="<row>" badge="<badge>"}';

export async function loadTemplate(handle: FileSystemDirectoryHandle): Promise<string> {
  try {
    const settings = JSON.parse(await readTextFile(handle, 'SOURCE/settings.json'));
    if (typeof settings.photo_region_template === 'string' && settings.photo_region_template) {
      return settings.photo_region_template;
    }
  } catch {
    // No/unreadable settings.json — the default template applies.
  }
  return DEFAULT_TEMPLATE;
}
