# OPDS (Open Publication Distribution System)

## Executive Summary

**OPDS** is an open web standard for distributing digital publications, primarily EPUB files, through feeds that can be discovered and consumed by reading applications. It enables libraries, publishers, and content distributors to create catalogs of books that reading apps can browse, search, and download from directly.

OPDS feeds are syndication formats based on Atom that provide metadata about publications, search capabilities, and direct download links. The protocol supports both free and commercial content distribution with authentication, payment integration, and content protection mechanisms.

## Key Features

- **Standardized Discovery**: Uniform way for reading apps to find and browse catalogs
- **Search Integration**: Built-in search capabilities across catalogs
- **Hierarchical Organization**: Support for categories, series, and collections
- **Authentication Support**: Integration with library systems and commercial platforms
- **Acquisition Methods**: Direct downloads, streaming, and purchase workflows
- **Multilingual Support**: International content distribution with locale-specific metadata
- **Extensible Architecture**: Support for custom metadata and acquisition types

## Technical Overview

### Feed Structure

OPDS catalogs are XML documents based on the Atom Syndication Format with OPDS-specific extensions:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:uuid:2853dacf-ed79-42f7-8e8a-a7bb3d1ae6a2</id>
  <title>Sample OPDS Catalog</title>
  <updated>2023-11-20T12:00:00Z</updated>

  <entry>
    <title>Sample Book</title>
    <id>urn:uuid:book-123</id>
    <updated>2023-11-20T12:00:00Z</updated>
    <link rel="http://opds-spec.org/acquisition"
          href="/books/sample.epub"
          type="application/epub+zip"/>
  </entry>
</feed>
```

### Link Relations

OPDS extends standard Atom link relations:

- `http://opds-spec.org/catalog` - Navigation to sub-catalogs
- `http://opds-spec.org/acquisition` - Direct acquisition (download)
- `http://opds-spec.org/acquisition/buy` - Purchase workflow
- `http://opds-spec.org/acquisition/borrow` - Library lending
- `http://opds-spec.org/acquisition/subscribe` - Subscription access
- `http://opds-spec.org/image` - Cover images and thumbnails
- `http://opds-spec.org/image/thumbnail` - Thumbnail images

### Content Types

- **Navigation Feeds**: Catalog browsing and hierarchy
- **Acquisition Feeds**: Lists of publications available for download
- **Search Results**: Response to search queries
- **Authentication Documents**: Login and access control information

## Software Ecosystem

### Reading Applications

**Desktop & Mobile**

- **Calibre** - Popular ebook management with OPDS browsing
- **Moon+ Reader** (Android) - Full OPDS catalog integration
- **KyBook** (iOS) - Comprehensive OPDS client
- **FBReader** (Cross-platform) - Long-standing OPDS support
- **Thorium Reader** (Desktop) - Accessible reading with OPDS
- **Aldiko** (Android) - Commercial reader with library integration

**Library-Focused**

- **SimplyE** - NYPL's open-source library app
- **Palace** (formerly SimplyE) - Library consortium reader
- **OverDrive** - Commercial library platform
- **Hoopla** - Media library platform

### Server Implementations

**Open Source**

- **COPS** (Calibre OPDS PHP Server) - Popular Calibre integration
- **Ubooquity** - Java-based server for comics and ebooks
- **Komga** - Modern comic and ebook server
- **BicBucStriim** - Lightweight PHP server for Calibre
- **calibre-web** - Web interface for Calibre with OPDS

**Commercial**

- **OverDrive** - Library content distribution
- **Hoopla** - Digital media circulation
- **Baker & Taylor** - Academic and library solutions
- **BiblioLabs** - Library platform services

### Library Systems

- **Koha** - Integrated library system with OPDS
- **Evergreen** - Open source ILS with catalog feeds
- **FOLIO** - Next-generation library platform
- **Ex Libris Alma** - Academic library management
- **SirsiDynix** - Library automation with OPDS modules

## Integration Possibilities with SEED.html

### Direct Export

- Export workspace EPUBs to OPDS-compatible directory structure
- Generate catalog entries with metadata from workspace books
- Create hierarchical organization based on workspace collections

### Development Server

- Serve edited EPUBs during development via local OPDS feed
- Enable real-time testing with OPDS-compatible reading apps
- Support for draft versioning through OPDS acquisition metadata

### Publishing Workflow

- Generate publication-ready OPDS catalogs for finished books
- Integration with existing OPDS server software
- Batch export for library and publisher distribution

### Example Integration

```javascript
// Generate OPDS entry for SEED.html workspace
function generateOPDSEntry(workspace, epubMetadata) {
  return {
    id: `urn:uuid:${workspace.id}`,
    title: epubMetadata.title,
    updated: workspace.lastModified,
    links: [
      {
        rel: 'http://opds-spec.org/acquisition',
        href: `/epub/${workspace.id}/download`,
        type: 'application/epub+zip',
      },
      {
        rel: 'http://opds-spec.org/image',
        href: `/epub/${workspace.id}/cover`,
        type: 'image/jpeg',
      },
    ],
    authors: epubMetadata.creators,
    categories: workspace.tags?.map(tag => ({ term: tag })),
  };
}
```

## Developer Resources

### Official Specifications

- **OPDS 1.2 Specification**: https://specs.opds.io/opds-1.2
- **OPDS 2.0 Specification**: https://readium.org/opds-spec/
- **Authentication for OPDS**: https://readium.org/opds-spec/auth.html

### Implementation Guides

- **OPDS Validator**: https://github.com/readium/opds-validator
- **Reference Implementation**: https://github.com/readium/r2-opds-kotlin
- **Test Feeds**: https://github.com/readium/opds-test-files

### Tools and Libraries

**JavaScript/Node.js**

- `opds-parser` - Parse OPDS feeds
- `atom-parser` - Base Atom feed parsing
- `xml2js` - XML processing for custom OPDS handling

**Python**

- `feedparser` - Parse OPDS and Atom feeds
- `lxml` - XML generation and processing
- `python-opds` - OPDS-specific utilities

**PHP**

- `COPS` source code - Reference implementation
- `SimpleXML` - Built-in PHP XML handling
- `DOMDocument` - Advanced XML manipulation

### Testing Resources

- **Internet Archive OPDS**: https://bookserver.archive.org/catalog/
- **Standard Ebooks**: https://standardebooks.org/opds/
- **Project Gutenberg**: https://www.gutenberg.org/ebooks/search.opds/
- **Feedbooks**: https://catalog.feedbooks.com/catalog/index.xml

This document provides the foundation for understanding OPDS and its potential integration with SEED.html's EPUB editing and distribution capabilities.
