/**
 * Links to hand to a person: a file's public address on a destination (an
 * EPUB to download, or a catalog to add to a reading app), and the same EPUB
 * opened in a web reader through the destination's reader link, an address
 * with a `{url}` placeholder for the EPUB's link.
 */
import { getPublicUrl } from './remote-ops.js';
import { getDropboxPublicUrl, resolveDropboxLinks } from './dropbox-upload.js';
import { showStatus } from './status.js';
import { translate } from './i18n.js';
import type { RemoteConfig, S3Object } from './types.js';

/** The reader link offered as the example in a destination's form. */
export const READER_LINK_EXAMPLE = 'https://readitinabook.com/READ.html?book={url}';

/** Whether files on a destination have an address to share. */
export function canShareLinks(remote: RemoteConfig): boolean {
  return remote.type !== 'device';
}

/** The destination's reader link, if it has one. */
export function readerLinkTemplate(remote: RemoteConfig): string {
  return remote.type === 'device' ? '' : (remote.readerLink?.trim() ?? '');
}

/**
 * The reader link for one EPUB: the template with `{url}` replaced by the
 * EPUB's address, encoded as a query value. A template without the
 * placeholder has the address appended.
 */
export function readerLinkFor(template: string, url: string): string {
  const base = template.trim();
  if (!base || !url) return '';
  const encoded = encodeURIComponent(url);
  return base.includes('{url}') ? base.split('{url}').join(encoded) : base + encoded;
}

/**
 * The public address of a file on a destination: the download address for
 * S3, WebDAV and Google Drive (shared with anyone who has the link when
 * sent), and for Dropbox the file's shared link, made on demand, set to
 * download. Empty when the destination has none.
 */
export async function publicLinkFor(
  remote: RemoteConfig,
  key: string,
  objects: S3Object[],
): Promise<string> {
  if (!canShareLinks(remote)) return '';
  const object = objects.find((o) => o.key === key) ?? {
    key,
    size: 0,
    lastModified: '',
  };
  if (remote.type === 'dropbox') {
    const [resolved] = await resolveDropboxLinks(remote, [object], [key]);
    return resolved?.fileId ? getDropboxPublicUrl(remote, resolved.fileId) : '';
  }
  return getPublicUrl(remote, key, object.fileId);
}

/** Put text on the clipboard; false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a file's link, or its reader link, and say so. When the clipboard is
 * refused the link is shown instead, so it can still be copied by hand.
 */
export async function copyShareLink(
  remote: RemoteConfig,
  key: string,
  objects: S3Object[],
  kind: 'file' | 'reader',
): Promise<void> {
  const url = await publicLinkFor(remote, key, objects);
  const text = kind === 'reader' ? readerLinkFor(readerLinkTemplate(remote), url) : url;
  if (!text) {
    showStatus(translate('This file has no public link'), 'error');
    return;
  }
  if (await copyText(text)) showStatus(translate('URL copied to clipboard'), 'success');
  else showStatus(text, 'info');
}
