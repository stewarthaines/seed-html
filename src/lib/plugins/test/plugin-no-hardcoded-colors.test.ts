import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Guards the publish-to-remote plugin's dark mode against regressions.
 *
 * The plugin renders correctly in dark only because every colour routes through
 * the design tokens in its src/styles.css (which carries a [data-theme='dark']
 * block). A raw hex or named colour hardcoded into a component would silently
 * render light-in-dark — exactly the bug the token sweep fixed. This fails the
 * build if anyone reintroduces one. Tokens live in styles.css (the one allowed
 * home for literal colours, excluded here); everything else must use var(--…).
 */
const PLUGIN_SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../plugins/publish-to-remote/src'
);

// A hex colour literal (#rgb … #rrggbbaa) or a named colour used as a CSS value.
// rgba()/rgb() lines (shadows, overlays) are theme-agnostic and allowed.
const COLOR = /#[0-9a-fA-F]{3,8}\b|:\s*(?:white|black)\b/;

function styledFiles(): string[] {
  const files = ['App.svelte'];
  for (const name of readdirSync(join(PLUGIN_SRC, 'components'))) {
    if (name.endsWith('.svelte')) files.push(join('components', name));
  }
  return files;
}

describe('publish plugin uses design tokens, not hardcoded colours', () => {
  for (const rel of styledFiles()) {
    it(`${rel} has no hardcoded colours (use a var(--token) from styles.css)`, () => {
      const offenders = readFileSync(join(PLUGIN_SRC, rel), 'utf8')
        // Blank CSS block comments (preserving newlines for line numbers) so a hex
        // mentioned in an explanatory comment isn't flagged as a hardcoded value.
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => COLOR.test(line) && !/rgba?\(/.test(line))
        .map(({ line, n }) => `${rel}:${n}  ${line.trim()}`);
      expect(offenders, `Hardcoded colour(s) found:\n${offenders.join('\n')}`).toEqual([]);
    });
  }
});
