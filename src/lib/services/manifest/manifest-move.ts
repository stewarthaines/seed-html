/**
 * Commit a manifest move plan — the IO half of batch file moves (the pure
 * half is src/lib/manifest/move-plan.ts).
 *
 * Crash-safe ordering, deliberately: copy new files first, then rewrite
 * referrers, then save the OPF once, and only then delete the originals. A
 * failure at any point leaves at worst a harmless duplicate file — never a
 * book whose OPF or references point at something missing. (Contrast
 * updateManifestItem, which renames before saving.)
 */

import type { FileStorageAPI } from '../../storage/index.js';
import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';
import type { MovePlan, MoveRequest, ReferenceHit } from '../../manifest/move-plan.js';
import {
  applyRewrites,
  applyCssRewrites,
  buildMovePlan,
  findHrefReferences,
} from '../../manifest/move-plan.js';
import { classifySourceFile } from '../../source/source-utils.js';
import { joinBasePath } from '../../transform/transform-broker.js';

/**
 * Read the reference-bearing texts: chapter sources + stylesheets. Unreadable
 * files are skipped — a missing source simply can't be scanned or rewritten.
 */
async function gatherReferenceInputs(
  workspaceService: WorkspaceService,
  fileStorage: FileStorageAPI,
  workspace: WorkspaceState
): Promise<{
  sources: { path: string; text: string }[];
  stylesheets: { href: string; text: string }[];
}> {
  const sources: { path: string; text: string }[] = [];
  try {
    const items = await workspaceService.listSourceFiles(workspace);
    for (const item of items) {
      if (classifySourceFile(item.path) !== 'text' || !item.path.endsWith('.txt')) continue;
      try {
        sources.push({
          path: item.path,
          text: await fileStorage.readTextFile(workspace.id, item.path),
        });
      } catch {
        // Unreadable source.
      }
    }
  } catch {
    // No SOURCE listing (read-only EPUB) — proceed with stylesheets only.
  }

  const stylesheets: { href: string; text: string }[] = [];
  for (const item of workspace.opf.manifest) {
    if (item.mediaType !== 'text/css') continue;
    try {
      stylesheets.push({
        href: item.href,
        text: await fileStorage.readTextFile(
          workspace.id,
          joinBasePath(workspace.pathInfo.basePath, item.href)
        ),
      });
    } catch {
      // Unreadable stylesheet — skip.
    }
  }

  return { sources, stylesheets };
}

/**
 * Gather the plan inputs and build the move plan.
 */
export async function prepareMovePlan(
  workspaceService: WorkspaceService,
  fileStorage: FileStorageAPI,
  workspace: WorkspaceState,
  moves: MoveRequest[]
): Promise<MovePlan> {
  const { sources, stylesheets } = await gatherReferenceInputs(
    workspaceService,
    fileStorage,
    workspace
  );
  return buildMovePlan({ manifest: workspace.opf.manifest, moves, sources, stylesheets });
}

/**
 * Read-only usage lookup for one manifest item's href (the details pane's
 * "where is this used?" list). Same conventions and inputs as the move
 * rewriter, no writes.
 */
export async function findItemUsage(
  workspaceService: WorkspaceService,
  fileStorage: FileStorageAPI,
  workspace: WorkspaceState,
  href: string
): Promise<ReferenceHit[]> {
  const { sources, stylesheets } = await gatherReferenceInputs(
    workspaceService,
    fileStorage,
    workspace
  );
  return findHrefReferences(href, sources, stylesheets);
}

export interface MoveResult {
  updatedWorkspace: WorkspaceState;
  /** Item ids whose files were physically copied (and originals deleted). */
  movedIds: string[];
  /** OPF-relative hrefs whose cached blob URLs are now stale (old locations
   *  of moved files + rewritten stylesheets). */
  staleHrefs: string[];
}

export async function commitMovePlan(
  workspaceService: WorkspaceService,
  fileStorage: FileStorageAPI,
  workspace: WorkspaceState,
  plan: MovePlan
): Promise<MoveResult> {
  const rows = plan.rows.filter(r => !r.blocked);
  if (rows.length === 0) {
    return { updatedWorkspace: workspace, movedIds: [], staleHrefs: [] };
  }

  const basePath = workspace.pathInfo.basePath;
  const fullPath = (href: string) => joinBasePath(basePath, href);
  const newHrefFor = new Map(rows.map(r => [r.oldHref, r.newHref]));

  // 1. Copy every moved file to its new path. A read failure means the item
  //    has no stored file (manifest-only entry — same semantic as
  //    updateManifestItem's fileExists guard): the OPF still updates, there
  //    is just nothing to copy or delete.
  const copied: typeof rows = [];
  for (const row of rows) {
    try {
      const bytes = await fileStorage.readFile(workspace.id, fullPath(row.oldHref));
      await fileStorage.writeFile(workspace.id, fullPath(row.newHref), bytes);
      copied.push(row);
    } catch {
      // No stored file for this item; manifest-only move.
    }
  }

  // 2. Rewrite referrers. Source paths are workspace-relative; stylesheet
  //    paths are OPF-relative hrefs — and a MOVED stylesheet's rewritten text
  //    goes to its NEW location (the phase-1 copy carried the old text).
  const staleHrefs = new Set<string>(copied.map(r => r.oldHref));
  for (const change of plan.fileChanges) {
    if (change.kind === 'source') {
      const text = await fileStorage.readTextFile(workspace.id, change.path);
      await fileStorage.writeTextFile(
        workspace.id,
        change.path,
        applyRewrites(text, change.rewrites)
      );
    } else {
      const targetHref = newHrefFor.get(change.path) ?? change.path;
      const text = await fileStorage.readTextFile(workspace.id, fullPath(change.path));
      await fileStorage.writeTextFile(
        workspace.id,
        fullPath(targetHref),
        applyCssRewrites(text, change.rewrites)
      );
      staleHrefs.add(change.path);
    }
  }

  // 3. One OPF save for the whole batch.
  const updatedWorkspace: WorkspaceState = {
    ...workspace,
    opf: {
      ...workspace.opf,
      manifest: workspace.opf.manifest.map(item => {
        const newHref = newHrefFor.get(item.href);
        return newHref && rows.some(r => r.id === item.id) ? { ...item, href: newHref } : item;
      }),
    },
  };
  const saved = await workspaceService.saveWorkspace(updatedWorkspace);

  // 4. Delete originals, best-effort — a failure leaves a duplicate, never a
  //    broken book.
  for (const row of copied) {
    try {
      await fileStorage.deleteFile(workspace.id, fullPath(row.oldHref));
    } catch (error) {
      console.warn(`Failed to remove moved file's original: ${row.oldHref}`, error);
    }
  }

  return {
    updatedWorkspace: saved,
    movedIds: rows.map(r => r.id),
    staleHrefs: [...staleHrefs],
  };
}
