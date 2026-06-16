/**
 * Curated MARC Relators vocabulary for EPUB creator/contributor roles.
 *
 * The full MARC relator list has ~270 codes; this is the curated subset that is
 * relevant to books, used to populate the role picker. Codes are emitted in the
 * OPF as `<meta refines="#id" property="role" scheme="marc:relators">code</meta>`.
 *
 * @see https://www.loc.gov/marc/relators/relaterm.html
 */

export interface MarcRelator {
  code: string;
  label: string;
}

export const MARC_RELATORS: MarcRelator[] = [
  { code: 'aut', label: 'Author' },
  { code: 'edt', label: 'Editor' },
  { code: 'ill', label: 'Illustrator' },
  { code: 'trl', label: 'Translator' },
  { code: 'nrt', label: 'Narrator' },
  { code: 'ctb', label: 'Contributor' },
  { code: 'pht', label: 'Photographer' },
  { code: 'cov', label: 'Cover designer' },
  { code: 'aui', label: 'Author of introduction' },
  { code: 'aft', label: 'Author of afterword' },
  { code: 'fwd', label: 'Author of foreword' },
  { code: 'com', label: 'Compiler' },
  { code: 'cmm', label: 'Commentator' },
  { code: 'ann', label: 'Annotator' },
  { code: 'mus', label: 'Musician' },
  { code: 'bkp', label: 'Book producer' },
];

const LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  MARC_RELATORS.map(r => [r.code, r.label])
);

/** Human label for a MARC relator code, falling back to the code itself. */
export function marcLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code;
}

/** Options for a SelectMetadataField role dropdown ({ value, label }). */
export function marcSelectOptions(): { value: string; label: string }[] {
  return MARC_RELATORS.map(r => ({ value: r.code, label: r.label }));
}
