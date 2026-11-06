import { describe, expect, it } from 'vitest';
import { filterBooks } from './filter-books';

const books = [
  { id: 'a', title: 'Allen and Wells Family', author: 'Stewart Haines' },
  { id: 'b', title: 'SEED.html User Manual', author: 'Stewart Haines' },
  { id: 'c', title: 'Canções de José', author: 'Maria Ávila' },
  { id: 'd', title: 'Untitled Project' },
];

const ids = (query: string) => filterBooks(books, query).map(book => book.id);

describe('filterBooks', () => {
  it('returns every book for an empty or blank query', () => {
    expect(ids('')).toEqual(['a', 'b', 'c', 'd']);
    expect(ids('   ')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('matches the title or the author, ignoring case', () => {
    expect(ids('manual')).toEqual(['b']);
    expect(ids('HAINES')).toEqual(['a', 'b']);
  });

  it('needs every word to match, in any order and across title and author', () => {
    expect(ids('haines wells')).toEqual(['a']);
    expect(ids('family manual')).toEqual([]);
  });

  it('ignores accents on either side', () => {
    expect(ids('jose avila')).toEqual(['c']);
    expect(ids('canções')).toEqual(['c']);
  });

  it('handles a book without an author', () => {
    expect(ids('untitled')).toEqual(['d']);
  });
});
