import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  readEmbeddedPayload,
  readEpubIdentity,
  findWorkspaceByIdentifier,
} from './boot-payload.js';
import { bytesToBase64 } from '../epub/html-payload.js';
import { ZipWriter } from '../zip/index.js';
import { OPFUtils } from '../epub/opf-utils.js';

// happy-dom cannot parse namespaced OPF/container XML (see the project's
// testing notes), so the OPFUtils statics are stubbed here — these tests cover
// the plumbing (slot → zip → the right entries → the right calls), and the
// parsers have their own coverage.
const CONTAINER_XML = 'container-xml-sentinel';
const OPF_XML = 'opf-xml-sentinel';

afterEach(() => vi.restoreAllMocks());

function stubParsers(identifier = 'urn:uuid:abc', title = 'A Book') {
  vi.spyOn(OPFUtils, 'parseRootfilePath').mockReturnValue('OEBPS/content.opf');
  vi.spyOn(OPFUtils, 'parseOPFMetadataFromString').mockReturnValue({
    identifier,
    title,
  } as ReturnType<typeof OPFUtils.parseOPFMetadataFromString>);
}

describe('readEmbeddedPayload', () => {
  it('returns null when the slot is absent or empty', () => {
    expect(readEmbeddedPayload(document)).toBeNull();
    const slot = document.createElement('script');
    slot.id = 'seedhtml-payload';
    slot.type = 'application/epub+zip;base64';
    document.body.appendChild(slot);
    try {
      expect(readEmbeddedPayload(document)).toBeNull();
    } finally {
      slot.remove();
    }
  });

  it('decodes a filled slot back to bytes', () => {
    const bytes = new Uint8Array([80, 75, 3, 4, 200]);
    const slot = document.createElement('script');
    slot.id = 'seedhtml-payload';
    slot.type = 'application/epub+zip;base64';
    slot.textContent = bytesToBase64(bytes);
    document.body.appendChild(slot);
    try {
      expect(readEmbeddedPayload(document)).toEqual(bytes);
    } finally {
      slot.remove();
    }
  });
});

describe('readEpubIdentity', () => {
  it('walks container.xml to the OPF and returns identifier + title', async () => {
    stubParsers('urn:uuid:xyz', 'The Payload Book');
    const writer = new ZipWriter();
    // STORED entries: the deflate Compression/DecompressionStream pair stalls
    // under the unit environment; the store path is plain buffers.
    await writer.addFile('mimetype', 'application/epub+zip');
    await writer.addFile('META-INF/container.xml', CONTAINER_XML, { compressionMethod: 0x00 });
    await writer.addFile('OEBPS/content.opf', OPF_XML, { compressionMethod: 0x00 });
    const bytes = new Uint8Array(await writer.build());

    const identity = await readEpubIdentity(bytes);

    expect(identity).toEqual({ identifier: 'urn:uuid:xyz', title: 'The Payload Book' });
    expect(OPFUtils.parseRootfilePath).toHaveBeenCalledWith(CONTAINER_XML);
    expect(OPFUtils.parseOPFMetadataFromString).toHaveBeenCalledWith(OPF_XML);
  });

  it('returns an empty identity when container.xml is missing', async () => {
    const writer = new ZipWriter();
    await writer.addFile('mimetype', 'application/epub+zip');
    const bytes = new Uint8Array(await writer.build());
    expect(await readEpubIdentity(bytes)).toEqual({});
  });
});

describe('findWorkspaceByIdentifier', () => {
  const reader = (byWorkspace: Record<string, string | Error>) => ({
    readTextFile: vi.fn(async (id: string, path: string) => {
      const v = byWorkspace[id];
      if (v instanceof Error) throw v;
      return path === 'META-INF/container.xml' ? CONTAINER_XML : `${OPF_XML}:${id}`;
    }),
  });

  it('returns the workspace whose OPF carries the identifier', async () => {
    vi.spyOn(OPFUtils, 'parseRootfilePath').mockReturnValue('OEBPS/content.opf');
    vi.spyOn(OPFUtils, 'parseOPFMetadataFromString').mockImplementation(
      opf =>
        ({ identifier: opf.endsWith(':ws-2') ? 'urn:uuid:match' : 'urn:uuid:other' }) as ReturnType<
          typeof OPFUtils.parseOPFMetadataFromString
        >
    );
    const found = await findWorkspaceByIdentifier(
      reader({ 'ws-1': 'ok', 'ws-2': 'ok' }),
      [{ id: 'ws-1' }, { id: 'ws-2' }],
      'urn:uuid:match'
    );
    expect(found).toBe('ws-2');
  });

  it('skips unreadable workspaces and returns null on no match', async () => {
    stubParsers('urn:uuid:other');
    const found = await findWorkspaceByIdentifier(
      reader({ 'ws-1': new Error('gone'), 'ws-2': 'ok' }),
      [{ id: 'ws-1' }, { id: 'ws-2' }],
      'urn:uuid:match'
    );
    expect(found).toBeNull();
  });
});
