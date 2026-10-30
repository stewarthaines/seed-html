/**
 * Nav coherence — keep the EPUB navigation document (nav.xhtml) in sync.
 *
 * The Navigation view generates nav.xhtml only while it is open, so an
 * auto-generated nav goes stale when chapters change elsewhere. This helper
 * regenerates the auto nav from the current spine and registers its manifest
 * entry, so the packaged EPUB always ships a coherent nav. A manually authored
 * nav (a non-empty SOURCE/text/nav.txt) is authoritative, except for its
 * page-list, which is always derived from the chapters' page markers and so is
 * refreshed here too.
 */

import type { WorkspaceService, WorkspaceState } from '../services/workspace/workspace.service.js';
import type { SpineService } from '../services/spine/spine.service.js';
import { OutlineGenerator } from './outline-generator.js';
import type { SpineTransformPipeline } from '../transform/spine-transform-pipeline.js';
import { primaryLanguage } from '../epub/opf-utils.js';
import { manifestHrefToPath } from '../epub/path-utils.js';
import { collectPageTargets, withPageList } from './page-list.js';

const NAV_SOURCE_PATH = 'SOURCE/text/nav.txt';
const DEFAULT_NAV_HREF = 'nav.xhtml';

export interface EnsureNavOptions {
  /** The `start_reading` setting: the chapter the landmarks nav names as bodymatter. */
  startReading?: string;
  /**
   * Re-renders a hand-written nav from nav.txt (text transform only), so its
   * page-list and start-reading landmarks reflect the current chapters and
   * settings. Without it, only the page-list is refreshed in place.
   */
  transformPipeline?: SpineTransformPipeline;
}

export interface EnsureNavResult {
  /** The workspace, updated if a nav manifest entry was added. */
  workspace: WorkspaceState;
  /** The regenerated nav XHTML, or null for a manual nav (only its page-list is refreshed). */
  xhtml: string | null;
}

/**
 * Ensure the auto-generated nav.xhtml reflects the current spine and is
 * registered in the manifest.
 *
 * - Manual nav (non-empty nav.txt): re-rendered from nav.txt with the
 *   `transformPipeline` option, so its page-list and start-reading landmarks
 *   are current; without it, only its page-list is replaced (xhtml null).
 * - Auto nav (empty/absent nav.txt): nav.xhtml is regenerated from the spine,
 *   written to the workspace, and a `properties="nav"` manifest entry is added
 *   if one is missing.
 */
export async function ensureGeneratedNav(
  workspace: WorkspaceState,
  spineService: SpineService,
  workspaceService: WorkspaceService,
  options: EnsureNavOptions = {}
): Promise<EnsureNavResult> {
  const navItem = workspace.opf.manifest.find(
    item => item.id === 'nav' || item.properties?.includes('nav')
  );
  const navHref = navItem?.href ?? DEFAULT_NAV_HREF;
  const navPath = `${workspace.pathInfo.basePath}/${navHref}`;

  // Respect a manually authored nav: a non-empty nav.txt means the on-disk
  // nav.xhtml is the user's authoritative, already-transformed document. Only
  // its page-list is the app's, since the chapters define it.
  if (await workspaceService.fileExists(workspace.id, NAV_SOURCE_PATH)) {
    const buffer = await workspaceService.readFile(workspace.id, NAV_SOURCE_PATH);
    const navText = new TextDecoder().decode(buffer);
    if (navText.trim() !== '') {
      if (options.transformPipeline) {
        try {
          await rerenderManualNav(workspace, spineService, workspaceService, navPath, navText, {
            ...options,
            transformPipeline: options.transformPipeline,
          });
          return { workspace, xhtml: null };
        } catch (error) {
          // A nav.txt that no longer transforms keeps its last good nav.xhtml.
          console.warn('Hand-written nav was not re-rendered:', error);
        }
      }
      await refreshPageList(workspace, spineService, workspaceService, navHref);
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
    primaryLanguage(workspace.opf?.metadata),
    { startReading: options.startReading }
  );

  // Write nav.xhtml to wherever the manifest already declares it, defaulting to
  // nav.xhtml at the OPF base path (matching the Navigation view's convention).
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

/**
 * Replace a manual nav's page-list with one built from the chapters' current
 * page markers (or remove it when there are none). Writes only on a change; a
 * missing nav.xhtml is left for the Navigation view to create.
 */
async function refreshPageList(
  workspace: WorkspaceState,
  spineService: SpineService,
  workspaceService: WorkspaceService,
  navHref: string
): Promise<void> {
  const navPath = manifestHrefToPath(workspace.pathInfo.basePath, navHref);
  if (!(await workspaceService.fileExists(workspace.id, navPath))) return;
  const current = new TextDecoder().decode(await workspaceService.readFile(workspace.id, navPath));
  const targets = await collectPageTargets(
    await spineService.loadSpineItems(workspace),
    workspaceService,
    workspace.id,
    workspace.pathInfo.basePath,
    navHref
  );
  const updated = withPageList(current, targets);
  if (updated !== current) await workspaceService.writeFile(workspace.id, navPath, updated);
}

/**
 * Render a hand-written nav from nav.txt, as the Navigation view does, and
 * write it when it differs from the stored nav.xhtml.
 */
async function rerenderManualNav(
  workspace: WorkspaceState,
  spineService: SpineService,
  workspaceService: WorkspaceService,
  navPath: string,
  navText: string,
  options: EnsureNavOptions & { transformPipeline: SpineTransformPipeline }
): Promise<void> {
  // A freshly loaded workspace gives plain manifest objects, which (unlike a
  // reactive proxy) can be cloned to the transform iframe.
  const plain = await workspaceService.loadWorkspace(workspace.id);
  const language = primaryLanguage(plain.opf?.metadata);
  const doc = await OutlineGenerator.processUserContent(
    navText,
    options.transformPipeline,
    workspace.id,
    {
      language,
      brokerContext: { basePath: plain.pathInfo.basePath, manifest: plain.opf.manifest, language },
      spine: {
        items: await spineService.loadSpineItems(workspace),
        workspaceService,
        pathInfo: workspace.pathInfo,
      },
      startReading: options.startReading,
    }
  );
  const current = (await workspaceService.fileExists(workspace.id, navPath))
    ? new TextDecoder().decode(await workspaceService.readFile(workspace.id, navPath))
    : null;
  if (doc.xhtmlContent !== current) {
    await workspaceService.writeFile(workspace.id, navPath, doc.xhtmlContent);
  }
}
