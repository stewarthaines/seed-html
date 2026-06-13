import { describe, it, expect } from 'vitest';
import { coverImageHref } from './pdf-export.js';
import type { ManifestItem } from '../epub/opf-utils.js';
import type { PrintSettings } from '../services/settings/settings.service.js';

const onPrint: PrintSettings = {
  page_size: 'A4',
  margin: 'normal',
  page_numbers: true,
  cover_page: true,
};
const offPrint: PrintSettings = { ...onPrint, cover_page: false };

const item = (over: Partial<ManifestItem>): ManifestItem => ({
  id: over.href ?? 'id',
  href: 'x',
  mediaType: 'application/octet-stream',
  ...over,
});

describe('coverImageHref', () => {
  const coverPng = item({
    href: 'Images/cover.png',
    mediaType: 'image/png',
    properties: ['cover-image'],
  });

  it('returns null when cover_page is off', () => {
    expect(coverImageHref([coverPng], offPrint)).toBeNull();
  });

  it('returns null when there is no cover-image item', () => {
    const manifest = [item({ href: 'Text/ch1.xhtml', mediaType: 'application/xhtml+xml' })];
    expect(coverImageHref(manifest, onPrint)).toBeNull();
  });

  it('prefers the SVG sibling of the cover-image item (generated cover)', () => {
    const manifest = [item({ href: 'Images/cover.svg', mediaType: 'image/svg+xml' }), coverPng];
    expect(coverImageHref(manifest, onPrint)).toBe('Images/cover.svg');
  });

  it('falls back to the cover-image item when there is no SVG sibling (imported raster)', () => {
    const manifest = [
      item({ href: 'images/mycover.jpg', mediaType: 'image/jpeg', properties: ['cover-image'] }),
    ];
    expect(coverImageHref(manifest, onPrint)).toBe('images/mycover.jpg');
  });

  it('defaults to on when print settings are undefined', () => {
    expect(coverImageHref([coverPng], undefined)).toBe('Images/cover.png');
  });
});
