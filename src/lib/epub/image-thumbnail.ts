/**
 * Downscales an arbitrary raster (or SVG) image to a PNG thumbnail using a
 * browser canvas. Aspect ratio is preserved; the longer edge is capped at
 * maxDim. Used to write small cover thumbnails into the publish output for the
 * OPDS catalog. Must be called in a window context.
 */
export async function resizeImageToPng(
  buffer: ArrayBuffer,
  mediaType: string,
  maxDim = 256
): Promise<ArrayBuffer> {
  return resizeImage(buffer, mediaType, maxDim, 'image/png');
}

/** Shared canvas downscale; `mime`/`quality` pick the encoding. */
async function resizeImage(
  buffer: ArrayBuffer,
  mediaType: string,
  maxDim: number,
  mime: 'image/png' | 'image/jpeg',
  quality?: number
): Promise<ArrayBuffer> {
  const blob = new Blob([buffer], { type: mediaType || 'image/png' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    // Intrinsic size; SVGs without width/height fall back to maxDim so we still
    // produce a sensibly-sized raster.
    const naturalW = img.naturalWidth || maxDim;
    const naturalH = img.naturalHeight || maxDim;
    const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    if (mime === 'image/jpeg') {
      // JPEG has no alpha — flatten onto white so transparent covers don't go black.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise<ArrayBuffer>((resolve, reject) => {
      canvas.toBlob(
        b => {
          if (!b) return reject(new Error('Image conversion failed'));
          b.arrayBuffer().then(resolve, reject);
        },
        mime,
        quality
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Renders a cover image as a small JPEG data URL for the Projects-list card.
 * Data URLs are directly persistable (localStorage) and need no blob-URL
 * lifecycle in the component. Must be called in a window context.
 *
 * 256px long edge: the card displays the cover at 4×6rem (64×96 CSS px), so a
 * 2× display needs ≥192 device px — 256 keeps it crisp with margin. JPEG
 * rather than PNG so photographic covers at this size stay well under the
 * projects-cache persistence guard (MAX_THUMB_CHARS).
 */
export async function coverThumbDataUrl(
  buffer: ArrayBuffer,
  mediaType: string,
  maxDim = 256
): Promise<string> {
  const jpeg = await resizeImage(buffer, mediaType, maxDim, 'image/jpeg', 0.85);
  let binary = '';
  const bytes = new Uint8Array(jpeg);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}
