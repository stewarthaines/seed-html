import { writable } from 'svelte/store';
import type { PluginSurface } from './types.js';

export const dirHandle = writable<FileSystemDirectoryHandle | null>(null);

/** Which surface this frame renders; the host names it in `init`. */
export const surface = writable<PluginSurface>('send');

/** The open project's dc:identifier, pushed by the host via the context message. */
export const activeIdentifier = writable<string | undefined>(undefined);

/** dc:identifiers of every book on this device, from the context message. */
export const knownIdentifiers = writable<Set<string>>(new Set());
