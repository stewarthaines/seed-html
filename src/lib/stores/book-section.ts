import { persisted, asEnum } from '../state/persisted.svelte.js';

/** The Book tab's sections, in sub-nav order. */
export type BookSection = 'cover' | 'chapters' | 'navigation' | 'metadata' | 'manifest';
export const BOOK_SECTIONS: readonly BookSection[] = [
  'cover',
  'chapters',
  'navigation',
  'metadata',
  'manifest',
];

/** Which of the Book tab's sections was open last; the tab reopens there. */
export const lastBookSection = persisted<BookSection>(
  'seedhtml_book_section',
  'metadata',
  asEnum(BOOK_SECTIONS)
);
