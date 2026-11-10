/**
 * Workspace access over the handed OPFS root: read text files, find the OPF
 * (META-INF/container.xml), list a directory. DOMParser for XML, as in core.
 */

async function resolveDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of segments) dir = await dir.getDirectoryHandle(segment);
  return dir;
}

/** Read a text file at a workspace-relative path; throws when missing. */
export async function readTextFile(root: FileSystemDirectoryHandle, path: string): Promise<string> {
  const segments = path.split('/').filter(Boolean);
  const filename = segments.pop();
  if (!filename) throw new Error(`Invalid path: ${path}`);
  const dir = await resolveDir(root, segments);
  return (await (await dir.getFileHandle(filename)).getFile()).text();
}

/** Does a workspace-relative file exist? */
export async function fileExists(root: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  try {
    await readTextFile(root, path);
    return true;
  } catch {
    return false;
  }
}

/** Names of the files in a workspace-relative directory; [] when it is missing. */
export async function listFiles(root: FileSystemDirectoryHandle, path: string): Promise<string[]> {
  try {
    const dir = await resolveDir(root, path.split('/').filter(Boolean));
    const names: string[] = [];
    for await (const [name, handle] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
      if (handle.kind === 'file') names.push(name);
    }
    return names.sort();
  } catch {
    return [];
  }
}

/** The directory holding the OPF (e.g. `OEBPS`), which manifest hrefs are relative to. */
export async function findOpfDir(root: FileSystemDirectoryHandle): Promise<string> {
  const source = await readTextFile(root, 'META-INF/container.xml');
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  const fullPath = doc.querySelector('rootfile')?.getAttribute('full-path');
  if (!fullPath) throw new Error('container.xml names no rootfile');
  return fullPath.split('/').slice(0, -1).join('/');
}
