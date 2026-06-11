import { AwsClient } from 'aws4fetch';
import type { S3RemoteConfig, S3Object } from './types.js';

interface S3UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

function createAwsClient(credentials: S3RemoteConfig): AwsClient {
  return new AwsClient({
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    region: credentials.region === 'auto' ? 'us-east-1' : credentials.region,
  });
}

function xhrUpload(
  signedRequest: Request,
  blob: Blob,
  onProgress: (percent: number) => void,
): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(signedRequest.method || 'GET', signedRequest.url);
    signedRequest.headers.forEach((value, key) =>
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
        text: () => Promise.resolve(xhr.responseText),
      });
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.send(blob);
  });
}

export async function uploadToS3(
  creds: S3RemoteConfig,
  objectKey: string,
  blob: Blob,
  contentType = 'application/epub+zip',
  onProgress?: (percent: number) => void,
): Promise<S3UploadResult> {
  const awsClient = createAwsClient(creds);
  const baseEndpoint = creds.endpoint.replace(/\/$/, '');
  const url = `${baseEndpoint}/${creds.bucket}/${objectKey}`;

  try {
    const signedRequest = await awsClient.sign(url, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': contentType },
    });

    const response = onProgress
      ? await xhrUpload(signedRequest, blob, onProgress)
      : await fetch(signedRequest);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        error: `Upload failed: ${response.status} ${response.statusText}${errorText ? '\n' + errorText : ''}`,
      };
    }

    return { success: true, url: getPublicUrl(creds, objectKey) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function listObjects(
  creds: S3RemoteConfig,
  prefix?: string,
): Promise<{ objects: S3Object[]; error?: string }> {
  const awsClient = createAwsClient(creds);
  const baseEndpoint = creds.endpoint.replace(/\/$/, '');

  let url = `${baseEndpoint}/${creds.bucket}?list-type=2`;
  if (prefix) {
    url += `&prefix=${encodeURIComponent(prefix)}`;
  }

  try {
    const response = await awsClient.fetch(url, { method: 'GET' });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        objects: [],
        error: `List failed: ${response.status} ${response.statusText}${text ? '\n' + text : ''}`,
      };
    }

    const xml = await response.text();
    const objects = parseListObjectsXml(xml);
    return { objects };
  } catch (error) {
    return { objects: [], error: String(error) };
  }
}

function parseListObjectsXml(xml: string): S3Object[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (doc.documentElement.tagName === 'parsererror') {
    return [];
  }

  const objects: S3Object[] = [];
  const contents = doc.querySelectorAll('Contents');

  contents.forEach((element) => {
    const key = element.querySelector('Key')?.textContent ?? '';
    const sizeStr = element.querySelector('Size')?.textContent ?? '0';
    const lastModified =
      element.querySelector('LastModified')?.textContent ?? '';

    if (key) {
      objects.push({
        key,
        size: parseInt(sizeStr, 10),
        lastModified,
      });
    }
  });

  return objects;
}

export async function deleteObject(
  creds: S3RemoteConfig,
  objectKey: string,
): Promise<{ success: boolean; error?: string }> {
  const awsClient = createAwsClient(creds);
  const baseEndpoint = creds.endpoint.replace(/\/$/, '');
  const url = `${baseEndpoint}/${creds.bucket}/${objectKey}`;

  try {
    const response = await awsClient.fetch(url, { method: 'DELETE' });

    if (response.status === 204 || response.status === 404) {
      return { success: true };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        success: false,
        error: `Delete failed: ${response.status} ${response.statusText}${text ? '\n' + text : ''}`,
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function getPublicUrl(creds: S3RemoteConfig, objectKey: string): string {
  if (creds.publicUrlBase) {
    const baseUrl = creds.publicUrlBase.replace(/\/$/, '');
    return `${baseUrl}/${encodeURIComponent(objectKey)}`;
  }
  const baseEndpoint = creds.endpoint.replace(/\/$/, '');
  return `${baseEndpoint}/${creds.bucket}/${encodeURIComponent(objectKey)}`;
}

export async function uploadText(
  creds: S3RemoteConfig,
  objectKey: string,
  text: string,
  contentType = 'text/xml; charset=utf-8',
): Promise<S3UploadResult> {
  const blob = new Blob([text], { type: contentType });
  return uploadToS3(creds, objectKey, blob, contentType);
}

/** Fetch an object's text via a signed GET. Returns null if it's missing. */
export async function getObjectText(
  creds: S3RemoteConfig,
  objectKey: string,
): Promise<string | null> {
  const awsClient = createAwsClient(creds);
  const baseEndpoint = creds.endpoint.replace(/\/$/, '');
  const url = `${baseEndpoint}/${creds.bucket}/${objectKey}`;
  const response = await awsClient.fetch(url, { method: 'GET' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Get failed: ${response.status} ${response.statusText}`);
  return response.text();
}
