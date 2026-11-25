/**
 * The invented McInnes family: the sample book behind the screenshots in
 * Book Recipes › Family history books (docs/user/seed.html-recipes/). Three
 * generations in Carlton and Brunswick, Melbourne. The people are invented;
 * their circumstances borrow from the author's own family research. The
 * photographs are real, of unidentified sitters, from open-access museum
 * collections (credited in the `about` chapter).
 *
 * familyHistoryBook(demo) seeds the whole book plus one extra chapter, the
 * `demo` chapter a story opens, whose source is the markup the shot shows.
 * The record copies and the photographs' regions records are written up
 * front, so the first render of any chapter sees the whole family.
 */

import type { SeedChapter, SeedProjectOptions } from '../utils/seed-project';
import photo1858 from './assets/family-history/mcinnes_ewen_isabella_1858.jpg?url';
import photo1890 from './assets/family-history/kerr_thomas_margaret_1890.jpg?url';
import photo1910 from './assets/family-history/kerr_family_1910.jpg?url';

export const FAMILY_BOOK_TITLE = 'The McInnes Family of Carlton';

const PHOTOS = {
  couple: {
    href: 'Images/mcinnes_ewen_isabella_1858.jpg',
    url: photo1858,
    size: { w: 570, h: 763 },
    alt: 'A daguerreotype of a young woman in a striped silk dress with a lace collar, seated beside a broad-faced man in a dark coat and high neckcloth, her hand resting on his arm',
    title: 'Ewen and Isabella McInnes, about 1858',
  },
  kerrs: {
    href: 'Images/kerr_thomas_margaret_1890.jpg',
    url: photo1890,
    size: { w: 926, h: 1200 },
    alt: 'A studio portrait of a seated man with spectacles and a moustache, and a young woman in a dark flowered dress standing beside him with her hand in his',
    title: 'Thomas and Margaret Kerr, about 1890',
  },
  garden: {
    href: 'Images/kerr_family_1910.jpg',
    url: photo1910,
    size: { w: 934, h: 888 },
    alt: 'Seven people in a garden in front of a trellis fence: two young men and a young woman standing at the back; an old woman, a woman with spectacles and a man with a moustache seated in front of them; and a small girl in a white pinafore standing at the front',
    title: 'Three generations in the garden at Brunswick, about 1910',
  },
};

type Photo = (typeof PHOTOS)[keyof typeof PHOTOS];
interface Region {
  at: string;
  /** The person's id; left out for someone with no record. */
  of?: string;
  as: string;
  row?: string;
}

const REGIONS: Record<string, { photo: Photo; regions: Region[] }> = {
  ewen_mcinnes: {
    photo: PHOTOS.couple,
    regions: [
      { at: '20,25,16,16', of: 'isabella_ross', as: 'Isabella' },
      { at: '60,17,20,19', of: 'ewen_mcinnes', as: 'Ewen' },
    ],
  },
  margaret_mcinnes: {
    photo: PHOTOS.kerrs,
    regions: [
      { at: '26,16,13,12', of: 'thomas_kerr', as: 'Thomas' },
      { at: '56,2,12,13', of: 'margaret_mcinnes', as: 'Margaret' },
    ],
  },
  ewen_kerr: {
    photo: PHOTOS.garden,
    regions: [
      { at: '17,10.8,10,12.2', as: 'George Bell', row: 'Standing' },
      { at: '41,14.9,11,13.5', of: 'jessie_kerr', as: 'Jessie', row: 'Standing' },
      { at: '67,9.5,11,13.5', of: 'ewen_kerr', as: 'Ewen', row: 'Standing' },
      { at: '13,39.2,12,14.9', of: 'isabella_ross', as: 'Isabella', row: 'Seated' },
      { at: '36,36.5,11,14.9', of: 'margaret_mcinnes', as: 'Margaret', row: 'Seated' },
      { at: '59,40.5,11,14.9', of: 'thomas_kerr', as: 'Thomas', row: 'Seated' },
      { at: '35,64.9,9,12.2', of: 'annie_kerr', as: 'Annie', row: 'In front' },
    ],
  },
};

/** A photograph and its named faces, as a chapter writes them. */
export function photoMarkup(chapterId: keyof typeof REGIONS): string {
  const { photo, regions } = REGIONS[chapterId];
  const lines = regions.map(r => {
    const of = r.of ? ` of=${r.of}` : '';
    const row = r.row ? ` row="${r.row}"` : '';
    return `:region:{at="${r.at}"${of} as="${r.as}"${row}}`;
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
      ...(r.of ? { of: r.of } : {}),
      as: r.as,
      ...(r.row ? { row: r.row } : {}),
      id: `photo-${chapterId}-${base}`,
      size: photo.size,
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
      size: photo.size,
      regions: regions.map(r => {
        const [x, y, w, h] = r.at.split(',').map(Number);
        return { person: r.of ?? '', as: r.as, row: r.row ?? '', x, y, w, h };
      }),
    };
  }
  return JSON.stringify({ version: 2, files }, null, 2);
}

export const MARGARET_RECORD = `---
display: Margaret McInnes
birth: 1866-02-20
birthplace: Carlton
parents: [ewen_mcinnes, isabella_ross]
partner: thomas_kerr
married: 1890-04-09
married_place: "Lygon Street Church of Christ, Carlton"
---`;

const CHAPTERS: SeedChapter[] = [
  {
    id: 'about',
    title: 'About this book',
    sourceText: `# About this book

The McInneses are an invented family: a tailor from Inverness-shire, his wife from Glasgow, and their children and grandchildren in Carlton and Brunswick, from the 1850s to about 1910.

The photographs are real, but nobody knows who the sitters were. The daguerreotype of about 1850 is by Marcus Aurelius Root, from the Los Angeles County Museum of Art (M.91.287.2, public domain). The portrait of a couple and the family in a garden are from the Rijksmuseum, Amsterdam (RP-F-F00680-17 and RP-F-F00830-CJ, CC0).

This is a sample book, made with SEED.html to show how a family history book is put together. Open it in SEED.html to see the source of every chapter. Each person's chapter starts with their record, and the family panels, trees, lifelines, portraits and index are all drawn from those records.

The page [Family history books](https://readitinabook.com/docs/en/recipes/family-history-books/) explains how to make a book like this one.`,
  },
  {
    id: 'family',
    title: 'The family',
    sourceText: `# The family

Ewen McInnes's descendants, two generations down:

:tree:{of=ewen_mcinnes depth=2}

## Three generations

:lifeline:{of=ewen_mcinnes as=Ewen}
:lifeline:{of=margaret_mcinnes as=Margaret}
:lifeline:{of=ewen_kerr as="Ewen Kerr"}`,
  },
  {
    id: 'ewen_mcinnes',
    title: 'Ewen McInnes',
    sourceText: `---
display: Ewen McInnes
birth: 1822-04-02
birthplace: "Corpach, Inverness-shire"
death: 1890-08-11
deathplace: Brunswick East
partner: isabella_ross
married: 1858-09-02
married_place: Melbourne
others:
  robert_mcinnes:
    display: Robert Lyle McInnes
    birth: 1878-08
    birthplace: Carlton
    death: 1879-02
    deathplace: Carlton
    parents: [ewen_mcinnes, isabella_ross]
---

# Ewen McInnes

:family:

Ewen was an apprentice tailor at Corpach in 1841. He held a seaman's ticket in 1853, and probably worked his passage to Melbourne; no passenger list names him. From 1875 he was a partner in a firm of tailors in Elizabeth Street,[^firm] and the partners assigned their estate to their creditors in 1885.

In 1877 Isabella bought a cottage in Davis Street, Carlton, with a mortgage from Robert Lyle. Their son born the next year was named Robert Lyle McInnes, and died at six months.

${photoMarkup('ewen_mcinnes')}

[^firm]: Sands & McDougall's directories, 1875–1885; see [the research notes](research.xhtml#tailoring-firm).`,
  },
  {
    id: 'isabella_ross',
    title: 'Isabella McInnes',
    sourceText: `---
display: Isabella McInnes
# Ages 20 (1858), 42 (1878) and 79 (1913) point to 1834-1838. See research, isabella-age.
birth: 1836~
birthplace: Glasgow
death: 1913-05-30
deathplace: Brunswick
parents: [james_ross, agnes_lennox]
partner: ewen_mcinnes
married: 1858-09-02
married_place: Melbourne
others:
  james_ross:
    display: James Ross
    death: 1848-06
    deathplace: Glasgow
  agnes_lennox:
    # Isabella's death certificate calls her mother Agnes Hill; the Glasgow records say Lennox.
    display: Agnes Ross
    birth: 1795~
    death: 1866-03-29
    deathplace: "City Poorhouse, Glasgow"
---

# Isabella McInnes

:family:

Isabella's father, a shoemaker, died when she was about twelve. She came out from Glasgow alone in 1857, and her mother died in the City Poorhouse nine years later.

## Portraits

:portraits:`,
  },
  {
    id: 'john_mcinnes',
    title: 'John McInnes',
    sourceText: `---
display: John McInnes
birth: 1859-10-04
birthplace: Carlton
death: 1931-06-17
deathplace: Brunswick
parents: [ewen_mcinnes, isabella_ross]
partner:
  - { id: mary_doyle, married: 1884-03-12, married_place: Carlton }
  - { id: emily_barnes, married: 1892 }
others:
  mary_doyle:
    display: Mary McInnes
    birth: 1863
    death: 1888-07-21
    deathplace: Carlton
  emily_barnes:
    display: Emily McInnes
    birth: 1865~
    birthplace: Ballarat
---

# John McInnes

:family:

John was a plumber in Brunswick, and later an inspector for the Board of Works.`,
  },
  {
    id: 'margaret_mcinnes',
    title: 'Margaret McInnes',
    sourceText: `${MARGARET_RECORD}

# Margaret McInnes

:family:

Margaret taught in the Sunday school at Lygon Street for twenty-eight years.

${photoMarkup('margaret_mcinnes')}

## Portraits

:portraits:`,
  },
  {
    id: 'thomas_kerr',
    title: 'Thomas Kerr',
    sourceText: `---
display: Thomas Kerr
birth: 1862~
birthplace: Geelong
death: 1934-11-02
deathplace: Coburg
partner: margaret_mcinnes
married: 1890-04-09
married_place: "Lygon Street Church of Christ, Carlton"
---

# Thomas Kerr

:family:

Thomas was a compositor.

## Portraits

:portraits:`,
  },
  {
    id: 'catherine_mcinnes',
    title: 'Catherine McInnes',
    sourceText: `---
display: Catherine McInnes
birth: 1886-01-15
birthplace: Carlton
parents: [john_mcinnes, mary_doyle]
---

# Catherine McInnes

:family:`,
  },
  {
    id: 'jessie_kerr',
    title: 'Jessie Kerr',
    sourceText: `---
display: Jessie Kerr
birth: 1891-02-11
birthplace: Brunswick
parents: [thomas_kerr, margaret_mcinnes]
---

# Jessie Kerr

:family:`,
  },
  {
    id: 'ewen_kerr',
    title: 'Ewen Kerr',
    sourceText: `---
display: Ewen Kerr
birth: 1893-06-30
birthplace: Brunswick
parents: [thomas_kerr, margaret_mcinnes]
others:
  annie_kerr:
    display: Annie Kerr
    birth: 1908
    birthplace: Brunswick
    parents: [thomas_kerr, margaret_mcinnes]
---

# Ewen Kerr

:family:

Ewen was named after his grandfather.

${photoMarkup('ewen_kerr')}`,
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

{#tailoring-firm}
## Ewen McInnes's tailoring firm

Sands & McDougall's directories list Ewen as a partner in a firm of tailors in Elizabeth Street in 1875, 1880 and 1885, and give his home as Carlton each time. The firm is not listed in 1870 or 1890.

{#isabella-age}
## Isabella's age

Isabella's age is 20 on her marriage certificate (1858), 42 on her son Robert's birth certificate (1878) and 79 on her death certificate (1913). These point to 1838, 1836 and 1834. No baptism has been found.`,
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
    language: 'en-AU',
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
