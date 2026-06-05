import { getPublicUrl } from './s3-upload.js';
import { getWebDAVPublicUrl } from './webdav-upload.js';
import type {
  RemoteConfig,
  S3Object,
  S3RemoteConfig,
  GoogleDriveRemoteConfig,
  DropboxRemoteConfig,
} from './types.js';

const ATOM_NS = 'http://www.w3.org/2005/Atom';

export function generateOpdsFeed(
  creds: RemoteConfig,
  objects: S3Object[],
  feedUrl: string,
): string {
  const doc = document.implementation.createDocument(ATOM_NS, 'feed', null);
  const feed = doc.documentElement;
  feed.setAttribute('xmlns:dc', 'http://purl.org/dc/terms/');
  feed.setAttribute('xmlns:opds', 'http://opds-spec.org/2010/catalog');

  function child(
    parent: Element,
    tag: string,
    text?: string,
    attrs: Record<string, string> = {},
  ) {
    const el = doc.createElementNS(ATOM_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    if (text !== undefined) {
      el.textContent = text;
    }
    parent.appendChild(el);
    return el;
  }

  const title =
    creds.type === 's3-compatible'
      ? (creds as S3RemoteConfig).bucket
      : creds.type === 'google-drive'
        ? (creds as GoogleDriveRemoteConfig).folderName
        : creds.type === 'dropbox'
          ? (creds as DropboxRemoteConfig).folderPath
          : creds.name; // webdav: use the display name
  child(feed, 'id', `urn:uri:${feedUrl}`);
  child(feed, 'title', title);
  child(feed, 'updated', new Date().toISOString());
  child(feed, 'link', undefined, {
    rel: 'self',
    href: feedUrl,
    type: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
  });

  for (const o of objects.filter((o) => o.key.endsWith('.epub'))) {
    let url = '';
    if (creds.type === 's3-compatible') {
      url = getPublicUrl(creds as S3RemoteConfig, o.key);
    } else if (creds.type === 'google-drive') {
      url = o.fileId
        ? `https://drive.google.com/uc?id=${o.fileId}&export=download`
        : '';
    } else if (creds.type === 'dropbox') {
      url = o.fileId || '';
    } else if (creds.type === 'webdav') {
      url = getWebDAVPublicUrl(creds, o.key);
    }
    const entry = child(feed, 'entry');
    child(entry, 'title', o.key.replace(/\.epub$/i, ''));
    child(entry, 'id', `urn:uri:${url}`);
    child(entry, 'updated', o.lastModified);
    child(entry, 'link', undefined, {
      rel: 'http://opds-spec.org/acquisition',
      href: url,
      type: 'application/epub+zip',
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}`;
}
