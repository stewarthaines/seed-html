/**
 * CSS counter styles (CSS Counter Styles 3), for the PDF to write the numbers
 * and symbols the browser draws but doesn't put in the DOM: list markers and
 * `counter()` in generated content.
 */

const ROMAN: [number, string][] = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

function roman(n: number): string | null {
  if (n < 1 || n > 3999) return null;
  let out = '';
  for (const [value, letters] of ROMAN) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}

function alphabetic(n: number, letters: string): string | null {
  if (n < 1) return null;
  const symbols = Array.from(letters);
  let out = '';
  for (; n > 0; n = Math.floor((n - 1) / symbols.length)) {
    out = symbols[(n - 1) % symbols.length] + out;
  }
  return out;
}

const SYMBOLS: Record<string, string> = { disc: '\u2022', circle: '\u25E6', square: '\u25AA' };

/**
 * A number in a counter style, without a list marker's suffix; null for a
 * style not written yet, or a number outside the style's range.
 */
export function counterText(type: string, n: number): string | null {
  if (type in SYMBOLS) return SYMBOLS[type];
  switch (type) {
    case 'none':
      return '';
    case 'decimal':
      return String(n);
    case 'decimal-leading-zero':
      return n >= 0 && n < 10 ? `0${n}` : String(n);
    case 'lower-alpha':
    case 'lower-latin':
      return alphabetic(n, 'abcdefghijklmnopqrstuvwxyz');
    case 'upper-alpha':
    case 'upper-latin':
      return alphabetic(n, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    case 'lower-greek':
      return alphabetic(n, 'αβγδεζηθικλμνξοπρστυφχψω');
    case 'lower-roman':
      return roman(n);
    case 'upper-roman':
      return roman(n)?.toUpperCase() ?? null;
    case 'arabic-indic':
      return String(n).replace(/\d/g, d => String.fromCharCode(0x0660 + Number(d)));
    default:
      return null;
  }
}

/**
 * The marker text for a `list-style-type` and an item's number, with the
 * suffix and space the browser adds; null for a style the PDF doesn't draw
 * yet, '' for `none`.
 */
export function markerText(type: string, n: number): string | null {
  const quoted = /^"(.*)"$/.exec(type);
  if (quoted) return quoted[1];
  const text = counterText(type, n);
  if (text === null || text === '') return text;
  return type in SYMBOLS ? `${text} ` : `${text}. `;
}
