/**
 * The core's half of the accessible PDF (process/ACCESSIBLE_PDF_PDFKIT.md): lay
 * out the whole book with Paged.js, exactly as Save as PDF does, in a frame off
 * screen; measure it into a page description; and gather the book's font and
 * image files for it. The accessible-pdf plugin writes the PDF from what this returns.
 */
import { BlobURLManager } from '../blob-url/blob-url-manager.js';
import type { FileStorageAPI } from '../storage/index.js';
import type { WorkspaceService, WorkspaceState } from '../services/workspace/workspace.service.js';
import type { PrintSettings } from '../services/settings/settings.service.js';
import { buildBookDocument } from './pdf-export.js';
import { describePages, type PageDescription } from './page-description.js';
import { collectFontFaces, loadFontFiles } from './font-files.js';
import { loadImageFiles } from './image-files.js';
import { translate } from '../i18n/index.js';

const DONE_MESSAGE = 'accessible-pdf-paged';
/**
 * A long book takes a while to paginate, and Firefox much longer than Chrome;
 * only when no page has been added for this long is something wrong.
 */
const STALL_TIMEOUT_MS = 60 * 1000;
/** Marks the book document written into the frame (see describeBook). */
const WRITE_STAMP = 'data-seed-render';
const WRITE_CHECK_MS = 250;
const MAX_REWRITES = 3;

export interface BookDescription {
  description: PageDescription;
  /** One file per `description.fonts` entry, in order. */
  fonts: ArrayBuffer[];
  /** One JPEG or PNG file per `description.images` entry, in order. */
  images: ArrayBuffer[];
  author?: string;
  /** Font families with no face in the book; the PDF can't be written without them. */
  missingFonts: string[];
  /** Chapters that could not be parsed and are not in the description. */
  skippedChapterIds: string[];
}

/** Lay out the book, measure it and gather its fonts and images. */
export async function describeBook(
  workspace: WorkspaceState,
  fileStorage: FileStorageAPI,
  workspaceService: WorkspaceService,
  print?: PrintSettings
): Promise<BookDescription> {
  const { master, skippedChapterIds, meta } = await buildBookDocument(
    workspace,
    workspaceService,
    print,
    { afterMode: 'message', doneMessage: DONE_MESSAGE }
  );

  const blobManager = new BlobURLManager({
    fileStorage,
    basePath: workspace.pathInfo.basePath,
    maxBlobURLs: 2000,
  });
  blobManager.setActiveWorkspace(workspace.id);
  // Laid out in the app's own document at its real size, on screen but unseen:
  // a hidden frame isn't laid out, and the measuring needs the layout; Firefox
  // gives a frame out of view (or `visibility: hidden`) about two animation
  // frames a second, and Paged.js steps once a frame.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: 'fixed',
    insetBlockStart: '0',
    insetInlineStart: '0',
    inlineSize: '1200px',
    blockSize: '900px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.appendChild(frame);
  try {
    const finalDoc = await blobManager.processXHTMLForPreview(master);
    const frameWindow = frame.contentWindow;
    if (!frameWindow || !frame.contentDocument) {
      throw new Error(translate('The book could not be laid out.'));
    }
    const write = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(finalDoc);
      doc.close();
      doc.documentElement?.setAttribute(WRITE_STAMP, '');
    };
    let rewrites = 0;
    let pages = 0;
    let progressAt = Date.now();
    // Every check: Firefox commits a new frame's initial about:blank late, and
    // it can replace the written book seconds into pagination with no event, so
    // a book that's gone is written again; and a layout that adds no page for
    // a while has stalled.
    const check = (fail: (error: Error) => void) => {
      const doc = frame.contentDocument;
      if (!doc?.documentElement?.hasAttribute(WRITE_STAMP)) {
        if (rewrites++ < MAX_REWRITES) write();
        progressAt = Date.now();
        return;
      }
      const count = doc.querySelectorAll('.pagedjs_page').length;
      if (count !== pages) {
        pages = count;
        progressAt = Date.now();
      } else if (Date.now() - progressAt > STALL_TIMEOUT_MS) {
        fail(new Error(translate('The book took too long to lay out.')));
      }
    };
    const paged = waitForMessage(frameWindow, DONE_MESSAGE, check);
    write();
    await paged;
    const frameDoc = frame.contentDocument;
    if (!frameDoc) throw new Error(translate('The book could not be laid out.'));

    const description = describePages(frameDoc, { title: meta.title?.trim() || '' });
    const { files, missing } = await loadFontFiles(collectFontFaces(frameDoc), description.fonts);
    // Before the cleanup below: the images are the frame's blob URLs.
    const images = await loadImageFiles(description);
    return {
      description,
      fonts: files,
      images,
      author: meta.creator?.[0]?.name?.trim() || undefined,
      missingFonts: missing,
      skippedChapterIds,
    };
  } finally {
    frame.remove();
    blobManager.cleanup();
  }
}

/** Wait for `message` from `source`, running `check` meanwhile; it can fail the wait. */
function waitForMessage(
  source: Window,
  message: string,
  check: (fail: (error: Error) => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      clearInterval(timer);
      window.removeEventListener('message', onMessage);
    };
    const timer = setInterval(
      () =>
        check(error => {
          done();
          reject(error);
        }),
      WRITE_CHECK_MS
    );
    function onMessage(event: MessageEvent) {
      if (event.source !== source || event.data !== message) return;
      done();
      resolve();
    }
    window.addEventListener('message', onMessage);
  });
}
