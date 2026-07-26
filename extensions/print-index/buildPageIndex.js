// Print Index — assembler (process/PDF_PAGE_INDEX.md). A DOM transform with two
// modes, both fed by the per-chapter page maps the capture head.xml writes to
// SOURCE/data/preview/<idref>/pagemap.json:
//
//   Generate — fill an element marked  id="page-index"  / [data-page-index]  with
//              the whole index (every captured heading + its absolute page).
//   Decorate — append a print page number to every internal link inside an element
//              marked  id="data-page-refs" / [data-page-refs]  (a hand-authored
//              contents page).
//
// Absolute pages come from ctx.spine (reading order) + each chapter's pageCount.
// A chapter's start page is only known once every preceding chapter has a pagemap;
// links/entries past the first un-previewed chapter are left un-numbered rather
// than shown wrong. Page numbers go in .pdf-page-ref, which page-index.css shows
// only under @media print.
async function transformDOM(htmlDocument, idref, ctx) {
  if (!ctx || !Array.isArray(ctx.spine)) return htmlDocument;

  const manifest = Array.isArray(ctx.manifest) ? ctx.manifest : [];
  const hrefFor = ref => (manifest.find(m => m.id === ref) || {}).href || ref + '.xhtml';

  // One pass over the pagemaps in spine order.
  const offset = {}; // idref -> start page, or null once an earlier chapter is missing
  const chapterMap = {}; // idref -> parsed pagemap (for the generate mode)
  const headingPage = {}; // idref -> { headingId: relativePage }
  let acc = 0;
  let reliable = true;
  for (const s of ctx.spine.filter(x => x.linear !== false)) {
    offset[s.idref] = reliable ? acc : null;
    headingPage[s.idref] = {};
    let map = null;
    try {
      map = JSON.parse(await ctx.readSourceText('data/preview/' + s.idref + '/pagemap.json'));
    } catch (e) {
      map = null; // not previewed yet
    }
    if (map) {
      chapterMap[s.idref] = map;
      for (const e of map.entries || []) if (e.id) headingPage[s.idref][e.id] = e.page;
      acc += map.pageCount || 0;
    } else {
      reliable = false; // unknown pageCount → every later chapter's offset is unknown
    }
  }

  const pageRef = page => {
    const num = htmlDocument.createElement('span');
    num.className = 'pdf-page-ref';
    num.textContent = String(page);
    return num;
  };

  // Generate mode.
  const genTarget = htmlDocument.querySelector('#page-index, [data-page-index]');
  if (genTarget) {
    const list = htmlDocument.createElement('ol');
    list.className = 'page-index';
    for (const s of ctx.spine.filter(x => x.linear !== false)) {
      const off = offset[s.idref];
      const map = chapterMap[s.idref];
      if (off == null || !map) continue;
      for (const e of map.entries || []) {
        const li = htmlDocument.createElement('li');
        li.className = 'page-index-entry level-' + (e.level || 1);
        const label = htmlDocument.createElement('span');
        label.className = 'page-index-text';
        if (e.id) {
          const a = htmlDocument.createElement('a');
          a.setAttribute('href', hrefFor(s.idref) + '#' + e.id);
          a.textContent = e.text;
          label.appendChild(a);
        } else {
          label.textContent = e.text;
        }
        li.appendChild(label);
        li.appendChild(pageRef(off + e.page));
        list.appendChild(li);
      }
    }
    genTarget.textContent = '';
    genTarget.appendChild(list);
  }

  // Decorate mode.
  const scope = htmlDocument.querySelector('#data-page-refs, [data-page-refs]');
  if (scope) {
    const pageForHref = href => {
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) return null; // external/protocol
      const parts = href.split('#');
      const frag = parts[1];
      const file = (parts[0] || '').split('/').pop();
      const ref = file ? file.replace(/\.x?html$/i, '') : idref; // <idref>.xhtml convention
      const off = offset[ref];
      if (off == null) return null; // not a spine chapter, or offset not yet known
      const rel = frag && headingPage[ref][frag] != null ? headingPage[ref][frag] : 1;
      return off + rel;
    };
    const links = scope.querySelectorAll('a[href]');
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const page = pageForHref(a.getAttribute('href'));
      if (page == null) continue;
      const li = a.closest('li');
      if (li) li.appendChild(pageRef(page));
      else a.after(pageRef(page));
    }
  }

  return htmlDocument;
}
