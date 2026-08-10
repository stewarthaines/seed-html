// Message types for main app <-> plugin communication.
// Mirrors src/lib/plugins/contract.ts (the plugin builds separately).

/** main → plugin: hands over the project workspace root. */
export interface InitMessage {
  type: 'init';
  projectId: string;
  /** Absent where handles can't be cloned into iframes (WebKit/iPadOS). */
  opfsDirHandle?: FileSystemDirectoryHandle;
  /** OPFS path segments to the same directory; the plugin walks these when
      the handle is absent (same origin, same OPFS root). */
  opfsDirPath?: string[];
}

/** main → plugin: ambient host environment (theme, locale, direction). */
export interface ContextMessage {
  type: 'context';
  theme: 'light' | 'dark';
  locale: string;
  dir: 'ltr' | 'rtl';
  messages?: Record<string, string>;
  activeIdentifier?: string;
  /** Spine item id of the chapter the editor has open — the panel lists only
   *  the images that chapter renders. Absent → every manifested image. */
  activeChapterId?: string;
}

export type MainToPlugin = InitMessage | ContextMessage;

/** plugin → main: insert a string at the editor cursor. */
export interface InsertMessage {
  type: 'insert';
  content: string;
}

/** An image declared in the OPF manifest. */
export interface ImageManifestItem {
  id: string;
  /** Manifest href, relative to the OPF's directory (e.g. `Images/x.jpg`).
   *  This is the key the chapter's `photos:` block uses. */
  href: string;
  /** Workspace-relative path, for reading the bytes (e.g. `OEBPS/Images/x.jpg`). */
  storagePath: string;
  mediaType: string;
}

/**
 * One drawn region. Geometry is in PERCENT of the image's own box, so it
 * survives the image being re-exported at a different size — and matches the
 * `xywh=percent:` form of W3C Media Fragments.
 */
export interface Region {
  /** Local list key only; never written to the source. */
  key: number;
  /** A person id (linked when they have a chapter) or a name as authored. */
  person: string;
  /** Display override: link the person's chapter but show this text ("Ted"). */
  as?: string;
  /** Row label — the caption groups by this ("Back", "Front", "Pictured"). */
  row: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Where the number sits, as the badge's top-left in the same percent space.
   * Absent means "wherever the default puts it" — stored only once the author
   * has moved it, so the common case stays terse and hand-editable.
   */
  badge?: { x: number; y: number };
}

/** A region as persisted — the list key is a runtime detail, not stored. */
export type SavedRegion = Omit<Region, 'key'>;

/** One image's stored work: its pixel size (what lets a crop of a region know
 *  its aspect ratio) and the drawn regions. */
export interface RegionEntry {
  size?: { w: number; h: number };
  regions: SavedRegion[];
}

/**
 * The per-project region library. Keyed by the image's OPF-relative href, the
 * same key the chapter's `photos:` block uses.
 *
 * This schema is PUBLIC, not plugin-private: a book's transform scripts may
 * read this file (via ctx.readSourceText) as the canonical record of who is
 * pictured where — the Haines family book renders captions, face overlays
 * and portrait crops straight from it. Change it additively, and keep
 * loadRegions able to read every version ever written.
 */
export interface RegionStore {
  version: 2;
  files: Record<string, RegionEntry>;
}
