import type { GoogleDriveRemoteConfig, S3Object } from './types.js';

interface UploadResult {
  success: boolean;
  url?: string;
  /** The uploaded/updated Drive file id (needed to build a stable download URL). */
  fileId?: string;
  error?: string;
}

interface ListResult {
  objects: S3Object[];
  error?: string;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

async function getValidToken(config: GoogleDriveRemoteConfig): Promise<string> {
  if (config.accessToken) {
    return config.accessToken;
  }
  throw new Error('GOOGLE_AUTH_REQUIRED');
}

/**
 * Share an uploaded file "anyone with the link" (reader). Without this the file
 * stays private and its download URL redirects anonymous readers to a Google
 * login page — breaking the OPDS acquisition links that reading apps fetch
 * unauthenticated. The `drive.file` scope already permits sharing app-created
 * files, so no extra consent is needed. Throws on failure (an unshared file is a
 * broken publish); the caller's catch surfaces it as an UploadResult error.
 */
async function makeGoogleDriveFilePublic(
  token: string,
  fileId: string,
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Uploaded, but failed to share publicly: ${response.status} ${response.statusText}\n${error}`,
    );
  }
}

export async function uploadToGoogleDrive(
  config: GoogleDriveRemoteConfig,
  objectKey: string,
  blob: Blob,
  _contentType = 'application/epub+zip',
  _onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  try {
    const token = await getValidToken(config);

    // Update in place when a file with this name already exists in the folder —
    // Drive allows same-name duplicates, so a plain create would pile up a new file
    // (and a new id/URL) on every publish. Reusing the id keeps the download URL stable.
    const existingId = await findGoogleDriveFileId(config, objectKey);

    // A create sets the parent folder; an update (PATCH) keeps the file where it is.
    const metadata = existingId
      ? { name: objectKey }
      : { name: objectKey, parents: [config.folderId] };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    );
    formData.append('file', blob, objectKey);

    const response = await fetch(
      existingId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: existingId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );

    if (response.status === 401) {
      return { success: false, error: 'GOOGLE_AUTH_REQUIRED' };
    }

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Upload failed: ${response.status} ${response.statusText}\n${error}`,
      };
    }

    const result = await response.json();
    // New files start private; share them so the download link resolves without
    // sign-in. An updated (existing) file was already shared on creation.
    if (!existingId) {
      await makeGoogleDriveFilePublic(token, result.id);
    }
    const url = getGoogleDrivePublicUrl(config, result.id);

    return { success: true, url, fileId: result.id };
  } catch (error) {
    if (error instanceof Error && error.message === 'GOOGLE_AUTH_REQUIRED') {
      return { success: false, error: 'GOOGLE_AUTH_REQUIRED' };
    }
    return { success: false, error: String(error) };
  }
}

export async function listGoogleDriveFiles(
  config: GoogleDriveRemoteConfig,
): Promise<ListResult> {
  try {
    const token = await getValidToken(config);

    const query = `'${config.folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.append('q', query);
    url.searchParams.append('fields', 'files(id,name,size,modifiedTime)');
    url.searchParams.append('pageSize', '1000');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      return { objects: [], error: 'GOOGLE_AUTH_REQUIRED' };
    }

    if (!response.ok) {
      const error = await response.text();
      return {
        objects: [],
        error: `List failed: ${response.status} ${response.statusText}\n${error}`,
      };
    }

    const data = (await response.json()) as {
      files?: { id: string; name: string; size?: string; modifiedTime: string }[];
    };
    const objects: S3Object[] = (data.files || []).map((file) => ({
      key: file.name,
      size: parseInt(file.size || '0', 10),
      lastModified: file.modifiedTime,
      fileId: file.id,
    }));

    return { objects };
  } catch (error) {
    if (error instanceof Error && error.message === 'GOOGLE_AUTH_REQUIRED') {
      return { objects: [], error: 'GOOGLE_AUTH_REQUIRED' };
    }
    return { objects: [], error: String(error) };
  }
}

/**
 * Find the id of a file in the configured folder by name. Drive addresses files by
 * an opaque id (not by name) and allows same-name duplicates, so callers use this to
 * update a file in place (and to build a stable download URL) rather than blindly
 * creating a new one. Returns null when no file with that name exists.
 */
export async function findGoogleDriveFileId(
  config: GoogleDriveRemoteConfig,
  objectKey: string,
): Promise<string | null> {
  const listResult = await listGoogleDriveFiles(config);
  if (listResult.error) throw new Error(listResult.error);
  return (
    listResult.objects.find((obj) => obj.key === objectKey)?.fileId ?? null
  );
}

export async function deleteGoogleDriveFile(
  config: GoogleDriveRemoteConfig,
  objectKey: string,
  fileId?: string,
): Promise<DeleteResult> {
  try {
    const token = await getValidToken(config);

    if (!fileId) {
      const listResult = await listGoogleDriveFiles(config);
      if (listResult.error) return { success: false, error: listResult.error };
      const file = listResult.objects.find((obj) => obj.key === objectKey);
      if (!file?.fileId) {
        return { success: false, error: 'File not found' };
      }
      fileId = file.fileId;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 401) {
      return { success: false, error: 'GOOGLE_AUTH_REQUIRED' };
    }

    if (response.status === 204 || response.status === 404) {
      return { success: true };
    }

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Delete failed: ${response.status} ${response.statusText}\n${error}`,
      };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'GOOGLE_AUTH_REQUIRED') {
      return { success: false, error: 'GOOGLE_AUTH_REQUIRED' };
    }
    return { success: false, error: String(error) };
  }
}

/**
 * A viewable image URL for a public Drive file, for `<img>` display. Unlike the
 * download URL (which Drive serves as an attachment/octet-stream that won't render
 * in an image tag), the thumbnail endpoint returns a real image. `sz=w<width>` sizes
 * it. Only resolves for files shared publicly (see makeGoogleDriveFilePublic).
 */
export function getGoogleDriveThumbnailUrl(
  fileId: string,
  width = 400,
): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

export function getGoogleDrivePublicUrl(
  _config: GoogleDriveRemoteConfig,
  fileId: string,
): string {
  // Google's direct-download host — serves the bytes for a public file without the
  // virus-scan interstitial the legacy `drive.google.com/uc?export=download` shows
  // for larger files. Only resolves once the file is shared (see makeGoogleDriveFilePublic).
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
}

export async function uploadTextToGoogleDrive(
  config: GoogleDriveRemoteConfig,
  objectKey: string,
  text: string,
  contentType = 'text/xml; charset=utf-8',
): Promise<UploadResult> {
  const blob = new Blob([text], { type: contentType });
  return uploadToGoogleDrive(config, objectKey, blob, contentType);
}
