import { describe, it, expect } from 'vitest';
import {
  identifiersOnRemote,
  sendStateFor,
  shelfFor,
  typeLabel,
} from './remote-status.js';
import type { LocalPackage } from './local-packages.js';
import type {
  CatalogEntry,
  S3Object,
  S3RemoteConfig,
  DeviceRemoteConfig,
} from './types.js';

const s3: S3RemoteConfig = {
  id: 's3',
  name: 'Shelf',
  type: 's3-compatible',
  endpoint: 'https://s3.example.com',
  bucket: 'books',
  accessKeyId: 'k',
  secretAccessKey: 's',
};

const device: DeviceRemoteConfig = {
  id: 'kobo',
  name: 'Kobo',
  type: 'device',
  deviceKind: 'kobo',
  volumeLabel: 'KOBOeReader',
  targetFolder: '',
};

const DAY = 86_400_000;
const T0 = Date.parse('2026-09-01T00:00:00.000Z');

function pkg(
  name: string,
  identifier: string | undefined,
  lastModified: number,
): LocalPackage {
  return {
    file: new File(['x'], name),
    name,
    size: 1024,
    lastModified,
    identifier,
    title: name.replace(/\.epub$/, ''),
  };
}

function obj(key: string, lastModified: number, size = 1024): S3Object {
  return { key, size, lastModified: new Date(lastModified).toISOString() };
}

const href = (key: string) => `https://s3.example.com/books/${key}`;

describe('typeLabel', () => {
  it('names each kind briefly', () => {
    expect(typeLabel(s3)).toBe('S3');
    expect(typeLabel(device)).toBe('USB');
  });
});

describe('identifiersOnRemote', () => {
  it('reads the identifier from the local sidecar, else the catalog entry', () => {
    const packages = [pkg('a.epub', 'urn:a', T0)];
    const objects = [obj('a.epub', T0), obj('b.epub', T0), obj('c.epub', T0)];
    const entries: CatalogEntry[] = [{ href: href('b.epub'), identifier: 'urn:b' }];
    const ids = identifiersOnRemote(s3, objects, packages, entries);
    expect(ids.get('a.epub')).toBe('urn:a');
    expect(ids.get('b.epub')).toBe('urn:b');
    expect(ids.has('c.epub')).toBe(false);
  });
});

describe('sendStateFor', () => {
  const packages = [pkg('book-new.epub', 'urn:x', T0 + 2 * DAY), pkg('book-old.epub', 'urn:x', T0)];

  it('is not-sent when nothing of the book is on the destination', () => {
    expect(sendStateFor(s3, [obj('other.epub', T0)], packages, [], 'urn:x')).toEqual({
      kind: 'not-sent',
    });
  });

  it('is current when the latest package is there and not older than the local file', () => {
    const state = sendStateFor(s3, [obj('book-new.epub', T0 + 2 * DAY)], packages, [], 'urn:x');
    expect(state.kind).toBe('current');
  });

  it('is newer-here when only an older package of the book is there', () => {
    const state = sendStateFor(s3, [obj('book-old.epub', T0)], packages, [], 'urn:x');
    expect(state).toEqual({
      kind: 'newer-here',
      key: 'book-old.epub',
      sentAt: new Date(T0).toISOString(),
    });
  });

  it('is newer-here when the same filename was repackaged since it was sent', () => {
    const state = sendStateFor(s3, [obj('book-new.epub', T0)], packages, [], 'urn:x');
    expect(state.kind).toBe('newer-here');
  });

  it('matches through the catalog when the sidecar is not on this device', () => {
    const entries: CatalogEntry[] = [{ href: href('elsewhere.epub'), identifier: 'urn:x' }];
    const state = sendStateFor(s3, [obj('elsewhere.epub', T0)], packages, entries, 'urn:x');
    expect(state.kind).toBe('newer-here');
  });

  it('is not-sent without an identifier to match on', () => {
    expect(sendStateFor(s3, [obj('book-new.epub', T0)], packages, [], undefined).kind).toBe(
      'not-sent',
    );
  });
});

describe('shelfFor', () => {
  const packages = [
    pkg('known.epub', 'urn:known', T0 + DAY),
    pkg('known-old.epub', 'urn:known', T0),
    pkg('unsent.epub', 'urn:unsent', T0),
    pkg('gone.epub', 'urn:gone', T0),
  ];
  const objects = [
    obj('known.epub', T0 + DAY),
    obj('known.thumb.png', T0 + DAY, 10),
    obj('known-old.epub', T0),
    obj('foreign.epub', T0 + 2 * DAY),
    obj('mystery.epub', T0 - DAY),
    obj('gone.epub', T0),
    obj('catalog.json', T0 + DAY, 10),
  ];
  const entries: CatalogEntry[] = [
    { href: href('known.epub'), identifier: 'urn:known', title: 'Known' },
    { href: href('foreign.epub'), identifier: 'urn:foreign', title: 'Foreign' },
  ];
  const catalogKeys = new Set(['known.epub', 'foreign.epub']);
  const known = new Set(['urn:known', 'urn:unsent']);

  const shelf = shelfFor(s3, objects, packages, entries, catalogKeys, known);
  const byKey = new Map(shelf.onDestination.map((b) => [b.key, b]));

  it('lists only the EPUBs, newest first', () => {
    expect(shelf.onDestination.map((b) => b.key)).toEqual([
      'foreign.epub',
      'known.epub',
      'known-old.epub',
      'gone.epub',
      'mystery.epub',
    ]);
  });

  it('marks a book known here and whether the file is its latest package', () => {
    expect(byKey.get('known.epub')).toMatchObject({ known: true, latest: true, inCatalog: true });
    expect(byKey.get('known-old.epub')).toMatchObject({ known: true, latest: false, inCatalog: false });
  });

  it('takes the title and identifier from the catalog for a book not on this device', () => {
    expect(byKey.get('foreign.epub')).toMatchObject({
      known: false,
      title: 'Foreign',
      identifier: 'urn:foreign',
      inCatalog: true,
    });
  });

  it('shows a file with no sidecar and no entry by its name', () => {
    expect(byKey.get('mystery.epub')).toMatchObject({
      known: false,
      title: 'mystery',
      identifier: undefined,
    });
  });

  it('treats a package whose project was deleted as not known here', () => {
    expect(byKey.get('gone.epub')?.known).toBe(false);
  });

  it('uses the hosted thumbnail, cache-busted, when the destination has one', () => {
    expect(byKey.get('known.epub')?.thumbnailUrl).toBe(
      `${href('known.thumb.png')}?v=${encodeURIComponent(new Date(T0 + DAY).toISOString())}`,
    );
  });

  it('lists the newest package of each book with nothing on the destination', () => {
    expect(shelf.notSent.map((p) => p.name)).toEqual(['unsent.epub']);
  });

  it('never points at a hosted thumbnail for a device', () => {
    const local: LocalPackage = { ...pkg('known.epub', 'urn:known', T0), thumbnailUrl: 'data:x' };
    const onDevice = shelfFor(device, [obj('known.epub', T0), obj('known.thumb.png', T0)], [local], [], new Set(), known);
    expect(onDevice.onDestination[0].thumbnailUrl).toBe('data:x');
  });
});
