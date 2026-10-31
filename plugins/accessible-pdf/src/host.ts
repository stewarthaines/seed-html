/**
 * Ask the host for the open book, laid out and measured. Laying out a long
 * book takes a while, so the wait is generous; the host gives up on its own
 * well before this.
 */
import { translate } from './i18n.js';
import type { BookDescribedMessage, DescribeBookMessage, DescribedBook } from './types.js';

const REPLY_TIMEOUT_MS = 6 * 60 * 1000;

export function describeBook(target: Window = window.parent): Promise<DescribedBook> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(translate('The app did not answer.')));
    }, REPLY_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.origin) return;
      const reply = event.data as BookDescribedMessage | undefined;
      if (reply?.type !== 'book-described' || reply.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if ('error' in reply) reject(new Error(reply.error));
      else resolve(reply);
    }
    window.addEventListener('message', onMessage);
    const message: DescribeBookMessage = { type: 'describe-book', requestId };
    target.postMessage(message, window.origin);
  });
}
