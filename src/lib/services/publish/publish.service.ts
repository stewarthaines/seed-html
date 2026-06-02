/**
 * Publish Service
 *
 * Reads packaged .epub files from the shared publish output directory
 * (the reserved 'publish' workspace) so the Publish view can list and
 * download them. This is the plugin-free core feature; the publish plugin
 * later layers remote storage on top.
 */

import type { FileStorageAPI } from '../../storage/index.js';
import { PUBLISH_WORKSPACE_ID } from '../../workspace/types.js';

export interface PublishedEpub {
  filename: string;
  size: number;
  lastModified: Date;
}

export class PublishService {
  constructor(private fileStorage: FileStorageAPI) {}

  /**
   * List the packaged .epub files in the publish output directory, with size
   * and last-modified metadata.
   */
  async listPublishedEpubs(): Promise<PublishedEpub[]> {
    const filenames = await this.fileStorage.listFiles(PUBLISH_WORKSPACE_ID);

    const epubs: PublishedEpub[] = [];
    for (const filename of filenames) {
      if (!filename.toLowerCase().endsWith('.epub')) continue;
      const info = await this.fileStorage.getFileInfo(PUBLISH_WORKSPACE_ID, filename);
      epubs.push({ filename, size: info.size, lastModified: info.lastModified });
    }
    return epubs;
  }

  /**
   * Read a published epub from the output directory as a Blob, ready to download.
   */
  async getPublishedEpubBlob(filename: string): Promise<Blob> {
    const content = await this.fileStorage.readFile(PUBLISH_WORKSPACE_ID, filename);
    return new Blob([content], { type: 'application/epub+zip' });
  }

  /**
   * Delete a published epub from the output directory.
   */
  async deletePublishedEpub(filename: string): Promise<void> {
    await this.fileStorage.deleteFile(PUBLISH_WORKSPACE_ID, filename);
  }

  /**
   * Live OPFS handle for the shared output directory, handed to the publish
   * plugin in its `init` message. Null when OPFS isn't the active backend (the
   * plugin can't operate, so the core feature is used instead).
   */
  async getOutputDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    return this.fileStorage.getWorkspaceDirectoryHandle(PUBLISH_WORKSPACE_ID);
  }
}
