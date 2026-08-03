/**
 * Tests for the mermaid extension's sample generator. It runs in the transform
 * iframe as `generateText`; here we load the source and eval it the same way
 * the sandbox does (wrap → return the function), then drive it with option
 * combinations. The generator is self-contained (no ctx use), so the tests are
 * pure string assertions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('extensions/mermaid/mermaid-sample.js', 'utf8');
const generateText = new Function(`${src}\nreturn generateText;`)() as (
  ctx: unknown,
  options: unknown
) => string;

const FENCE = '```';

describe('mermaid-sample (generator)', () => {
  it('defaults to a markdown-fenced accessible flowchart', () => {
    const out = generateText(null, {});
    expect(out.startsWith(`${FENCE}mermaid\nflowchart TD\n`)).toBe(true);
    expect(out.endsWith(`\n${FENCE}\n`)).toBe(true);
    expect(out).toContain('accTitle: Publishing decision');
    expect(out).toContain('accDescr: ');
    expect(out).not.toContain('---'); // neutral theme emits no frontmatter
  });

  it('wraps in a textile bc(mermaid). block with a closing blank line', () => {
    const out = generateText(null, { format: 'textile' });
    expect(out.startsWith('bc(mermaid).\nflowchart TD\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(true);
    expect(out).not.toContain(FENCE);
  });

  it.each([
    ['flowchart', 'flowchart TD'],
    ['sequence', 'sequenceDiagram'],
    ['class', 'classDiagram'],
    ['state', 'stateDiagram-v2'],
    ['pie', 'pie'],
    ['gantt', 'gantt'],
  ])('emits the %s declaration', (diagram, decl) => {
    const out = generateText(null, { diagram });
    expect(out.startsWith(`${FENCE}mermaid\n${decl}\n`)).toBe(true);
  });

  it('places accTitle/accDescr directly after the declaration', () => {
    const lines = generateText(null, { diagram: 'pie' }).split('\n');
    expect(lines[1]).toBe('pie');
    expect(lines[2]).toContain('accTitle: ');
    expect(lines[3]).toContain('accDescr: ');
  });

  it('omits the accessibility keywords when titled is off', () => {
    const out = generateText(null, { titled: false });
    expect(out).not.toContain('accTitle');
    expect(out).not.toContain('accDescr');
  });

  it('emits a non-neutral theme as frontmatter ahead of the declaration', () => {
    const out = generateText(null, { theme: 'dark' });
    expect(
      out.startsWith(`${FENCE}mermaid\n---\nconfig:\n  theme: dark\n---\nflowchart TD\n`)
    ).toBe(true);
  });

  it('falls back to defaults on unknown option values', () => {
    const out = generateText(null, { format: 'html', diagram: 'mindmap', theme: 'sepia' });
    expect(out.startsWith(`${FENCE}mermaid\nflowchart TD\n`)).toBe(true);
    expect(out).not.toContain('---');
  });
});
