/**
 * OPDS Feed Generator
 *
 * Creates OPDS-compatible Atom XML feeds from EPUB metadata catalog
 * following OPDS specification for acquisition feeds.
 */

import { Feed } from 'feed';

/**
 * Generate OPDS Atom XML feed from book catalog
 * @param {Map} bookCatalog - Map of identifier -> {file, metadata, modifiedDate}
 * @param {Object} options - Feed configuration options
 * @returns {string} - OPDS Atom XML feed
 */
export function generateOPDSFeed(bookCatalog, options = {}) {
  const {
    title = 'EDITME Development Library',
    description = 'EPUB books from EDITME editor for development and testing',
    feedUrl = 'http://localhost:3001/opds.xml',
    siteUrl = 'http://localhost:3001',
    id = 'urn:uuid:editme-opds-feed',
  } = options;

  // Create base feed
  const feed = new Feed({
    title,
    description,
    id,
    link: siteUrl,
    language: 'en',
    updated: new Date(),
    generator: 'EDITME OPDS Server',
    feedLinks: {
      atom: feedUrl,
    },
  });

  // Add OPDS namespace and acquisition links for each book
  // Sort by modification date (newest first) per OPDS 1.2 spec
  const books = Array.from(bookCatalog.values()).sort(
    (a, b) => b.metadata.modifiedDate - a.metadata.modifiedDate
  );

  for (const book of books) {
    const { file, metadata } = book;
    const fileName = extractFileName(file);
    const downloadUrl = `${siteUrl}/books/${encodeURIComponent(fileName)}`;

    feed.addItem({
      title: metadata.title,
      id: `urn:uuid:${metadata.identifier}`,
      link: downloadUrl,
      description: metadata.description,
      author: [
        {
          name: metadata.creator,
        },
      ],
      date: metadata.modifiedDate,
      // OPDS-specific properties
      content: metadata.description,
      // Add acquisition link as extension
      extensions: [
        {
          name: '_opds_acquisition',
          objects: {
            rel: 'http://opds-spec.org/acquisition',
            href: downloadUrl,
            type: 'application/epub+zip',
          },
        },
      ],
    });
  }

  // Generate Atom XML with OPDS extensions
  let atomXML = feed.atom1();

  // Add OPDS namespace and modify acquisition links
  atomXML = addOPDSExtensions(atomXML, bookCatalog, siteUrl);

  return atomXML;
}

/**
 * Add OPDS namespace and acquisition links to Atom XML
 * @param {string} atomXML - Base Atom XML
 * @param {Map} bookCatalog - Book catalog
 * @param {string} siteUrl - Base site URL
 * @returns {string} - OPDS-enhanced Atom XML
 */
function addOPDSExtensions(atomXML, bookCatalog, siteUrl) {
  // Add OPDS namespace to feed element
  atomXML = atomXML.replace(
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">'
  );

  // Process each book entry to add proper OPDS acquisition links
  const books = Array.from(bookCatalog.values());

  for (const book of books) {
    const { file, metadata } = book;
    const fileName = extractFileName(file);
    const downloadUrl = `${siteUrl}/books/${encodeURIComponent(fileName)}`;

    // Find and replace the entry for this book
    const entryPattern = new RegExp(
      `<entry>([\\s\\S]*?)<id>urn:uuid:${escapeRegExp(metadata.identifier)}</id>([\\s\\S]*?)</entry>`,
      'g'
    );

    atomXML = atomXML.replace(entryPattern, (match, beforeId, afterId) => {
      // Add OPDS acquisition link before closing entry tag
      const acquisitionLink = `
    <link rel="http://opds-spec.org/acquisition" 
          href="${downloadUrl}" 
          type="application/epub+zip"/>`;

      return `<entry>${beforeId}<id>urn:uuid:${metadata.identifier}</id>${afterId}${acquisitionLink}
</entry>`;
    });
  }

  return atomXML;
}

/**
 * Extract filename from full path
 * @param {string} filePath - Full file path
 * @returns {string} - Filename only
 */
function extractFileName(filePath) {
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
}

/**
 * Escape string for use in regular expression
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate OPDS catalog info
 * @param {Map} bookCatalog - Book catalog
 * @returns {Object} - Catalog statistics
 */
export function getCatalogInfo(bookCatalog) {
  const books = Array.from(bookCatalog.values());
  const totalBooks = books.length;
  const lastUpdated =
    books.length > 0
      ? new Date(Math.max(...books.map(b => b.metadata.modifiedDate.getTime())))
      : new Date();

  const authors = [...new Set(books.map(b => b.metadata.creator))];
  const languages = [...new Set(books.map(b => b.metadata.language))];

  return {
    totalBooks,
    totalAuthors: authors.length,
    totalLanguages: languages.length,
    lastUpdated,
    authors: authors.sort(),
    languages: languages.sort(),
  };
}
