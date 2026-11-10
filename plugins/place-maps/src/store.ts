import { writable } from 'svelte/store';

/** The project workspace root handle, pushed by the host via `init`. */
export const dirHandle = writable<FileSystemDirectoryHandle | null>(null);

/** The same directory's OPFS path segments — for the sync-worker write fallback. */
export const dirPath = writable<string[] | null>(null);

/** Spine item id of the chapter the editor has open (from `context`). */
export const activeChapterId = writable<string | null>(null);
