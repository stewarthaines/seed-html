/**
 * BCP 47 (RFC 5646) language-tag helpers for dc:language.
 *
 * The core stays lightweight: this validates tag STRUCTURE (well-formedness)
 * only — it does not check subtags against the IANA registry. That keeps every
 * language, including ISO 639-3 minority/indigenous tags and script subtags,
 * enterable as free text. Friendly names come from the browser-native
 * Intl.DisplayNames (CLDR data), at zero bundle cost.
 */

// Curated head of common languages for the combobox datalist. Free-text entry
// is always allowed, so this is a convenience shortlist, not a whitelist.
export const COMMON_LANGUAGES: string[] = [
  'en',
  'de',
  'es',
  'fr',
  'it',
  'pl',
  'pt',
  'ja',
  'zh',
  'ar',
  'he',
  'ka',
];

/**
 * Structural RFC 5646 langtag check (well-formedness, not registry validity).
 * Accepts: language(2-3) with optional extlang, script (4 alpha), region
 * (2 alpha | 3 digit), variants, extensions, and private-use; bare private-use
 * (`x-...`); and irregular grandfathered tags.
 */
export function isWellFormedLanguageTag(tag: string): boolean {
  if (!tag) return false;
  const value = tag.trim();

  // Private-use only, e.g. "x-klingon"
  const privateUse = '[xX](-[A-Za-z0-9]{1,8})+';
  if (new RegExp(`^${privateUse}$`).test(value)) return true;

  // A small set of irregular grandfathered tags still in use.
  const grandfathered =
    /^(i-(ami|bnn|default|enochian|hak|klingon|lux|mingo|navajo|pwn|tao|tay|tsu)|en-GB-oed|sgn-(BE-FR|BE-NL|CH-DE))$/i;
  if (grandfathered.test(value)) return true;

  const language = '[A-Za-z]{2,3}(-[A-Za-z]{3}){0,3}'; // language + optional extlangs
  const script = '(-[A-Za-z]{4})?';
  const region = '(-([A-Za-z]{2}|[0-9]{3}))?';
  const variant = '(-([A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*';
  const extension = '(-[A-WY-Za-wy-z0-9](-[A-Za-z0-9]{2,8})+)*';
  const privateUseSuffix = `(-${privateUse})?`;
  const langtag = `^${language}${script}${region}${variant}${extension}${privateUseSuffix}$`;

  return new RegExp(langtag).test(value);
}

/**
 * Localized display name for a language tag via Intl.DisplayNames, falling back
 * to the tag itself for valid-but-unnamed tags (e.g. many ISO 639-3 minority
 * languages have no CLDR name).
 */
export function languageDisplayName(tag: string, uiLocale: string = 'en'): string {
  const value = tag.trim();
  if (!value) return '';
  try {
    const dn = new Intl.DisplayNames([uiLocale], { type: 'language', fallback: 'code' });
    return dn.of(value) ?? value;
  } catch {
    return value;
  }
}
