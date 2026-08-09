/**
 * EPUB container discovery over the handed workspace-root OPFS handle. The
 * plugin navigates the EPUB-standard structure only: META-INF/container.xml
 * names the OPF, whose <manifest> lists the image items and the content
 * documents. DOMParser + querySelector throughout (no regex XML parsing).
 */

import type { ImageManifestItem } from './types.js';

async function resolveDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment);
  }
  return dir;
}

/** Read a text file at a workspace-relative path like `META-INF/container.xml`. */
export async function readTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const segments = path.split('/').filter(Boolean);
  const filename = segments.pop();
  if (!filename) throw new Error(`Invalid path: ${path}`);
  const dir = await resolveDir(root, segments);
  const file = await (await dir.getFileHandle(filename)).getFile();
  return file.text();
}

/** Read a file's bytes at a workspace-relative path (the image to draw on). */
export async function readFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<File> {
  const segments = path.split('/').filter(Boolean);
  const filename = segments.pop();
  if (!filename) throw new Error(`Invalid path: ${path}`);
  const dir = await resolveDir(root, segments);
  return (await dir.getFileHandle(filename)).getFile();
}

function parseXml(source: string, what: string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error(`Failed to parse ${what}`);
  }
  return doc;
}

/** The workspace-relative OPF path named by META-INF/container.xml. */
export async function findOpfPath(root: FileSystemDirectoryHandle): Promise<string> {
  const container = parseXml(
    await readTextFile(root, 'META-INF/container.xml'),
    'container.xml',
  );
  const fullPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!fullPath) throw new Error('container.xml names no rootfile');
  return fullPath;
}

/** The OPF's manifest, read once: image items plus content-document ids. */
export async function readManifest(root: FileSystemDirectoryHandle): Promise<{
  images: ImageManifestItem[];
  chapterIds: string[];
}> {
  const opfPath = await findOpfPath(root);
  const opf = parseXml(await readTextFile(root, opfPath), opfPath);
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const images: ImageManifestItem[] = [];
  const chapterIds: string[] = [];
  for (const item of opf.querySelectorAll('manifest > item')) {
    const mediaType = item.getAttribute('media-type') ?? '';
    const href = item.getAttribute('href') ?? '';
    const id = item.getAttribute('id') ?? '';
    if (!href) continue;

    if (mediaType.startsWith('image/')) {
      images.push({
        id: id || href,
        href,
        storagePath: opfDir ? `${opfDir}/${href}` : href,
        mediaType,
      });
    } else if (mediaType === 'application/xhtml+xml') {
      // The nav document is not a person chapter.
      const properties = (item.getAttribute('properties') ?? '').split(/\s+/);
      if (id && !properties.includes('nav')) chapterIds.push(id);
    }
  }
  images.sort((a, b) => a.href.localeCompare(b.href));
  chapterIds.sort();
  return { images, chapterIds };
}
