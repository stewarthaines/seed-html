import { writable } from 'svelte/store';

/** The project workspace root handle, pushed by the host via `init`. */
export const dirHandle = writable<FileSystemDirectoryHandle | null>(null);

/** The same directory's OPFS path segments (init's opfsDirPath) — needed for
    the sync-access-worker write fallback where createWritable is missing. */
export const dirPath = writable<string[] | null>(null);

/** The active workspace id, from the same `init` message. */
export const projectId = writable<string | null>(null);

/** Spine item id of the chapter the editor has open (from `context`). */
export const activeChapterId = writable<string | null>(null);
