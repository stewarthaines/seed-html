/**
 * Derive a patchset by diffing the base snapshot (`SOURCE/main/`) against the
 * current content. Only files that were edited have a base (copy-on-first-change),
 * so iterating the base directory yields exactly the changed-file candidates.
 */

import { FileStorageAPI } from '../storage/index.js';
import { randomUUID } from '../utils/uuid.js';
import { resolveManifestPath } from '../blob-url/utils.js';
import type { WorkspaceState } from '../services/workspace/workspace.service.js';
import { BASE_PREFIX } from './base-snapshot.js';
import type { ChangeItem, Patchset } from './types.js';

async function readText(
  storage: FileStorageAPI,
  workspaceId: string,
  path: string
): Promise<string | null> {
  try {
    return await storage.readTextFile(workspaceId, path);
  } catch {
    return null;
  }
}

/** `SOURCE/text/{id}.txt` → `{id}`, otherwise null. */
function chapterIdFromTextPath(path: string): string | null {
  const match = path.match(/^SOURCE\/text\/(.+)\.txt$/);
  return match ? match[1] : null;
}

function mediaTypeForPath(workspace: WorkspaceState, path: string): string {
  const item = workspace.opf.manifest.find(
    m => resolveManifestPath(m.href, workspace.pathInfo.basePath) === path
  );
  if (item) return item.mediaType;
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  return 'text/plain';
}

/** Build (but do not persist) a patchset of content changes vs the base snapshot. */
export async function generatePatchset(
  workspace: WorkspaceState,
  storage: FileStorageAPI = FileStorageAPI.getInstance()
): Promise<Patchset> {
  const baseFiles = (await storage.listFiles(workspace.id, 'SOURCE/main')).filter(p =>
    p.startsWith(BASE_PREFIX)
  );

  const changes: ChangeItem[] = [];
  for (const basePath of baseFiles) {
    const original = basePath.slice(BASE_PREFIX.length);
    const baseText = await readText(storage, workspace.id, basePath);
    const currentText = await readText(storage, workspace.id, original);
    if (baseText === null || currentText === null) continue; // unreadable / removed
    if (baseText === currentText) continue; // unchanged

    const chapterId = chapterIdFromTextPath(original);
    if (chapterId) {
      changes.push({
        kind: 'chapter-modify',
        id: chapterId,
        title: chapterId,
        newText: currentText,
      });
    } else {
      changes.push({
        kind: 'file-modify',
        path: original,
        mediaType: mediaTypeForPath(workspace, original),
        newContent: currentText,
      });
    }
  }

  return {
    id: randomUUID(),
    projectIdentifier: workspace.opf.metadata.identifier ?? '',
    projectTitle: workspace.opf.metadata.title ?? '',
    createdAt: Date.now(),
    changes,
  };
}
