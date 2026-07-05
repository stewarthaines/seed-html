/**
 * Directive formatting. Mirrors the core `formatClipDirective` /
 * `formatTimeString` semantics (src/lib/audio/audio-clip.service.ts) by hand —
 * the plugin builds separately and can't import core modules.
 */

/** Seconds → 'h:mm:ss.cc' (centisecond precision), e.g. 5 → '0:00:05.00'. */
export function formatTimeString(seconds: number): string {
  const totalCentiseconds = Math.max(0, Math.round(seconds * 100));
  const cs = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

export interface ClipDirectiveData {
  href: string;
  begin: number;
  end: number;
  label: string;
}

/**
 * Substitute the template's placeholders. `<href>` (and its `<src>` alias),
 * `<begin>`, `<end>` are required by the settings validation; `<label>` clears
 * to empty when unset; a `<rate>` placeholder (no rate UI here) is stripped
 * together with its attribute.
 */
export function formatDirective(template: string, data: ClipDirectiveData): string {
  return template
    .replace(/<href>|<src>/g, data.href)
    .replace(/<begin>/g, formatTimeString(data.begin))
    .replace(/<end>/g, formatTimeString(data.end))
    .replace(/<label>/g, data.label.trim())
    .replace(/\s+(?:rate|speed)="?<rate>"?/g, '')
    .replace(/<rate>/g, '');
}
