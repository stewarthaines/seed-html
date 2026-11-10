/**
 * Talking to the host: insert text at the editor cursor, and add a file to
 * the book's manifest (the host owns manifest writes) — answered by request id.
 */
import type { MediaAddedMessage } from './types.js';

const pending = new Map<string, { resolve: (href: string) => void; reject: (error: Error) => void }>();
let nextId = 1;

export function insertText(content: string): void {
  window.parent.postMessage({ type: 'insert', content }, window.origin);
}

export function addMedia(filename: string, mediaType: string, text: string, folder: string): Promise<string> {
  const requestId = `place-maps-${nextId++}`;
  const bytes = new TextEncoder().encode(text).buffer;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    window.parent.postMessage({ type: 'add-media', requestId, filename, mediaType, bytes, folder }, window.origin, [
      bytes,
    ]);
  });
}

export function answerMediaAdded(message: MediaAddedMessage): void {
  const waiting = pending.get(message.requestId);
  if (!waiting) return;
  pending.delete(message.requestId);
  if ('href' in message) waiting.resolve(message.href);
  else waiting.reject(new Error(message.error));
}
