/**
 * EPUB container discovery over the handed workspace-root OPFS handle. The
 * plugin navigates the EPUB-standard structure only: META-INF/container.xml
 * names the OPF, whose <manifest> lists the audio items. DOMParser +
 * querySelector throughout (no regex XML parsing).
 */

import type { AudioManifestItem } from './types.js';

/** Read a text file at a workspace-relative path like `META-INF/container.xml`. */
export async function readTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const segments = path.split('/').filter(Boolean);
  const filename = segments.pop();
  if (!filename) throw new Error(`Invalid path: ${path}`);
  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment);
  }
  const file = await (await dir.getFileHandle(filename)).getFile();
  return file.text();
}

/** Read a file's bytes at a workspace-relative path (session 2: waveform input). */
export async function readFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<File> {
  const segments = path.split('/').filter(Boolean);
  const filename = segments.pop();
  if (!filename) throw new Error(`Invalid path: ${path}`);
  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment);
  }
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

/** All `audio/*` items in the OPF manifest. */
export async function listAudioItems(
  root: FileSystemDirectoryHandle,
): Promise<AudioManifestItem[]> {
  const opfPath = await findOpfPath(root);
  const opf = parseXml(await readTextFile(root, opfPath), opfPath);
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
  const items: AudioManifestItem[] = [];
  for (const item of opf.querySelectorAll('manifest > item')) {
    const mediaType = item.getAttribute('media-type') ?? '';
    const href = item.getAttribute('href') ?? '';
    if (!mediaType.startsWith('audio/') || !href) continue;
    items.push({
      id: item.getAttribute('id') ?? href,
      href,
      storagePath: opfDir ? `${opfDir}/${href}` : href,
      mediaType,
    });
  }
  return items;
}
