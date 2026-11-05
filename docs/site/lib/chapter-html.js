/**
 * Web-only touches to a chapter the app's transform rendered: heading ids, the
 * "On this page" list, and scroll regions for wide tables. The chapter's own
 * markup is otherwise left exactly as the EPUB has it.
 *
 * The app's transform gives a heading an id only when the source asks for one
 * (`## Title {#id}`); those are kept, because cross-references point at them.
 * Every other h2/h3 gets an id from its text so the list can link to it. The
 * EPUB doesn't need these.
 */

import { Window } from 'happy-dom';

const window = new Window();
const parser = new window.DOMParser();

function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/**
 * @param {string} html - the chapter body as rendered by the app's transform
 * @param {{ tableLabel: string }} options - accessible name for table scroll regions
 * @returns {{ html: string, title: string, toc: Array<{id: string, text: string, children: Array<{id: string, text: string}>}> }}
 */
export function processChapter(html, { tableLabel }) {
  const doc = parser.parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  const used = new Set([...doc.querySelectorAll('[id]')].map(el => el.id));

  const uniqueId = base => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  const toc = [];
  for (const heading of doc.querySelectorAll('h2, h3')) {
    const text = heading.textContent.trim();
    if (!heading.id) heading.id = uniqueId(slugify(text));
    const entry = { id: heading.id, text, children: [] };
    if (heading.tagName === 'H2' || toc.length === 0) toc.push(entry);
    else toc[toc.length - 1].children.push(entry);
  }

  // A wide table scrolls inside its own keyboard-focusable region, never the page.
  for (const table of doc.querySelectorAll('table')) {
    const region = doc.createElement('div');
    region.className = 'docs-table';
    region.setAttribute('role', 'region');
    region.setAttribute('tabindex', '0');
    region.setAttribute('aria-label', tableLabel);
    table.replaceWith(region);
    region.append(table);
  }

  const title = doc.querySelector('h1')?.textContent.trim() ?? '';
  return { html: doc.body.innerHTML, title, toc };
}
