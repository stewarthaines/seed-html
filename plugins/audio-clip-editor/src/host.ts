/**
 * Requests to the host that need an answer. `add-media` hands the host a file
 * for the book's manifest (only the host writes the OPF); the host replies
 * with `media-added` carrying the same request id.
 */
import { randomUUID } from './uuid.js';
import type { AddMediaMessage, MediaAddedMessage } from './types.js';

const REPLY_TIMEOUT_MS = 30000;

/** Add a file to the open book; resolves to its OPF-relative href. */
export function addMedia(
  filename: string,
  mediaType: string,
  bytes: ArrayBuffer,
  target: Window = window.parent,
): Promise<string> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('The app did not answer'));
    }, REPLY_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.origin) return;
      const reply = event.data as MediaAddedMessage | undefined;
      if (reply?.type !== 'media-added' || reply.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if ('href' in reply) resolve(reply.href);
      else reject(new Error(reply.error));
    }
    window.addEventListener('message', onMessage);
    const message: AddMediaMessage = { type: 'add-media', requestId, filename, mediaType, bytes };
    target.postMessage(message, window.origin, [bytes]);
  });
}
