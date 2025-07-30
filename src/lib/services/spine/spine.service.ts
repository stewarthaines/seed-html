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

// Re-export existing SpineItemWithSource type for compatibility
export type { SpineItemWithSource } from '../../spine/types.js';

export interface ChapterCreationOptions {
  title: string;
  linear?: boolean;
  createSourceFile?: boolean;
  insertIndex?: number;
}

// Service error types
export class SpineServiceError extends Error {
  constructor(message: string, public code: string, public workspaceId?: string) {
    super(message);
    this.name = 'SpineServiceError';
  }
}

/**
 * SpineService - Single responsibility for EPUB spine management
 */
export class SpineService {
  constructor(
    private workspaceService: WorkspaceService
  ) {}

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
          hasSourceFile
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
   * Add a new chapter to workspace state
   */
  async addChapter(workspace: WorkspaceState, options: ChapterCreationOptions): Promise<{ updatedWorkspace: WorkspaceState; newChapter: SpineItemWithSource }> {
    try {
      // Generate unique ID for the chapter
      const chapterId = this.generateUniqueChapterId(workspace);
      const href = `Text/${chapterId}.xhtml`;

      // Create manifest item
      const manifestItem: ManifestItem = {
        id: chapterId,
        href,
        mediaType: 'application/xhtml+xml'
      };

      // Add to manifest
      let updatedWorkspace = await this.workspaceService.addManifestItem(workspace, manifestItem);

      // Create spine item
      const spineItem: SpineItem = {
        idref: chapterId,
        linear: options.linear ?? true
      };

      // Add to spine
      updatedWorkspace = await this.workspaceService.addSpineItem(updatedWorkspace, spineItem, options.insertIndex);

      // Create XHTML file
      const xhtmlContent = this.generateChapterXHTML(options.title);
      await this.workspaceService.writeFile(workspace.id, href, xhtmlContent);

      // Create source file if requested
      let hasSourceFile = false;
      let sourceFilePath: string | undefined;
      
      if (options.createSourceFile) {
        sourceFilePath = `SOURCE/text/${chapterId}.txt`;
        const sourceContent = `# ${options.title}\n\nYour chapter content goes here...`;
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
        hasSourceFile
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
  async moveChapterUp(workspace: WorkspaceState, chapterIndex: number): Promise<{ updatedWorkspace: WorkspaceState; newOrder: SpineItemWithSource[] }> {
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
      [newOrder[chapterIndex - 1], newOrder[chapterIndex]] = [newOrder[chapterIndex], newOrder[chapterIndex - 1]];

      // Update spine order
      const updatedWorkspace = await this.workspaceService.updateSpineOrder(workspace, newOrder.map(item => item.id));

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
  async moveChapterDown(workspace: WorkspaceState, chapterIndex: number): Promise<{ updatedWorkspace: WorkspaceState; newOrder: SpineItemWithSource[] }> {
    try {
      const spineItems = await this.loadSpineItems(workspace);
      
      if (chapterIndex < 0 || chapterIndex >= spineItems.length - 1) {
        throw new SpineServiceError('Cannot move last chapter down', 'INVALID_MOVE', workspace.id);
      }

      // Create new order by swapping items
      const newOrder = [...spineItems];
      [newOrder[chapterIndex], newOrder[chapterIndex + 1]] = [newOrder[chapterIndex + 1], newOrder[chapterIndex]];

      // Update spine order
      const updatedWorkspace = await this.workspaceService.updateSpineOrder(workspace, newOrder.map(item => item.id));

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
  async reorderItems(workspace: WorkspaceState, fromIndex: number, toIndex: number): Promise<{ updatedWorkspace: WorkspaceState; newOrder: SpineItemWithSource[] }> {
    try {
      const spineItems = await this.loadSpineItems(workspace);
      
      if (fromIndex < 0 || fromIndex >= spineItems.length || toIndex < 0 || toIndex >= spineItems.length) {
        throw new SpineServiceError('Invalid reorder indices', 'INVALID_INDEX', workspace.id);
      }

      // Create new order by moving item
      const newOrder = [...spineItems];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);

      // Update spine order using WorkspaceService
      const updatedWorkspace = await this.workspaceService.updateSpineOrder(workspace, newOrder.map(item => item.id));

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
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
    <title>${title}</title>
    <link rel="stylesheet" type="text/css" href="../Styles/styles.css"/>
</head>
<body>
    <section class="chapter">
        <h1>${title}</h1>
        <p>Your chapter content goes here...</p>
    </section>
</body>
</html>`;
  }
}