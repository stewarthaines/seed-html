/**
 * Boot-time handling of an embedded EPUB payload — the "opening" half of
 * Package as SEED.html (process/SEED_HTML_PACKAGE.md §2).
 *
 * A SEED.html artifact carries one Active EPUB in the seedhtml-payload slot.
 * The slot is static markup and cannot be cleared after import, so this runs
 * on EVERY load of such a file — the dc:identifier dedupe below is what makes
 * that harmless: double-clicking the same file twice must not silently mint
 * duplicate projects.
 *
 * App.svelte owns the flow (dialog, import, navigation); this module owns the
 * mechanics: read the slot, extract the payload's identity, find a matching
 * existing project.
 */

import { base64ToBytes } from '../epub/html-payload.js';
import { SEED_PAYLOAD_ID } from '../epub/html-payload.js';
import { Zip } from '../zip/index.js';
import { OPFUtils } from '../epub/opf-utils.js';
import type { WorkspaceInfo } from '../workspace/types.js';

/** Minimal identity read from the payload EPUB, for dedupe and the dialog. */
export interface EmbeddedEpubIdentity {
  identifier?: string;
  title?: string;
}

/** The storage reads this module needs (a slice of FileStorageAPI). */
interface TextFileReader {
  readTextFile(workspaceId: string, path: string): Promise<string>;
}

/**
 * Read the embedded payload from the document's slot. Returns null when the
 * slot is absent or empty (the normal hosted/standalone app); throws on
 * malformed base64 (a corrupted artifact — caller shows the import error).
 */
export function readEmbeddedPayload(doc: Document = document): Uint8Array | null {
  const text = doc.getElementById(SEED_PAYLOAD_ID)?.textContent?.trim();
  if (!text) return null;
  return base64ToBytes(text);
}

/**
 * Pull dc:identifier and title out of the payload EPUB without unpacking it
 * to storage: container.xml → rootfile path → OPF metadata.
 */
export async function readEpubIdentity(epubBytes: Uint8Array): Promise<EmbeddedEpubIdentity> {
  const buffer = epubBytes.buffer.slice(
    epubBytes.byteOffset,
    epubBytes.byteOffset + epubBytes.byteLength
  ) as ArrayBuffer;
  const zip = new Zip(buffer);

  const containerEntry = zip.entries.find(e => e.fileName === 'META-INF/container.xml');
  if (!containerEntry) return {};
  const containerXml = await (await containerEntry.extract()).text();
  const rootfilePath = OPFUtils.parseRootfilePath(containerXml);

  const opfEntry = zip.entries.find(e => e.fileName === rootfilePath);
  if (!opfEntry) return {};
  const opfContent = await (await opfEntry.extract()).text();
  const metadata = OPFUtils.parseOPFMetadataFromString(opfContent);
  return { identifier: metadata.identifier || undefined, title: metadata.title || undefined };
}

/**
 * Find an existing project whose OPF carries `identifier`. Reads each
 * workspace's container.xml + OPF directly (two small text reads); a
 * workspace that fails to read is skipped, never fatal — worst case the
 * payload imports as a fresh copy.
 */
export async function findWorkspaceByIdentifier(
  fileStorage: TextFileReader,
  workspaces: Pick<WorkspaceInfo, 'id'>[],
  identifier: string
): Promise<string | null> {
  for (const { id } of workspaces) {
    try {
      const containerXml = await fileStorage.readTextFile(id, 'META-INF/container.xml');
      const rootfilePath = OPFUtils.parseRootfilePath(containerXml);
      const opfContent = await fileStorage.readTextFile(id, rootfilePath);
      const metadata = OPFUtils.parseOPFMetadataFromString(opfContent);
      if (metadata.identifier === identifier) return id;
    } catch {
      continue;
    }
  }
  return null;
}
