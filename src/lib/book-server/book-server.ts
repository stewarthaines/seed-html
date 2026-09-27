/**
 * The served book: over HTTP, the app's service worker answers
 * `GET /__book/<workspace>/<path>` by asking this page for the bytes over a
 * message channel (process/PREVIEW_SERVED_BOOK.md). The page reads the file
 * from storage and replies with the bytes and a media type; the worker
 * answers the request, honouring Range headers. Nothing is held in the
 * worker, so a book the reader tab keeps in memory could answer the same way.
 *
 * The preview document gets `<base href>` pointing under this route so a
 * reference a script builds at runtime resolves to a served file, as EPUB
 * says it should. Over `file:` there is no worker and no base.
 */
import { getMimeType } from '../utils/mime-types.js';

/** The route the worker reserves; workspace id and container path follow. */
export const BOOK_ROUTE = '/__book/';

/**
 * An empty document the worker serves under the route. The preview frame
 * starts here before the chapter is written into it: a frame that begins
 * at about:blank is not a controlled client in Chromium, one that begins
 * at a served URL is, and stays so through document.write.
 */
export const BOOK_FRAME_PATH = `${BOOK_ROUTE}_/frame.html`;

/** Message the worker posts to ask for a file; the reply goes back on the port. */
export interface BookFileRequest {
  type: 'book-file';
  workspaceId: string;
  path: string;
}

/**
 * `not-found` means this page holds the workspace but not the file, so the
 * worker can stop waiting; `not-mine` means the workspace is not this
 * page's, and another page (a reader tab, another editor tab) may still
 * answer. The reader (READ.html) answers with the same shapes for the book
 * it has open.
 */
export type BookFileReply =
  | { ok: true; bytes: ArrayBuffer; contentType: string }
  | { ok: false; reason: 'not-found' | 'not-mine' };

/** What the page needs from storage to answer. */
export interface BookFileReader {
  readFile(workspaceId: string, path: string): Promise<ArrayBuffer>;
  listWorkspaces(): Promise<string[]>;
}

/** Whether a base under the route means anything here: HTTP with a worker in control. */
export function isBookServingAvailable(): boolean {
  if (typeof location === 'undefined' || !location.protocol.startsWith('http')) return false;
  return !!(typeof navigator !== 'undefined' && navigator.serviceWorker?.controller);
}

/**
 * The URL a container path is served at for a workspace, absolute so it can
 * be a `<base href>`. Null when serving is not available.
 */
export function bookFileUrl(workspaceId: string, path: string): string | null {
  if (!isBookServingAvailable()) return null;
  return bookRoutePath(workspaceId, path, location.origin);
}

/** The route path for a file, without the availability check (testable). */
export function bookRoutePath(workspaceId: string, path: string, origin = ''): string {
  const segments = path
    .split('/')
    .filter(s => s !== '' && s !== '.')
    .map(encodeURIComponent);
  return `${origin}${BOOK_ROUTE}${encodeURIComponent(workspaceId)}/${segments.join('/')}`;
}

/** The workspace and container path a served request names, or null. */
export function parseBookRoute(pathname: string): { workspaceId: string; path: string } | null {
  if (!pathname.startsWith(BOOK_ROUTE)) return null;
  const rest = pathname.slice(BOOK_ROUTE.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const workspaceId = decodeURIComponent(rest.slice(0, slash));
  const path = rest
    .slice(slash + 1)
    .split('/')
    .map(s => decodeURIComponent(s))
    .filter(s => s !== '' && s !== '.');
  if (path.some(s => s === '..')) return null;
  return { workspaceId, path: path.join('/') };
}

/**
 * Documents the page has prepared and answers in place of the stored file
 * while they are registered: the reader-engine preview's rendered chapter,
 * which its section frame navigates to (`process/PREVIEW_SERVED_BOOK.md`).
 */
const preparedDocuments = new Map<string, { markup: string; contentType: string }>();

function preparedKey(workspaceId: string, path: string): string {
  return `${workspaceId}\n${path}`;
}

/**
 * Answer `path` in `workspaceId` with `markup` until the returned function
 * is called. A later registration for the same file replaces this one, and
 * this one's release then leaves the newer registration alone.
 */
export function serveDocument(
  workspaceId: string,
  path: string,
  markup: string,
  contentType = 'text/html'
): () => void {
  const key = preparedKey(workspaceId, path);
  const entry = { markup, contentType };
  preparedDocuments.set(key, entry);
  return () => {
    if (preparedDocuments.get(key) === entry) preparedDocuments.delete(key);
  };
}

/** Answer one request from storage. Exported for tests; `startBookServer` wires it. */
export async function answerBookFile(
  reader: BookFileReader,
  request: BookFileRequest
): Promise<BookFileReply> {
  const prepared = preparedDocuments.get(preparedKey(request.workspaceId, request.path));
  if (prepared) {
    return {
      ok: true,
      bytes: new TextEncoder().encode(prepared.markup).buffer as ArrayBuffer,
      contentType: prepared.contentType,
    };
  }
  try {
    const bytes = await reader.readFile(request.workspaceId, request.path);
    return { ok: true, bytes, contentType: getMimeType(request.path) };
  } catch {
    // Only the failure path pays for the listing: a missing file in a
    // workspace this page holds is final, a workspace it does not hold is not.
    const mine = await reader
      .listWorkspaces()
      .then(ids => ids.includes(request.workspaceId))
      .catch(() => false);
    return { ok: false, reason: mine ? 'not-found' : 'not-mine' };
  }
}

function isBookFileRequest(value: unknown): value is BookFileRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'book-file' &&
    typeof (value as { workspaceId?: unknown }).workspaceId === 'string' &&
    typeof (value as { path?: unknown }).path === 'string'
  );
}

/**
 * Start answering the worker's requests from `reader`. Returns a stop
 * function. Safe to call where there is no worker: it simply never hears
 * anything.
 */
export function startBookServer(reader: BookFileReader): () => void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return () => {};
  const onMessage = (event: MessageEvent) => {
    if (!isBookFileRequest(event.data)) return;
    const port = event.ports[0];
    if (!port) return;
    void answerBookFile(reader, event.data).then(reply => {
      if (reply.ok) port.postMessage(reply, [reply.bytes]);
      else port.postMessage(reply);
    });
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
