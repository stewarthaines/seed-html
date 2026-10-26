/**
 * Tests for the Bricks extension's sample generator: every sample it inserts
 * is a block the parser reads without notes, in both wrappers, and the
 * spaceman is offered only when the minifigs parts set is installed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

type Generator = (ctx: unknown, options: Record<string, unknown>) => string;
type Parsed = {
  header: { spin: number | null };
  sections: { kind: string; parts: { part: string }[] }[];
  notes: unknown[];
};

const jsyaml: Record<string, unknown> = {};
new Function('exports', 'module', readFileSync('extensions/bricks/js-yaml.min.js', 'utf8'))(
  jsyaml,
  {}
);
const parseBricks = new Function(
  'jsyaml',
  `${readFileSync('extensions/bricks/parseBricks.js', 'utf8')}\nreturn parseBricks;`
)(jsyaml) as (text: string) => Parsed;
const generateText = new Function(
  `${readFileSync('extensions/bricks/bricks-sample.js', 'utf8')}\nreturn generateText;`
)() as Generator;

const WITH_MINIFIGS = { manifest: [{ href: 'Misc/bricks/minifigs.mpd' }] };
const WITHOUT = { manifest: [{ href: 'Misc/bricks/core.mpd' }] };

// The block's content, without its wrapper.
function body(text: string): string {
  return text.startsWith('bc(bricks).\n')
    ? text.slice('bc(bricks).\n'.length).trimEnd()
    : text.replace(/^``` bricks\n/, '').replace(/```\n$/, '');
}

const parts = (parsed: Parsed) => parsed.sections.flatMap(s => s.parts.map(p => p.part));

describe('bricks-sample generator', () => {
  for (const format of ['markdown', 'textile']) {
    for (const page of ['step', 'turning']) {
      it(`writes a ${page} page in ${format} that parses cleanly`, () => {
        const text = generateText(WITH_MINIFIGS, { format, page, spaceman: true });
        const parsed = parseBricks(body(text));
        expect(parsed.notes).toEqual([]);
        expect(parsed.header.spin).toBe(page === 'turning' ? 90 : null);
        expect(parts(parsed)).toContain('spaceman');
      });
    }
  }

  it('fences a block for Markdown and the other fenced formats', () => {
    const text = generateText(WITHOUT, { format: 'markdown' });
    expect(text.startsWith('``` bricks\n')).toBe(true);
    expect(text.endsWith('```\n')).toBe(true);
  });

  it('keeps blank lines out of a Textile block, which would end it', () => {
    const text = generateText(WITHOUT, { format: 'textile' });
    expect(text.startsWith('bc(bricks).\n')).toBe(true);
    expect(text.trimEnd()).not.toMatch(/\n\n/);
  });

  it('builds the step page in steps from a built base', () => {
    const parsed = parseBricks(body(generateText(WITHOUT, { page: 'step' })));
    expect(parsed.sections.map(s => s.kind)).toEqual(['built', 'step', 'step']);
  });

  it('leaves the spaceman out without the minifigs set, or when unticked', () => {
    expect(parts(parseBricks(body(generateText(WITHOUT, { spaceman: true }))))).not.toContain(
      'spaceman'
    );
    expect(
      parts(parseBricks(body(generateText(WITH_MINIFIGS, { spaceman: false }))))
    ).not.toContain('spaceman');
  });
});
