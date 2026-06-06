import { refreshDropboxToken } from './dropbox.js';
import type { DropboxRemoteConfig, S3Object } from './types.js';

interface UploadResult {
  success: boolean;
  url?: string;
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

async function getValidToken(config: DropboxRemoteConfig): Promise<string> {
  if (Date.now() < config.tokenExpiry) {
    return config.accessToken;
  }

  const { accessToken, tokenExpiry } = await refreshDropboxToken(
    config.appKey,
    config.refreshToken,
  );
  config.accessToken = accessToken;
  config.tokenExpiry = tokenExpiry;
  return accessToken;
}

export async function uploadToDropbox(
  config: DropboxRemoteConfig,
  objectKey: string,
  blob: Blob,
  contentType = 'application/epub+zip',
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  try {
    const token = await getValidToken(config);
    const path = config.folderId
      ? `${config.folderId}/${objectKey}`
      : `/${objectKey}`;

    const response = await fetch(
      'https://content.dropboxapi.com/2/files/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite' }),
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      },
    );

    if (response.status === 401) {
      const newToken = await refreshDropboxToken(
        config.appKey,
        config.refreshToken,
      );
      config.accessToken = newToken.accessToken;
      config.tokenExpiry = newToken.tokenExpiry;
      return uploadToDropbox(config, objectKey, blob, contentType, onProgress);
    }

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      return {
        success: false,
        error: `Upload failed: ${response.status} ${response.statusText}${error ? '\n' + error : ''}`,
      };
    }

    const url = await getOrCreateSharedLink(config, path);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function listDropboxFiles(
  config: DropboxRemoteConfig,
): Promise<ListResult> {
  try {
    const token = await getValidToken(config);

    const listResponse = await fetch(
      'https://api.dropboxapi.com/2/files/list_folder',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: config.folderId }),
      },
    );

    if (listResponse.status === 401) {
      const newToken = await refreshDropboxToken(
        config.appKey,
        config.refreshToken,
      );
      config.accessToken = newToken.accessToken;
      config.tokenExpiry = newToken.tokenExpiry;
      return listDropboxFiles(config);
    }

    if (!listResponse.ok) {
      const error = await listResponse.text().catch(() => '');
      return {
        objects: [],
        error: `List failed: ${listResponse.status} ${listResponse.statusText}${error ? '\n' + error : ''}`,
      };
    }

    const listData = await listResponse.json();
    const entries = listData.entries || [];

    const objects: S3Object[] = [];
    for (const entry of entries) {
      if (entry['.tag'] === 'file') {
        const fileId = await getOrCreateSharedLink(config, entry.path_display);
        objects.push({
          key: entry.name,
          size: entry.size,
          lastModified: entry.server_modified,
          fileId,
        });
      }
    }

    return { objects };
  } catch (error) {
    return { objects: [], error: String(error) };
  }
}

export async function deleteDropboxFile(
  config: DropboxRemoteConfig,
  objectKey: string,
): Promise<DeleteResult> {
  try {
    const token = await getValidToken(config);
    const path = config.folderId
      ? `${config.folderId}/${objectKey}`
      : `/${objectKey}`;

    const response = await fetch(
      'https://api.dropboxapi.com/2/files/delete_v2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      },
    );

    if (response.status === 401) {
      const newToken = await refreshDropboxToken(
        config.appKey,
        config.refreshToken,
      );
      config.accessToken = newToken.accessToken;
      config.tokenExpiry = newToken.tokenExpiry;
      return deleteDropboxFile(config, objectKey);
    }

    if (response.status === 200 || response.status === 404) {
      return { success: true };
    }

    if (!response.ok) {
      const error = await response.text().catch(() => '');
      return {
        success: false,
        error: `Delete failed: ${response.status} ${response.statusText}${error ? '\n' + error : ''}`,
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function getDropboxPublicUrl(
  config: DropboxRemoteConfig,
  fileId: string,
): string {
  if (!fileId) return '';
  if (fileId.includes('dl=1')) return fileId;
  if (fileId.includes('dl=0')) return fileId.replace('dl=0', 'dl=1');
  // Add dl=1 if no dl parameter present
  return fileId.includes('?') ? fileId + '&dl=1' : fileId + '?dl=1';
}

async function getOrCreateSharedLink(
  config: DropboxRemoteConfig,
  filePath: string,
): Promise<string> {
  try {
    const token = await getValidToken(config);

    // Try to find existing link
    const listLinksResponse = await fetch(
      'https://api.dropboxapi.com/2/sharing/list_shared_links',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath }),
      },
    );

    if (listLinksResponse.ok) {
      const data = await listLinksResponse.json();
      if (data.links && data.links.length > 0) {
        const url = data.links[0].url.replace('?dl=0', '').replace('?dl=0', '');
        return url.endsWith('?') ? url.slice(0, -1) : url;
      }
    }

    // Create new link if doesn't exist
    const createResponse = await fetch(
      'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          settings: { requested_visibility: 'public' },
        }),
      },
    );

    if (createResponse.ok) {
      const data = await createResponse.json();
      const url = data.url.replace('?dl=0', '').replace('?dl=0', '');
      return url.endsWith('?') ? url.slice(0, -1) : url;
    }

    return '';
  } catch {
    return '';
  }
}

export async function uploadTextToDropbox(
  config: DropboxRemoteConfig,
  objectKey: string,
  text: string,
  contentType = 'text/xml; charset=utf-8',
): Promise<UploadResult> {
  const blob = new Blob([text], { type: contentType });
  return uploadToDropbox(config, objectKey, blob, contentType);
}
