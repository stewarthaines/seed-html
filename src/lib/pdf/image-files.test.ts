import { describe, it, expect } from 'vitest';
import { sniffImageFormat, largestBoxes, loadImageFiles } from './image-files.js';
import type { ImageItem, PageBox } from './page-description.js';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

const image = (index: number, width: number, height: number): ImageItem => ({
  kind: 'image',
  image: index,
  x: 0,
  y: 0,
  width,
  height,
  struct: null,
});
const page = (items: ImageItem[]): PageBox => ({ width: 400, height: 600, number: 1, items });

describe('sniffImageFormat', () => {
  it('knows JPEG and PNG from their first bytes', () => {
    expect(sniffImageFormat(JPEG)).toBe('jpeg');
    expect(sniffImageFormat(PNG)).toBe('png');
  });

  it('calls anything else other', () => {
    expect(sniffImageFormat(new TextEncoder().encode('<svg xmlns="…"/>'))).toBe('other');
    expect(sniffImageFormat(new TextEncoder().encode('RIFF....WEBP'))).toBe('other');
    expect(sniffImageFormat(new Uint8Array())).toBe('other');
  });
});

describe('largestBoxes', () => {
  it('takes the largest box each image is drawn at, across pages', () => {
    const boxes = largestBoxes({
      images: ['a.svg', 'b.png'],
      pages: [page([image(0, 100, 50), image(1, 20, 20)]), page([image(0, 80, 90)])],
    });
    expect(boxes).toEqual([
      { width: 100, height: 90 },
      { width: 20, height: 20 },
    ]);
  });
});

describe('loadImageFiles', () => {
  it('passes JPEG and PNG through unchanged, in order', async () => {
    const files: Record<string, Uint8Array> = { 'a.jpg': JPEG, 'b.png': PNG };
    const out = await loadImageFiles(
      { images: ['b.png', 'a.jpg'], pages: [] },
      async url => files[url].slice().buffer
    );
    expect(out.map(b => sniffImageFormat(new Uint8Array(b)))).toEqual(['png', 'jpeg']);
  });
});
