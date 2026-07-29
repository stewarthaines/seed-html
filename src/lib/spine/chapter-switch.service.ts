/**
 * Chapter-switch orchestration (process/CHAPTER_SWITCH_SERVICE.md).
 *
 * Phase 1: the per-switch context. One workspace enumeration and one settings
 * read, shared by every consumer that previously enumerated for itself
 * (generators, extension preview-heads, the editor's file dropdown). The
 * context is built fresh on every switch and discarded — the orchestrator
 * holds no cross-switch state, so there is nothing to invalidate; services
 * that want longer-lived caching own it themselves (workspace mtime cache
 * precedent).
 */
import type { FileStorageAPI } from '../storage/index.js';
import type { SettingsService, EPUBSettings } from '../services/settings/settings.service.js';
import type { ExtensionManager } from '../extensions/extension-manager.js';
import { listGenerators, type InstalledGenerator } from '../generators/generator-store.js';

export interface SwitchContextDeps {
  fileStorage: FileStorageAPI;
  settingsService: SettingsService;
  extensionManager: ExtensionManager;
  workspaceId: string;
}

/** Everything a switch reads once and shares; see the design doc. */
export interface SwitchContext {
  /** The single workspace enumeration for this switch ([] if it failed). */
  files: string[];
  /** EPUB settings, or null when unavailable (older/partial projects). */
  settings: EPUBSettings | null;
  /** Workspace path of the preview-only <head> fragment (SOURCE/-prefixed). */
  previewHeadPath: string;
  /** Contents of that fragment ('' when absent). */
  previewHeadContent: string;
  /** Concatenated previewHead fragments of installed extensions ('' if none). */
  extensionPreviewHead: string;
  /** The project's generators (empty on discovery failure). */
  generators: InstalledGenerator[];
}

/**
 * Build the shared context for one chapter switch. Failure semantics mirror
 * the per-consumer fallbacks this replaces: each field degrades independently
 * (empty list / null / empty string) rather than failing the switch.
 */
export async function buildSwitchContext(deps: SwitchContextDeps): Promise<SwitchContext> {
  const { fileStorage, settingsService, extensionManager, workspaceId } = deps;

  let files: string[] = [];
  try {
    files = await fileStorage.listFiles(workspaceId);
  } catch {
    // Enumeration-dependent fields degrade to empty below.
  }

  let settings: EPUBSettings | null = null;
  try {
    settings = await settingsService.loadEPUBSettings(workspaceId);
  } catch {
    // Settings unavailable — transform/preview-head consumers skip their entries.
  }

  // The remaining reads are independent of each other — run them together.
  const headPath = settings?.preview?.head ?? 'preview/head.xml';
  const previewHeadPath = headPath.startsWith('SOURCE/') ? headPath : `SOURCE/${headPath}`;
  const [previewHeadContent, extensionPreviewHead, generators] = await Promise.all([
    fileStorage.readTextFile(workspaceId, previewHeadPath).catch(() => ''),
    collectExtensionPreviewHeads(extensionManager, fileStorage, workspaceId, files),
    listGenerators(fileStorage, workspaceId, files).catch(() => [] as InstalledGenerator[]),
  ]);

  return { files, settings, previewHeadPath, previewHeadContent, extensionPreviewHead, generators };
}

/**
 * Gather every installed extension's `previewHead` fragment (extension.json
 * `previewHead` key) into one string — see process/PREVIEW_HEAD_EXTENSIONS.md.
 * A missing/malformed manifest or fragment skips that extension; any broader
 * failure yields ''.
 */
async function collectExtensionPreviewHeads(
  extensionManager: ExtensionManager,
  fileStorage: FileStorageAPI,
  workspaceId: string,
  knownFiles: string[]
): Promise<string> {
  try {
    const exts = await extensionManager.listWorkspaceExtensions(workspaceId, knownFiles);
    const fragments: string[] = [];
    for (const ext of exts) {
      try {
        const metaRaw = await fileStorage.readTextFile(
          workspaceId,
          `SOURCE/extensions/${ext.name}/extension.json`
        );
        const file = JSON.parse(metaRaw)?.previewHead;
        if (typeof file !== 'string' || !file) continue;
        const fragment = await fileStorage.readTextFile(
          workspaceId,
          `SOURCE/extensions/${ext.name}/${file}`
        );
        if (fragment.trim()) fragments.push(fragment);
      } catch {
        // Missing/malformed extension.json or fragment — skip that extension.
      }
    }
    return fragments.join('\n');
  } catch {
    return '';
  }
}
