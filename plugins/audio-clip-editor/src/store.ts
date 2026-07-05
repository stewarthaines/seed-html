import { writable } from 'svelte/store';

/** The project workspace root handle, pushed by the host via `init`. */
export const dirHandle = writable<FileSystemDirectoryHandle | null>(null);

/** The active workspace id, from the same `init` message. */
export const projectId = writable<string | null>(null);
