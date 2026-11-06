/**
 * The Books shelf's filter: a book matches when every word of the query
 * appears in its title or author, ignoring case and accents ("haines" finds
 * "Stewart Haines", "jose" finds "José"). An empty query matches everything.
 */

function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase();
}

export function filterBooks<T extends { title: string; author?: string }>(
  books: T[],
  query: string
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return books;
  return books.filter(book => {
    const haystack = fold(`${book.title} ${book.author ?? ''}`);
    return words.every(word => haystack.includes(word));
  });
}
