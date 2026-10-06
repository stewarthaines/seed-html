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

/**
 * A manifest href as a chapter sees it: chapters live in `Text/`, so
 * `Audio/a.mp3` becomes `../Audio/a.mp3` — the same convention as every other
 * resource reference in source markup. Mirrors the core
 * `convertManifestPathToXHTMLPath`; relative, absolute and special-scheme
 * hrefs pass through.
 */
export function chapterRelativeHref(href: string): string {
  if (/^(\.\.?\/|\/|https?:|data:|blob:)/.test(href)) return href;
  return `../${href}`;
}

export interface ClipDirectiveData {
  /** The audio file's manifest (OPF-relative) href. */
  href: string;
  begin: number;
  end: number;
  label: string;
  /** Unset (or 1) emits no rate attribute at all. */
  rate?: number;
}

/**
 * Substitute the template's placeholders. `<href>` (and its `<src>` alias),
 * `<begin>`, `<end>` are required by the settings validation; `<label>` clears
 * to empty when unset. Rate mirrors the core semantics: with a rate set (≠ 1),
 * a `<rate>` placeholder is filled in place, and a template without one gets a
 * `rate=` attribute injected before the closing brace — quoted when the
 * template's own values are quoted (djot rejects bare values containing '.').
 * With no rate, any `<rate>` attribute is stripped whole.
 */
export function formatDirective(template: string, data: ClipDirectiveData): string {
  let result = template
    .replace(/<href>|<src>/g, chapterRelativeHref(data.href))
    .replace(/<begin>/g, formatTimeString(data.begin))
    .replace(/<end>/g, formatTimeString(data.end))
    .replace(/<label>/g, data.label.trim());

  const rate =
    data.rate !== undefined && data.rate > 0 && data.rate !== 1
      ? Number(data.rate.toFixed(2)).toString()
      : null;

  if (!rate) {
    return result.replace(/\s+(?:rate|speed)="?<rate>"?/g, '').replace(/<rate>/g, '');
  }
  if (result.includes('<rate>')) {
    return result.replace(/<rate>/g, rate);
  }
  const close = result.lastIndexOf('}');
  if (close === -1) return result;
  const attr = template.includes('="') ? ` rate="${rate}"` : ` rate=${rate}`;
  return result.slice(0, close) + attr + result.slice(close);
}
