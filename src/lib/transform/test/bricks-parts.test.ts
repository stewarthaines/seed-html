/**
 * Tests for the Bricks extension's parts generator: it lists the parts each
 * parts set offers as `#` comment lines, set by set and sorted by name, which
 * a bricks block reads as nothing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

type Generator = (ctx: unknown, options: Record<string, unknown>) => Promise<string>;

const jsyaml: Record<string, unknown> = {};
new Function('exports', 'module', readFileSync('extensions/bricks/js-yaml.min.js', 'utf8'))(
  jsyaml,
  {}
);
const parseBricks = new Function(
  'jsyaml',
  `${readFileSync('extensions/bricks/parseBricks.js', 'utf8')}\nreturn parseBricks;`
)(jsyaml) as (text: string) => { sections: unknown[]; notes: unknown[] };
const generateText = new Function(
  `${readFileSync('extensions/bricks/bricks-parts.js', 'utf8')}\nreturn generateText;`
)() as Generator;

const SETS: Record<string, string> = {
  'Misc/bricks/core.mpd': [
    '0 !COLOUR Black CODE 0 VALUE #1B2A34 EDGE #808080',
    '0 !COLOUR Light_Bluish_Grey CODE 71 VALUE #A0A5A9 EDGE #333333',
    '0 FILE parts/3005.dat\n0 Brick  1 x  1',
    '0 FILE parts/s/3005s01.dat\n0 ~Brick  1 x  1 without Front Stud',
    '0 FILE parts/3010.dat\n0 Brick  1 x  4',
    '0 FILE parts/3004.dat\n0 Brick  1 x  2',
    '0 FILE parts/4073.dat\n0 ~Moved to 6141',
    '0 FILE p/stud.dat\n0 Stud',
  ].join('\n'),
  'Misc/bricks/tiles.mpd': [
    '0 FILE parts/25269.dat\n0 Tile  1 x  1 Corner Round',
    '0 FILE parts/3005.dat\n0 Brick  1 x  1',
  ].join('\n'),
};
const ctx = (hrefs: string[]) => ({
  manifest: [{ href: 'Text/page.xhtml' }, ...hrefs.map(href => ({ href })), { href: 'page05.mpd' }],
  readManifestText: async (href: string) => {
    if (!(href in SETS)) throw new Error(`not declared: ${href}`);
    return SETS[href];
  },
});

describe('bricks-parts generator', () => {
  it('lists each set’s parts by name, once each, without LDraw’s ~ files', async () => {
    const text = await generateText(ctx(Object.keys(SETS)), {});
    expect(text).toBe(
      [
        '# core.mpd',
        '# 3005   Brick 1 x 1',
        '# 3004   Brick 1 x 2',
        '# 3010   Brick 1 x 4',
        '# tiles.mpd',
        '# 25269  Tile 1 x 1 Corner Round',
        '',
      ].join('\n')
    );
  });

  it('is nothing to a bricks block it is inserted into', async () => {
    const text = await generateText(ctx(Object.keys(SETS)), { colours: true });
    const { sections, notes } = parseBricks(`3005 Red 0 0 0\n${text}`);
    expect(notes).toEqual([]);
    expect(sections).toHaveLength(1);
  });

  it('adds the colour names when asked', async () => {
    const text = await generateText(ctx(['Misc/bricks/core.mpd']), { colours: true });
    expect(text.endsWith('# colours\n# Black, Light_Bluish_Grey\n')).toBe(true);
  });

  it('says when there is no set, or a set cannot be read', async () => {
    expect(await generateText(ctx([]), {})).toBe(
      '# No parts sets: nothing under Misc/bricks/ in the manifest.\n'
    );
    const text = await generateText(ctx(['Misc/bricks/missing.mpd']), {});
    expect(text).toBe('# missing.mpd: could not be read\n');
  });
});
