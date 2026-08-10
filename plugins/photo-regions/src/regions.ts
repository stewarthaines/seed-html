/**
 * Emit drawn regions as the `photos:` frontmatter block the chapter's DOM
 * transform reads (SOURCE/scripts/transformDom.js → facesSetup).
 *
 *   photos:
 *     Images/014-Family-of-Thomas-and-Emma.JPG:
 *       size: 1422x1000
 *       Back:
 *         - { person: james_haddow, at: "3.1,12,9.4,18.2" }
 *         - { person: "Mrs Ted [Edith] Haines", at: "14.2,11.8,8.9,17.4" }
 *
 * The image is keyed by its MANIFEST href, not a bare filename, so images in
 * nested directories stay distinct. `at` is x,y,width,height in PERCENT of the
 * image's own box — the same quantities as a W3C Media Fragments
 * `xywh=percent:` selector, so the geometry survives re-export at another size.
 *
 * Rows group the caption ("Back", "Front"); within a row, entries are sorted
 * left to right by x, which is the order the generated caption reads in — and
 * therefore the order the badge numbers run in.
 *
 * `badge` is the number's own position, written only when the author has moved
 * it off the computed default.
 */

import type { Region } from './types.js';

/** A bare lowercase token is a person id; anything else is a name. */
const ID = /^[a-z][a-z0-9_]*$/;
/** Characters that make a plain scalar ambiguous at the start of a token. */
const INDICATOR = /^[-?:,[\]{}#&*!|>'"%@`]/;
/** Words YAML would read as something other than a string. */
const AMBIGUOUS = /^(?:true|false|null|~|yes|no|on|off)$/i;

function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * A mapping key, in BLOCK context. Quoted only when it would misparse, so a
 * generated block reads like a hand-written one: `Images/x.JPG:` and `Back:`
 * stay bare (slashes, dots and dashes are all fine mid-token).
 */
function key(value: string): string {
  const plain =
    value.length > 0 &&
    value === value.trim() &&
    !INDICATOR.test(value) &&
    !value.includes(': ') &&
    !value.includes(' #') &&
    !value.endsWith(':') &&
    !AMBIGUOUS.test(value) &&
    !/^[\d.+-]+$/.test(value);
  return plain ? value : quote(value);
}

/**
 * A scalar inside a FLOW mapping, where `, [ ] { }` are structural: only a
 * bare person id is safe unquoted, so every authored name gets quotes. An id
 * that happens to spell a YAML keyword (`true`, `null`) is quoted too — bare,
 * it would parse as a boolean and the entry would render as nothing.
 */
function flow(value: string): string {
  return ID.test(value) && !AMBIGUOUS.test(value) ? value : quote(value);
}

/** Trim trailing zeros: 14.00 → 14, 8.90 → 8.9. */
function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function at(region: Region): string {
  return `${round(region.x)},${round(region.y)},${round(region.w)},${round(region.h)}`;
}

/**
 * @param href           the image's manifest href (the block's key)
 * @param regions        drawn regions, any order
 * @param includeHeader  emit the `photos:` line; turn off when pasting a second
 *                       image under a block the chapter already has
 * @param size           the photo's pixel size, emitted as a `size: WxH` line —
 *                       what lets a crop of a region know its aspect ratio
 *                       (transformDom.js portraitsSetup). `size` is a reserved
 *                       row label for this reason.
 */
export function toYaml(
  href: string,
  regions: Region[],
  includeHeader: boolean,
  size?: { w: number; h: number }
): string {
  const named = regions.filter(region => region.person.trim());
  if (named.length === 0) return '';

  // Rows in the order first drawn; entries within a row left to right.
  const rows = new Map<string, Region[]>();
  for (const region of named) {
    const row = region.row.trim() || 'Pictured';
    const group = rows.get(row);
    if (group) group.push(region);
    else rows.set(row, [region]);
  }

  const lines: string[] = [];
  if (includeHeader) lines.push('photos:');
  lines.push(`  ${key(href)}:`);
  if (size && size.w > 0 && size.h > 0) lines.push(`    size: ${size.w}x${size.h}`);
  for (const [row, group] of rows) {
    lines.push(`    ${key(row)}:`);
    for (const region of [...group].sort((a, b) => a.x - b.x)) {
      const fields = [`person: ${flow(region.person.trim())}`];
      if (region.as && region.as.trim()) fields.push(`as: ${flow(region.as.trim())}`);
      fields.push(`at: "${at(region)}"`);
      // Only when moved off its default, so an untouched badge adds no noise.
      if (region.badge) {
        fields.push(`badge: "${round(region.badge.x)},${round(region.badge.y)}"`);
      }
      lines.push(`      - { ${fields.join(', ')} }`);
    }
  }
  return lines.join('\n') + '\n';
}
