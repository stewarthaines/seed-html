/**
 * Emit drawn regions as :region: directive lines — the chapter-markup
 * transport the photo-regions extension renders (transformRegions.js).
 *
 *   :region:{at="3.1,12,9.4,18.2" of=james_haddow row="Back"}
 *   :region:{at="14.2,11.8,8.9,17.4" as="Mrs Ted [Edith] Haines" row="Back"}
 *
 * The lines are inserted directly under the photo's figure line — consecutive
 * :region: lines form one paragraph, and that paragraph binds to the figure
 * above it. `at` is x,y,width,height in PERCENT of the image's own box (the
 * same quantities as a W3C Media Fragments `xywh=percent:` selector), so the
 * geometry survives re-export at another size and no size record is needed.
 *
 * Rows group the caption ("Back", "Front"); within a row, entries are sorted
 * left to right by x, which is the order the generated caption reads in — and
 * therefore the order the badge numbers run in. `badge` is the number's own
 * position, written only when the author has moved it off the computed default.
 *
 * The line shape comes from the project's photo_region_template setting, with
 * omit-when-empty placeholder filling: an optional attribute whose value is
 * empty vanishes whole (`row="<row>"` with no row emits nothing, not row="").
 */

import type { Region } from './types.js';

/** A bare lowercase token is a person id; anything else is a display name. */
const ID = /^[a-z][a-z0-9_]*$/;

/** Trim trailing zeros: 14.00 → 14, 8.90 → 8.9. */
function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function at(region: Region): string {
  return `${round(region.x)},${round(region.y)},${round(region.w)},${round(region.h)}`;
}

/**
 * Fill one directive line, omitting empty optional attributes whole: for an
 * empty value, the enclosing `name=<ph>` / `name="<ph>"` token is removed
 * (with its leading whitespace); otherwise the placeholder is substituted.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    const token = `<${key}>`;
    if (value) {
      out = out.split(token).join(value);
    } else {
      out = out
        .replace(new RegExp(`\\s*[A-Za-z_][\\w-]*=("?)${token}\\1`, 'g'), '')
        .split(token)
        .join('');
    }
  }
  return out;
}

/**
 * Directive lines for the named regions: rows in the order first drawn,
 * entries left to right within a row — the numbering the reader sees.
 */
export function toDirectives(template: string, regions: Region[]): string {
  const named = regions.filter(region => region.person.trim());
  if (named.length === 0) return '';

  const rows = new Map<string, Region[]>();
  for (const region of named) {
    const row = region.row.trim() || 'Pictured';
    const group = rows.get(row);
    if (group) group.push(region);
    else rows.set(row, [region]);
  }

  const lines: string[] = [];
  for (const group of rows.values()) {
    for (const region of [...group].sort((a, b) => a.x - b.x)) {
      // An id-shaped person becomes of= (the chapter link); anything else is
      // display text. A separate "shown as" always wins as the display name.
      const person = region.person.trim();
      const shownAs = region.as?.trim() || '';
      const isId = ID.test(person);
      lines.push(
        fillTemplate(template, {
          at: at(region),
          of: isId ? person : '',
          as: shownAs || (isId ? '' : person),
          row: region.row.trim(),
          badge: region.badge ? `${round(region.badge.x)},${round(region.badge.y)}` : '',
        })
      );
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * One :detail: directive line for a single region: the crop's geometry plus
 * what the renderer needs to stand alone — the image's chapter-relative src
 * and its pixel size (so the crop knows its aspect with no library at hand).
 * alt= seeds from the region's shown-as text, or its person field when that
 * is a plain name rather than an id — and is NEVER omitted: an empty alt=""
 * stays in the inserted line as the visible slot the author must fill (the
 * DOM transform refuses to render a detail without one, and says so). to=
 * (the full image's page) vanishes when empty, fillTemplate's usual rule.
 */
export function toDetailDirective(
  template: string,
  region: Region,
  src: string,
  size: { w: number; h: number } | undefined,
): string {
  const person = region.person.trim();
  const alt = region.as?.trim() || (ID.test(person) ? '' : person);
  return (
    fillTemplate(template, {
      src,
      at: at(region),
      size: size ? `${size.w}x${size.h}` : '',
      to: '',
    })
      .split('<alt>')
      .join(alt) + '\n'
  );
}

/**
 * The chapter-relative path that reaches `targetHref` from inside
 * `fromHref`'s directory (both OPF-relative): "Images/x.jpg" seen from
 * "Text/tom.xhtml" → "../Images/x.jpg". Segment arithmetic, not the URL API,
 * so filenames needing percent-encoding compare as authored.
 */
export function relativeToChapter(targetHref: string, fromHref: string): string {
  const from = fromHref.split('/').slice(0, -1);
  const to = targetHref.split('/');
  while (from.length > 0 && to.length > 1 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  return '../'.repeat(from.length) + to.join('/');
}
