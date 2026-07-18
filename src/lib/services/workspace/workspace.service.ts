/**
 * WorkspaceService - Clean Service Architecture Implementation
 *
 * Consolidates workspace lifecycle and EPUB structure management from existing managers
 * following the clean service architecture with single responsibility principle.
 */

import type { FileStorageAPI } from '../../storage/index.js';
import { randomUUID } from '../../utils/uuid.js';
import type { EPUBMetadata, OPFDocument, ManifestItem, SpineItem } from '../../epub/opf-utils.js';
import {
  generateEPUBTimestamp,
  creatorName,
  primaryLanguage,
  toEpubSafeHref,
} from '../../epub/opf-utils.js';
import {
  isSourceFile,
  classifySourceFile,
  workspaceIsReadOnly,
} from '../../source/source-utils.js';
import type { SourceItem } from '../../manifest/types.js';
import { resolveSourceWritePath } from '../../transform/transform-broker.js';
import { getBrowserLocale } from '../../i18n/locale-config.js';
import { captureBaseIfNeeded } from '../../track-changes/base-snapshot.js';

// Service-specific types
export interface WorkspaceState {
  id: string;
  opf: OPFDocument;
  pathInfo: WorkspacePathInfo;
}

export interface WorkspacePathInfo {
  rootfilePath: string;
  basePath: string;
  opfFileName: string;
}

export interface WorkspaceInfo {
  id: string;
  title: string;
  language: string;
  lastModified: Date;
  /** Loaded lazily per row via getWorkspaceRowDetails — absent in the fast list path. */
  fileCount?: number;
  totalSize?: number;
  author?: string;
  /** All creator names (the detail panel shows the full list). */
  authors?: string[];
  /** dc:description, when present. */
  description?: string;
  /** dc:date (publication date), when present. */
  date?: string;
  hasError?: boolean;
  epubVersion: string;
  /** Loaded lazily per row via getWorkspaceRowDetails. */
  extensionIds?: string[];
}

/** Per-row details loaded lazily after the Projects list renders. */
export interface WorkspaceRowDetails {
  fileCount: number;
  extensionIds?: string[];
  /** A regular EPUB (no SOURCE/ files) — viewable but not editable. */
  readOnly: boolean;
  /** Small PNG data URL of the cover, sized for the project card. */
  coverThumbUrl?: string;
}

/**
 * Cached row metadata — the lightweight, derived parts of WorkspaceRowDetails.
 * Excludes the cover ArrayBuffer: only the resolved cover path + media type are
 * kept, and the bytes are re-read on demand so the cache stays memory-flat.
 *
 * Known accepted staleness: SOURCE-only writes (chapter text edits) don't
 * touch the OPF, so fileCount can be off by a file until the next OPF write.
 */
interface CachedRowMeta {
  fileCount: number;
  extensionIds?: string[];
  readOnly: boolean;
  cover?: { path: string; mediaType: string };
}

export interface ChapterContent {
  id: string;
  href: string;
  xhtmlContent: string;
  linear: boolean;
  mediaType: string;
}

// Pure data structure for sample content (no file I/O)
export interface SampleContentData {
  chapters: Array<{
    id: string;
    title: string;
    fileName: string;
    content: string; // Plain text content
    xhtmlContent: string; // Transformed XHTML
  }>;
  assets: Array<{
    path: string;
    content: string;
  }>;
  manifestUpdates: ManifestItem[];
  spineUpdates: SpineItem[];
}

// Service error types
export class WorkspaceServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public workspaceId?: string
  ) {
    super(message);
    this.name = 'WorkspaceServiceError';
  }
}

export class WorkspaceNotFoundError extends WorkspaceServiceError {
  constructor(workspaceId: string) {
    super(
      `Workspace not found: ${workspaceId}. Please check workspace ID.`,
      'WORKSPACE_NOT_FOUND',
      workspaceId
    );
    this.name = 'WorkspaceNotFoundError';
  }
}

export class OPFCorruptedError extends WorkspaceServiceError {
  constructor(workspaceId: string, details: string) {
    super(
      `OPF file corrupted in workspace ${workspaceId}: ${details}. Try reimporting the EPUB.`,
      'OPF_CORRUPTED',
      workspaceId
    );
    this.name = 'OPFCorruptedError';
  }
}

export class ValidationError extends WorkspaceServiceError {
  constructor(
    message: string,
    public context?: any
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    // Context is already assigned via parameter property
  }
}

// Import OPF utilities for internal use
import { OPFUtils } from '../../epub/opf-utils.js';
import { ExtensionManager } from '../../extensions/extension-manager.js';
import { RESERVED_WORKSPACE_IDS } from '../../workspace/types.js';
import { coverThumbDataUrl } from '../../epub/image-thumbnail.js';
import {
  readEntry,
  writeEntry,
  removeEntry,
  pruneEntries,
  entryFreshFor,
} from './projects-cache.js';

/**
 * WorkspaceService - Single responsibility for workspace lifecycle and EPUB structure
 */
export class WorkspaceService {
  private extensionManager: ExtensionManager;

  // container.xml → rootfilePath is immutable per workspace; cache permanently.
  private pathInfoCache = new Map<string, WorkspacePathInfo>();

  // OPF-mtime-validated cache of the Projects-list data. The shared mtime token
  // means a single OPF write invalidates both the summary and the row metadata.
  // Backed by a persistent localStorage layer (projects-cache.ts) so page
  // reloads skip the per-project directory walks and cover reads.
  private summaryCache = new Map<
    string,
    { opfMtime: number; info?: WorkspaceInfo; rowMeta?: CachedRowMeta; thumb?: string }
  >();

  constructor(private fileStorage: FileStorageAPI) {
    this.extensionManager = new ExtensionManager(fileStorage);
  }

  /**
   * Resolve pathInfo (cached) and the current OPF mtime, returning a cache slot
   * for this workspace. A changed mtime drops the stale slot so callers rebuild.
   */
  private async cacheSlot(id: string): Promise<{
    pathInfo: WorkspacePathInfo;
    slot: { opfMtime: number; info?: WorkspaceInfo; rowMeta?: CachedRowMeta; thumb?: string };
  }> {
    const pathInfo = await this.getWorkspacePathInfo(id);
    let opfMtime = 0;
    try {
      opfMtime = (
        await this.fileStorage.getFileInfo(id, pathInfo.rootfilePath)
      ).lastModified.getTime();
    } catch {
      // Leave 0 → never matches a stored mtime, so the slot always rebuilds.
    }
    let slot = this.summaryCache.get(id);
    if (!slot || slot.opfMtime !== opfMtime) {
      slot = { opfMtime };
      // Hydrate from the persistent layer when its entry was derived from the
      // same OPF version — this is what makes reloads warm.
      const entry = readEntry(id);
      if (entry && entryFreshFor(entry, opfMtime)) {
        if (entry.info) {
          slot.info = {
            id,
            title: entry.info.title,
            language: entry.info.language,
            lastModified: new Date(entry.info.lastModified),
            author: entry.info.author,
            authors: entry.info.authors,
            description: entry.info.description,
            date: entry.info.date,
            hasError: false,
            epubVersion: '3.0',
          };
        }
        slot.rowMeta = entry.rowMeta;
        slot.thumb = entry.thumb;
      }
      this.summaryCache.set(id, slot);
    }
    return { pathInfo, slot };
  }

  /**
   * Merge this workspace's in-memory slot into its persistent entry
   * (read-modify-write so data written by the other load path survives).
   */
  private persistSlot(
    id: string,
    slot: { opfMtime: number; info?: WorkspaceInfo; rowMeta?: CachedRowMeta; thumb?: string }
  ): void {
    const existing = readEntry(id);
    const base = existing && entryFreshFor(existing, slot.opfMtime) ? existing : undefined;
    writeEntry(id, {
      v: 2,
      opfMtime: slot.opfMtime,
      info: slot.info
        ? {
            title: slot.info.title,
            language: slot.info.language,
            lastModified: slot.info.lastModified.getTime(),
            author: slot.info.author,
            authors: slot.info.authors,
            description: slot.info.description,
            date: slot.info.date,
          }
        : base?.info,
      rowMeta: slot.rowMeta ?? base?.rowMeta,
      thumb: slot.thumb ?? base?.thumb,
    });
  }

  /** Drop cached data for one workspace (or all when no id is given). */
  invalidateWorkspaceCache(id?: string): void {
    if (id) {
      this.pathInfoCache.delete(id);
      this.summaryCache.delete(id);
      removeEntry(id);
    } else {
      pruneEntries([]); // removes every persistent entry
      this.pathInfoCache.clear();
      this.summaryCache.clear();
    }
  }

  /**
   * Create a new workspace with initial EPUB structure
   */
  async createWorkspace(metadata: EPUBMetadata): Promise<WorkspaceState> {
    // Generate unique workspace ID
    const id = this.generateWorkspaceId();

    // Add automatic timestamps and browser language detection
    const timestampedMetadata: EPUBMetadata = {
      ...metadata,
      // Auto-detect browser language if not provided
      language: metadata.language?.length ? metadata.language : [getBrowserLocale()],
      modifiedDate: generateEPUBTimestamp(),
    };

    // Create workspace in storage
    await this.fileStorage.createWorkspace(id);

    // Create initial OPF document
    const opf: OPFDocument = {
      version: '3.0',
      metadata: {
        ...timestampedMetadata,
        epubVersion: '3.0',
      },
      manifest: [],
      spine: [],
      guide: [],
    };

    // Generate EPUB structure files
    await this.createEPUBStructure(id, opf);

    // Create workspace state
    const workspaceState: WorkspaceState = {
      id,
      opf,
      pathInfo: {
        rootfilePath: 'OEBPS/content.opf',
        basePath: 'OEBPS',
        opfFileName: 'content.opf',
      },
    };

    return workspaceState;
  }

  /**
   * Deep-copy an existing workspace into a new one. Every file is copied
   * verbatim (OEBPS content, SOURCE/, settings sidecar, nav), then the copy's
   * OPF is re-stamped with a fresh identifier and a "(copy)" title so it is a
   * distinct EPUB. Returns the new workspace.
   */
  async duplicateWorkspace(srcId: string, title?: string): Promise<WorkspaceState> {
    const newId = this.generateWorkspaceId();
    await this.fileStorage.createWorkspace(newId);

    // Copy every file as-is. readFile/writeFile use ArrayBuffer, so this is
    // safe for both text and binary content.
    for (const path of await this.fileStorage.listFiles(srcId)) {
      const content = await this.fileStorage.readFile(srcId, path);
      await this.fileStorage.writeFile(newId, path, content);
    }

    // Re-stamp identity on the copied OPF (the copy is its own EPUB). Use the
    // caller-supplied title, or default to "<title> (copy)".
    const copy = await this.loadWorkspace(newId);
    return await this.updateMetadata(copy, {
      title: title?.trim() || `${copy.opf.metadata.title} (copy)`,
      identifier: `urn:uuid:${randomUUID()}`,
    });
  }

  /**
   * Populate workspace with sample content data
   * Pure file I/O operation - takes structured data and writes files
   */
  async populateWithContent(
    workspaceId: string,
    sampleData: SampleContentData
  ): Promise<WorkspaceState> {
    // Write all asset files
    for (const asset of sampleData.assets) {
      await this.fileStorage.writeTextFile(workspaceId, asset.path, asset.content);
    }

    // Write all chapter files
    for (const chapter of sampleData.chapters) {
      // Write source text file
      await this.fileStorage.writeTextFile(
        workspaceId,
        `SOURCE/text/${chapter.fileName}`,
        chapter.content
      );

      // Write XHTML file
      await this.fileStorage.writeTextFile(
        workspaceId,
        `OEBPS/Text/${chapter.id}.xhtml`,
        chapter.xhtmlContent
      );
    }

    // Load current workspace to update OPF
    const workspace = await this.loadWorkspace(workspaceId);

    // Update OPF with new manifest and spine items
    const updatedOPF: OPFDocument = {
      ...workspace.opf,
      manifest: [...workspace.opf.manifest, ...sampleData.manifestUpdates],
      spine: [...workspace.opf.spine, ...sampleData.spineUpdates],
    };

    // Write updated OPF
    const opfXML = OPFUtils.generateOPFXML(updatedOPF);
    await this.fileStorage.writeTextFile(workspaceId, workspace.pathInfo.rootfilePath, opfXML);

    // Return updated workspace state
    return {
      ...workspace,
      opf: updatedOPF,
    };
  }

  /**
   * Load complete workspace state from storage
   */
  async loadWorkspace(id: string): Promise<WorkspaceState> {
    try {
      // Check if workspace exists
      const workspaces = await this.fileStorage.listWorkspaces();
      if (!workspaces.includes(id)) {
        throw new WorkspaceNotFoundError(id);
      }

      // Get workspace path info
      const pathInfo = await this.getWorkspacePathInfo(id);

      // Load and parse OPF
      const opfContent = await this.fileStorage.readTextFile(id, pathInfo.rootfilePath);

      let opf: OPFDocument;
      try {
        opf = OPFUtils.parseOPFDocument(opfContent);
      } catch (error) {
        throw new OPFCorruptedError(
          id,
          error instanceof Error ? error.message : 'Unknown parsing error'
        );
      }

      return {
        id,
        opf,
        pathInfo,
      };
    } catch (error) {
      if (error instanceof WorkspaceServiceError) {
        throw error;
      }
      throw new WorkspaceServiceError(
        `Failed to load workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_ERROR',
        id
      );
    }
  }

  /**
   * Save workspace state to storage
   */
  async saveWorkspace(workspace: WorkspaceState): Promise<WorkspaceState> {
    // Save workspace without updating modification timestamp (only updated during EPUB packaging)
    const updatedWorkspace = { ...workspace };

    // Generate and save OPF
    const opfXML = OPFUtils.generateOPFXML(updatedWorkspace.opf);
    await this.fileStorage.writeTextFile(workspace.id, workspace.pathInfo.rootfilePath, opfXML);

    return updatedWorkspace;
  }

  /**
   * Delete workspace and all associated files
   */
  async deleteWorkspace(id: string): Promise<void> {
    try {
      await this.fileStorage.deleteWorkspace(id);
      this.invalidateWorkspaceCache(id);
    } catch (error) {
      // Don't throw for non-existent workspaces (idempotent operation)
      if (error instanceof Error && !error.message.includes('not found')) {
        throw new WorkspaceServiceError(
          `Failed to delete workspace: ${error.message}`,
          'DELETE_ERROR',
          id
        );
      }
    }
  }

  /**
   * Update workspace metadata
   */
  async updateMetadata(
    workspace: WorkspaceState,
    updates: Partial<EPUBMetadata>
  ): Promise<WorkspaceState> {
    // Validate updates
    this.validateMetadataUpdates(updates);

    // Create new metadata object to trigger reactivity while preserving workspace reference
    // This allows XML preview to update while preventing loading states in sidebar components
    workspace.opf.metadata = { ...workspace.opf.metadata, ...updates };

    // Save to storage immediately (preserves user requirement for no data loss)
    await this.saveWorkspace(workspace);

    // Return same workspace object (not new one) to prevent reactive cascade
    return workspace;
  }

  /**
   * Add manifest item to workspace
   */
  async addManifestItem(
    workspace: WorkspaceState,
    item: Partial<ManifestItem>
  ): Promise<WorkspaceState> {
    // Validate required fields
    if (!item.href) {
      throw new ValidationError('Manifest item must have href');
    }

    // Generate ID if not provided
    const id =
      item.id || this.generateManifestId(item.href, new Set(workspace.opf.manifest.map(m => m.id)));

    // Check for duplicate ID
    if (workspace.opf.manifest.some(m => m.id === id)) {
      throw new ValidationError(`Manifest item with ID '${id}' already exists`);
    }

    // Create manifest item
    const manifestItem: ManifestItem = {
      id,
      href: item.href,
      mediaType: item.mediaType || this.detectMediaType(item.href),
      properties: item.properties,
      fallback: item.fallback,
    };

    // Create updated workspace
    let updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: [...workspace.opf.manifest, manifestItem],
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    // Reconcile the blanket 'scripted' property on every add — not only when the
    // added item is JS. Adding a JS file toggles it on for all chapters, AND a
    // newly-added chapter must pick up 'scripted' when a reading-system JS already
    // exists (otherwise it's order-dependent: chapters created after the JS never
    // get flagged). The reconcile is idempotent, so a non-JS/non-chapter add is a
    // cheap no-op.
    updatedWorkspace = this.addScriptedPropertiesToChapters(updatedWorkspace);

    // Save to storage
    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Remove manifest item from workspace
   */
  async removeManifestItem(workspace: WorkspaceState, itemId: string): Promise<WorkspaceState> {
    const itemIndex = workspace.opf.manifest.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new ValidationError(`Manifest item with ID '${itemId}' not found`);
    }

    // Get the manifest item before removing it
    const removedItem = workspace.opf.manifest[itemIndex];
    const removingJavaScript =
      removedItem.mediaType === 'text/javascript' ||
      removedItem.mediaType === 'application/javascript';

    // Create updated workspace without the item
    let updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: workspace.opf.manifest.filter(item => item.id !== itemId),
        spine: workspace.opf.spine.filter(spineItem => spineItem.idref !== itemId), // Remove from spine too
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    // Update scripted properties if JavaScript file was removed
    if (removingJavaScript) {
      updatedWorkspace = this.addScriptedPropertiesToChapters(updatedWorkspace);
    }

    // Persist the manifest change first, so a failure to delete the file can
    // never leave content.opf still listing an item whose file is gone.
    const savedWorkspace = await this.saveWorkspace(updatedWorkspace);

    // Then delete the actual file using existing path resolution infrastructure.
    try {
      const filePath = this.resolveManifestPath(removedItem.href, workspace.pathInfo.basePath);
      await this.fileStorage.deleteFile(workspace.id, filePath);
    } catch (error) {
      // Log warning but don't fail if file doesn't exist (e.g. rollback of an
      // upload whose file write never completed).
      console.warn(`Failed to delete file for manifest item ${itemId}:`, error);
    }

    return savedWorkspace;
  }

  /**
   * Update manifest item properties
   */
  async updateManifestItem(
    workspace: WorkspaceState,
    itemId: string,
    updates: Partial<ManifestItem>
  ): Promise<WorkspaceState> {
    const itemIndex = workspace.opf.manifest.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new ValidationError(`Manifest item with ID '${itemId}' not found`);
    }

    // Get the old item for comparison
    const oldItem = workspace.opf.manifest[itemIndex];

    // Sanitize a renamed href to an EPUB-safe path before using it anywhere.
    if (updates.href) {
      const safe = toEpubSafeHref(updates.href);
      if (!safe) {
        throw new ValidationError(`Invalid file path: '${updates.href}'`);
      }
      // Reject a collision with a different item (OCF disallows case-only diffs).
      if (
        safe.toLowerCase() !== oldItem.href.toLowerCase() &&
        workspace.opf.manifest.some(
          (m, idx) => idx !== itemIndex && m.href.toLowerCase() === safe.toLowerCase()
        )
      ) {
        throw new ValidationError(`A manifest item already exists at path '${safe}'`);
      }
      updates = { ...updates, href: safe };
    }

    // Handle file path changes by moving the actual file
    if (updates.href && updates.href !== oldItem.href) {
      const oldFullPath = this.resolveManifestPath(oldItem.href, workspace.pathInfo.basePath);
      const newFullPath = this.resolveManifestPath(updates.href, workspace.pathInfo.basePath);

      // Only move if source file exists
      if (await this.fileStorage.fileExists(workspace.id, oldFullPath)) {
        try {
          await this.fileStorage.renameFile(workspace.id, oldFullPath, newFullPath);
        } catch (_error) {
          throw new WorkspaceServiceError(
            `Failed to move file from ${oldItem.href} to ${updates.href}: ${_error instanceof Error ? _error.message : 'Unknown error'}`,
            'FILE_MOVE_ERROR',
            workspace.id
          );
        }
      }
    }

    // Check if media type changed to/from JavaScript
    const oldIsJS =
      oldItem.mediaType === 'text/javascript' || oldItem.mediaType === 'application/javascript';
    const newIsJS =
      updates.mediaType === 'text/javascript' || updates.mediaType === 'application/javascript';

    // Update manifest item
    const updatedManifest = [...workspace.opf.manifest];
    updatedManifest[itemIndex] = {
      ...updatedManifest[itemIndex],
      ...updates,
    };

    // Check if ID is being changed and update spine references
    let updatedSpine = workspace.opf.spine;
    if (updates.id && updates.id !== itemId) {
      // Validate new ID doesn't already exist
      if (workspace.opf.manifest.some((item, idx) => idx !== itemIndex && item.id === updates.id)) {
        throw new ValidationError(`Manifest item with ID '${updates.id}' already exists`);
      }

      // Update all spine items that reference the old ID
      updatedSpine = workspace.opf.spine.map(spineItem =>
        spineItem.idref === itemId ? { ...spineItem, idref: updates.id! } : spineItem
      );
    }

    // Create updated workspace
    let updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: updatedManifest,
        spine: updatedSpine,
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    // Update scripted properties if JavaScript status changed
    if (oldIsJS !== newIsJS) {
      updatedWorkspace = this.addScriptedPropertiesToChapters(updatedWorkspace);
    }

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Update spine order
   */
  async updateSpineOrder(workspace: WorkspaceState, itemIds: string[]): Promise<WorkspaceState> {
    // Validate all items exist in manifest
    const manifestIds = new Set(workspace.opf.manifest.map(item => item.id));
    const invalidItems = itemIds.filter(id => !manifestIds.has(id));

    if (invalidItems.length > 0) {
      throw new ValidationError(
        `Spine items reference missing manifest items: ${invalidItems.join(', ')}`
      );
    }

    // Create spine items, preserving each item's existing attributes (linear,
    // properties) by idref — reordering must not silently drop a `linear="no"`
    // flag or spine properties. Ids new to the spine fall back to a bare item.
    const existingByIdref = new Map(workspace.opf.spine.map(item => [item.idref, item]));
    const spine: SpineItem[] = itemIds.map(idref => existingByIdref.get(idref) ?? { idref });

    // Create updated workspace
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        spine,
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Add spine item at specific position
   */
  async addSpineItem(
    workspace: WorkspaceState,
    item: SpineItem,
    insertIndex?: number
  ): Promise<WorkspaceState> {
    // Validate that referenced manifest item exists
    if (!workspace.opf.manifest.some(m => m.id === item.idref)) {
      throw new ValidationError(`Referenced manifest item not found: ${item.idref}`);
    }

    // Check for duplicate spine items
    if (workspace.opf.spine.some(s => s.idref === item.idref)) {
      throw new ValidationError(`Spine item with idref '${item.idref}' already exists`);
    }

    // Create updated spine
    const updatedSpine = [...workspace.opf.spine];
    const targetIndex = insertIndex ?? updatedSpine.length;
    updatedSpine.splice(targetIndex, 0, item);

    // Create updated workspace
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        spine: updatedSpine,
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Remove spine item
   */
  async removeSpineItem(workspace: WorkspaceState, idref: string): Promise<WorkspaceState> {
    const index = workspace.opf.spine.findIndex(item => item.idref === idref);
    if (index === -1) {
      throw new ValidationError(`Spine item with idref '${idref}' not found`);
    }

    // Create updated workspace
    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        spine: workspace.opf.spine.filter(item => item.idref !== idref),
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * Update a spine item's attributes in place (e.g. the `linear` reading-order
   * flag or spine `properties`), preserving its position and other fields.
   */
  async updateSpineItem(
    workspace: WorkspaceState,
    idref: string,
    patch: { linear?: boolean; properties?: string[] }
  ): Promise<WorkspaceState> {
    const index = workspace.opf.spine.findIndex(item => item.idref === idref);
    if (index === -1) {
      throw new ValidationError(`Spine item with idref '${idref}' not found`);
    }

    const updatedSpine = [...workspace.opf.spine];
    updatedSpine[index] = { ...updatedSpine[index], ...patch };

    const updatedWorkspace: WorkspaceState = {
      ...workspace,
      opf: {
        ...workspace.opf,
        spine: updatedSpine,
        metadata: {
          ...workspace.opf.metadata,
          modifiedDate: generateEPUBTimestamp(),
        },
      },
    };

    return await this.saveWorkspace(updatedWorkspace);
  }

  /**
   * List all workspaces with summary information
   */
  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    const workspaceIds = await this.fileStorage.listWorkspaces();

    // Skip reserved workspaces (e.g. 'locales', 'publish') — they are not user
    // projects and have no OPF to parse.
    const visibleIds = workspaceIds.filter(id => !RESERVED_WORKSPACE_IDS.has(id));

    // Housekeeping for the persistent cache: drop entries for deleted
    // workspaces and keep the total size within budget.
    pruneEntries(visibleIds);

    // Parse all workspaces in parallel; a corrupted workspace resolves to null
    // (one bad workspace must not abort the whole list) and is filtered out.
    const results = await Promise.all(
      visibleIds.map(id => this.getWorkspaceInfo(id).catch(() => null))
    );

    return results.filter((info): info is WorkspaceInfo => info !== null);
  }

  /**
   * Build the fast summary info for a single workspace shown in the Projects
   * list: title/author/language/lastModified only. Parses just the OPF metadata
   * block (not the full manifest/spine/guide) and avoids the expensive
   * per-workspace directory scans (file count, extensions) — those are loaded
   * lazily per row via getWorkspaceRowDetails so the list renders fast.
   */
  async getWorkspaceInfo(id: string): Promise<WorkspaceInfo> {
    const { pathInfo, slot } = await this.cacheSlot(id);
    if (slot.info) return slot.info;

    const opfContent = await this.fileStorage.readTextFile(id, pathInfo.rootfilePath);
    const metadata = OPFUtils.parseOPFMetadataFromString(opfContent);

    // The cache slot carries the OPF mtime (0 when getFileInfo failed); reuse it
    // for last-modified, falling back to the metadata date when unavailable.
    const lastModified = slot.opfMtime
      ? new Date(slot.opfMtime)
      : metadata.modifiedDate
        ? new Date(metadata.modifiedDate)
        : new Date();

    const authors = metadata.creator?.map(c => creatorName(c)).filter((n): n is string => !!n);

    slot.info = {
      id,
      title: metadata.title,
      language: primaryLanguage(metadata),
      lastModified,
      author: authors?.[0],
      authors: authors && authors.length > 0 ? authors : undefined,
      description: metadata.description || undefined,
      date: metadata.date || undefined,
      hasError: false,
      epubVersion: '3.0',
    };
    this.persistSlot(id, slot);
    return slot.info;
  }

  /**
   * Rebuild the heavy, derived row metadata on a miss (one directory scan,
   * extensions from the same listing, OPF parse to locate the cover). The
   * cover's resolved path is kept; its bytes are not, so the cache stays
   * memory-flat.
   */
  private async ensureRowMeta(
    id: string,
    pathInfo: WorkspacePathInfo,
    slot: { opfMtime: number; rowMeta?: CachedRowMeta }
  ): Promise<CachedRowMeta> {
    if (slot.rowMeta) return slot.rowMeta;

    const files = await this.fileStorage.listFiles(id);

    let extensionIds: string[] | undefined;
    try {
      // Pass the listing along so extensions don't trigger a second walk.
      const extensions = await this.extensionManager.listWorkspaceExtensions(id, files);
      if (extensions.length > 0) {
        extensionIds = extensions.map(ext => ext.name);
      }
    } catch {
      // Extensions are optional — don't fail the row if they can't be loaded.
    }

    let cover: CachedRowMeta['cover'];
    try {
      const opfPath = pathInfo.rootfilePath;
      const opfXml = await this.fileStorage.readTextFile(id, opfPath);
      const doc = new DOMParser().parseFromString(opfXml, 'application/xml');
      const coverEl = doc.querySelector('[properties~="cover-image"]');
      const href = coverEl?.getAttribute('href');
      const mediaType = coverEl?.getAttribute('media-type') ?? 'image/png';
      if (href) {
        const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));
        cover = { path: `${opfDir}/${href}`, mediaType };
      }
    } catch {
      // Cover image is optional — don't fail the row.
    }

    slot.rowMeta = {
      fileCount: files.length,
      extensionIds,
      readOnly: workspaceIsReadOnly(files),
      cover,
    };
    return slot.rowMeta;
  }

  /**
   * Load the per-row details that are too expensive for the fast list path:
   * file count (directory scan), extension ids, and a small cover thumbnail.
   * Called lazily once a row is rendered.
   */
  async getWorkspaceRowDetails(id: string): Promise<WorkspaceRowDetails> {
    const { pathInfo, slot } = await this.cacheSlot(id);
    const rowMeta = await this.ensureRowMeta(id, pathInfo, slot);

    // Generate the card thumbnail once from the full cover bytes, then serve
    // it from the (persisted) cache. Canvas failure just means no thumbnail.
    if (!slot.thumb && rowMeta.cover) {
      try {
        const buffer = await this.fileStorage.readFile(id, rowMeta.cover.path);
        slot.thumb = await coverThumbDataUrl(buffer, rowMeta.cover.mediaType);
      } catch {
        // Cover missing or not rasterizable — the card shows its fallback icon.
      }
    }

    this.persistSlot(id, slot);

    return {
      fileCount: rowMeta.fileCount,
      extensionIds: rowMeta.extensionIds,
      readOnly: rowMeta.readOnly,
      coverThumbUrl: slot.thumb,
    };
  }

  /**
   * Full-resolution cover bytes for the detail pane and the publish sidecar —
   * the Projects-list cards use the cached thumbnail instead.
   */
  async getWorkspaceCoverImage(
    id: string
  ): Promise<{ buffer: ArrayBuffer; mediaType: string } | null> {
    const { pathInfo, slot } = await this.cacheSlot(id);
    const rowMeta = await this.ensureRowMeta(id, pathInfo, slot);
    if (!rowMeta.cover) return null;
    try {
      const buffer = await this.fileStorage.readFile(id, rowMeta.cover.path);
      return { buffer, mediaType: rowMeta.cover.mediaType };
    } catch {
      return null;
    }
  }

  /**
   * Check if workspace exists
   */
  async workspaceExists(id: string): Promise<boolean> {
    try {
      const workspaces = await this.fileStorage.listWorkspaces();
      return workspaces.includes(id);
    } catch {
      return false;
    }
  }

  /**
   * Load chapter contents for navigation generation
   */
  async loadChapterContents(
    workspace: WorkspaceState,
    chapterIds: string[]
  ): Promise<ChapterContent[]> {
    const chapters: ChapterContent[] = [];

    for (const id of chapterIds) {
      const manifestItem = workspace.opf.manifest.find(item => item.id === id);
      const spineItem = workspace.opf.spine.find(item => item.idref === id);

      if (!manifestItem || !spineItem) continue;

      try {
        const filePath = this.resolveManifestPath(manifestItem.href, workspace.pathInfo.basePath);
        const xhtmlContent = await this.fileStorage.readTextFile(workspace.id, filePath);

        chapters.push({
          id,
          href: manifestItem.href,
          xhtmlContent,
          linear: spineItem.linear ?? true,
          mediaType: manifestItem.mediaType || 'application/xhtml+xml',
        });
      } catch (_error) {
        // Skip missing files
        continue;
      }
    }

    return chapters;
  }

  /**
   * Load all linear chapter contents
   */
  async loadAllLinearChapterContents(workspace: WorkspaceState): Promise<ChapterContent[]> {
    const linearChapterIds = workspace.opf.spine
      .filter(item => item.linear !== false)
      .map(item => item.idref);

    return this.loadChapterContents(workspace, linearChapterIds);
  }

  // Private helper methods

  private generateWorkspaceId(): string {
    return 'workspace-' + randomUUID();
  }

  private async createEPUBStructure(id: string, opf: OPFDocument): Promise<void> {
    // Create mimetype
    await this.fileStorage.writeTextFile(id, 'mimetype', 'application/epub+zip');

    // Create container.xml
    const containerXML = OPFUtils.generateContainerXML();
    await this.fileStorage.writeTextFile(id, 'META-INF/container.xml', containerXML);

    // Create OPF file
    const opfXML = OPFUtils.generateOPFXML(opf);
    await this.fileStorage.writeTextFile(id, 'OEBPS/content.opf', opfXML);
  }

  private async getWorkspacePathInfo(workspaceId: string): Promise<WorkspacePathInfo> {
    // container.xml → rootfilePath never changes for a workspace; serve cached.
    const cached = this.pathInfoCache.get(workspaceId);
    if (cached) return cached;
    try {
      const containerXml = await this.fileStorage.readTextFile(
        workspaceId,
        'META-INF/container.xml'
      );
      const result = OPFUtils.parseContainerXml(containerXml);

      if (result.error) {
        throw new Error(result.error);
      }

      const rootfilePath = result.rootfilePath!;
      const lastSlashIndex = rootfilePath.lastIndexOf('/');

      let pathInfo: WorkspacePathInfo;
      if (lastSlashIndex === -1) {
        pathInfo = { rootfilePath, basePath: '', opfFileName: rootfilePath };
      } else {
        const basePath = rootfilePath.substring(0, lastSlashIndex);
        const opfFileName = rootfilePath.substring(lastSlashIndex + 1);
        pathInfo = { rootfilePath, basePath, opfFileName };
      }

      this.pathInfoCache.set(workspaceId, pathInfo);
      return pathInfo;
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to parse workspace container.xml: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_CONTAINER_STRUCTURE',
        workspaceId
      );
    }
  }

  private validateMetadataUpdates(updates: Partial<EPUBMetadata>): void {
    // Validate required fields
    if (updates.title !== undefined && updates.title.trim() === '') {
      throw new ValidationError('Title cannot be empty');
    }

    // Language tags are NOT hard-validated here: the editor persists in-progress
    // tags and surfaces malformed ones as inline errors (see MetadataService
    // validateMetadata). Blocking the save would revert the user's input.
  }

  private addScriptedPropertiesToChapters(workspace: WorkspaceState): WorkspaceState {
    const hasJavaScript = workspace.opf.manifest.some(
      item => item.mediaType === 'text/javascript' || item.mediaType === 'application/javascript'
    );

    const updatedManifest = workspace.opf.manifest.map(item => {
      // Only update chapter items (XHTML but NOT nav)
      if (
        item.mediaType === 'application/xhtml+xml' &&
        item.id !== 'nav' &&
        !item.properties?.includes('nav')
      ) {
        const properties = item.properties || [];
        const hasScripted = properties.includes('scripted');

        if (hasJavaScript && !hasScripted) {
          // Add scripted property
          return { ...item, properties: [...properties, 'scripted'] };
        } else if (!hasJavaScript && hasScripted) {
          // Remove scripted property
          const filteredProperties = properties.filter(p => p !== 'scripted');
          return {
            ...item,
            properties: filteredProperties.length > 0 ? filteredProperties : undefined,
          };
        }
      }
      return item;
    });

    return {
      ...workspace,
      opf: {
        ...workspace.opf,
        manifest: updatedManifest,
      },
    };
  }

  private generateManifestId(href: string, existingIds: Set<string>): string {
    // Extract base name from href
    const fileName = href.split('/').pop() || 'item';
    const baseName = fileName.replace(/\.[^.]+$/, ''); // Remove extension

    // Sanitize for XML ID requirements
    const sanitized = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/^[^a-zA-Z]/, 'item-') // Ensure starts with letter
      .toLowerCase();

    // Ensure uniqueness
    let id = sanitized;
    let counter = 1;
    while (existingIds.has(id)) {
      id = `${sanitized}-${counter++}`;
    }

    return id;
  }

  private detectMediaType(href: string): string {
    const extension = href.split('.').pop()?.toLowerCase() || '';

    const mediaTypeMap: Record<string, string> = {
      xhtml: 'application/xhtml+xml',
      html: 'application/xhtml+xml',
      css: 'text/css',
      js: 'application/javascript',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      ttf: 'font/ttf',
      otf: 'font/otf',
      woff: 'font/woff',
      woff2: 'font/woff2',
    };

    return mediaTypeMap[extension] || 'application/octet-stream';
  }

  private resolveManifestPath(href: string, basePath: string): string {
    if (!basePath || href.startsWith(basePath + '/')) {
      return href;
    }
    return `${basePath}/${href}`;
  }

  /**
   * Check if a file exists in the workspace
   */
  async fileExists(workspaceId: string, filePath: string): Promise<boolean> {
    try {
      await this.fileStorage.readFile(workspaceId, filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rename a file in the workspace
   */
  async renameFile(workspaceId: string, oldPath: string, newPath: string): Promise<void> {
    await this.fileStorage.renameFile(workspaceId, oldPath, newPath);
  }

  /**
   * Read a file from the workspace
   */
  async readFile(workspaceId: string, filePath: string): Promise<ArrayBuffer> {
    try {
      return await this.fileStorage.readFile(workspaceId, filePath);
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'READ_FILE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Cache hygiene for direct file writes: overwriting the bytes at the cached
   * cover path (e.g. an overwrite-import of the cover image) must drop the
   * cached thumbnail, since neither the OPF mtime nor the cover path changes.
   * Other writes (chapter text, SOURCE files) stay cache-neutral.
   */
  private noteFileWritten(workspaceId: string, filePath: string): void {
    const slot = this.summaryCache.get(workspaceId);
    if (slot?.rowMeta?.cover?.path === filePath) {
      slot.rowMeta = undefined;
      slot.thumb = undefined;
      removeEntry(workspaceId);
    }
  }

  /**
   * Write a file to the workspace
   */
  async writeFile(workspaceId: string, filePath: string, content: string): Promise<void> {
    try {
      // Track changes: snapshot the pre-edit version of trackable content the first
      // time it's actually changed in review mode (no-op otherwise).
      await captureBaseIfNeeded(this.fileStorage, workspaceId, filePath, content);

      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(content);
      // Create a proper ArrayBuffer from the Uint8Array
      const contentBuffer = new ArrayBuffer(uint8Array.length);
      new Uint8Array(contentBuffer).set(uint8Array);
      await this.fileStorage.writeFile(workspaceId, filePath, contentBuffer);
      this.noteFileWritten(workspaceId, filePath);
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WRITE_FILE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Write a binary file to the workspace
   */
  async writeBinaryFile(
    workspaceId: string,
    filePath: string,
    content: ArrayBuffer
  ): Promise<void> {
    try {
      await this.fileStorage.writeFile(workspaceId, filePath, content);
      this.noteFileWritten(workspaceId, filePath);
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to write binary file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WRITE_BINARY_FILE_ERROR',
        workspaceId
      );
    }
  }

  /**
   * List SOURCE files in the workspace for manifest display
   */
  async listSourceFiles(workspace: WorkspaceState): Promise<SourceItem[]> {
    try {
      // Get all files in workspace
      const allFiles = await this.fileStorage.listFiles(workspace.id);

      // Filter for SOURCE files and exclude .gitkeep files
      const sourceFiles = allFiles
        .filter(path => isSourceFile(path))
        .filter(path => !path.endsWith('.gitkeep'));

      const sourceItems: SourceItem[] = [];

      // Create SourceItem objects with metadata
      for (const filePath of sourceFiles) {
        try {
          // Get file size
          const fileInfo = await this.fileStorage.getFileInfo(workspace.id, filePath);

          const sourceItem: SourceItem = {
            path: filePath,
            name: filePath.split('/').pop() || filePath,
            type: 'file',
            size: fileInfo.size,
            modified: fileInfo.lastModified,
            mediaType: this.detectMediaTypeForSource(filePath),
          };

          sourceItems.push(sourceItem);
        } catch {
          // Skip files that can't be accessed (but continue processing others)
          continue;
        }
      }

      return sourceItems;
    } catch (error) {
      throw new WorkspaceServiceError(
        `Failed to list SOURCE files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_SOURCE_FILES_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Delete a transform-created data file under SOURCE/data/. Scoped to exactly
   * the area transform scripts may write (see resolveSourceWritePath / the ctx
   * broker), so chapter text, settings.json, transform scripts and extensions
   * can't be removed through this path. SOURCE/ files aren't in the OPF manifest,
   * so this touches storage only and leaves content.opf untouched.
   */
  async deleteSourceFile(workspace: WorkspaceState, path: string): Promise<void> {
    const safePath = resolveSourceWritePath(path);
    if (!safePath) {
      throw new WorkspaceServiceError(
        `Refusing to delete file outside SOURCE/data/: ${path}`,
        'INVALID_SOURCE_DELETE',
        workspace.id
      );
    }
    await this.fileStorage.deleteFile(workspace.id, safePath);
  }

  /**
   * Detect media type for SOURCE files
   */
  private detectMediaTypeForSource(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const sourceFileType = classifySourceFile(filePath);

    // Use SOURCE-specific media type detection
    const mediaTypeMap: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      js: 'application/javascript',
      ts: 'application/typescript',
      css: 'text/css',
      html: 'text/html',
      xhtml: 'application/xhtml+xml',
      xml: 'application/xml',
      py: 'text/x-python',
      sh: 'application/x-sh',
    };

    // For script files, use more specific types
    if (sourceFileType === 'script') {
      return mediaTypeMap[extension] || 'text/plain';
    }

    return mediaTypeMap[extension] || 'text/plain';
  }

  /**
   * Get file information (size and modification date)
   */
  async getFileInfo(
    workspaceId: string,
    path: string
  ): Promise<{ size: number; lastModified: Date }> {
    return await this.fileStorage.getFileInfo(workspaceId, path);
  }
}
