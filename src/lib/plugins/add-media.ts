/**
 * The host side of the `add-media` plugin message: a file a plugin made (a
 * recorded audio clip) joins the open book's manifest through the same import
 * path as a dropped file. Manifest writes stay with the host, so the caller
 * hands the returned workspace to onWorkspaceUpdate.
 */
import type { WorkspaceService, WorkspaceState } from '$lib/services/workspace/workspace.service.js';
import { importFileToManifest, type ImportedMediaFile } from '$lib/import/import-media.js';

/** Media types a plugin may add. Audio only, for recording. */
export function isPluginMediaTypeAllowed(mediaType: string): boolean {
  return mediaType.startsWith('audio/');
}

/** The last path segment, so a plugin cannot aim the file outside the media folder. */
export function pluginMediaFilename(filename: string): string {
  return filename.split(/[\\/]/).pop()?.trim() ?? '';
}

export interface PluginMediaRequest {
  filename: string;
  mediaType: string;
  bytes: ArrayBuffer;
}

/**
 * Add a plugin's file to the manifest. Throws, with a message for the plugin,
 * when the media type is not allowed or the file is empty or unnamed.
 */
export async function addPluginMedia(
  request: PluginMediaRequest,
  workspace: WorkspaceState,
  workspaceService: WorkspaceService,
  importFile: typeof importFileToManifest = importFileToManifest
): Promise<ImportedMediaFile> {
  if (!isPluginMediaTypeAllowed(request.mediaType)) {
    throw new Error(`Plugins can only add audio files, not ${request.mediaType}`);
  }
  const name = pluginMediaFilename(request.filename);
  if (!name) throw new Error('The file has no name');
  if (request.bytes.byteLength === 0) throw new Error('The file is empty');
  const file = new File([request.bytes], name, { type: request.mediaType });
  return importFile(workspace, workspaceService, file, request.mediaType);
}
