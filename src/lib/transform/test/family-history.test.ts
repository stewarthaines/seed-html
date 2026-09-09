/**
 * The family-history extension's DOM transform, driven by an invented family
 * (the Ashbys — no real records: the repo has a public mirror). The script
 * runs in the transform iframe as `transformDOM` with the bundled validator
 * as the global `jsonSchema`; here both are evaluated from the extension
 * folder and given a SOURCE/ tree of frontmatter records, regions records
 * and the schema through a mock ctx.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';

const validatorSrc = readFileSync('extensions/family-history/json-schema.js', 'utf8');
(globalThis as Record<string, unknown>).jsonSchema = new Function(
  `${validatorSrc}\nreturn jsonSchema;`
)();
const src = readFileSync('extensions/family-history/transformFamily.js', 'utf8');
const transformDOM = new Function(`${src}\nreturn transformDOM;`)() as (
  doc: Document,
  idref: string,
  ctx: unknown
) => Promise<Document>;
const SCHEMA = readFileSync('extensions/family-history/person.schema.json', 'utf8');

function parse(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
}

type Rec = Record<string, unknown> | null;

/** A book: chapters in spine order with their records, plus regions data. */
function book(options: {
  chapters: Record<string, Rec>;
  regions?: Record<string, unknown[]>;
  language?: string;
  open?: string;
}) {
  const files: Record<string, string> = {
    'SOURCE/extensions/family-history/person.schema.json': SCHEMA,
  };
  for (const [id, record] of Object.entries(options.chapters)) {
    if (record !== undefined) files[`SOURCE/data/frontmatter/${id}.json`] = JSON.stringify(record);
  }
  for (const [id, regions] of Object.entries(options.regions ?? {})) {
    files[`SOURCE/data/regions/${id}.json`] = JSON.stringify(regions);
  }
  const ids = Object.keys(options.chapters);
  const reads: string[] = [];
  const ctx = {
    language: options.language ?? 'en-AU',
    manifest: [
      { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
      ...ids.map(id => ({ id, href: `Text/${id}.xhtml`, mediaType: 'application/xhtml+xml' })),
      { id: 'family-jpg', href: 'Images/family.jpg', mediaType: 'image/jpeg' },
    ],
    spine: ids.map(idref => ({ idref, linear: true })),
    frontmatter: options.open ? (options.chapters[options.open] ?? null) : null,
    readSourceText: vi.fn(async (path: string) => {
      reads.push(path);
      if (!(path in files)) throw new Error(`Missing: ${path}`);
      return files[path];
    }),
  };
  return { ctx, files, reads };
}

const ASHBYS: Record<string, Rec> = {
  harriet_ashby: {
    display: 'Harriet Ashby',
    birth: '1831-05-02',
    death: 1902,
    birthplace: 'Norwich',
    partner: [
      { id: 'walter_ashby', married: '1852-06-01', married_place: 'Norwich' },
      'silas_moore',
    ],
    others: {
      walter_ashby: { display: 'Walter Ashby', birth: 1828, death: 1869 },
      silas_moore: { display: 'Silas Moore', partner: 'harriet_ashby', married: 1871 },
      ada_ashby: { display: 'Ada Ashby', birth: 1854, parents: ['walter_ashby', 'harriet_ashby'] },
      tom_moore: { display: 'Tom Moore', birth: 1873, parents: ['silas_moore', 'harriet_ashby'] },
    },
  },
  edwin_ashby: {
    display: 'Edwin Ashby',
    nickname: 'Ned',
    birth: '1857-03-09',
    death: '1930~',
    parents: ['walter_ashby', 'harriet_ashby'],
    partner: 'clara_bell',
    married: '1880-10-10',
    married_place: 'Ipswich',
    others: {
      clara_bell: { display: 'Clara Bell', birth: '1859?', parents: ['robert_bell'] },
      robert_bell: { display: 'Robert Bell' },
      rose_ashby: { display: 'Rose Ashby', birth: 1882, parents: ['edwin_ashby', 'clara_bell'] },
    },
  },
  people: null,
};

const ASHBY_REGIONS = {
  harriet_ashby: [
    {
      href: 'Images/family.jpg',
      at: '10,10,20,30',
      of: 'edwin_ashby',
      as: 'Ned',
      row: 'Back',
      size: { w: 1000, h: 800 },
    },
    {
      href: 'Images/family.jpg',
      at: '40,10,20,30',
      of: 'harriet_ashby',
      as: '',
      row: 'Front',
      size: { w: 1000, h: 800 },
    },
  ],
  edwin_ashby: [{ href: 'Images/ned.jpg', at: '0,0,100,100', of: 'edwin_ashby', as: '', row: '' }],
};

const texts = (doc: Document | Element, selector: string) =>
  [...doc.querySelectorAll(selector)].map(el => el.textContent!.replace(/\s+/g, ' ').trim());
/** The items of the nth list under a selector, joined. */
const items = (doc: Document, selector: string, n: number) =>
  texts(doc.querySelectorAll(selector)[n], 'li').join(' | ');
/** Element children of `el` matching a predicate (happy-dom has no :scope). */
const kids = (el: Element, match: (child: Element) => boolean) => [...el.children].filter(match);

describe('family-history: the kinship panel', () => {
  it('renders dates, parents, siblings and partners from the records, linking chapters', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'edwin_ashby' });
    const doc = parse('<h1>Edwin</h1><p>:family:</p><p>Prose.</p>');
    await transformDOM(doc, 'edwin_ashby', ctx);

    const panel = doc.querySelector('div.family')!;
    expect(panel).not.toBeNull();
    expect(doc.querySelector('.family-findings')).toBeNull();
    const paragraphs = texts(doc, 'div.family > p');
    expect(paragraphs[0]).toBe('b. 9 March 1857');
    expect(paragraphs[1]).toBe('d. c. 1930');
    expect(paragraphs[2]).toBe('Parents Walter Ashby and Harriet Ashby');
    // Harriet has a chapter, Walter does not.
    const parents = doc.querySelectorAll('div.family > p')[2];
    expect(parents.querySelector('a')!.getAttribute('href')).toBe('harriet_ashby.xhtml');
    expect(parents.querySelector('span.person-name')!.textContent).toBe('Walter Ashby');
    // Siblings: Ada (full) and Tom (half, through Harriet), in birth order.
    expect(items(doc, 'div.family > ul', 0)).toBe('Ada Ashby (b. 1854) | Tom Moore (b. 1873)');
    // Partner with the record's own marriage date and place.
    expect(texts(doc, 'div.family > p')[4]).toBe('Partner');
    expect(items(doc, 'div.family > ul', 1)).toBe('Clara Bell, m. 10 October 1880, Ipswich');
  });

  it('lists several partners in declared order, merging the other side’s declaration', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'harriet_ashby' });
    const doc = parse('<p>:family:</p>');
    await transformDOM(doc, 'harriet_ashby', ctx);

    expect(texts(doc, 'div.family > p')).toContain('Partners');
    const lists = doc.querySelectorAll('div.family > ul');
    expect(items(doc, 'div.family > ul', lists.length - 1)).toBe(
      'Walter Ashby, m. 1 June 1852, Norwich | Silas Moore, m. 1871'
    );
  });

  it('uses ctx.frontmatter for the open chapter, the store for the rest, and reads nothing without a marker', async () => {
    const fresh = book({ chapters: ASHBYS, open: 'edwin_ashby' });
    fresh.ctx.frontmatter = { ...(ASHBYS.edwin_ashby as object), nickname: 'Fresh' };
    const doc = parse('<p>:family-index:</p>');
    await transformDOM(doc, 'edwin_ashby', fresh.ctx);
    expect(doc.body.textContent).toContain('(Fresh)');
    expect(fresh.reads).not.toContain('SOURCE/data/frontmatter/edwin_ashby.json');
    expect(fresh.reads).toContain('SOURCE/data/frontmatter/harriet_ashby.json');

    const idle = book({ chapters: ASHBYS });
    await transformDOM(parse('<p>Just prose with :family: inside.</p>'), 'edwin_ashby', idle.ctx);
    expect(idle.reads).toEqual([]);
  });

  it('accepts the attributed carrier form of the anchors', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'people' });
    const doc = parse(
      '<p class="family-set"><span class="family" data-of="harriet_ashby"></span></p>'
    );
    await transformDOM(doc, 'people', ctx);
    expect(texts(doc, 'div.family > p')[0]).toBe('b. 2 May 1831, Norwich');
  });

  it('takes a bare :portraits: / :lifeline: / :tree: as the chapter’s own person', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'harriet_ashby', regions: ASHBY_REGIONS });
    const doc = parse('<p>:portraits:</p><p>:lifeline:</p><p>:tree:</p><p>:wink:</p>');
    await transformDOM(doc, 'harriet_ashby', ctx);
    expect(doc.querySelector('.portrait-strip .portrait')).not.toBeNull();
    expect(doc.querySelector('.lifeline-group .lifeline-name')!.textContent).toBe('Harriet Ashby');
    expect(doc.querySelector('div.tree .tree-couple')!.textContent).toContain('Harriet Ashby');
    expect(doc.body.textContent).toContain(':wink:');
  });

  it('speaks German when the book does', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'edwin_ashby', language: 'de' });
    const doc = parse('<p>:family:</p>');
    await transformDOM(doc, 'edwin_ashby', ctx);
    const paragraphs = texts(doc, 'div.family > p');
    expect(paragraphs[0]).toBe('geb. 9. März 1857');
    expect(paragraphs[2]).toBe('Eltern Walter Ashby und Harriet Ashby');
    expect(paragraphs).toContain('Geschwister');
  });
});

describe('family-history: the index', () => {
  it('groups given names under surnames, nickname in brackets, suffix kept with the given names', async () => {
    const chapters: Record<string, Rec> = {
      ...ASHBYS,
      people: {
        others: { andrew_haddow_1828: { display: 'Andrew Haddow Snr', nickname: 'Andy' } },
      },
    };
    const { ctx } = book({ chapters, open: 'people' });
    const doc = parse('<p>:family-index:</p>');
    await transformDOM(doc, 'people', ctx);

    expect(texts(doc, 'h3')).toEqual(['Ashby', 'Bell', 'Haddow', 'Moore']);
    const ashby = doc.querySelectorAll('ul')[0];
    expect(texts(ashby, 'li')).toEqual(['Ada', 'Edwin (Ned)', 'Harriet', 'Rose', 'Walter']);
    expect(ashby.querySelector('a[href="edwin_ashby.xhtml"]')).not.toBeNull();
    expect(texts(doc, 'ul')[2]).toBe('Andrew Snr (Andy)');
  });
});

describe('family-history: findings', () => {
  it('reports schema violations, a married beside a partner list, a null stub silently, an orphan, a duplicate', async () => {
    const chapters: Record<string, Rec> = {
      one: {
        display: 'One',
        birth: 'c. 1861',
        death: '1983-09-25 heart attack',
        marriedlocation: 'Carlton',
        partner: ['a', 'nothing_yet'],
        married: 1900,
        others: {
          nothing_yet: null,
          orphan: { display: 'Orphan' },
          dup: { display: 'First', parents: ['one'] },
          spouse_by_name: { display: 'Spouse' },
          self_declared: { display: 'Self Declared', partner: 'one' },
          two: { display: 'Stub Two' },
        },
      },
      two: {
        display: 'Chapter Two',
        birth: 1901,
        partner: 'spouse_by_name',
        others: { dup: { display: 'Second' }, kid: { parents: ['two'], birth: '19XX' } },
      },
    };
    const { ctx } = book({ chapters, open: 'two' });
    const doc = parse('<p>:family:</p>');
    await transformDOM(doc, 'two', ctx);

    const findings = texts(doc, '.family-findings li');
    expect(findings).toEqual([
      '⚠ one: birth is not an EDTF date',
      '⚠ one: death is not an EDTF date',
      '⚠ one: unknown key "marriedlocation"',
      '⚠ dup: also defined in one, which wins — consolidate',
      '⚠ one: married / married_place beside a list of partners — move them into the list',
      '⚠ orphan: orphan record — no parents, nobody’s partner or parent',
    ]);
    // Precedence: chapter over stub, earlier chapter over later.
    expect(doc.body.textContent).not.toContain('Stub Two');
    const index = parse('<p>:family-index:</p>');
    await transformDOM(index, 'two', book({ chapters, open: 'two' }).ctx);
    expect(index.body.textContent).toContain('First');
    expect(index.body.textContent).not.toContain('Second');
  });

  it('accepts integer years and every EDTF form the plan names', async () => {
    const chapters: Record<string, Rec> = {
      dates: {
        birth: 1922,
        death: '1922-12',
        married: '187X-08-22',
        partner: 'x',
        others: {
          a: { birth: '1837?', death: '1837~', parents: ['dates'] },
          b: { birth: '1866/1868', death: '/1948', parents: ['dates'] },
          c: { birth: '../1948', death: '1901-02-03%', parents: ['dates'] },
        },
      },
    };
    const { ctx } = book({ chapters, open: 'dates' });
    const doc = parse('<p>:family:</p>');
    await transformDOM(doc, 'dates', ctx);
    expect(doc.querySelector('.family-findings')).toBeNull();
    expect(texts(doc, 'div.family > p')[0]).toBe('b. 1922');
    expect(texts(doc, 'div.family > p')[1]).toBe('d. December 1922');
  });

  it('flags a photograph region naming an unknown person', async () => {
    const { ctx } = book({
      chapters: ASHBYS,
      open: 'edwin_ashby',
      regions: {
        edwin_ashby: [{ href: 'Images/x.jpg', at: '1,1,1,1', of: 'nobody', as: '', row: '' }],
      },
    });
    const doc = parse('<p>:family:</p>');
    await transformDOM(doc, 'edwin_ashby', ctx);
    expect(texts(doc, '.family-findings li')).toEqual([
      '⚠ nobody: a photograph names this id, which is not a person record',
    ]);
  });

  it('warns and skips validation when the schema is missing, still rendering', async () => {
    const { ctx, files } = book({ chapters: ASHBYS, open: 'edwin_ashby' });
    delete files['SOURCE/extensions/family-history/person.schema.json'];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = parse('<p>:family:</p>');
    await transformDOM(doc, 'edwin_ashby', ctx);
    expect(doc.querySelector('div.family > p')).not.toBeNull();
    expect(warn.mock.calls.some(call => String(call[0]).includes('not validated'))).toBe(true);
    warn.mockRestore();
  });
});

describe('family-history: portraits', () => {
  it('crops every photograph naming the person from the regions records, linking the chapter that shows it', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'edwin_ashby', regions: ASHBY_REGIONS });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = parse(
      '<p class="portraits-set"><span class="portraits" data-of="edwin_ashby"></span></p>'
    );
    await transformDOM(doc, 'edwin_ashby', ctx);
    warn.mockRestore();

    const strip = doc.querySelector('.portrait-strip')!;
    expect(strip).not.toBeNull();
    // The family photograph (sized) renders; ned.jpg has no size and is skipped.
    const crops = strip.querySelectorAll('.portrait');
    expect(crops.length).toBe(1);
    const crop = crops[0];
    expect(crop.tagName).toBe('A');
    expect(crop.getAttribute('href')).toBe('harriet_ashby.xhtml');
    expect(crop.getAttribute('aria-label')).toBe('Edwin Ashby in a photograph in Harriet Ashby');
    const style = crop.getAttribute('style')!;
    // 20% × 1000 wide by 30% × 800 high → aspect 200/240; 7em tall.
    expect(style).toContain('width:5.83em; height:7em;');
    expect(style).toContain("background-image:url('../Images/family.jpg')");
    expect(style).toContain('background-size:500% auto');
    expect(style).toContain('background-position:12.5% 14.29%');
  });

  it('renders the chapter’s own photograph as a plain image and removes an empty strip', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'harriet_ashby', regions: ASHBY_REGIONS });
    const doc = parse(
      '<p class="portraits-set"><span class="portraits" data-of="harriet_ashby"></span></p>' +
        '<p class="portraits-set"><span class="portraits" data-of="robert_bell"></span></p>'
    );
    await transformDOM(doc, 'harriet_ashby', ctx);
    const crops = doc.querySelectorAll('.portrait');
    expect(crops.length).toBe(1);
    expect(crops[0].tagName).toBe('SPAN');
    expect(crops[0].getAttribute('role')).toBe('img');
    expect(crops[0].getAttribute('aria-label')).toBe(
      'Harriet Ashby in a photograph in this chapter'
    );
    expect(doc.querySelectorAll('.portrait-strip').length).toBe(1);
    expect(doc.querySelector('p.portraits-set')).toBeNull();
  });
});

describe('family-history: lifelines', () => {
  it('draws one set as one chart on a shared scale, with a spoken summary per row', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'harriet_ashby' });
    const doc = parse(
      '<p class="lifeline-set two-thirds">' +
        '<span class="lifeline" data-of="harriet_ashby" data-as="Harriet"></span>' +
        '<span class="lifeline" data-of="walter_ashby" data-include="birth,death"></span>' +
        '<span class="lifeline" data-of="robert_bell"></span>' +
        '</p>'
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await transformDOM(doc, 'harriet_ashby', ctx);
    warn.mockRestore();

    const group = doc.querySelector('.lifeline-group')!;
    expect(group.getAttribute('class')).toBe('lifeline-group two-thirds');
    const rows = group.querySelectorAll('.lifeline-row');
    expect(rows.length).toBe(2); // Robert has no dates
    expect(rows[0].querySelector('.lifeline-name')!.textContent).toBe('Harriet');
    expect(rows[0].querySelector('.visually-hidden')!.textContent).toBe(
      ': born 1831, married 1852, married 1871, died 1902'
    );
    expect(rows[0].querySelectorAll('.lifeline-marriage').length).toBe(2);
    // Shared scale: Walter's 1828 birth is the earliest event, at the left pad.
    const walterBirth = rows[1].querySelector('.lifeline-birth') as HTMLElement;
    const harrietBirth = rows[0].querySelector('.lifeline-birth') as HTMLElement;
    expect(parseFloat(walterBirth.style.left)).toBeLessThan(parseFloat(harrietBirth.style.left));
    expect(rows[1].querySelector('a')).toBeNull(); // Walter has no chapter
  });
});

describe('family-history: trees', () => {
  it('descendant mode groups children by partnership, later partners as remarriages', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'people' });
    const doc = parse(
      '<p class="tree-set"><span class="tree" data-of="harriet_ashby" data-depth="2"></span></p>'
    );
    await transformDOM(doc, 'people', ctx);

    const tree = doc.querySelector('div.tree')!;
    const root = tree.querySelector('ul > li')!;
    const couples = [...root.children].filter(el => el.classList.contains('tree-couple'));
    expect(couples[0].textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Harriet Ashby (1831–1902), born 1831, died 1902, = married Walter Ashby (1828–1869), born 1828, died 1869,m. 1852 in 1852'
    );
    expect(couples[1].classList.contains('tree-remarried')).toBe(true);
    expect(couples[1].textContent).toContain('also married');
    expect(couples[1].textContent).toContain('Silas Moore');
    // Walter's children first, then Silas's.
    const lists = [...root.children].filter(el => el.tagName === 'UL');
    expect(lists.length).toBe(2);
    const heads = (ul: Element) =>
      kids(ul, li => li.tagName === 'LI').map(li =>
        li.querySelector('.tree-couple > .tree-person')!.textContent!.replace(/\s+/g, ' ').trim()
      );
    expect(heads(lists[0])).toEqual([
      'Ada Ashby (b. 1854), born 1854,',
      'Edwin Ashby (1857–c. 1930), born 1857, died c. 1930,',
    ]);
    expect(heads(lists[1])).toEqual(['Tom Moore (b. 1873), born 1873,']);
    // Depth 2 reaches Rose under Edwin; Edwin's line links to his chapter.
    expect(lists[0].querySelector('a[href="edwin_ashby.xhtml"]')).not.toBeNull();
    expect(lists[0].textContent).toContain('Rose Ashby');
  });

  it('stands a count in for a hidden generation at the depth cut', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'people' });
    const doc = parse(
      '<p class="tree-set"><span class="tree" data-of="edwin_ashby" data-depth="0"></span></p>'
    );
    await transformDOM(doc, 'people', ctx);
    const more = doc.querySelector('.tree-more')!;
    expect(more.textContent).toBe('… 1 more');
    expect(more.getAttribute('href')).toBe('edwin_ashby.xhtml');
  });

  it('path mode roots at the shared ancestor with one chain to each end', async () => {
    const { ctx } = book({ chapters: ASHBYS, open: 'people' });
    const doc = parse(
      '<p class="tree-set"><span class="tree" data-of="rose_ashby" data-to="tom_moore"></span></p>'
    );
    await transformDOM(doc, 'people', ctx);
    const root = doc.querySelector('div.tree > ul > li')!;
    expect(kids(root, el => el.classList.contains('tree-couple'))[0].textContent).toContain(
      'Harriet Ashby'
    );
    const chains = kids(kids(root, el => el.tagName === 'UL')[0], el => el.tagName === 'LI');
    expect(chains.length).toBe(2);
    // Rose's chain descends through Edwin (and Clara), Tom's is Tom himself.
    expect(chains[0].textContent).toContain('Edwin Ashby');
    expect(chains[0].textContent).toContain('Clara Bell');
    expect(chains[0].textContent).toContain('Rose Ashby');
    expect(chains[1].textContent).toContain('Tom Moore');
  });
});
