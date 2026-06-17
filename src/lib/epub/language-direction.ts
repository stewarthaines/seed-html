/**
 * Right-to-left detection for EPUB content.
 *
 * The EPUB/HTML specs require the base direction to be set in *markup* (the `dir`
 * attribute) — a language declaration alone does not imply direction, and CSS is
 * not reliably honoured by reading systems. This decides whether a book's BCP-47
 * language tag is RTL so the chapter `<html>`, the package, and the spine can be
 * marked accordingly.
 *
 * It honours an explicit RTL script subtag (e.g. `az-Arab`, `pa-Aran`) and, absent
 * that, the common RTL languages by their primary subtag.
 */

const RTL_SCRIPT_SUBTAGS = new Set([
  'arab', // Arabic
  'aran', // Nastaliq (Arabic variant)
  'hebr', // Hebrew
  'thaa', // Thaana (Dhivehi)
  'syrc', // Syriac
  'nkoo', // N'Ko
  'samr', // Samaritan
  'mand', // Mandaic
  'mend', // Mende Kikakui
  'adlm', // Adlam
  'rohg', // Hanifi Rohingya
  'yezi', // Yezidi
]);

const RTL_LANGUAGE_SUBTAGS = new Set([
  'ar', // Arabic
  'fa', // Persian
  'he', // Hebrew
  'ur', // Urdu
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'yi', // Yiddish
  'dv', // Dhivehi
  'ckb', // Central Kurdish (Sorani)
]);

/**
 * Whether a BCP-47 language tag denotes a right-to-left script.
 */
export function isRtlLanguage(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const subtags = lang.toLowerCase().split(/[-_]/).filter(Boolean);
  if (subtags.length === 0) return false;
  // An explicit script subtag (a 4-letter subtag after the primary one) takes
  // precedence over the primary language's default direction.
  if (subtags.slice(1).some(t => t.length === 4 && RTL_SCRIPT_SUBTAGS.has(t))) {
    return true;
  }
  return RTL_LANGUAGE_SUBTAGS.has(subtags[0]);
}
