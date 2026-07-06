/**
 * Extraction marker for translatable string literals.
 *
 * `_('…')` is recognized by build-scripts/i18n-extract.js, so wrap a literal in it
 * when the string is defined away from a `t()`/`translate()` call site (e.g. a
 * msgid table). At runtime it is the identity function — translation still happens
 * wherever the string is passed to `t()`/`translate()`.
 */
export function _(msgid: string): string {
  return msgid;
}
