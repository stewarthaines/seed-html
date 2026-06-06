import type { WebDAVRemoteConfig, S3Object } from './types.js';

interface WebDAVUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/** UTF-8-safe HTTP Basic auth header (btoa is Latin1-only on its own). */
function basicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `Basic ${btoa(binary)}`;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** The authenticated resource URL for a file inside the configured folder. */
function resourceUrl(creds: WebDAVRemoteConfig, objectKey: string): string {
  return `${stripTrailingSlash(creds.url)}/${encodeURIComponent(objectKey)}`;
}

function httpError(op: string, status: number, statusText: string): string {
  if (status === 401) {
    return `${op} failed: authentication rejected (401). Check the username and password.`;
  }
  if (status === 409) {
    return `${op} failed: the storage path does not exist on the server (409).`;
  }
  return `${op} failed: ${status} ${statusText}`;
}

/** PUT via XHR so upload progress can be reported (mirrors s3-upload's xhrUpload). */
function xhrPut(
  url: string,
  headers: Record<string, string>,
  blob: Blob,
  onProgress: (percent: number) => void,
): Promise<{ ok: boolean; status: number; statusText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([key, value]) =>
      xhr.setRequestHeader(key, value),
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
      });
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.send(blob);
  });
}

export async function uploadToWebDAV(
  creds: WebDAVRemoteConfig,
  objectKey: string,
  blob: Blob,
  contentType = 'application/epub+zip',
  onProgress?: (percent: number) => void,
): Promise<WebDAVUploadResult> {
  const url = resourceUrl(creds, objectKey);
  const headers = {
    Authorization: basicAuth(creds.username, creds.password),
    'Content-Type': contentType,
  };

  try {
    const response = onProgress
      ? await xhrPut(url, headers, blob, onProgress)
      : await fetch(url, { method: 'PUT', headers, body: blob });

    if (!response.ok) {
      return {
        success: false,
        error: httpError('Upload', response.status, response.statusText),
      };
    }

    return { success: true, url: getWebDAVPublicUrl(creds, objectKey) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>`;

export async function listWebDAVFiles(
  creds: WebDAVRemoteConfig,
): Promise<{ objects: S3Object[]; error?: string }> {
  try {
    // Address the collection with a trailing slash. WebDAV collections are
    // canonically slash-terminated, and servers like Apache 301-redirect the
    // slash-less form — which a CORS preflight can't follow (it fails the
    // request). The slash keeps the PROPFIND (and its preflight) on one URL.
    const response = await fetch(`${stripTrailingSlash(creds.url)}/`, {
      method: 'PROPFIND',
      headers: {
        Authorization: basicAuth(creds.username, creds.password),
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: PROPFIND_BODY,
    });

    if (!response.ok) {
      return {
        objects: [],
        error: httpError('List', response.status, response.statusText),
      };
    }

    return { objects: parsePropfindXml(await response.text()) };
  } catch (error) {
    return { objects: [], error: String(error) };
  }
}

function davText(parent: Element, localName: string): string {
  const nodes = parent.getElementsByTagNameNS('DAV:', localName);
  return nodes.length ? (nodes[0].textContent ?? '') : '';
}

/** Parse a 207 Multi-Status body into the shared S3Object shape (all files). */
function parsePropfindXml(xml: string): S3Object[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.documentElement.tagName === 'parsererror') {
    return [];
  }

  const objects: S3Object[] = [];
  const responses = doc.getElementsByTagNameNS('DAV:', 'response');

  for (let i = 0; i < responses.length; i++) {
    const href = davText(responses[i], 'href');
    if (!href || href.endsWith('/')) {
      // Skip the collection itself and any sub-folder entries.
      continue;
    }
    const name = decodeURIComponent(
      stripTrailingSlash(href).split('/').pop() ?? '',
    );
    if (!name) {
      continue;
    }
    objects.push({
      key: name,
      size: parseInt(davText(responses[i], 'getcontentlength') || '0', 10) || 0,
      lastModified: davText(responses[i], 'getlastmodified'),
    });
  }

  return objects;
}

export async function deleteWebDAVFile(
  creds: WebDAVRemoteConfig,
  objectKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(resourceUrl(creds, objectKey), {
      method: 'DELETE',
      headers: { Authorization: basicAuth(creds.username, creds.password) },
    });

    if (response.status === 404 || response.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: httpError('Delete', response.status, response.statusText),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function getWebDAVPublicUrl(
  creds: WebDAVRemoteConfig,
  objectKey: string,
): string {
  const base = stripTrailingSlash(creds.publicUrlBase || creds.url);
  return `${base}/${encodeURIComponent(objectKey)}`;
}

export async function uploadTextToWebDAV(
  creds: WebDAVRemoteConfig,
  objectKey: string,
  text: string,
  contentType = 'text/xml; charset=utf-8',
): Promise<WebDAVUploadResult> {
  const blob = new Blob([text], { type: contentType });
  return uploadToWebDAV(creds, objectKey, blob, contentType);
}
