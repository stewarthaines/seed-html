/**
 * The image files behind a page description's images, in a form the PDF
 * writer embeds: JPEG and PNG as they are, anything else the browser can show
 * (WebP, GIF, AVIF, SVG) drawn to a canvas and saved as PNG.
 */
import type { PageDescription } from './page-description.js';
import { translate } from '../i18n/index.js';

/** Print resolution for images drawn from vectors (SVG). */
const VECTOR_DPI = 300;

export type ImageFormat = 'jpeg' | 'png' | 'other';

/** The format of an image file, from its first bytes. */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return 'png';
  return 'other';
}

/** The largest box, in points, each image is drawn at. */
export function largestBoxes(desc: Pick<PageDescription, 'images' | 'pages'>): {
  width: number;
  height: number;
}[] {
  const boxes = desc.images.map(() => ({ width: 0, height: 0 }));
  for (const page of desc.pages) {
    for (const item of page.items) {
      if (item.kind !== 'image') continue;
      const b = boxes[item.image];
      b.width = Math.max(b.width, item.width);
      b.height = Math.max(b.height, item.height);
    }
  }
  return boxes;
}

/**
 * One file per `desc.images` entry, in order. An image that can't be read
 * fails the whole export, as a missing font does: the PDF would be missing it.
 */
export async function loadImageFiles(
  desc: Pick<PageDescription, 'images' | 'pages'>,
  fetchFile: (url: string) => Promise<ArrayBuffer> = async url => (await fetch(url)).arrayBuffer()
): Promise<ArrayBuffer[]> {
  const boxes = largestBoxes(desc);
  return Promise.all(
    desc.images.map(async (url, i) => {
      const file = await fetchFile(url);
      const bytes = new Uint8Array(file);
      if (sniffImageFormat(bytes) !== 'other') return file;
      return toPng(url, bytes, boxes[i]);
    })
  );
}

async function toPng(
  url: string,
  bytes: Uint8Array,
  box: { width: number; height: number }
): Promise<ArrayBuffer> {
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {
    throw new Error(translate('An image in the book could not be read.'));
  });
  // A vector image has no pixels of its own: draw it at print resolution for
  // the largest box it's drawn at. A bitmap keeps its own pixels.
  const isVector = /^\s*(<\?xml|<svg|<!--)/.test(new TextDecoder().decode(bytes.subarray(0, 256)));
  const scale = VECTOR_DPI / 72;
  const width = isVector ? Math.ceil(box.width * scale) : img.naturalWidth;
  const height = isVector ? Math.ceil(box.height * scale) : img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error(translate('An image in the book could not be read.'));
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(translate('An image in the book could not be read.'));
  return blob.arrayBuffer();
}
