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
import type { Term } from 'n3';
import Parser from 'n3/src/N3Parser.js';
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

function httpError(
  op: string,
  status: number,
  statusText: string,
  detail = '',
): string {
  if (status === 401) return SOLID_AUTH_REQUIRED;
  if (status === 403) {
    return `${op} failed: this account may not write to the folder (403).`;
  }
  const base = `${op} failed: ${status} ${statusText}`.trim();
  return detail ? `${base}: ${detail}` : base;
}

/**
 * The reason a pod gave for an error, from its response body: the `message`
 * of Community Solid Server's JSON error, or a short plain-text body. Empty
 * when there is nothing readable (an HTML page, say).
 */
export function serverMessage(body: string): string {
  const text = body.trim();
  if (!text) return '';
  try {
    const json = JSON.parse(text) as { message?: unknown };
    if (typeof json?.message === 'string') return json.message.trim();
  } catch {
    // not JSON
  }
  return text.startsWith('<') || text.length > 300 ? '' : text;
}

interface PutResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

/** PUT via XHR so upload progress can be reported; one retry after a 401. */
async function xhrPut(
  remote: SolidRemoteConfig,
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<PutResponse> {
  const attempt = async (force: boolean) => {
    const auth = await solidAuthHeaders(account(remote), url, 'PUT', force);
    return new Promise<PutResponse>((resolve, reject) => {
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
          body: xhr.responseText,
        });
      xhr.onerror = () => reject(new Error('XHR network error'));
      xhr.send(blob);
    });
  };
  const first = await attempt(false);
  return first.status === 401 ? attempt(true) : first;
}

async function fetchPut(
  remote: SolidRemoteConfig,
  url: string,
  blob: Blob,
  contentType: string,
): Promise<PutResponse> {
  const response = await solidFetch(account(remote), url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: response.ok ? '' : await response.text().catch(() => ''),
  };
}

/** How long before the upload began a resource may have been written and still count as ours. */
const CLOCK_SLACK_MS = 60_000;

/**
 * After a failed PUT, remove what the pod kept of it. Community Solid Server
 * can abort a slow upload part-way (its write lock expires) and leave the
 * bytes that had arrived, which would then be served as a broken book. Only
 * a resource written during this upload and not the size that was sent is
 * removed, so an earlier good copy is left alone when the failure came
 * before any write.
 */
async function removePartialWrite(
  remote: SolidRemoteConfig,
  url: string,
  sentBytes: number,
  startedAt: number,
): Promise<boolean> {
  try {
    const head = await solidFetch(account(remote), url, { method: 'HEAD' });
    if (!head.ok) return false;
    const size = Number(head.headers.get('Content-Length') ?? NaN);
    if (size === sentBytes) return false;
    const modified = Date.parse(head.headers.get('Last-Modified') ?? '');
    if (!Number.isFinite(modified) || modified < startedAt - CLOCK_SLACK_MS) {
      return false;
    }
    const removed = await solidFetch(account(remote), url, { method: 'DELETE' });
    return removed.ok || removed.status === 404;
  } catch {
    return false;
  }
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
  const startedAt = Date.now();
  const failed = async (error: string) => {
    const removed = await removePartialWrite(remote, url, blob.size, startedAt);
    return {
      success: false,
      error: removed
        ? `${error.replace(/\.?$/, '.')} The incomplete copy was removed.`
        : error,
    };
  };
  try {
    const response = onProgress
      ? await xhrPut(remote, url, blob, contentType, onProgress)
      : await fetchPut(remote, url, blob, contentType);
    if (!response.ok) {
      const error = httpError(
        'Upload',
        response.status,
        response.statusText,
        serverMessage(response.body),
      );
      // Only a server failure can have left part of the file behind.
      return response.status >= 500 ? failed(error) : { success: false, error };
    }
    return { success: true, url };
  } catch (error) {
    const text = errorText(error);
    return text === SOLID_AUTH_REQUIRED ? { success: false, error: text } : failed(text);
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

/**
 * A request for a document as Turtle. `no-store` keeps the browser from
 * answering with a copy cached in another format: a server that does not vary
 * its cache key on Accept would otherwise revalidate an earlier JSON-LD
 * response and the browser would hand that back.
 */
const TURTLE_REQUEST: RequestInit = {
  headers: { Accept: 'text/turtle' },
  cache: 'no-store',
};

/** The body of a Turtle response; names what came instead, and from where,
 *  when it is not Turtle (a host can put a web page in front of a pod path). */
async function turtleText(response: Response, url: string): Promise<string> {
  const type = (response.headers.get('Content-Type') ?? '').toLowerCase();
  if (type && !type.includes('turtle')) {
    throw new Error(
      `The pod sent ${type.split(';')[0]} instead of Turtle for ${url}`,
    );
  }
  return response.text();
}

/**
 * Solid servers must serve their RDF as Turtle (Solid Protocol), so listings
 * and profiles are read as Turtle and parsed with N3.js. Relative IRIs resolve
 * against the document's own URL.
 */
function readGraph(turtle: string, baseIRI: string) {
  const quads = new Parser({ baseIRI, format: 'text/turtle' }).parse(turtle);
  const bySubjectPredicate = new Map<string, Term[]>();
  for (const quad of quads) {
    const key = `${quad.subject.value} ${quad.predicate.value}`;
    const list = bySubjectPredicate.get(key) ?? [];
    list.push(quad.object);
    bySubjectPredicate.set(key, list);
  }
  const objects = (subject: string, predicate: string) =>
    bySubjectPredicate.get(`${subject} ${predicate}`) ?? [];
  return {
    /** The IRIs a subject points to through a predicate. */
    iris: (subject: string, predicate: string) =>
      objects(subject, predicate)
        .filter((term) => term.termType === 'NamedNode')
        .map((term) => term.value),
    /** The first literal value, or ''. */
    literal: (subject: string, predicate: string) =>
      objects(subject, predicate).find((term) => term.termType === 'Literal')
        ?.value ?? '',
  };
}

/**
 * The files directly inside a container, from its Turtle description.
 * Sub-folders are left out. Size and date are read where the server gives
 * them (Community Solid Server does, Inrupt's does not).
 */
export function parseContainerListing(
  containerUrl: string,
  turtle: string,
): S3Object[] {
  const folder = withSlash(containerUrl);
  const graph = readGraph(turtle, folder);
  const objects: S3Object[] = [];
  for (const id of graph.iris(folder, LDP_CONTAINS)) {
    if (id.endsWith('/')) continue;
    const key = decodeURIComponent(id.split('/').pop() ?? '');
    if (!key) continue;
    const mtime = graph.literal(id, POSIX_MTIME);
    objects.push({
      key,
      size: parseInt(graph.literal(id, POSIX_SIZE) || '0', 10) || 0,
      lastModified:
        graph.literal(id, DC_MODIFIED) ||
        (mtime ? new Date(Number(mtime) * 1000).toISOString() : ''),
    });
  }
  return objects;
}

/**
 * Fill in the size and date a listing left out (Inrupt's listings give
 * neither) from each file's own headers. A file that cannot be asked keeps
 * what the listing gave.
 */
async function withFileStats(
  remote: SolidRemoteConfig,
  objects: S3Object[],
): Promise<S3Object[]> {
  return Promise.all(
    objects.map(async (object) => {
      if (object.lastModified) return object;
      try {
        const head = await solidFetch(account(remote), resourceUrl(remote, object.key), {
          method: 'HEAD',
          cache: 'no-store',
        });
        if (!head.ok) return object;
        const modified = Date.parse(head.headers.get('Last-Modified') ?? '');
        const size = parseInt(head.headers.get('Content-Length') ?? '', 10);
        return {
          ...object,
          size: object.size || (Number.isFinite(size) ? size : 0),
          lastModified: Number.isFinite(modified) ? new Date(modified).toISOString() : '',
        };
      } catch {
        return object;
      }
    }),
  );
}

export async function listSolidFiles(
  remote: SolidRemoteConfig,
): Promise<{ objects: S3Object[]; error?: string }> {
  try {
    const response = await solidFetch(
      account(remote),
      withSlash(remote.containerUrl),
      TURTLE_REQUEST,
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
      objects: await withFileStats(
        remote,
        parseContainerListing(
          remote.containerUrl,
          await turtleText(response, remote.containerUrl),
        ),
      ),
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
  turtle: string,
): string[] {
  const folder = withSlash(containerUrl);
  return readGraph(turtle, folder)
    .iris(folder, LDP_CONTAINS)
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
    const response = await solidFetch(account, withSlash(url), TURTLE_REQUEST);
    if (!response.ok) {
      return {
        folders: [],
        error: httpError('List', response.status, response.statusText),
      };
    }
    return { folders: parseContainerFolders(url, await turtleText(response, withSlash(url))) };
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

/**
 * What a WebID profile says about its owner: a name and the pods they keep
 * (`pim:storage`). `documentUrl` is where the profile was read from, which
 * relative IRIs resolve against; it defaults to the WebID.
 */
export function parseProfile(
  webId: string,
  turtle: string,
  documentUrl = webId,
): { name?: string; storages: string[] } {
  const graph = readGraph(turtle, documentUrl);
  const name =
    graph.literal(webId, FOAF_NAME) || graph.literal(webId, VCARD_FN) || undefined;
  return { name, storages: graph.iris(webId, PIM_STORAGE) };
}

/** Read a WebID profile (public). Empty when it cannot be read. */
export async function readProfile(
  webId: string,
): Promise<{ name?: string; storages: string[] }> {
  try {
    const response = await fetch(webId, TURTLE_REQUEST);
    if (!response.ok) return { storages: [] };
    return parseProfile(webId, await turtleText(response, webId), response.url || webId);
  } catch {
    return { storages: [] };
  }
}

/** A name no book has: asking for it anonymously shows whether the public may
 *  read the folder's contents without asking for the folder itself. */
const PUBLIC_PROBE = '.seedhtml-public-check';

/**
 * Whether anyone can read the folder's books without signing in, and whether
 * they can also list the folder. Both are asked anonymously, which is the
 * reader's own experience whatever access system the pod uses or its
 * WAC-Allow header claims. A missing file answers 404 where the public may
 * read the folder's contents and 401 or 403 where it may not (Community Solid
 * Server and Inrupt's server alike, checked 2026-11-16). `no-store` keeps a
 * cached answer from before a change out.
 */
export async function isFolderPublic(
  remote: SolidPlace,
): Promise<{ public?: boolean; listed?: boolean; error?: string }> {
  const folder = withSlash(remote.containerUrl);
  const ask = (url: string) => fetch(url, { method: 'HEAD', cache: 'no-store' });
  try {
    const [member, listing] = await Promise.all([
      ask(`${folder}${PUBLIC_PROBE}`),
      ask(folder),
    ]);
    return {
      public: member.ok || member.status === 404,
      listed: listing.ok,
    };
  } catch (error) {
    return { error: errorText(error) };
  }
}

/** The targets of a `Link` header's entries with the given `rel`, resolved against `base`. */
function linkTargets(linkHeader: string | null, rel: string, base: string): string[] {
  const targets: string[] = [];
  for (const part of (linkHeader ?? '').split(',')) {
    const match = part.match(/<([^>]*)>\s*;(.*)/);
    if (!match) continue;
    const rels = match[2].match(/rel\s*=\s*"([^"]*)"|rel\s*=\s*([^;\s]+)/);
    const names = (rels?.[1] ?? rels?.[2] ?? '').split(/\s+/);
    if (names.includes(rel)) targets.push(new URL(match[1], base).href);
  }
  return targets;
}

const ACP_ACR = 'http://www.w3.org/ns/solid/acp#AccessControlResource';

/**
 * Which access-control system governs a resource. Both are in the Solid
 * specifications and both are advertised with `Link: <…>; rel="acl"`: Web
 * Access Control (Community Solid Server, a `.acl` document) and Access
 * Control Policies (Inrupt's server, an access control resource that says so
 * with `rel="type"` acp:AccessControlResource).
 */
async function accessSystem(remote: SolidPlace, aclUrl: string): Promise<'acp' | 'wac'> {
  const head = await solidFetch(account(remote), aclUrl, {
    method: 'HEAD',
    cache: 'no-store',
  });
  return linkTargets(head.headers.get('Link'), 'type', aclUrl).includes(ACP_ACR)
    ? 'acp'
    : 'wac';
}

/**
 * A SPARQL Update adding public read to an access control resource (Access
 * Control Policies): one policy allowing Read to acp:PublicAgent, applied to
 * the folder's members but not the folder, so a book opens from its link
 * while the folder's list of books stays private. It first takes back the
 * policy's hold on the folder itself, which an earlier version applied. The
 * owner's existing policies are left as they are, which is why this patches
 * rather than replaces.
 */
export function publicReadPatch(acrUrl: string): string {
  const id = (name: string) => `<${acrUrl}#${name}>`;
  return `PREFIX acp: <http://www.w3.org/ns/solid/acp#>
PREFIX acl: <http://www.w3.org/ns/auth/acl#>
DELETE DATA {
  <${acrUrl}> acp:accessControl ${id('seedhtml-public')}.
};
INSERT DATA {
  <${acrUrl}> acp:memberAccessControl ${id('seedhtml-public')}.
  ${id('seedhtml-public')} a acp:AccessControl;
    acp:apply ${id('seedhtml-public-policy')}.
  ${id('seedhtml-public-policy')} a acp:Policy;
    acp:allow acl:Read;
    acp:anyOf ${id('seedhtml-public-matcher')}.
  ${id('seedhtml-public-matcher')} a acp:Matcher;
    acp:agent acp:PublicAgent.
}
`;
}

/** Access rules for a public folder: the owner keeps control, and everyone may
 *  read what is in it (`acl:default`) but not the folder's own list of books
 *  (no `acl:accessTo` for the public). */
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
  acl:default <./>;
  acl:mode acl:Read.
`;
}

/**
 * Let anyone read the books in the folder from their links, without listing
 * the folder, with whichever access
 * system the pod uses (Web Access Control or Access Control Policies). The
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
    const [aclUrl] = linkTargets(head.headers.get('Link'), 'acl', folder);
    if (!aclUrl) {
      return {
        success: false,
        error: 'This pod does not offer access rules for the folder.',
      };
    }
    const write =
      (await accessSystem(remote, aclUrl)) === 'acp'
        ? await solidFetch(account(remote), aclUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/sparql-update' },
            body: publicReadPatch(aclUrl),
          })
        : await solidFetch(account(remote), aclUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/turtle' },
            body: publicFolderAcl(remote.webId),
          });
    if (!write.ok) {
      return {
        success: false,
        error: httpError(
          'Sharing',
          write.status,
          write.statusText,
          serverMessage(await write.text().catch(() => '')),
        ),
      };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: errorText(error) };
  }
}
