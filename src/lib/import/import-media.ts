/**
 * Shared media-file import: one file in, one manifest item + written content
 * out. Extracted from ManifestContainer's upload path so the chapter editor's
 * drag-and-drop can import through the identical pipeline (media-type
 * detection, EPUB-safe pathing, collision auto-rename via unique-href
 * suffixing, manifest rollback when the content write fails).
 *
 * Also home to the snippet formatting for drop-to-insert: the plain-text
 * representation of a dropped media item, driven by the per-project template
 * settings (image_template / video_template — audio uses the existing
 * audio_clip_template via AudioClipService).
 */

import type { WorkspaceService, WorkspaceState } from '../services/workspace/workspace.service.js';
import { ManifestUtils } from '../manifest/utils.js';
import { generateEPUBPath, ensureUniqueHref } from '../epub/opf-utils.js';
import { manifestHrefToPath } from '../epub/path-utils.js';
import { manifestCollision } from './collision.js';

/**
 * Reliable media type for an incoming File: browsers misreport fonts and
 * JavaScript, so prefer filename detection for those (and whenever the browser
 * type is generic). Mirrors ManifestContainer's rule.
 */
export function reliableMediaType(file: File): string {
  const browserType = file.type;
  const filenameType = ManifestUtils.detectMediaType(file.name);
  const isGeneric = !browserType || browserType === 'application/octet-stream';
  const isFontFile = filenameType.startsWith('font/');
  const isJavaScriptFile =
    filenameType === 'application/javascript' || filenameType === 'text/javascript';
  return isGeneric || isFontFile || isJavaScriptFile ? filenameType : browserType;
}

const isTextLike = (mediaType: string): boolean =>
  mediaType.startsWith('text/') || mediaType.includes('json') || mediaType.includes('xml');

const resolvePath = (workspace: WorkspaceState, href: string): string =>
  manifestHrefToPath(workspace.pathInfo.basePath, href);

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
};

export interface ManifestCollisionInfo {
  /** The manifest href the incoming file collides with. */
  existingHref: string;
  /** True when the incoming bytes match the existing content — a no-op import. */
  identical: boolean;
}

/**
 * Would this file collide with an existing manifest item, and if so, is it the
 * same content? A name collision is only a real conflict when the bytes differ;
 * an identical upload is a no-op (the caller can just reference `existingHref`).
 */
export async function analyzeManifestCollision(
  workspace: WorkspaceState,
  workspaceService: WorkspaceService,
  file: File,
  mediaType: string = reliableMediaType(file)
): Promise<ManifestCollisionInfo | null> {
  const existingHref = manifestCollision(file.name, mediaType, workspace);
  if (!existingHref) return null;
  let identical = false;
  try {
    const existing = new Uint8Array(
      await workspaceService.readFile(workspace.id, resolvePath(workspace, existingHref))
    );
    identical = bytesEqual(existing, new Uint8Array(await file.arrayBuffer()));
  } catch {
    // Existing file unreadable — treat as changed.
  }
  return { existingHref, identical };
}

/**
 * Overwrite an existing manifest item's content in place, leaving the manifest
 * entry (id, href, media-type) unchanged — the explicit-overwrite resolution
 * for a changed collision.
 */
export async function overwriteManifestFile(
  workspace: WorkspaceState,
  workspaceService: WorkspaceService,
  existingHref: string,
  mediaType: string,
  file: File
): Promise<void> {
  const filePath = resolvePath(workspace, existingHref);
  if (isTextLike(mediaType)) {
    await workspaceService.writeFile(workspace.id, filePath, await file.text());
  } else {
    await workspaceService.writeBinaryFile(workspace.id, filePath, await file.arrayBuffer());
  }
}

export interface ImportedMediaFile {
  /** Workspace state carrying the new manifest item — propagate via onWorkspaceUpdate. */
  workspace: WorkspaceState;
  /** OPF-relative href the file landed at (may carry a uniquifying suffix). */
  href: string;
  mediaType: string;
}

/**
 * Import one File into the workspace: EPUB-safe target path from the media
 * type, auto-renamed on collision, manifest item added, content written
 * (manifest entry rolled back if the write fails). Returns the updated
 * workspace — the caller must hand it to onWorkspaceUpdate, or the next
 * full-OPF save clobbers the addition.
 */
export async function importFileToManifest(
  workspace: WorkspaceState,
  workspaceService: WorkspaceService,
  file: File,
  mediaType: string = reliableMediaType(file)
): Promise<ImportedMediaFile> {
  const href = ensureUniqueHref(
    generateEPUBPath(file.name, mediaType),
    workspace.opf.manifest.map(m => m.href)
  );
  let updated = await workspaceService.addManifestItem(workspace, { href, mediaType });
  const addedItemId = updated.opf.manifest[updated.opf.manifest.length - 1].id;
  const filePath = resolvePath(updated, href);
  try {
    if (isTextLike(mediaType)) {
      await workspaceService.writeFile(updated.id, filePath, await file.text());
    } else {
      await workspaceService.writeBinaryFile(updated.id, filePath, await file.arrayBuffer());
    }
  } catch (writeError) {
    updated = await workspaceService.removeManifestItem(updated, addedItemId);
    throw writeError;
  }
  return { workspace: updated, href, mediaType };
}

/** The dropped file's name without extension — the default image alt text. */
export function filenameStem(name: string): string {
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

/** Substitute an image insertion template: `<href>` and `<alt>`. */
export function formatImageSnippet(template: string, data: { href: string; alt: string }): string {
  return template.replace(/<href>/g, data.href).replace(/<alt>/g, data.alt);
}

/** Substitute a video insertion template: `<href>`. */
export function formatVideoSnippet(template: string, data: { href: string }): string {
  return template.replace(/<href>/g, data.href);
}

/**
 * A media file's duration in seconds, read via a detached audio/video element.
 * Resolves 0 when the metadata can't be read (unsupported codec etc.).
 */
export function mediaDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    const done = (duration: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
    };
    element.preload = 'metadata';
    element.onloadedmetadata = () => done(element.duration);
    element.onerror = () => done(0);
    element.src = url;
  });
}
