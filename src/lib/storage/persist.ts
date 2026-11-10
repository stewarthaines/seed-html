/**
 * Ask the browser to keep this site's storage when the disk fills up.
 *
 * Without persistence, Chrome evicts a site's whole storage bucket (every
 * book in OPFS and IndexedDB) under disk pressure. Called from the user's
 * Package EPUB click, so Firefox's permission prompt appears in context;
 * Chrome and Safari decide silently. Nothing is shown either way and the
 * caller does not wait: a refusal now can be granted on a later request,
 * and a request once granted resolves at once without asking again.
 *
 * Must be called synchronously inside the click handler, before any await,
 * so the request carries the user's activation.
 */
export function requestPersistentStorage(): void {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!storage || typeof storage.persist !== 'function') return;
  storage.persist().catch((error: unknown) => {
    console.warn('Persistent storage request failed:', error);
  });
}
