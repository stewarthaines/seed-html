/**
 * The project's directive template: SOURCE/settings.json → audio_clip_template,
 * the same setting the built-in editor uses (exposed in EPUB Settings), read
 * fresh at insert time so mid-session settings changes apply. Read-only here —
 * settings writes stay host-side. Falls back to the core default.
 */

import { readTextFile } from './opf.js';

export const DEFAULT_TEMPLATE = ':clip[<label>]{src=<href> begin=<begin> end=<end>}';

export async function loadTemplate(handle: FileSystemDirectoryHandle): Promise<string> {
  try {
    const settings = JSON.parse(await readTextFile(handle, 'SOURCE/settings.json'));
    if (typeof settings.audio_clip_template === 'string' && settings.audio_clip_template) {
      return settings.audio_clip_template;
    }
  } catch {
    // No/unreadable settings.json — the default template applies.
  }
  return DEFAULT_TEMPLATE;
}
