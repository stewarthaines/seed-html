/**
 * The destinations store: the remotes.json in the plugin's OPFS, as a Svelte
 * store, kept in step across the three frames the host may have open at once
 * (the Send band on Share, the Published page, the Destinations section of
 * Settings) over a BroadcastChannel. A change saved in one frame reloads the
 * others; a frame that changes a destination's contents (a send, a removal,
 * a catalog write) tells the others to list it again.
 */
import { writable, get } from 'svelte/store';
import { readRemotes, writeRemotes } from './opfs.js';
import type { RemoteConfig, RemotesStore } from './types.js';

const CHANNEL_NAME = 'seedhtml-publish-to-remote';

type ChannelMessage =
  | { type: 'remotes-changed' }
  | { type: 'content-changed'; remoteId: string };

export const remotesStore = writable<RemotesStore>({
  remotes: [],
  activeRemoteId: null,
});

/** True once remotes.json has been read (before that the list is unknown, not empty). */
export const remotesLoaded = writable(false);

/** Bumped per destination when another frame changed what is on it. */
export const contentVersions = writable<Record<string, number>>({});

const channel =
  typeof BroadcastChannel === 'function'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

channel?.addEventListener('message', (event: MessageEvent<ChannelMessage>) => {
  const message = event.data;
  if (message?.type === 'remotes-changed') {
    void loadRemotes();
  } else if (message?.type === 'content-changed') {
    contentVersions.update((v) => ({
      ...v,
      [message.remoteId]: (v[message.remoteId] ?? 0) + 1,
    }));
  }
});

export async function loadRemotes(): Promise<RemotesStore> {
  const saved = await readRemotes();
  remotesStore.set(saved);
  remotesLoaded.set(true);
  return saved;
}

async function persist(next: RemotesStore): Promise<void> {
  remotesStore.set(next);
  await writeRemotes(next);
  channel?.postMessage({ type: 'remotes-changed' } satisfies ChannelMessage);
}

/** Add or replace a destination; a new one becomes the selected one. */
export async function saveRemote(
  remote: RemoteConfig,
  isNew: boolean,
): Promise<void> {
  const current = get(remotesStore);
  const remotes = isNew
    ? [...current.remotes, remote]
    : current.remotes.map((r) => (r.id === remote.id ? remote : r));
  await persist({
    remotes,
    activeRemoteId: isNew ? remote.id : current.activeRemoteId,
  });
}

/** Replace a destination's config in place without changing the selection
 *  (a refreshed token, a re-granted device). */
export async function updateRemote(remote: RemoteConfig): Promise<void> {
  const current = get(remotesStore);
  await persist({
    ...current,
    remotes: current.remotes.map((r) => (r.id === remote.id ? remote : r)),
  });
}

export async function removeRemote(id: string): Promise<void> {
  const current = get(remotesStore);
  const remotes = current.remotes.filter((r) => r.id !== id);
  await persist({
    remotes,
    activeRemoteId:
      current.activeRemoteId === id
        ? (remotes[0]?.id ?? null)
        : current.activeRemoteId,
  });
}

/** Remember which destination the Published page shows. */
export async function selectRemote(id: string): Promise<void> {
  const current = get(remotesStore);
  if (current.activeRemoteId === id) return;
  await persist({ ...current, activeRemoteId: id });
}

/** Tell the other frames that what is on this destination changed. */
export function announceContentChanged(remoteId: string): void {
  channel?.postMessage({
    type: 'content-changed',
    remoteId,
  } satisfies ChannelMessage);
}
