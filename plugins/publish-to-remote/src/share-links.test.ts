import { describe, it, expect, vi } from 'vitest';

vi.mock('./dropbox-upload.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./dropbox-upload.js')>()),
  resolveDropboxLinks: vi.fn(async (_config, objects) =>
    objects.map((o: { key: string }) => ({
      ...o,
      fileId: `https://www.dropbox.com/scl/fi/abc/${o.key}?rlkey=x&dl=0`,
    })),
  ),
}));

const {
  READER_LINK_EXAMPLE,
  canShareLinks,
  publicLinkFor,
  readerLinkFor,
  readerLinkTemplate,
} = await import('./share-links.js');
import type {
  DeviceRemoteConfig,
  DropboxRemoteConfig,
  S3RemoteConfig,
  WebDAVRemoteConfig,
} from './types.js';

const s3: S3RemoteConfig = {
  id: 's3',
  name: 'Sample',
  type: 's3-compatible',
  endpoint: 'https://s3.example.com',
  bucket: 'books',
  accessKeyId: 'k',
  secretAccessKey: 's',
  publicUrlBase: 'https://sample.readitinabook.com',
  readerLink: READER_LINK_EXAMPLE,
};

const webdav: WebDAVRemoteConfig = {
  id: 'dav',
  name: 'Dav',
  type: 'webdav',
  url: 'https://dav.example.com/books',
  username: 'u',
  password: 'p',
  publicUrlBase: 'https://files.example.com/books/',
};

const dropbox: DropboxRemoteConfig = {
  id: 'db',
  name: 'Box',
  type: 'dropbox',
  appKey: 'a',
  folderId: '/books',
  folderPath: '/books',
  accessToken: 't',
  refreshToken: 'r',
  tokenExpiry: 0,
};

const device: DeviceRemoteConfig = {
  id: 'dev',
  name: 'Kobo',
  type: 'device',
  deviceKind: 'kobo',
  volumeLabel: 'KOBOeReader',
  targetFolder: '',
};

describe('readerLinkFor', () => {
  it('puts the encoded address in place of {url}', () => {
    expect(
      readerLinkFor(READER_LINK_EXAMPLE, 'https://sample.readitinabook.com/My%20Book.epub'),
    ).toBe(
      'https://readitinabook.com/READ.html?book=https%3A%2F%2Fsample.readitinabook.com%2FMy%2520Book.epub',
    );
  });

  it('appends the address to a template without the placeholder', () => {
    expect(readerLinkFor('https://reader.example/?book=', 'https://a.example/b.epub')).toBe(
      'https://reader.example/?book=https%3A%2F%2Fa.example%2Fb.epub',
    );
  });

  it('gives nothing without a template or an address', () => {
    expect(readerLinkFor('', 'https://a.example/b.epub')).toBe('');
    expect(readerLinkFor(READER_LINK_EXAMPLE, '')).toBe('');
  });
});

describe('readerLinkTemplate', () => {
  it('reads the destination’s reader link, trimmed', () => {
    expect(readerLinkTemplate({ ...s3, readerLink: `  ${READER_LINK_EXAMPLE} ` })).toBe(
      READER_LINK_EXAMPLE,
    );
    expect(readerLinkTemplate(webdav)).toBe('');
    expect(readerLinkTemplate(device)).toBe('');
  });
});

describe('publicLinkFor', () => {
  it('joins the public base and the encoded filename for S3', async () => {
    const url = await publicLinkFor(s3, 'My Book.epub', []);
    expect(url).toBe('https://sample.readitinabook.com/My%20Book.epub');
  });

  it('uses the public base for WebDAV', async () => {
    expect(await publicLinkFor(webdav, 'b.epub', [])).toBe('https://files.example.com/books/b.epub');
  });

  it('turns a Dropbox shared link into a download', async () => {
    expect(await publicLinkFor(dropbox, 'b.epub', [])).toBe(
      'https://www.dropbox.com/scl/fi/abc/b.epub?rlkey=x&dl=1',
    );
  });

  it('has nothing for a device', async () => {
    expect(canShareLinks(device)).toBe(false);
    expect(await publicLinkFor(device, 'b.epub', [])).toBe('');
  });
});
