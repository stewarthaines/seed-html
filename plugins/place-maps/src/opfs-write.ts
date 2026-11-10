/**
 * OPFS file writing that works on every engine.
 *
 * `createWritable` is missing from Safari's main thread before 18.2; the
 * write path Safari does support is a sync access handle inside a dedicated
 * worker (the same reason the host app has its opfs-worker). Feature-detect
 * per call: direct stream where available, otherwise a one-shot inline worker
 * walks `pathFromRoot` and writes with a sync access handle.
 *
 * OPFS-only: sync access handles exist only for origin-private files, so
 * writes to user-picked directory handles (device upload) must keep plain
 * `createWritable` and stay gated to engines that have it.
 */

const WORKER_SOURCE = `
self.onmessage = async (event) => {
  const { path, buffer } = event.data;
  try {
    let dir = await navigator.storage.getDirectory();
    for (let i = 0; i < path.length - 1; i++) {
      dir = await dir.getDirectoryHandle(path[i], { create: true });
    }
    const fileHandle = await dir.getFileHandle(path[path.length - 1], { create: true });
    const access = await fileHandle.createSyncAccessHandle();
    try {
      access.truncate(0);
      access.write(new Uint8Array(buffer));
      access.flush();
    } finally {
      access.close();
    }
    self.postMessage({ ok: true });
  } catch (error) {
    self.postMessage({ ok: false, error: String((error && error.message) || error) });
  }
};
`;

async function toArrayBuffer(data: string | Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data).buffer as ArrayBuffer;
  }
  if (data instanceof Blob) {
    return data.arrayBuffer();
  }
  return data;
}

function writeViaSyncWorker(pathFromRoot: string[], buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'application/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    const finish = (settle: () => void) => {
      worker.terminate();
      settle();
    };
    worker.onmessage = (event) =>
      finish(() =>
        event.data?.ok
          ? resolve()
          : reject(new Error(event.data?.error || 'OPFS worker write failed')),
      );
    worker.onerror = (event) =>
      finish(() => reject(new Error(event.message || 'OPFS worker failed')));
    worker.postMessage({ path: pathFromRoot, buffer }, [buffer]);
  });
}

/**
 * Write `data` to the file at `pathFromRoot` (segments from the OPFS root),
 * creating directories along the way.
 */
export async function writeOpfsFile(
  pathFromRoot: string[],
  data: string | Blob | ArrayBuffer,
): Promise<void> {
  let dir = await navigator.storage.getDirectory();
  for (let i = 0; i < pathFromRoot.length - 1; i++) {
    dir = await dir.getDirectoryHandle(pathFromRoot[i], { create: true });
  }
  const fileHandle = await dir.getFileHandle(pathFromRoot[pathFromRoot.length - 1], {
    create: true,
  });
  if (typeof fileHandle.createWritable === 'function') {
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return;
  }
  await writeViaSyncWorker(pathFromRoot, await toArrayBuffer(data));
}
