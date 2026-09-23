import type { RemoteConfig, S3Object } from './types.js';
import {
  uploadToS3,
  listObjects as listS3Objects,
  deleteObject as deleteS3Object,
  getPublicUrl as getS3PublicUrl,
  uploadText as uploadS3Text,
  getObjectText as getS3ObjectText,
  getObjectBlob as getS3ObjectBlob,
} from './s3-upload.js';
import {
  uploadToGoogleDrive,
  listGoogleDriveFiles,
  deleteGoogleDriveFile,
  getGoogleDrivePublicUrl,
  getGoogleDriveThumbnailUrl,
  uploadTextToGoogleDrive,
  downloadGoogleDriveFile,
} from './google-drive-upload.js';
import {
  uploadToDropbox,
  listDropboxFiles,
  deleteDropboxFile,
  getDropboxPublicUrl,
  uploadTextToDropbox,
  downloadDropboxFile,
} from './dropbox-upload.js';
import {
  uploadToDevice,
  listDeviceFiles,
  deleteDeviceFile,
  readDeviceFile,
} from './device-upload.js';
import {
  uploadToWebDAV,
  listWebDAVFiles,
  deleteWebDAVFile,
  getWebDAVPublicUrl,
  uploadTextToWebDAV,
  getWebDAVText,
  getWebDAVBlob,
} from './webdav-upload.js';

export async function uploadFile(
  remote: RemoteConfig,
  objectKey: string,
  blob: Blob,
  contentType?: string,
  onProgress?: (percent: number) => void,
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (remote.type === 's3-compatible') {
    return uploadToS3(remote, objectKey, blob, contentType, onProgress);
  } else if (remote.type === 'google-drive') {
    return uploadToGoogleDrive(
      remote,
      objectKey,
      blob,
      contentType,
      onProgress,
    );
  } else if (remote.type === 'dropbox') {
    return uploadToDropbox(remote, objectKey, blob, contentType, onProgress);
  } else if (remote.type === 'webdav') {
    return uploadToWebDAV(remote, objectKey, blob, contentType, onProgress);
  } else if (remote.type === 'device') {
    return uploadToDevice(remote, objectKey, blob, onProgress);
  }
  return { success: false, error: 'Unknown remote type' };
}

export async function listFiles(
  remote: RemoteConfig,
): Promise<{ objects: S3Object[]; error?: string }> {
  if (remote.type === 's3-compatible') {
    return listS3Objects(remote);
  } else if (remote.type === 'google-drive') {
    return listGoogleDriveFiles(remote);
  } else if (remote.type === 'dropbox') {
    return listDropboxFiles(remote);
  } else if (remote.type === 'webdav') {
    return listWebDAVFiles(remote);
  } else if (remote.type === 'device') {
    return listDeviceFiles(remote);
  }
  return { objects: [], error: 'Unknown remote type' };
}

export async function deleteFile(
  remote: RemoteConfig,
  objectKey: string,
): Promise<{ success: boolean; error?: string }> {
  if (remote.type === 's3-compatible') {
    return deleteS3Object(remote, objectKey);
  } else if (remote.type === 'google-drive') {
    return deleteGoogleDriveFile(remote, objectKey);
  } else if (remote.type === 'dropbox') {
    return deleteDropboxFile(remote, objectKey);
  } else if (remote.type === 'webdav') {
    return deleteWebDAVFile(remote, objectKey);
  } else if (remote.type === 'device') {
    return deleteDeviceFile(remote, objectKey);
  }
  return { success: false, error: 'Unknown remote type' };
}

export function getPublicUrl(
  remote: RemoteConfig,
  objectKey: string,
  fileId?: string,
): string {
  if (remote.type === 's3-compatible') {
    return getS3PublicUrl(remote, objectKey);
  } else if (remote.type === 'google-drive' && fileId) {
    return getGoogleDrivePublicUrl(remote, fileId);
  } else if (remote.type === 'dropbox' && fileId) {
    return getDropboxPublicUrl(remote, fileId);
  } else if (remote.type === 'webdav') {
    return getWebDAVPublicUrl(remote, objectKey);
  }
  // 'device': files on a reader's filesystem have no URL.
  return '';
}

/**
 * A viewable image URL for a cover thumbnail, for `<img>` display in the file list.
 * Same as getPublicUrl for S3/WebDAV (direct image URLs), but Google Drive needs its
 * dedicated thumbnail endpoint — the plain download URL serves an attachment that
 * won't render in an image tag.
 */
export function getThumbnailUrl(
  remote: RemoteConfig,
  objectKey: string,
  fileId?: string,
): string {
  if (remote.type === 'google-drive' && fileId) {
    return getGoogleDriveThumbnailUrl(fileId);
  }
  return getPublicUrl(remote, objectKey, fileId);
}

/**
 * Fetch a remote text file's contents (the existing catalog). Returns null if
 * the file is missing or the remote type cannot host a catalog (Google Drive,
 * device). Throws on transport errors so callers can fall back.
 */
export async function downloadTextFile(
  remote: RemoteConfig,
  objectKey: string,
): Promise<string | null> {
  if (remote.type === 's3-compatible') {
    return getS3ObjectText(remote, objectKey);
  } else if (remote.type === 'webdav') {
    return getWebDAVText(remote, objectKey);
  } else if (remote.type === 'dropbox') {
    const blob = await downloadDropboxFile(remote, objectKey);
    return blob ? blob.text() : null;
  }
  return null;
}

/**
 * Fetch a remote file's bytes (an EPUB to import onto this device). `blob` is
 * null when the file is not there; `error` names a failure, including the
 * device and Google sentinels the callers already know.
 */
export async function downloadFile(
  remote: RemoteConfig,
  objectKey: string,
  fileId?: string,
): Promise<{ blob?: Blob | null; error?: string }> {
  try {
    if (remote.type === 's3-compatible') {
      return { blob: await getS3ObjectBlob(remote, objectKey) };
    } else if (remote.type === 'webdav') {
      return { blob: await getWebDAVBlob(remote, objectKey) };
    } else if (remote.type === 'dropbox') {
      return { blob: await downloadDropboxFile(remote, objectKey) };
    } else if (remote.type === 'google-drive') {
      if (!fileId) return { error: 'File not found' };
      return { blob: await downloadGoogleDriveFile(remote, fileId) };
    } else if (remote.type === 'device') {
      return readDeviceFile(remote, objectKey);
    }
    return { error: 'Unknown remote type' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function uploadTextFile(
  remote: RemoteConfig,
  objectKey: string,
  text: string,
  contentType?: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (remote.type === 's3-compatible') {
    return uploadS3Text(remote, objectKey, text, contentType);
  } else if (remote.type === 'google-drive') {
    return uploadTextToGoogleDrive(remote, objectKey, text, contentType);
  } else if (remote.type === 'dropbox') {
    return uploadTextToDropbox(remote, objectKey, text, contentType);
  } else if (remote.type === 'webdav') {
    return uploadTextToWebDAV(remote, objectKey, text, contentType);
  }
  // 'device': no OPDS catalog on a reader's filesystem.
  return { success: false, error: 'Unknown remote type' };
}
