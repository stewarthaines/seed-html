/**
 * A Solid pod folder as a destination: books, thumbnails and the catalog are
 * plain resources in one LDP container, written with the account's DPoP
 * tokens (solid-auth.ts). Every function returns its failure instead of
 * throwing, as the sibling modules do; SOLID_AUTH_REQUIRED means the account
 * must sign in again.
 */
import {
  SOLID_AUTH_REQUIRED,
  solidAuthHeaders,
  solidFetch,
  type SolidAccount,
} from './solid-auth.js';
import type { S3Object, SolidRemoteConfig } from './types.js';

interface SolidResult {
  success: boolean;
  url?: string;
  error?: string;
}

const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains';
const DC_MODIFIED = 'http://purl.org/dc/terms/modified';
const POSIX_SIZE = 'http://www.w3.org/ns/posix/stat#size';
const POSIX_MTIME = 'http://www.w3.org/ns/posix/stat#mtime';

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);

/** Enough of a destination to reach its folder (a form can pass one before saving). */
export type SolidPlace = Pick<
  SolidRemoteConfig,
  'oidcIssuer' | 'webId' | 'containerUrl'
>;

const account = (remote: SolidPlace): SolidAccount => ({
  oidcIssuer: remote.oidcIssuer,
  webId: remote.webId,
});

function resourceUrl(remote: SolidRemoteConfig, objectKey: string): string {
  return `${withSlash(remote.containerUrl)}${encodeURIComponent(objectKey)}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function httpError(op: string, status: number, statusText: string): string {
  if (status === 401) return SOLID_AUTH_REQUIRED;
  if (status === 403) {
    return `${op} failed: this account may not write to the folder (403).`;
  }
  return `${op} failed: ${status} ${statusText}`;
}

/** PUT via XHR so upload progress can be reported; one retry after a 401. */
async function xhrPut(
  remote: SolidRemoteConfig,
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<{ ok: boolean; status: number; statusText: string }> {
  const attempt = async (force: boolean) => {
    const auth = await solidAuthHeaders(account(remote), url, 'PUT', force);
    return new Promise<{ ok: boolean; status: number; statusText: string }>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', contentType);
        Object.entries(auth).forEach(([k, v]) => xhr.setRequestHeader(k, v));
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
      },
    );
  };
  const first = await attempt(false);
  return first.status === 401 ? attempt(true) : first;
}

/** Write a file into the folder; the pod creates the folder on first use. */
export async function uploadToSolid(
  remote: SolidRemoteConfig,
  objectKey: string,
  blob: Blob,
  contentType = 'application/epub+zip',
  onProgress?: (percent: number) => void,
): Promise<SolidResult> {
  const url = resourceUrl(remote, objectKey);
  try {
    const response = onProgress
      ? await xhrPut(remote, url, blob, contentType, onProgress)
      : await solidFetch(account(remote), url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: blob,
        });
    if (!response.ok) {
      return {
        success: false,
        error: httpError('Upload', response.status, response.statusText),
      };
    }
    return { success: true, url };
  } catch (error) {
    return { success: false, error: errorText(error) };
  }
}

export async function uploadTextToSolid(
  remote: SolidRemoteConfig,
  objectKey: string,
  text: string,
  contentType = 'text/xml; charset=utf-8',
): Promise<SolidResult> {
  return uploadToSolid(
    remote,
    objectKey,
    new Blob([text], { type: contentType }),
    contentType,
  );
}

type JsonLdNode = Record<string, unknown> & { '@id'?: string };

function literal(node: JsonLdNode | undefined, predicate: string): string {
  const values = node?.[predicate];
  if (!Array.isArray(values) || !values.length) return '';
  const first = values[0] as { '@value'?: unknown };
  return first?.['@value'] === undefined ? '' : String(first['@value']);
}

/** Expanded JSON-LD nodes (a bare array or an @graph), merged by @id. */
function jsonLdNodes(json: unknown): Map<string, JsonLdNode> {
  const list = Array.isArray(json)
    ? json
    : Array.isArray((json as { '@graph'?: unknown })?.['@graph'])
      ? (json as { '@graph': unknown[] })['@graph']
      : [];
  const nodes = new Map<string, JsonLdNode>();
  for (const raw of list as JsonLdNode[]) {
    const id = raw?.['@id'];
    if (typeof id !== 'string') continue;
    nodes.set(id, { ...nodes.get(id), ...raw });
  }
  return nodes;
}

function ids(node: JsonLdNode | undefined, predicate: string): string[] {
  const values = node?.[predicate];
  if (!Array.isArray(values)) return [];
  return (values as JsonLdNode[])
    .map((v) => v?.['@id'])
    .filter((id): id is string => typeof id === 'string');
}

/**
 * The files directly inside a container, from its expanded JSON-LD
 * description (the form Community Solid Server returns). Sub-folders are left
 * out. Nodes describing one resource may be split; they are merged by @id.
 */
export function parseContainerJsonLd(
  containerUrl: string,
  json: unknown,
): S3Object[] {
  const nodes = jsonLdNodes(json);
  const objects: S3Object[] = [];
  for (const id of ids(nodes.get(withSlash(containerUrl)), LDP_CONTAINS)) {
    if (id.endsWith('/')) continue;
    const key = decodeURIComponent(id.split('/').pop() ?? '');
    if (!key) continue;
    const node = nodes.get(id);
    const mtime = literal(node, POSIX_MTIME);
    objects.push({
      key,
      size: parseInt(literal(node, POSIX_SIZE) || '0', 10) || 0,
      lastModified:
        literal(node, DC_MODIFIED) ||
        (mtime ? new Date(Number(mtime) * 1000).toISOString() : ''),
    });
  }
  return objects;
}

export async function listSolidFiles(
  remote: SolidRemoteConfig,
): Promise<{ objects: S3Object[]; error?: string }> {
  try {
    const response = await solidFetch(
      account(remote),
      withSlash(remote.containerUrl),
      { headers: { Accept: 'application/ld+json' }, cache: 'no-cache' },
    );
    // Not there yet: the first send creates it.
    if (response.status === 404) return { objects: [] };
    if (!response.ok) {
      return {
        objects: [],
        error: httpError('List', response.status, response.statusText),
      };
    }
    return {
      objects: parseContainerJsonLd(remote.containerUrl, await response.json()),
    };
  } catch (error) {
    return { objects: [], error: errorText(error) };
  }
}

export async function deleteSolidFile(
  remote: SolidRemoteConfig,
  objectKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await solidFetch(
      account(remote),
      resourceUrl(remote, objectKey),
      { method: 'DELETE' },
    );
    if (response.ok || response.status === 404) return { success: true };
    return {
      success: false,
      error: httpError('Delete', response.status, response.statusText),
    };
  } catch (error) {
    return { success: false, error: errorText(error) };
  }
}

/** A resource's own URL is its public link (readable by all once the folder is public). */
export function getSolidPublicUrl(
  remote: SolidRemoteConfig,
  objectKey: string,
): string {
  return resourceUrl(remote, objectKey);
}

async function getAuthenticated(
  remote: SolidRemoteConfig,
  objectKey: string,
): Promise<Response | null> {
  const response = await solidFetch(
    account(remote),
    resourceUrl(remote, objectKey),
    // Revalidate so a just-republished catalog reads back fresh.
    { cache: 'no-cache' },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(httpError('Get', response.status, response.statusText));
  }
  return response;
}

/** A file's text (the existing catalog). Null when it is not there. */
export async function getSolidText(
  remote: SolidRemoteConfig,
  objectKey: string,
): Promise<string | null> {
  const response = await getAuthenticated(remote, objectKey);
  return response ? response.text() : null;
}

/** A file's bytes (an EPUB to import). Null when it is not there. */
export async function getSolidBlob(
  remote: SolidRemoteConfig,
  objectKey: string,
): Promise<Blob | null> {
  const response = await getAuthenticated(remote, objectKey);
  return response ? response.blob() : null;
}

/** The sub-folders directly inside a container (slash-terminated URLs). */
export function parseContainerFolders(
  containerUrl: string,
  json: unknown,
): string[] {
  const nodes = jsonLdNodes(json);
  return ids(nodes.get(withSlash(containerUrl)), LDP_CONTAINS)
    .filter((id) => id.endsWith('/'))
    .sort((a, b) => a.localeCompare(b));
}

/** A folder's last path segment, for display. */
export function folderName(url: string): string {
  const path = new URL(url).pathname.replace(/\/+$/, '');
  return decodeURIComponent(path.split('/').pop() ?? '') || url;
}

/** The sub-folders of a pod folder, read as the account. */
export async function listSolidFolders(
  account: SolidAccount,
  url: string,
): Promise<{ folders: string[]; error?: string }> {
  try {
    const response = await solidFetch(account, withSlash(url), {
      headers: { Accept: 'application/ld+json' },
      cache: 'no-cache',
    });
    if (!response.ok) {
      return {
        folders: [],
        error: httpError('List', response.status, response.statusText),
      };
    }
    return { folders: parseContainerFolders(url, await response.json()) };
  } catch (error) {
    return { folders: [], error: errorText(error) };
  }
}

/** Make a new, empty folder at `url`. */
export async function createSolidFolder(
  account: SolidAccount,
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await solidFetch(account, withSlash(url), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
    });
    if (response.ok) return { success: true };
    return {
      success: false,
      error: httpError('Create folder', response.status, response.statusText),
    };
  } catch (error) {
    return { success: false, error: errorText(error) };
  }
}

const PIM_STORAGE = 'http://www.w3.org/ns/pim/space#storage';
const FOAF_NAME = 'http://xmlns.com/foaf/0.1/name';
const VCARD_FN = 'http://www.w3.org/2006/vcard/ns#fn';

/** What a WebID profile says about its owner: a name and the pods they keep. */
export function parseProfile(
  webId: string,
  json: unknown,
): { name?: string; storages: string[] } {
  const me = jsonLdNodes(json).get(webId);
  const name = literal(me, FOAF_NAME) || literal(me, VCARD_FN) || undefined;
  return { name, storages: ids(me, PIM_STORAGE) };
}

/** Read a WebID profile (public). Empty when it cannot be read as JSON-LD. */
export async function readProfile(
  webId: string,
): Promise<{ name?: string; storages: string[] }> {
  try {
    const response = await fetch(webId, {
      headers: { Accept: 'application/ld+json' },
    });
    if (!response.ok) return { storages: [] };
    return parseProfile(webId, await response.json());
  } catch {
    return { storages: [] };
  }
}

/** The modes a WAC-Allow header grants one group (`public`, `user`). */
export function wacModes(header: string | null, group: string): string[] {
  const match = header?.match(new RegExp(`${group}\\s*=\\s*"([^"]*)"`));
  return match ? match[1].split(/\s+/).filter(Boolean) : [];
}

/** True when anyone can read the folder's books without signing in. */
export async function isFolderPublic(
  remote: SolidPlace,
): Promise<{ public?: boolean; error?: string }> {
  try {
    // Ask anonymously: the answer that matters is what a reader gets.
    const response = await fetch(withSlash(remote.containerUrl), {
      method: 'HEAD',
      cache: 'no-cache',
    });
    if (response.status === 404) return { public: false };
    const header = response.headers.get('WAC-Allow');
    if (header !== null) {
      return { public: wacModes(header, 'public').includes('read') };
    }
    return { public: response.ok };
  } catch (error) {
    return { error: errorText(error) };
  }
}

/** The folder's access-control resource, from its `Link: <…>; rel="acl"`. */
function aclUrlFrom(linkHeader: string | null, base: string): string | null {
  for (const part of (linkHeader ?? '').split(',')) {
    const match = part.match(/<([^>]*)>\s*;(.*)/);
    if (match && /rel\s*=\s*"?acl"?/.test(match[2])) {
      return new URL(match[1], base).href;
    }
  }
  return null;
}

/** Access rules for a public folder: the owner keeps control, everyone may read. */
export function publicFolderAcl(webId: string): string {
  return `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

<#owner> a acl:Authorization;
  acl:agent <${webId}>;
  acl:accessTo <./>;
  acl:default <./>;
  acl:mode acl:Read, acl:Write, acl:Control.

<#public> a acl:Authorization;
  acl:agentClass foaf:Agent;
  acl:accessTo <./>;
  acl:default <./>;
  acl:mode acl:Read.
`;
}

/**
 * Let anyone read the folder and everything in it (Web Access Control). The
 * folder is created first if nothing has been sent yet.
 */
export async function makeFolderPublic(
  remote: SolidPlace,
): Promise<{ success: boolean; error?: string }> {
  const folder = withSlash(remote.containerUrl);
  try {
    let head = await solidFetch(account(remote), folder, { method: 'HEAD' });
    if (head.status === 404) {
      const created = await solidFetch(account(remote), folder, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/turtle' },
      });
      if (!created.ok) {
        return {
          success: false,
          error: httpError('Create folder', created.status, created.statusText),
        };
      }
      head = await solidFetch(account(remote), folder, { method: 'HEAD' });
    }
    const aclUrl = aclUrlFrom(head.headers.get('Link'), folder);
    if (!aclUrl) {
      return {
        success: false,
        error: 'This pod does not offer access rules for the folder.',
      };
    }
    const put = await solidFetch(account(remote), aclUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: publicFolderAcl(remote.webId),
    });
    if (!put.ok) {
      return {
        success: false,
        error: httpError('Sharing', put.status, put.statusText),
      };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: errorText(error) };
  }
}
