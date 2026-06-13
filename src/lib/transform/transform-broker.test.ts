import { describe, it, expect } from 'vitest';
import {
  joinBasePath,
  resolveManifestStoragePath,
  manifestMediaType,
  resolveSourceReadPath,
  resolveSourceWritePath,
} from './transform-broker.js';
import type { ManifestItem } from '../epub/opf-utils.js';

const item = (over: Partial<ManifestItem>): ManifestItem => ({
  id: over.href ?? 'id',
  href: 'x',
  mediaType: 'application/octet-stream',
  ...over,
});

const manifest: ManifestItem[] = [
  item({ href: 'Images/cover.png', mediaType: 'image/png' }),
  item({ href: 'Text/ch1.xhtml', mediaType: 'application/xhtml+xml' }),
];

describe('joinBasePath', () => {
  it('joins an OPF-relative href onto the base path', () => {
    expect(joinBasePath('OEBPS', 'Images/cover.png')).toBe('OEBPS/Images/cover.png');
  });
  it('is idempotent when already joined', () => {
    expect(joinBasePath('OEBPS', 'OEBPS/Images/cover.png')).toBe('OEBPS/Images/cover.png');
  });
  it('returns the href unchanged when there is no base path', () => {
    expect(joinBasePath('', 'Images/cover.png')).toBe('Images/cover.png');
  });
});

describe('resolveManifestStoragePath', () => {
  it('resolves a declared manifest item to its storage path', () => {
    expect(resolveManifestStoragePath(manifest, 'OEBPS', 'Images/cover.png')).toBe(
      'OEBPS/Images/cover.png'
    );
  });
  it('returns null for an href that is not a declared manifest item (read scoping)', () => {
    expect(resolveManifestStoragePath(manifest, 'OEBPS', 'Images/secret.png')).toBeNull();
    expect(resolveManifestStoragePath(manifest, 'OEBPS', '../settings.json')).toBeNull();
  });
});

describe('manifestMediaType', () => {
  it('returns the declared media type', () => {
    expect(manifestMediaType(manifest, 'Images/cover.png')).toBe('image/png');
  });
  it('falls back to octet-stream for an unknown href', () => {
    expect(manifestMediaType(manifest, 'nope')).toBe('application/octet-stream');
  });
});

describe('resolveSourceReadPath', () => {
  it('prefixes a bare path with SOURCE/', () => {
    expect(resolveSourceReadPath('data/cache.json')).toBe('SOURCE/data/cache.json');
  });
  it('accepts an explicit SOURCE/ path (e.g. settings.json)', () => {
    expect(resolveSourceReadPath('SOURCE/settings.json')).toBe('SOURCE/settings.json');
  });
  it('rejects path traversal', () => {
    expect(resolveSourceReadPath('../OEBPS/content.opf')).toBeNull();
    expect(resolveSourceReadPath('SOURCE/../secret')).toBeNull();
  });
});

describe('resolveSourceWritePath', () => {
  it('lands a bare path under SOURCE/data/', () => {
    expect(resolveSourceWritePath('cache.json')).toBe('SOURCE/data/cache.json');
  });
  it('accepts an explicit SOURCE/data/ path', () => {
    expect(resolveSourceWritePath('SOURCE/data/sub/x.json')).toBe('SOURCE/data/sub/x.json');
  });
  it('rejects writes outside SOURCE/data/ (settings, scripts, extensions)', () => {
    expect(resolveSourceWritePath('SOURCE/settings.json')).toBeNull();
    expect(resolveSourceWritePath('SOURCE/scripts/evil.js')).toBeNull();
    expect(resolveSourceWritePath('SOURCE/extensions/x/transform.js')).toBeNull();
  });
  it('rejects traversal even under the data prefix', () => {
    expect(resolveSourceWritePath('SOURCE/data/../../OEBPS/x')).toBeNull();
  });
});
