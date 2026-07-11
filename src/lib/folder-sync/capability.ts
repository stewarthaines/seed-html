/**
 * Folder sync capability + picker (see process/FOLDER_SYNC.md).
 *
 * Folder sync links a project to a local directory via the File System Access
 * API and pulls its text files into chapters. `showDirectoryPicker()` is
 * Chromium-only; callers render the affordance everywhere and disable it (with
 * an explanatory tooltip) where unsupported — the device-destination pattern.
 */

export function isFolderSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Show the directory picker for a folder to link. Read-only access — v1 sync
 * is a one-way pull, so the browser prompt promises no more than we do.
 * Throws AbortError when the user cancels; must run in a user gesture.
 */
export async function pickSyncFolder(): Promise<FileSystemDirectoryHandle> {
  return (
    window as unknown as {
      showDirectoryPicker: (opts: {
        mode: string;
        id?: string;
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker({ mode: 'read', id: 'seedhtml-folder-sync' });
}
