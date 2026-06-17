/**
 * Nav coherence — keep the EPUB navigation document (nav.xhtml) in sync.
 *
 * The Navigation view generates nav.xhtml only while it is open, so an
 * auto-generated nav goes stale when chapters change elsewhere. This helper
 * regenerates the auto nav from the current spine and registers its manifest
 * entry, so the packaged EPUB always ships a coherent nav. A manually authored
 * nav (a non-empty SOURCE/text/nav.txt) is authoritative and left untouched.
 */

import type { WorkspaceService, WorkspaceState } from '../services/workspace/workspace.service.js';
import type { SpineService } from '../services/spine/spine.service.js';
import { OutlineGenerator } from './outline-generator.js';
import { primaryLanguage } from '../epub/opf-utils.js';

const NAV_SOURCE_PATH = 'SOURCE/text/nav.txt';
const DEFAULT_NAV_HREF = 'nav.xhtml';

export interface EnsureNavResult {
  /** The workspace, updated if a nav manifest entry was added. */
  workspace: WorkspaceState;
  /** The regenerated nav XHTML, or null when a manual nav was left untouched. */
  xhtml: string | null;
}

/**
 * Ensure the auto-generated nav.xhtml reflects the current spine and is
 * registered in the manifest.
 *
 * - Manual nav (non-empty nav.txt): returned unchanged (xhtml null) — never
 *   clobbered.
 * - Auto nav (empty/absent nav.txt): nav.xhtml is regenerated from the spine,
 *   written to the workspace, and a `properties="nav"` manifest entry is added
 *   if one is missing.
 */
export async function ensureGeneratedNav(
  workspace: WorkspaceState,
  spineService: SpineService,
  workspaceService: WorkspaceService
): Promise<EnsureNavResult> {
  // Respect a manually authored nav: a non-empty nav.txt means the on-disk
  // nav.xhtml is the user's authoritative, already-transformed document.
  if (await workspaceService.fileExists(workspace.id, NAV_SOURCE_PATH)) {
    const buffer = await workspaceService.readFile(workspace.id, NAV_SOURCE_PATH);
    if (new TextDecoder().decode(buffer).trim() !== '') {
      return { workspace, xhtml: null };
    }
  }

  // Auto mode: regenerate from the current spine.
  const spineItems = await spineService.loadSpineItems(workspace);
  const doc = await OutlineGenerator.generateFromSpine(
    spineItems,
    workspaceService,
    workspace.id,
    workspace.pathInfo,
    primaryLanguage(workspace.opf?.metadata)
  );

  // Write nav.xhtml to wherever the manifest already declares it, defaulting to
  // nav.xhtml at the OPF base path (matching the Navigation view's convention).
  const navItem = workspace.opf.manifest.find(
    item => item.id === 'nav' || item.properties?.includes('nav')
  );
  const navHref = navItem?.href ?? DEFAULT_NAV_HREF;
  const navPath = `${workspace.pathInfo.basePath}/${navHref}`;
  await workspaceService.writeFile(workspace.id, navPath, doc.xhtmlContent);

  // Register the nav entry if it is missing. (An existing nav entry is left as
  // is — we wrote to its declared href, so file and manifest already agree.)
  if (!navItem) {
    const updated = await workspaceService.addManifestItem(workspace, {
      id: 'nav',
      href: DEFAULT_NAV_HREF,
      mediaType: 'application/xhtml+xml',
      properties: ['nav'],
    });
    return { workspace: updated, xhtml: doc.xhtmlContent };
  }

  return { workspace, xhtml: doc.xhtmlContent };
}
