import { writable } from 'svelte/store';
import type { PluginSurface } from './types.js';

export const dirHandle = writable<FileSystemDirectoryHandle | null>(null);

/** Which surface this frame renders; the host names it in `init`. */
export const surface = writable<PluginSurface>('send');

/** The open project's dc:identifier, pushed by the host via the context message. */
export const activeIdentifier = writable<string | undefined>(undefined);

/** dc:identifiers of every book on this device, from the context message. */
export const knownIdentifiers = writable<Set<string>>(new Set());

/**
 * Validate requests from the host (the agent bridge's seed_validate), by
 * request id, waiting for the Send surface to answer them. Queued here by the
 * entry point because a request can arrive before the surface has mounted —
 * the host sends it as soon as the handshake completes — and a listener in the
 * surface itself would miss it.
 */
export const validateRequests = writable<string[]>([]);
