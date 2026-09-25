import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  dirOfPath,
  resolveRelativePath,
  manifestHrefToPath,
  relativePathFrom,
  convertXHTMLPathToManifestPath,
} from './path-utils';

describe('normalizePath', () => {
  it('collapses dot segments and never escapes the root', () => {
    expect(normalizePath('EPUB/xhtml/raw/../../css/a.css')).toBe('EPUB/css/a.css');
    expect(normalizePath('EPUB/./css//a.css')).toBe('EPUB/css/a.css');
    expect(normalizePath('../../x.js')).toBe('x.js');
    expect(normalizePath('')).toBe('');
  });
});

describe('dirOfPath', () => {
  it('gives the directory, empty at the root', () => {
    expect(dirOfPath('EPUB/xhtml/raw/ch1.xhtml')).toBe('EPUB/xhtml/raw');
    expect(dirOfPath('content.opf')).toBe('');
  });
});

describe('resolveRelativePath', () => {
  it('resolves against the directory the reference is written in', () => {
    expect(resolveRelativePath('EPUB/xhtml/raw', '../../css/a.css')).toBe('EPUB/css/a.css');
    expect(resolveRelativePath('OEBPS/Text', '../Styles/page.css')).toBe('OEBPS/Styles/page.css');
    expect(resolveRelativePath('OEBPS/Text', 'chapter2.xhtml#top')).toBe(
      'OEBPS/Text/chapter2.xhtml'
    );
    expect(resolveRelativePath('', 'a.css')).toBe('a.css');
  });

  it('treats a leading slash as the container root', () => {
    expect(resolveRelativePath('EPUB/xhtml', '/EPUB/css/a.css')).toBe('EPUB/css/a.css');
  });
});

describe('manifestHrefToPath', () => {
  it('resolves against the OPF directory, including hrefs that climb out of it', () => {
    expect(manifestHrefToPath('EPUB', 'xhtml/raw/ch1.xhtml')).toBe('EPUB/xhtml/raw/ch1.xhtml');
    expect(manifestHrefToPath('EPUB', '../_kmeta/config.js')).toBe('_kmeta/config.js');
    expect(manifestHrefToPath('', 'ch1.xhtml')).toBe('ch1.xhtml');
  });

  it('leaves an href that already carries the base alone', () => {
    expect(manifestHrefToPath('OEBPS', 'OEBPS/Text/a.xhtml')).toBe('OEBPS/Text/a.xhtml');
  });
});

describe('relativePathFrom', () => {
  it('writes a container path relative to a directory', () => {
    expect(relativePathFrom('EPUB', 'EPUB/css/a.css')).toBe('css/a.css');
    expect(relativePathFrom('EPUB', '_kmeta/x.js')).toBe('../_kmeta/x.js');
    expect(relativePathFrom('', 'a.css')).toBe('a.css');
    expect(relativePathFrom('OEBPS/Text', 'OEBPS/Styles/page.css')).toBe('../Styles/page.css');
  });

  it('round-trips the SEED layout through the old one-level shortcut', () => {
    const path = resolveRelativePath('OEBPS/Text', '../Styles/page.css');
    expect(relativePathFrom('OEBPS', path)).toBe(
      convertXHTMLPathToManifestPath('../Styles/page.css')
    );
  });
});
