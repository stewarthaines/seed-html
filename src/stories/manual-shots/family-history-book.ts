/**
 * The invented Fairweather family: the sample book behind the screenshots in
 * Book Recipes › Family history books (docs/user/seed.html-recipes/). Three
 * generations in Norwich, with three generated photographs. Nothing here is a
 * real family.
 *
 * familyHistoryBook(demo) seeds the whole book plus one extra chapter, the
 * `demo` chapter a story opens, whose source is the markup the shot shows.
 * The record copies and the photographs' regions records are written up
 * front, so the first render of any chapter sees the whole family.
 */

import type { SeedChapter, SeedProjectOptions } from '../utils/seed-project';
import photo1852 from './assets/family-history/fairweather_edmund_alice_1852.jpg?url';
import photo1877 from './assets/family-history/fairweather_walter_margaret_1877.jpg?url';
import photo1892 from './assets/family-history/fairweather_family_1892.jpg?url';

export const FAMILY_BOOK_TITLE = 'The Fairweathers of Norwich';

const PHOTOS = {
  edmund_alice: {
    href: 'Images/fairweather_edmund_alice_1852.jpg',
    url: photo1852,
    alt: 'A studio portrait of a young woman seated in a dark dress with a lace collar, and a young man in a frock coat standing beside her with his hand on her shoulder',
    title: 'Alice and Edmund Fairweather, about 1852',
  },
  wedding: {
    href: 'Images/fairweather_walter_margaret_1877.jpg',
    url: photo1877,
    alt: 'A wedding portrait of a young woman in a dark buttoned dress with a veil, standing beside a seated young man with a moustache and a flower in his buttonhole, in front of a painted balustrade',
    title: 'Margaret and Walter Fairweather on their wedding day, 1877',
  },
  group: {
    href: 'Images/fairweather_family_1892.jpg',
    url: photo1892,
    alt: 'A studio group of four: a white-bearded old man seated in the centre, a boy standing at the left, a woman in a dark buttoned dress standing behind, and a girl in a sailor-collared dress standing at the right',
    title: 'Three generations, about 1892. Walter is not in the photograph.',
  },
};

type Photo = (typeof PHOTOS)[keyof typeof PHOTOS];
interface Region {
  at: string;
  of: string;
  as: string;
  row?: string;
}

const REGIONS: Record<string, { photo: Photo; regions: Region[] }> = {
  edmund_fairweather: {
    photo: PHOTOS.edmund_alice,
    regions: [
      { at: '26,24,14,20', of: 'alice_fairweather', as: 'Alice' },
      { at: '57,12,15,21', of: 'edmund_fairweather', as: 'Edmund' },
    ],
  },
  walter_fairweather: {
    photo: PHOTOS.wedding,
    regions: [
      { at: '25,21,17,20', of: 'margaret_fairweather', as: 'Margaret' },
      { at: '60,25,18,26', of: 'walter_fairweather', as: 'Walter' },
    ],
  },
  henry_fairweather: {
    photo: PHOTOS.group,
    regions: [
      { at: '16,22,11,14', of: 'henry_fairweather', as: 'Henry', row: 'Standing' },
      { at: '63,18,13,14', of: 'margaret_fairweather', as: 'Margaret', row: 'Standing' },
      { at: '75,24,11,13', of: 'beatrice_beckwith', as: 'Beatrice', row: 'Standing' },
      { at: '39,32,16,22', of: 'edmund_fairweather', as: 'Edmund', row: 'Seated' },
    ],
  },
};

/** A photograph and its named faces, as a chapter writes them. */
export function photoMarkup(chapterId: keyof typeof REGIONS): string {
  const { photo, regions } = REGIONS[chapterId];
  const lines = regions.map(r => {
    const row = r.row ? ` row="${r.row}"` : '';
    return `:region:{at="${r.at}" of=${r.of} as="${r.as}"${row}}`;
  });
  return [`![${photo.alt}](../${photo.href}){.figure title="${photo.title}"}`, '', ...lines].join(
    '\n'
  );
}

/** The regions record photo-regions writes when the chapter renders. */
function regionsRecord(chapterId: string): string {
  const { photo, regions } = REGIONS[chapterId];
  const base = photo.href.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
  return JSON.stringify(
    regions.map(r => ({
      href: photo.href,
      at: r.at,
      of: r.of,
      as: r.as,
      ...(r.row ? { row: r.row } : {}),
      id: `photo-${chapterId}-${base}`,
      size: { w: 1024, h: 1024 },
    }))
  );
}

/**
 * The Photo Regions panel's own library (plugins/photo-regions/src/library.ts):
 * the boxes as the panel drew them, so the panel reopens each photograph with
 * its faces in place.
 */
function panelLibrary(): string {
  const files: Record<string, unknown> = {};
  for (const { photo, regions } of Object.values(REGIONS)) {
    files[photo.href] = {
      size: { w: 1024, h: 1024 },
      regions: regions.map(r => {
        const [x, y, w, h] = r.at.split(',').map(Number);
        return { person: r.of, as: r.as, row: r.row ?? '', x, y, w, h };
      }),
    };
  }
  return JSON.stringify({ version: 2, files }, null, 2);
}

export const WALTER_RECORD = `---
display: Walter Fairweather
birth: 1853
birthplace: Norwich
parents: [edmund_fairweather, alice_fairweather]
partner: margaret_fairweather
married: 1877-09-14
married_place: Norwich
---`;

const CHAPTERS: SeedChapter[] = [
  {
    id: 'about',
    title: 'About this book',
    sourceText: `# About this book

The Fairweathers and Beckwiths are an invented family: three generations in Norwich, from Edmund Fairweather's birth in 1828 to his grandchildren in the 1880s. The photographs are made up too.

This is a sample book, made with SEED.html to show how a family history book is put together. Open it in SEED.html to see the source of every chapter. Each person's chapter starts with their record, and the family panels, trees, lifelines, portraits and index are all drawn from those records.

The page [Family history books](https://readitinabook.com/docs/en/recipes/family-history-books/) explains how to make a book like this one.`,
  },
  {
    id: 'family',
    title: 'The family',
    sourceText: `# The family

Edmund Fairweather's descendants, two generations down:

:tree:{of=edmund_fairweather depth=2}

## Three generations

:lifeline:{of=edmund_fairweather as=Edmund}
:lifeline:{of=walter_fairweather as=Walter}
:lifeline:{of=henry_fairweather as=Henry}`,
  },
  {
    id: 'edmund_fairweather',
    title: 'Edmund Fairweather',
    sourceText: `---
display: Edmund Fairweather
birth: 1828-03-12
birthplace: Norwich
death: 1901-05-20
deathplace: Norwich
partner:
  - { id: alice_fairweather, married: 1852-06-01, married_place: "St Peter Mancroft, Norwich" }
  - { id: constance_judd, married: 1874 }
others:
  constance_judd:
    display: Constance Fairweather
    # Census ages point to 1838-1842; no baptism found. See research, constance-birth.
    birth: 1840~
    birthplace: Diss
---

# Edmund Fairweather

:family:

Edmund trained as a wheelwright before taking over his father's yard on King Street,[^yard] and outlived his first wife by more than thirty years.

${photoMarkup('edmund_fairweather')}

## Portraits

:portraits:

[^yard]: Trade directories list the yard under Edmund's name from 1858; see [the research notes](research.xhtml#edmund-yard).`,
  },
  {
    id: 'alice_fairweather',
    title: 'Alice Fairweather',
    sourceText: `---
display: Alice Fairweather
birth: 1830~
birthplace: Norwich
death: 1869-11-02
deathplace: Norwich
partner: edmund_fairweather
married: 1852-06-01
married_place: "St Peter Mancroft, Norwich"
---

# Alice Fairweather

:family:`,
  },
  {
    id: 'walter_fairweather',
    title: 'Walter Fairweather',
    sourceText: `${WALTER_RECORD}

# Walter Fairweather

:family:

Walter followed his father into the wheelwright's trade.

${photoMarkup('walter_fairweather')}`,
  },
  {
    id: 'margaret_fairweather',
    title: 'Margaret Fairweather',
    sourceText: `---
display: Margaret Fairweather
birth: 1855?
birthplace: Yarmouth
partner: walter_fairweather
married: 1877-09-14
married_place: Norwich
---

# Margaret Fairweather

:family:

## Portraits

:portraits:`,
  },
  {
    id: 'eleanor_beckwith',
    title: 'Eleanor Beckwith',
    sourceText: `---
display: Eleanor Beckwith
birth: 1856
birthplace: Norwich
parents: [edmund_fairweather, alice_fairweather]
partner: thomas_beckwith
married: 1879-04-22
married_place: "St Andrew's, Norwich"
---

# Eleanor Beckwith

:family:`,
  },
  {
    id: 'thomas_beckwith',
    title: 'Thomas Beckwith',
    sourceText: `---
display: Thomas Beckwith
birth: 1850~
birthplace: Ipswich
partner: eleanor_beckwith
married: 1879-04-22
married_place: "St Andrew's, Norwich"
---

# Thomas Beckwith

:family:`,
  },
  {
    id: 'henry_fairweather',
    title: 'Henry Fairweather',
    sourceText: `---
display: Henry Fairweather
birth: 1880
birthplace: Norwich
parents: [walter_fairweather, margaret_fairweather]
---

# Henry Fairweather

:family:

${photoMarkup('henry_fairweather')}`,
  },
  {
    id: 'beatrice_beckwith',
    title: 'Beatrice Beckwith',
    sourceText: `---
display: Beatrice Beckwith
birth: 1882
birthplace: Norwich
parents: [eleanor_beckwith, thomas_beckwith]
---

# Beatrice Beckwith

:family:`,
  },
  {
    id: 'people',
    title: 'Index of people',
    sourceText: `# Index of people

:family-index:`,
  },
  {
    id: 'research',
    title: 'Research notes',
    sourceText: `# Research notes

{#edmund-yard}
## Edmund Fairweather's yard

The yard on King Street appears under Edmund's name in the county trade directories from 1858.`,
  },
];

/**
 * Seed options for the sample book. `demo` replaces the chapter with the same
 * id, or is added first when no chapter has that id; without it, the book as is.
 */
export function familyHistoryBook(demo?: SeedChapter): SeedProjectOptions {
  const chapters = !demo
    ? CHAPTERS
    : CHAPTERS.some(c => c.id === demo.id)
      ? CHAPTERS.map(c => (c.id === demo.id ? demo : c))
      : [demo, ...CHAPTERS];
  const sourceFiles: Record<string, string> = {};
  for (const id of Object.keys(REGIONS)) {
    sourceFiles[`SOURCE/data/regions/${id}.json`] = regionsRecord(id);
  }
  sourceFiles['SOURCE/plugins/photo-regions/regions.json'] = panelLibrary();
  return {
    title: FAMILY_BOOK_TITLE,
    author: 'Sample',
    language: 'en-GB',
    chapters,
    view: 'spine',
    extensions: ['djot', 'figures', 'photo-regions', 'family-history'],
    media: Object.values(PHOTOS).map(p => ({
      href: p.href,
      url: p.url,
      mediaType: 'image/jpeg',
    })),
    sourceFiles,
  };
}
