/**
 * Reads and writes inside the workspace folder the host handed over: the
 * places lists family-history writes, the register this plugin keeps, the
 * map files, and the insert template from settings.
 */
import { readTextFile, listFiles, fileExists } from './opf.js';
import { writeOpfsFile } from './opfs-write.js';
import {
  DEFAULT_TEMPLATE,
  PLACES_DIR,
  REGISTER_PATH,
  parseRegister,
  serializeRegister,
  withoutMissing,
  registerHrefs,
  type Register,
} from './register.js';

type Lists = Record<string, Array<{ text?: unknown; label?: unknown }>>;

async function readJson(root: FileSystemDirectoryHandle, path: string): Promise<unknown> {
  try {
    return JSON.parse(await readTextFile(root, path));
  } catch {
    return null;
  }
}

/** The places list of one chapter, or of every chapter that has one. */
export async function readPlaceLists(root: FileSystemDirectoryHandle, chapterId: string | null): Promise<Lists> {
  const lists: Lists = {};
  const ids = chapterId
    ? [chapterId]
    : (await listFiles(root, PLACES_DIR)).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5));
  for (const id of ids) {
    const list = await readJson(root, `${PLACES_DIR}/${id}.json`);
    if (Array.isArray(list)) lists[id] = list;
  }
  return lists;
}

/**
 * The register, without entries whose map file has gone (removed in the
 * Files view); the pruned register is written back when anything dropped.
 */
export async function readRegister(
  root: FileSystemDirectoryHandle,
  path: string[] | null,
  opfDir: string,
): Promise<Register> {
  let stored: string | null = null;
  try {
    stored = await readTextFile(root, REGISTER_PATH);
  } catch {
    stored = null;
  }
  const register = parseRegister(stored);
  const present = new Set<string>();
  for (const href of registerHrefs(register)) {
    if (await fileExists(root, `${opfDir}/${href}`)) present.add(href);
  }
  const pruned = withoutMissing(register, href => present.has(href));
  if (stored !== null && Object.keys(pruned.places).length !== Object.keys(register.places).length) {
    await writeRegister(root, path, pruned);
  }
  return pruned;
}

export async function writeRegister(
  root: FileSystemDirectoryHandle,
  path: string[] | null,
  register: Register,
): Promise<void> {
  await writeWorkspaceFile(root, path, REGISTER_PATH, serializeRegister(register));
}

/** Write a workspace-relative file: by OPFS path where known (Safari's worker fallback), else by handle. */
export async function writeWorkspaceFile(
  root: FileSystemDirectoryHandle,
  path: string[] | null,
  relative: string,
  text: string,
): Promise<void> {
  const segments = relative.split('/').filter(Boolean);
  if (path) {
    await writeOpfsFile([...path, ...segments], text);
    return;
  }
  let dir = root;
  for (const segment of segments.slice(0, -1)) dir = await dir.getDirectoryHandle(segment, { create: true });
  const file = await dir.getFileHandle(segments[segments.length - 1], { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();
}

/** SOURCE/settings.json → place_map_template, read fresh at insert time. */
export async function readTemplate(root: FileSystemDirectoryHandle): Promise<string> {
  const settings = (await readJson(root, 'SOURCE/settings.json')) as Record<string, unknown> | null;
  const value = settings?.place_map_template;
  return typeof value === 'string' && value ? value : DEFAULT_TEMPLATE;
}
