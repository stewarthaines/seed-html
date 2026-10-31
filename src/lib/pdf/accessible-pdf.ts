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
/** A long book takes a while to paginate; past this, something is wrong. */
const PAGINATION_TIMEOUT_MS = 5 * 60 * 1000;

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
  // Laid out in the app's own document, off screen at its real size: a hidden
  // frame isn't laid out, and the measuring needs the layout.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: 'fixed',
    insetBlockStart: '0',
    insetInlineStart: '-20000px',
    inlineSize: '1200px',
    blockSize: '900px',
    border: '0',
  });
  document.body.appendChild(frame);
  try {
    const finalDoc = await blobManager.processXHTMLForPreview(master);
    const frameWindow = frame.contentWindow;
    const frameDoc = frame.contentDocument;
    if (!frameWindow || !frameDoc) throw new Error(translate('The book could not be laid out.'));
    const paged = waitForMessage(frameWindow, DONE_MESSAGE, PAGINATION_TIMEOUT_MS);
    frameDoc.open();
    frameDoc.write(finalDoc);
    frameDoc.close();
    await paged;

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

function waitForMessage(source: Window, message: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(translate('The book took too long to lay out.')));
    }, timeoutMs);
    function onMessage(event: MessageEvent) {
      if (event.source !== source || event.data !== message) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve();
    }
    window.addEventListener('message', onMessage);
  });
}
