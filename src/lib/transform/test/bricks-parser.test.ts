/**
 * Tests for the Bricks extension's block parser: the YAML header, part lines,
 * built/step/model sections and the notes for anything malformed
 * (process/BRICKS_BLOCK_NOTATION.md). The parser and the js-yaml build are
 * loaded from the extension sources, as the transform frame loads them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

type Part = {
  part: string;
  color: string | null;
  at: number[];
  turn: number;
  from: number[] | null;
  line: number;
};
type Section = {
  kind: 'built' | 'step' | 'model';
  line: number;
  number?: number;
  name?: string | null;
  color?: string | null;
  parts: Part[];
};
type Parsed = {
  header: {
    spin: number | null;
    scale: number;
    model: string | null;
    color: string | null;
    from: number[] | null;
    alt: string | null;
    style: string | null;
  };
  sections: Section[];
  notes: { line: number; message: string }[];
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

const JOSH_O = `---
model: letter-o
color: Yellow
from: [0, 0, 9]
---
built
3032 Green 0 -8 -1 turn 90

step   # the rounded bottom corners
3665a 0 -5 0
3665a 0 -7 0 turn 180

step   # the sides
3005 0 -4 3
3005 0 -7 3
`;

describe('parseBricks', () => {
  it('reads the josh_o build page', () => {
    const { header, sections, notes } = parseBricks(JOSH_O);
    expect(notes).toEqual([]);
    expect(header).toEqual({
      spin: null,
      scale: 1,
      model: 'letter-o',
      color: 'Yellow',
      from: [0, 0, 9],
      alt: null,
      style: null,
    });
    expect(sections.map(s => [s.kind, s.number])).toEqual([
      ['built', undefined],
      ['step', 1],
      ['step', 2],
    ]);
    expect(sections[0].parts).toEqual([
      { part: '3032', color: 'Green', at: [0, -8, -1], turn: 90, from: null, line: 7 },
    ]);
    expect(sections[1].parts[1]).toEqual({
      part: '3665a',
      color: null,
      at: [0, -7, 0],
      turn: 180,
      from: [0, 0, 9],
      line: 11,
    });
  });

  it('puts parts before any section line in a first step, without a header', () => {
    const { header, sections, notes } = parseBricks('3005 Red 0 0 0\n3005 Red 1 0 0\n');
    expect(notes).toEqual([]);
    expect(header.model).toBeNull();
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ kind: 'step', number: 1, line: 1 });
    expect(sections[0].parts.map(p => p.at)).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
  });

  it('numbers steps from a step line and counts on', () => {
    const { sections } = parseBricks('step 3\n3005 0 0 0\nstep\n3005 0 0 1\n');
    expect(sections.map(s => s.number)).toEqual([3, 4]);
  });

  it('resolves from: the part, then its step, then the header; built parts never move', () => {
    const { sections } = parseBricks(
      [
        '---',
        'from: [0, 0, 9]',
        '---',
        'built',
        '3032 0 0 0',
        'step from 0 0 -9',
        '3005 0 0 1',
        '3005 0 0 2 from 2 0 0',
        '3005 0 0 3 from 0 0 0',
        'step',
        '3005 0 0 4',
      ].join('\n')
    );
    expect(sections.flatMap(s => s.parts.map(p => p.from))).toEqual([
      null,
      [0, 0, -9],
      [2, 0, 0],
      null,
      [0, 0, 9],
    ]);
  });

  it('drops a step from 9 plates above when nothing gives a from', () => {
    const { sections } = parseBricks(
      'built\n3032 0 0 0\nstep\n3005 0 0 1\n3005 0 0 2 from 0 0 0\n'
    );
    expect(sections.flatMap(s => s.parts.map(p => p.from))).toEqual([null, [0, 0, 9], null]);
  });

  it('gives a turning page no default from', () => {
    const { sections } = parseBricks('---\nspin: true\n---\nstep 5\n3005 0 0 0\n');
    expect(sections[0].parts[0].from).toBeNull();
  });

  it('accepts decimals, negatives and modifiers in either order', () => {
    const { sections, notes } = parseBricks('3024 Blue -0.5 .5 1.25 from 0 0 3 turn -90\n');
    expect(notes).toEqual([]);
    expect(sections[0].parts[0]).toMatchObject({
      color: 'Blue',
      at: [-0.5, 0.5, 1.25],
      turn: -90,
      from: [0, 0, 3],
    });
  });

  it('reads model sections on a display page', () => {
    const { header, sections, notes } = parseBricks(
      '---\nspin: true\n---\nmodel letter-a\n3005 0 0 0\nmodel letter-b Yellow\n3005 2 0 0\n'
    );
    expect(notes).toEqual([]);
    expect(header.spin).toBe(90);
    expect(sections.map(s => [s.kind, s.name, s.color])).toEqual([
      ['model', 'letter-a', null],
      ['model', 'letter-b', 'Yellow'],
    ]);
  });

  it('reads spin as degrees, scale and alt', () => {
    const { header, notes } = parseBricks(
      '---\nspin: 180\nscale: 0.5\nalt: A red chair.\n---\n3005 0 0 0\n'
    );
    expect(notes).toEqual([]);
    expect(header).toMatchObject({ spin: 180, scale: 0.5, alt: 'A red chair.' });
  });

  it('reads style, and notes a style it does not know', () => {
    expect(parseBricks('---\nstyle: Classic\n---\n3005 0 0 0\n').header.style).toBe('classic');
    const { header, notes } = parseBricks('---\nstyle: modern\n---\n3005 0 0 0\n');
    expect(header.style).toBeNull();
    expect(notes).toEqual([{ line: 2, message: 'style is one of classic' }]);
  });

  it('notes malformed part lines by line number and keeps the rest', () => {
    const { sections, notes } = parseBricks(
      [
        '3005 0 0 0',
        '3005 Red 0 0',
        '0 0 0',
        '3005 0 0 0 turn',
        '3005 0 0 0 from 1 2',
        '3005 0 0 0 turn 90 turn 90',
        '3005 0 0 0 spin 90',
        '3005 0 0 1',
      ].join('\n')
    );
    expect(sections[0].parts.map(p => p.line)).toEqual([1, 8]);
    expect(notes.map(n => n.line)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(notes[2].message).toMatch(/turn takes a number/);
    expect(notes[3].message).toMatch(/from takes three numbers/);
    expect(notes[4].message).toMatch(/turn given twice/);
  });

  it('notes bad section lines', () => {
    const { sections, notes } = parseBricks(
      [
        'built red',
        '3032 0 0 0',
        'step from 1',
        '3005 0 0 1',
        'model',
        '3005 0 0 2',
        'model step',
        '3005 0 0 3',
        'model letter-x 4',
        '3005 0 0 4',
        'model letter-y Red extra',
        '3005 0 0 5',
        'step',
      ].join('\n')
    );
    expect(notes.map(n => n.line)).toEqual([1, 3, 5, 7, 9, 11, 13]);
    expect(notes[6].message).toMatch(/step has no parts/);
    expect(sections.filter(s => s.kind === 'model').map(s => [s.name, s.color])).toEqual([
      [null, null],
      [null, null],
      ['letter-x', null],
      [null, null],
    ]);
  });

  it('notes header problems and keeps the defaults', () => {
    const { header, notes } = parseBricks(
      [
        '---',
        'colour: Red',
        'scale: 0',
        'spin: fast',
        'from: 0 0 9',
        'model: step',
        'size: 2',
        '---',
        '3005 0 0 0',
      ].join('\n')
    );
    expect(header).toMatchObject({ scale: 1, spin: null, from: null, model: null, color: null });
    expect(notes).toEqual([
      { line: 2, message: 'unknown key colour; did you mean color?' },
      { line: 3, message: 'scale is a number above 0' },
      { line: 4, message: 'spin is true or a number of degrees' },
      { line: 5, message: 'from is three numbers, as [x, y, z]' },
      { line: 6, message: 'model is a name with no spaces, other than built, step or model' },
      { line: 7, message: 'unknown key size' },
    ]);
  });

  it('notes YAML errors and an unclosed header', () => {
    expect(parseBricks('---\ncolor: [Red\n---\n3005 0 0 0\n').notes[0].message).toMatch(
      /not valid YAML/
    );
    const unclosed = parseBricks('\n---\ncolor: Red\n3005 0 0 0\n');
    expect(unclosed.notes).toEqual([{ line: 2, message: 'the header has no closing ---' }]);
    expect(unclosed.sections).toEqual([]);
  });

  it('notes an empty block', () => {
    expect(parseBricks('# nothing yet\n').notes).toEqual([
      { line: 1, message: 'the block has no parts' },
    ]);
  });
});
