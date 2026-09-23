/** Human-readable file size: KB, switching to MB once it reaches 1024 KB (1 MB). */
export function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${kb.toFixed(0)} KB`;
}

/**
 * "2 days ago" in the host's locale (the document's `lang`, set from the
 * context message); dates older than a month print as a date.
 */
export function relativeTime(
  when: string | number | Date,
  now: number = Date.now(),
): string {
  const time = new Date(when).getTime();
  if (Number.isNaN(time)) return '';
  const locale =
    (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
  const seconds = (time - now) / 1000;
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(seconds), 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
  return new Date(time).toLocaleDateString(locale);
}
