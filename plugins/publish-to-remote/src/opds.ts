import { getPublicUrl } from './s3-upload.js';
import { getWebDAVPublicUrl } from './webdav-upload.js';
import type {
  RemoteConfig,
  S3Object,
  S3RemoteConfig,
  GoogleDriveRemoteConfig,
  DropboxRemoteConfig,
  CatalogEntryMeta,
} from './types.js';

const ATOM_NS = 'http://www.w3.org/2005/Atom';
const DC_NS = 'http://purl.org/dc/terms/';

/** The public download URL for a remote object, per remote type. */
export function acquisitionUrl(creds: RemoteConfig, o: S3Object): string {
  if (creds.type === 's3-compatible') {
    return getPublicUrl(creds as S3RemoteConfig, o.key);
  } else if (creds.type === 'google-drive') {
    return o.fileId ? `https://drive.google.com/uc?id=${o.fileId}&export=download` : '';
  } else if (creds.type === 'dropbox') {
    return o.fileId || '';
  } else if (creds.type === 'webdav') {
    return getWebDAVPublicUrl(creds, o.key);
  }
  return '';
}

export function generateOpdsFeed(
  creds: RemoteConfig,
  objects: S3Object[],
  feedUrl: string,
  metaByKey: Map<string, CatalogEntryMeta> = new Map(),
  selectedKeys?: Set<string>,
): string {
  const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
  const doc = document.implementation.createDocument(ATOM_NS, 'feed', null);
  const feed = doc.documentElement;
  // Declare prefixes as proper namespace attributes so the serializer keeps them
  // on the root rather than re-declaring `xmlns:dc` on every dc: element.
  feed.setAttributeNS(XMLNS_NS, 'xmlns:dc', DC_NS);
  feed.setAttributeNS(XMLNS_NS, 'xmlns:opds', 'http://opds-spec.org/2010/catalog');

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

  // Dublin Core (dcterms) element, e.g. <dc:language>.
  function dcChild(parent: Element, tag: string, text: string) {
    const el = doc.createElementNS(DC_NS, `dc:${tag}`);
    el.textContent = text;
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

  const epubs = objects.filter(
    (o) => o.key.endsWith('.epub') && (!selectedKeys || selectedKeys.has(o.key)),
  );
  for (const o of epubs) {
    const url = acquisitionUrl(creds, o);
    const meta = metaByKey.get(o.key);
    const entry = child(feed, 'entry');
    child(entry, 'title', meta?.title || o.key.replace(/\.epub$/i, ''));
    child(entry, 'id', `urn:uri:${url}`);
    child(entry, 'updated', o.lastModified);

    // Rich metadata from the host-written sidecar, when available.
    if (meta) {
      for (const name of meta.authors ?? []) {
        const author = child(entry, 'author');
        child(author, 'name', name);
      }
      if (meta.description) child(entry, 'summary', meta.description);
      if (meta.language) dcChild(entry, 'language', meta.language);
      if (meta.publisher) dcChild(entry, 'publisher', meta.publisher);
      if (meta.issued) dcChild(entry, 'issued', meta.issued);
      if (meta.identifier) dcChild(entry, 'identifier', meta.identifier);
      for (const subject of meta.subjects ?? []) {
        child(entry, 'category', undefined, { term: subject });
      }
      if (meta.thumbnailUrl) {
        // Emit both relations (some clients read only the full `image`) pointing
        // at the hosted PNG — resolvable URLs render where data: URIs don't.
        child(entry, 'link', undefined, {
          rel: 'http://opds-spec.org/image',
          href: meta.thumbnailUrl,
          type: 'image/png',
        });
        child(entry, 'link', undefined, {
          rel: 'http://opds-spec.org/image/thumbnail',
          href: meta.thumbnailUrl,
          type: 'image/png',
        });
      }
    }

    child(entry, 'link', undefined, {
      rel: 'http://opds-spec.org/acquisition',
      href: url,
      type: 'application/epub+zip',
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}`;
}
