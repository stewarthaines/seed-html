/**
 * The app side of the bridge's `seed_add_media` (process/BRIDGE_HANDOVER_TOOLS.md,
 * section 2): a file the bridge read from a folder the author allowed joins the
 * manifest through the same path as a dropped file. Split into a check, which
 * changes nothing and tells the bridge module whether the add is new, a no-op
 * or an overwrite (each takes a different consent), and the add itself.
 */
import type { WorkspaceService, WorkspaceState } from '../services/workspace/workspace.service.js';
import { ManifestUtils } from '../manifest/utils.js';
import { generateEPUBPath } from '../epub/opf-utils.js';
import { manifestHrefToPath } from '../epub/path-utils.js';
import { importFileToManifest, overwriteManifestFile } from './import-media.js';
import { pluginMediaFilename, pluginMediaFolder } from '../plugins/add-media.js';

export interface AgentMediaRequest {
  /** The file's name as it was on disk; only the last segment counts. */
  filename: string;
  bytes: Uint8Array;
  /** Optional single subfolder inside the media type's folder. */
  folder?: string;
}

export interface AgentMediaPlan {
  /** The manifest href the file lands at, or already has. */
  href: string;
  mediaType: string;
  /** new: added under `href`; identical: already there, nothing to do;
   *  changed: `href` holds different bytes and only an overwrite replaces it. */
  status: 'new' | 'identical' | 'changed';
}

/** Media an agent may add: pictures, sound, video and fonts — never code or markup. */
export function isAgentMediaTypeAllowed(mediaType: string): boolean {
  return /^(image|audio|video|font)\//.test(mediaType);
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.byteLength === b.byteLength && a.every((value, i) => value === b[i]);

/**
 * Where the file would go and what adding it would do, without changing the
 * book. Throws a message for the agent when the file cannot be added at all.
 *
 * Unlike a dropped file, a name clash is never auto-renamed: the agent writes
 * references to the href this returns, so it must be the one the book uses.
 */
export async function checkAgentMedia(
  request: AgentMediaRequest,
  workspace: WorkspaceState,
  workspaceService: WorkspaceService
): Promise<AgentMediaPlan> {
  const name = pluginMediaFilename(request.filename);
  if (!name) throw new Error('the file has no name');
  if (request.bytes.byteLength === 0) throw new Error('the file is empty');
  const mediaType = ManifestUtils.detectMediaType(name);
  if (!isAgentMediaTypeAllowed(mediaType)) {
    throw new Error(
      `only pictures, audio, video and fonts can be added this way, not ${mediaType || name}`
    );
  }
  const folder = pluginMediaFolder(request.folder);
  const generated = generateEPUBPath(name, mediaType);
  const href = folder ? generated.replace(/([^/]+)$/, `${folder}/$1`) : generated;
  // OCF names compare case-insensitively, as the import's own collision check does.
  const existing = workspace.opf.manifest.find(
    item => item.href.toLowerCase() === href.toLowerCase()
  );
  if (!existing) return { href, mediaType, status: 'new' };
  let current: Uint8Array | null = null;
  try {
    current = new Uint8Array(
      await workspaceService.readFile(
        workspace.id,
        manifestHrefToPath(workspace.pathInfo.basePath, existing.href)
      )
    );
  } catch {
    // Unreadable existing file: treat it as different content.
  }
  return {
    href: existing.href,
    mediaType,
    status: current && bytesEqual(current, request.bytes) ? 'identical' : 'changed',
  };
}

/**
 * Add or replace the file as `plan` describes. Returns the workspace to hand to
 * app state (unchanged for an overwrite, which leaves the manifest alone) and
 * the href the file now has. That is `plan.href` unless the book changed
 * between the check and the add, which the caller reports.
 */
export async function addAgentMedia(
  request: AgentMediaRequest,
  plan: AgentMediaPlan,
  workspace: WorkspaceState,
  workspaceService: WorkspaceService
): Promise<{ workspace: WorkspaceState; href: string }> {
  if (plan.status === 'identical') return { workspace, href: plan.href };
  const buffer = new ArrayBuffer(request.bytes.byteLength);
  new Uint8Array(buffer).set(request.bytes);
  const name = plan.href.split('/').pop() ?? pluginMediaFilename(request.filename);
  const file = new File([buffer], name, { type: plan.mediaType });
  if (plan.status === 'changed') {
    await overwriteManifestFile(workspace, workspaceService, plan.href, plan.mediaType, file);
    return { workspace, href: plan.href };
  }
  const folder = pluginMediaFolder(request.folder);
  const imported = await importFileToManifest(
    workspace,
    workspaceService,
    file,
    plan.mediaType,
    folder || undefined
  );
  return { workspace: imported.workspace, href: imported.href };
}
