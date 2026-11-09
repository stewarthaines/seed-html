/**
 * The host side of the `add-media` plugin message: a file a plugin made (a
 * recorded audio clip, a drawn place map) joins the open book's manifest
 * through the same import path as a dropped file. Manifest writes stay with
 * the host, so the caller hands the returned workspace to onWorkspaceUpdate.
 */
import type { WorkspaceService, WorkspaceState } from '$lib/services/workspace/workspace.service.js';
import { importFileToManifest, type ImportedMediaFile } from '$lib/import/import-media.js';

/** Image types a plugin may add: the place-maps plugin's SVG maps, or PNG. */
const PLUGIN_IMAGE_TYPES = new Set(['image/svg+xml', 'image/png']);

/** Media types a plugin may add: audio (recording) and SVG or PNG images (maps). */
export function isPluginMediaTypeAllowed(mediaType: string): boolean {
  return mediaType.startsWith('audio/') || PLUGIN_IMAGE_TYPES.has(mediaType);
}

/** The last path segment, so a plugin cannot aim the file outside the media folder. */
export function pluginMediaFilename(filename: string): string {
  return filename.split(/[\\/]/).pop()?.trim() ?? '';
}

/**
 * The one subfolder a plugin may ask for inside its media type's folder
 * (`Images/maps/`): a single plain segment, or '' for none. Anything with a
 * separator, a dot or other characters is refused rather than cleaned up, so
 * a plugin cannot aim outside the media folder.
 */
export function pluginMediaFolder(folder: string | undefined): string {
  const value = (folder ?? '').trim();
  if (!value) return '';
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`Not a folder name: ${value}`);
  return value;
}

export interface PluginMediaRequest {
  filename: string;
  mediaType: string;
  bytes: ArrayBuffer;
  /** Optional subfolder inside the media type's folder, e.g. 'maps'. */
  folder?: string;
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
    throw new Error(`Plugins can only add audio, SVG or PNG files, not ${request.mediaType}`);
  }
  const name = pluginMediaFilename(request.filename);
  if (!name) throw new Error('The file has no name');
  if (request.bytes.byteLength === 0) throw new Error('The file is empty');
  const folder = pluginMediaFolder(request.folder);
  const file = new File([request.bytes], name, { type: request.mediaType });
  return importFile(workspace, workspaceService, file, request.mediaType, folder || undefined);
}
