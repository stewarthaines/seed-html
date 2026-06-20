/**
 * SpineService - Clean Service Architecture Implementation
 *
 * Manages EPUB spine items (chapters) with high-level operations for component usage.
 * Operates on cached WorkspaceState from AppState to avoid redundant loads.
 * Built on WorkspaceService for atomic operations and proper validation.
 */

import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';
import type { SpineItem, ManifestItem } from '../../epub/opf-utils.js';
import type { SpineItemWithSource } from '../../spine/types.js';
import { translate } from '$lib/i18n/index.js';

// Re-export existing SpineItemWithSource type for compatibility
export type { SpineItemWithSource } from '../../spine/types.js';

export interface ChapterCreationOptions {
  title: string;
  linear?: boolean;
  createSourceFile?: boolean;
  insertIndex?: number;
  /** Derive the chapter id/idref from this name (e.g. an uploaded filename)
   * instead of the auto-numbered chapterNN. Sanitized and made unique. */
  baseName?: string;
  /** Initial plain-text source for the chapter (e.g. an uploaded file's text).
   * Written to the SOURCE file and rendered into the chapter XHTML. */
  sourceText?: string;
}

// Service error types
export class SpineServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public workspaceId?: string
  ) {
    super(message);
    this.name = 'SpineServiceError';
  }
}

/**
 * SpineService - Single responsibility for EPUB spine management
 */
export class SpineService {
  constructor(private workspaceService: WorkspaceService) {}

  /**
   * Load spine items with source file information from cached workspace state
   */
  async loadSpineItems(workspace: WorkspaceState): Promise<SpineItemWithSource[]> {
    try {
      const spineItems: SpineItemWithSource[] = [];

      for (const spineItem of workspace.opf.spine) {
        const manifestItem = workspace.opf.manifest.find(item => item.id === spineItem.idref);
        if (!manifestItem) continue;

        // Check for source file existence
        const sourceFilePath = `SOURCE/text/${manifestItem.id}.txt`;
        const hasSourceFile = await this.workspaceService.fileExists(workspace.id, sourceFilePath);

        // A source-less chapter (regular/read-only EPUB) has no editable source to
        // label it; read its stored XHTML <title> so the sidebar can show a real
        // name. Editable chapters always have a source, so this never runs for them.
        const title = hasSourceFile
          ? undefined
          : await this.readStoredChapterTitle(workspace, manifestItem);

        spineItems.push({
          // Spine item properties
          idref: manifestItem.id,
          linear: spineItem.linear ?? true,

          // Manifest item properties
          id: manifestItem.id,
          href: manifestItem.href,
          mediaType: manifestItem.mediaType,

          // Source file association
          sourcePath: hasSourceFile ? sourceFilePath : undefined,
          hasSourceFile,
          title,
        });
      }

      return spineItems;
    } catch (error) {
      throw new SpineServiceError(
        `Failed to load spine items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Read a chapter's stored XHTML and extract a human title (`<title>`, falling
   * back to the first heading). Best-effort: returns undefined on any failure.
   */
  private async readStoredChapterTitle(
    workspace: WorkspaceState,
    manifestItem: ManifestItem
  ): Promise<string | undefined> {
    try {
      const basePath = workspace.pathInfo.basePath;
      const path =
        !basePath || manifestItem.href.startsWith(basePath + '/')
          ? manifestItem.href
          : `${basePath}/${manifestItem.href}`;
      const buffer = await this.workspaceService.readFile(workspace.id, path);
      const xhtml = new TextDecoder().decode(buffer);
      // Parse as HTML (lenient) — we only need the title/heading text, and this
      // avoids strict-XML namespace pitfalls.
      const doc = new DOMParser().parseFromString(xhtml, 'text/html');
      const fromTitle = doc.querySelector('title')?.textContent?.trim();
      if (fromTitle) return fromTitle;
      for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        const heading = doc.querySelector(tag)?.textContent?.trim();
        if (heading) return heading;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Add a new chapter to workspace state
   */
  async addChapter(
    workspace: WorkspaceState,
    options: ChapterCreationOptions
  ): Promise<{ updatedWorkspace: WorkspaceState; newChapter: SpineItemWithSource }> {
    try {
      // Generate a unique chapter id — from the supplied base name (e.g. an
      // uploaded filename) when given, otherwise auto-numbered.
      const chapterId = options.baseName
        ? this.chapterIdFromName(
            options.baseName,
            new Set(workspace.opf.manifest.map(item => item.id))
          )
        : this.generateUniqueChapterId(workspace);
      const href = `Text/${chapterId}.xhtml`;

      // Create manifest item
      const manifestItem: ManifestItem = {
        id: chapterId,
        href,
        mediaType: 'application/xhtml+xml',
      };

      // Add to manifest
      let updatedWorkspace = await this.workspaceService.addManifestItem(workspace, manifestItem);

      // Create spine item
      const spineItem: SpineItem = {
        idref: chapterId,
        linear: options.linear ?? true,
      };

      // Add to spine
      updatedWorkspace = await this.workspaceService.addSpineItem(
        updatedWorkspace,
        spineItem,
        options.insertIndex
      );

      // Create XHTML file (render the supplied source text when present).
      const xhtmlContent =
        options.sourceText !== undefined
          ? this.generateChapterXHTMLFromText(options.title, options.sourceText)
          : this.generateChapterXHTML(options.title);
      await this.workspaceService.writeFile(workspace.id, href, xhtmlContent);

      // Create source file if requested
      let hasSourceFile = false;
      let sourceFilePath: string | undefined;

      if (options.createSourceFile) {
        sourceFilePath = `SOURCE/text/${chapterId}.txt`;
        const sourceContent = options.sourceText ?? translate('Your chapter content goes here...');
        await this.workspaceService.writeFile(workspace.id, sourceFilePath, sourceContent);
        hasSourceFile = true;
      }

      const newChapter: SpineItemWithSource = {
        // Spine item properties
        idref: chapterId,
        linear: options.linear ?? true,

        // Manifest item properties
        id: chapterId,
        href,
        mediaType: 'application/xhtml+xml',

        // Source file association
        sourcePath: hasSourceFile ? sourceFilePath : undefined,
        hasSourceFile,
      };

      return { updatedWorkspace, newChapter };
    } catch (error) {
      throw new SpineServiceError(
        `Failed to add chapter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ADD_CHAPTER_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Move chapter up in spine order
   */
  async moveChapterUp(
    workspace: WorkspaceState,
    chapterIndex: number
  ): Promise<{ updatedWorkspace: WorkspaceState; newOrder: SpineItemWithSource[] }> {
    try {
      if (chapterIndex <= 0) {
        throw new SpineServiceError('Cannot move first chapter up', 'INVALID_MOVE', workspace.id);
      }

      const spineItems = await this.loadSpineItems(workspace);

      if (chapterIndex >= spineItems.length) {
        throw new SpineServiceError('Invalid chapter index', 'INVALID_INDEX', workspace.id);
      }

      // Create new order by swapping items
      const newOrder = [...spineItems];
      [newOrder[chapterIndex - 1], newOrder[chapterIndex]] = [
        newOrder[chapterIndex],
        newOrder[chapterIndex - 1],
      ];

      // Update spine order
      const updatedWorkspace = await this.workspaceService.updateSpineOrder(
        workspace,
        newOrder.map(item => item.id)
      );

      return { updatedWorkspace, newOrder };
    } catch (error) {
      if (error instanceof SpineServiceError) {
        throw error;
      }
      throw new SpineServiceError(
        `Failed to move chapter up: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MOVE_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Move chapter down in spine order
   */
  async moveChapterDown(
    workspace: WorkspaceState,
    chapterIndex: number
  ): Promise<{ updatedWorkspace: WorkspaceState; newOrder: SpineItemWithSource[] }> {
    try {
      const spineItems = await this.loadSpineItems(workspace);

      if (chapterIndex < 0 || chapterIndex >= spineItems.length - 1) {
        throw new SpineServiceError('Cannot move last chapter down', 'INVALID_MOVE', workspace.id);
      }

      // Create new order by swapping items
      const newOrder = [...spineItems];
      [newOrder[chapterIndex], newOrder[chapterIndex + 1]] = [
        newOrder[chapterIndex + 1],
        newOrder[chapterIndex],
      ];

      // Update spine order
      const updatedWorkspace = await this.workspaceService.updateSpineOrder(
        workspace,
        newOrder.map(item => item.id)
      );

      return { updatedWorkspace, newOrder };
    } catch (error) {
      if (error instanceof SpineServiceError) {
        throw error;
      }
      throw new SpineServiceError(
        `Failed to move chapter down: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MOVE_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Reorder spine items by moving an item from one index to another
   */
  async reorderItems(
    workspace: WorkspaceState,
    fromIndex: number,
    toIndex: number
  ): Promise<{ updatedWorkspace: WorkspaceState; newOrder: SpineItemWithSource[] }> {
    try {
      const spineItems = await this.loadSpineItems(workspace);

      if (
        fromIndex < 0 ||
        fromIndex >= spineItems.length ||
        toIndex < 0 ||
        toIndex >= spineItems.length
      ) {
        throw new SpineServiceError('Invalid reorder indices', 'INVALID_INDEX', workspace.id);
      }

      // Create new order by moving item
      const newOrder = [...spineItems];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);

      // Update spine order using WorkspaceService
      const updatedWorkspace = await this.workspaceService.updateSpineOrder(
        workspace,
        newOrder.map(item => item.id)
      );

      return { updatedWorkspace, newOrder };
    } catch (error) {
      if (error instanceof SpineServiceError) {
        throw error;
      }
      throw new SpineServiceError(
        `Failed to reorder items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REORDER_ERROR',
        workspace.id
      );
    }
  }

  // Private helper methods

  /** Derive an XML-safe, unique chapter id from a name (e.g. a filename). */
  private chapterIdFromName(name: string, existingIds: Set<string>): string {
    const sanitized =
      name
        .replace(/\.[^.]+$/, '') // drop extension
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/^[^a-zA-Z]/, 'item-') // ids must start with a letter
        .toLowerCase() || 'chapter';

    let id = sanitized;
    let counter = 1;
    while (existingIds.has(id)) {
      id = `${sanitized}-${counter++}`;
    }
    return id;
  }

  private generateUniqueChapterId(workspace: WorkspaceState): string {
    const existingIds = new Set(workspace.opf.manifest.map(item => item.id));
    let counter = 1;
    let id = `chapter${counter.toString().padStart(2, '0')}`;

    while (existingIds.has(id)) {
      counter++;
      id = `chapter${counter.toString().padStart(2, '0')}`;
    }

    return id;
  }

  private generateChapterXHTML(title: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
    <title>${title}</title>
    <link rel="stylesheet" type="text/css" href="../Styles/styles.css"/>
</head>
<body>
    <main role="main">
        <section class="chapter">
            <h1>${title}</h1>
            <p>Your chapter content goes here...</p>
        </section>
    </main>
</body>
</html>`;
  }

  /** Render plain text into chapter XHTML: blank-line-separated paragraphs. */
  private generateChapterXHTMLFromText(title: string, text: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const body =
      text
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean)
        .map(block => `        <p>${esc(block).replace(/\n/g, '<br />')}</p>`)
        .join('\n') || '        <p></p>';

    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
    <title>${esc(title)}</title>
    <link rel="stylesheet" type="text/css" href="../Styles/styles.css"/>
</head>
<body>
    <main role="main">
        <section class="chapter">
${body}
        </section>
    </main>
</body>
</html>`;
  }

  /**
   * Delete a chapter with coordinated removal from manifest, spine, and files
   */
  async deleteChapter(
    workspace: WorkspaceState,
    chapterId: string
  ): Promise<{ updatedWorkspace: WorkspaceState }> {
    try {
      // Find the chapter in the spine
      const chapterIndex = workspace.opf.spine.findIndex(item => item.idref === chapterId);
      if (chapterIndex === -1) {
        throw new SpineServiceError(
          'Chapter not found in spine',
          'CHAPTER_NOT_FOUND',
          workspace.id
        );
      }

      // Find the manifest item
      const manifestIndex = workspace.opf.manifest.findIndex(item => item.id === chapterId);
      if (manifestIndex === -1) {
        throw new SpineServiceError(
          'Chapter not found in manifest',
          'MANIFEST_ITEM_NOT_FOUND',
          workspace.id
        );
      }

      const manifestItem = workspace.opf.manifest[manifestIndex];

      // Create updated workspace state
      const updatedWorkspace: WorkspaceState = {
        ...workspace,
        opf: {
          ...workspace.opf,
          spine: workspace.opf.spine.filter(item => item.idref !== chapterId),
          manifest: workspace.opf.manifest.filter(item => item.id !== chapterId),
        },
      };

      // Save updated workspace (this will update the OPF automatically)
      await this.workspaceService.saveWorkspace(updatedWorkspace);

      // Delete associated files using the file storage API directly
      try {
        // Delete XHTML file
        const xhtmlPath = manifestItem.href.startsWith(workspace.pathInfo.basePath)
          ? manifestItem.href
          : `${workspace.pathInfo.basePath}/${manifestItem.href}`;
        const fileStorage = (this.workspaceService as any).fileStorage;
        await fileStorage.deleteFile(updatedWorkspace.id, xhtmlPath);
      } catch (error) {
        console.warn('Failed to delete XHTML file:', error);
      }

      try {
        // Delete the source text file and its metadata sidecar (SOURCE/text/{id}.{txt,json})
        const fileStorage = (this.workspaceService as any).fileStorage;
        await fileStorage.deleteFile(updatedWorkspace.id, `SOURCE/text/${chapterId}.txt`);
        const metaPath = `SOURCE/text/${chapterId}.json`;
        if (await this.workspaceService.fileExists(updatedWorkspace.id, metaPath)) {
          await fileStorage.deleteFile(updatedWorkspace.id, metaPath);
        }
      } catch (error) {
        console.warn('Failed to delete chapter source files:', error);
      }

      return { updatedWorkspace };
    } catch (error) {
      if (error instanceof SpineServiceError) {
        throw error;
      }
      throw new SpineServiceError(
        `Failed to delete chapter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Rename a chapter ID with coordinated updates across manifest, spine, and files
   */
  async renameChapterId(
    workspace: WorkspaceState,
    oldId: string,
    newId: string
  ): Promise<{ updatedWorkspace: WorkspaceState }> {
    try {
      // Validate new ID format (XML NCName)
      if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(newId)) {
        throw new SpineServiceError(
          'Invalid ID format. ID must start with a letter or underscore and contain only letters, numbers, hyphens, periods, and underscores.',
          'INVALID_ID_FORMAT',
          workspace.id
        );
      }

      // Check for duplicate
      if (workspace.opf.manifest.some(item => item.id === newId)) {
        throw new SpineServiceError(`ID '${newId}' already exists`, 'DUPLICATE_ID', workspace.id);
      }

      // Get the manifest item
      const manifestItem = workspace.opf.manifest.find(item => item.id === oldId);
      if (!manifestItem) {
        throw new SpineServiceError(
          `Item with ID '${oldId}' not found`,
          'ITEM_NOT_FOUND',
          workspace.id
        );
      }

      // Calculate new href (replace oldId with newId in the path)
      const newHref = manifestItem.href.replace(oldId, newId);

      // Update manifest item (ID and href) - this also updates spine references
      let updatedWorkspace = await this.workspaceService.updateManifestItem(workspace, oldId, {
        id: newId,
        href: newHref,
      });

      // Rename source text file if it exists
      const oldSourcePath = `SOURCE/text/${oldId}.txt`;
      const newSourcePath = `SOURCE/text/${newId}.txt`;

      if (await this.workspaceService.fileExists(workspace.id, oldSourcePath)) {
        await this.workspaceService.renameFile(workspace.id, oldSourcePath, newSourcePath);
      }

      // Rename the per-chapter metadata sidecar alongside the source, if present
      const oldMetaPath = `SOURCE/text/${oldId}.json`;
      const newMetaPath = `SOURCE/text/${newId}.json`;
      if (await this.workspaceService.fileExists(workspace.id, oldMetaPath)) {
        await this.workspaceService.renameFile(workspace.id, oldMetaPath, newMetaPath);
      }

      return { updatedWorkspace };
    } catch (error) {
      throw new SpineServiceError(
        `Failed to rename chapter ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RENAME_ERROR',
        workspace.id
      );
    }
  }

  /**
   * Set a chapter's `linear` reading-order flag. `linear="no"` keeps the item in
   * the book but outside the default reading order (covers, pop-up notes, etc.).
   */
  async setChapterLinear(
    workspace: WorkspaceState,
    idref: string,
    linear: boolean
  ): Promise<{ updatedWorkspace: WorkspaceState }> {
    try {
      const updatedWorkspace = await this.workspaceService.updateSpineItem(workspace, idref, {
        linear,
      });
      return { updatedWorkspace };
    } catch (error) {
      throw new SpineServiceError(
        `Failed to update linear flag: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_LINEAR_ERROR',
        workspace.id
      );
    }
  }
}
