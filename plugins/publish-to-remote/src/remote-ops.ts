import type { RemoteConfig, S3Object } from './types.js';
import {
  uploadToS3,
  listObjects as listS3Objects,
  deleteObject as deleteS3Object,
  getPublicUrl as getS3PublicUrl,
  uploadText as uploadS3Text,
  getObjectText as getS3ObjectText,
} from './s3-upload.js';
import {
  uploadToGoogleDrive,
  listGoogleDriveFiles,
  deleteGoogleDriveFile,
  getGoogleDrivePublicUrl,
  uploadTextToGoogleDrive,
} from './google-drive-upload.js';
import {
  uploadToDropbox,
  listDropboxFiles,
  deleteDropboxFile,
  getDropboxPublicUrl,
  uploadTextToDropbox,
} from './dropbox-upload.js';
import {
  uploadToWebDAV,
  listWebDAVFiles,
  deleteWebDAVFile,
  getWebDAVPublicUrl,
  uploadTextToWebDAV,
  getWebDAVText,
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
  return '';
}

/**
 * Fetch a remote text file's contents (e.g. the existing catalog.xml). Returns
 * null if the file is missing or the remote type isn't supported for reads
 * (Google Drive / Dropbox). Throws on transport errors so callers can fall back.
 */
export async function downloadTextFile(
  remote: RemoteConfig,
  objectKey: string,
): Promise<string | null> {
  if (remote.type === 's3-compatible') {
    return getS3ObjectText(remote, objectKey);
  } else if (remote.type === 'webdav') {
    return getWebDAVText(remote, objectKey);
  }
  return null; // Drive/Dropbox: not supported for catalog pre-population.
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
  return { success: false, error: 'Unknown remote type' };
}
