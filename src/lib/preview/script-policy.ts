/**
 * Scripts in a book made elsewhere run in the preview only when the reader
 * says so for that book (process/PREVIEW_SERVED_BOOK.md). Until then the
 * chapter is previewed without its `<script>` elements, inline event
 * handlers and `javascript:` links. Books made here are never stripped.
 */

const JAVASCRIPT_URL = /^\s*javascript:/i;

/** Remove every way a document can run script, in place. */
export function stripScriptsFromDocument(doc: Document): void {
  for (const script of Array.from(doc.querySelectorAll('script'))) script.remove();
  for (const element of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
      } else if (
        (name === 'href' || name === 'xlink:href' || name === 'src') &&
        JAVASCRIPT_URL.test(attr.value)
      ) {
        element.removeAttribute(attr.name);
      }
    }
  }
}

/**
 * The same for a serialized chapter. Parsed as HTML (the preview writes it
 * as HTML), so the result is HTML serialization of the same tree.
 */
export function stripScripts(xhtml: string): string {
  const doc = new DOMParser().parseFromString(xhtml, 'text/html');
  stripScriptsFromDocument(doc);
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : '';
  return doctype + doc.documentElement.outerHTML;
}

/** Whether a chapter has anything the policy would remove. */
export function hasScripts(xhtml: string): boolean {
  return /<script[\s>]|\son[a-z]+\s*=|javascript:/i.test(xhtml);
}
