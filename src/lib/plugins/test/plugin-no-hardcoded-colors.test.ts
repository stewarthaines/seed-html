import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Guards the plugins' dark mode against regressions.
 *
 * A plugin renders correctly in dark only because every colour routes through
 * the design tokens in its src/styles.css (which carries a [data-theme='dark']
 * block). A raw hex or named colour hardcoded into a component would silently
 * render light-in-dark — exactly the bug the token sweep fixed. This fails the
 * build if anyone reintroduces one. Tokens live in styles.css (the one allowed
 * home for literal colours, excluded here); everything else must use var(--…).
 *
 * A var() FALLBACK counts as hardcoded: `var(--nope, #518bb5)` renders the hex
 * in both themes when the token doesn't exist, which is how photo-regions
 * shipped a fixed blue before its accent tokens were added.
 *
 * audio-clip-editor is deliberately not listed: its literal colours are
 * wavesurfer canvas options in JS, not CSS. They have the same theme problem,
 * but fixing that means feeding the library themed values, not a lint rule.
 */
const PLUGINS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../plugins');
const GUARDED = ['publish-to-remote', 'photo-regions'];

// A hex colour literal (#rgb … #rrggbbaa) or a named colour used as a CSS value.
// rgba()/rgb() lines (shadows, overlays) are theme-agnostic and allowed.
const COLOR = /#[0-9a-fA-F]{3,8}\b|:\s*(?:white|black)\b/;

/** Every .svelte under a plugin's src/, one level of subdirectory included. */
function styledFiles(pluginSrc: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(pluginSrc, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.svelte')) files.push(entry.name);
    else if (entry.isDirectory()) {
      for (const name of readdirSync(join(pluginSrc, entry.name))) {
        if (name.endsWith('.svelte')) files.push(join(entry.name, name));
      }
    }
  }
  return files;
}

describe.each(GUARDED)('%s uses design tokens, not hardcoded colours', plugin => {
  const pluginSrc = join(PLUGINS_DIR, plugin, 'src');
  for (const rel of styledFiles(pluginSrc)) {
    it(`${rel} has no hardcoded colours (use a var(--token) from styles.css)`, () => {
      const offenders = readFileSync(join(pluginSrc, rel), 'utf8')
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
