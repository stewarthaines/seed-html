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

/**
 * Resolve an href against the document that contains it, giving the path as
 * the OPF lists it: `../Images/x.jpg` inside `Text/ch.xhtml` → `Images/x.jpg`.
 * Segment arithmetic rather than the URL API, so a filename needing
 * percent-encoding compares as authored.
 */
export function resolveHref(href: string, fromHref: string): string {
  const segments = fromHref.split('/').slice(0, -1);
  for (const part of href.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  return segments.join('/');
}

/** The OPF's manifest, read once: image items plus content-document ids. */
export async function readManifest(root: FileSystemDirectoryHandle): Promise<{
  images: ImageManifestItem[];
  chapterIds: string[];
  /** Manifest href of each content document, by spine item id. */
  chapterHrefs: Record<string, string>;
  /** Workspace-relative directory the OPF sits in (hrefs resolve against it). */
  opfDir: string;
}> {
  const opfPath = await findOpfPath(root);
  const opf = parseXml(await readTextFile(root, opfPath), opfPath);
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const images: ImageManifestItem[] = [];
  const chapterIds: string[] = [];
  const chapterHrefs: Record<string, string> = {};
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
      if (id && !properties.includes('nav')) {
        chapterIds.push(id);
        chapterHrefs[id] = href;
      }
    }
  }
  images.sort((a, b) => a.href.localeCompare(b.href));
  chapterIds.sort();
  return { images, chapterIds, chapterHrefs, opfDir };
}

/**
 * Manifest hrefs of the images a chapter actually renders, read from its
 * GENERATED XHTML — the transforms decide what ends up in a chapter, so the
 * output is the only truthful source. Returns null when the chapter has not
 * been rendered yet, which the caller shows as the whole manifest rather than
 * an empty list.
 */
export async function imagesInChapter(
  root: FileSystemDirectoryHandle,
  chapterHref: string,
  opfDir: string,
): Promise<Set<string> | null> {
  const path = opfDir ? `${opfDir}/${chapterHref}` : chapterHref;
  let xhtml: string;
  try {
    xhtml = await readTextFile(root, path);
  } catch {
    return null; // not rendered yet
  }
  const doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) return null;

  const used = new Set<string>();
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src') ?? '';
    if (src) used.add(resolveHref(src, chapterHref));
  }
  return used;
}
