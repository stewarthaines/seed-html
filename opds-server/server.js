/**
 * EDITME OPDS Server
 *
 * Watches ~/Downloads for EPUB files and serves OPDS feed with deduplication
 * based on dc:identifier and dcterms:modified from EPUB metadata.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import express from 'express';
import chokidar from 'chokidar';
import { parseEPUBMetadata } from './epub-opf.js';
import { generateOPDSFeed, getCatalogInfo } from './opds-feed.js';

// Configuration
const PORT = process.env.PORT || 3001;
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(os.homedir(), 'Downloads');
const FEED_URL = `http://localhost:${PORT}/opds.xml`;
const SITE_URL = `http://localhost:${PORT}`;

// Book catalog: Map<identifier, {file, metadata, modifiedDate}>
const bookCatalog = new Map();

// Express server
const app = express();

/**
 * Scan directory for EPUB files and build initial catalog
 */
async function scanEPUBFiles() {
  console.log(`📚 Scanning ${DOWNLOADS_DIR} for EPUB files...`);

  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const epubFiles = files
      .filter(file => file.toLowerCase().endsWith('.epub'))
      .map(file => path.join(DOWNLOADS_DIR, file));

    console.log(`Found ${epubFiles.length} EPUB files`);

    for (const epubFile of epubFiles) {
      try {
        await processEPUBFile(epubFile);
      } catch (error) {
        console.warn(`⚠️  Failed to process ${path.basename(epubFile)}: ${error.message}`);
      }
    }

    const catalogInfo = getCatalogInfo(bookCatalog);
    console.log(
      `📖 Catalog built: ${catalogInfo.totalBooks} unique books, ${catalogInfo.totalAuthors} authors`
    );
    console.log('');
    console.log('📋 Final Catalog Contents:');
    for (const [identifier, bookData] of bookCatalog.entries()) {
      console.log(`   📚 "${bookData.metadata.title}"`);
      console.log(`      🆔 ID: ${identifier}`);
      console.log(`      📁 File: ${path.basename(bookData.file)}`);
      console.log(`      📅 Modified: ${bookData.metadata.dctermsModified}`);
      console.log('');
    }
  } catch (error) {
    console.error(`❌ Failed to scan directory: ${error.message}`);
  }
}

/**
 * Process a single EPUB file and update catalog
 */
async function processEPUBFile(epubPath) {
  console.log(`🔍 Processing: ${path.basename(epubPath)}`);

  try {
    const metadata = await parseEPUBMetadata(epubPath);
    const { identifier, dctermsModified } = metadata;

    console.log(`📋 Book ID: "${identifier}"`);
    console.log(`📅 Modified: ${dctermsModified}`);
    console.log(`📊 Parsed Date: ${metadata.modifiedDate.toISOString()}`);

    // Check if we already have this book
    const existing = bookCatalog.get(identifier);

    if (existing) {
      console.log(`🔍 Found existing entry:`);
      console.log(`   📁 Current file: ${path.basename(existing.file)}`);
      console.log(`   📅 Current modified: ${existing.metadata.dctermsModified}`);
      console.log(`   📊 Current date: ${existing.metadata.modifiedDate.toISOString()}`);

      const isNewer = metadata.modifiedDate > existing.metadata.modifiedDate;
      const isEqual = metadata.modifiedDate.getTime() === existing.metadata.modifiedDate.getTime();

      console.log(`⚖️  Comparison: New ${isNewer ? '>' : isEqual ? '=' : '<'} Existing`);

      if (isNewer) {
        console.log(`🔄 REPLACING with newer version`);
        console.log(`   🗑️  Removing: ${path.basename(existing.file)}`);
        console.log(`   ➕ Adding: ${path.basename(epubPath)}`);
      } else if (isEqual) {
        console.log(`⚠️  WARNING: Same modification time - keeping first file`);
        console.log(`   🏆 Keeping: ${path.basename(existing.file)}`);
        console.log(`   ⏭️  Skipping: ${path.basename(epubPath)}`);
        return false;
      } else {
        console.log(`⏭️  SKIPPED: Older version`);
        console.log(`   🏆 Keeping: ${path.basename(existing.file)}`);
        console.log(`   ⏭️  Ignoring: ${path.basename(epubPath)}`);
        return false;
      }
    }

    if (!existing || metadata.modifiedDate > existing.metadata.modifiedDate) {
      // This is a newer version, update catalog
      bookCatalog.set(identifier, {
        file: epubPath,
        metadata: metadata,
        modifiedDate: metadata.modifiedDate,
      });

      if (existing) {
        console.log(`✅ Updated "${metadata.title}"`);
      } else {
        console.log(`✅ Added "${metadata.title}"`);
      }

      console.log(`📚 Catalog now has ${bookCatalog.size} unique books`);
      return true; // Catalog was updated
    } else {
      return false; // No update needed
    }
  } catch (error) {
    console.error(`❌ Failed to process ${path.basename(epubPath)}: ${error.message}`);
    throw error;
  }
}

/**
 * Remove EPUB file from catalog
 */
function removeEPUBFile(epubPath) {
  console.log(`🗑️  Removing: ${path.basename(epubPath)}`);

  // Find and remove the book by file path
  for (const [identifier, bookData] of bookCatalog.entries()) {
    if (bookData.file === epubPath) {
      bookCatalog.delete(identifier);
      console.log(`➖ Removed "${bookData.metadata.title}"`);
      return true;
    }
  }

  return false;
}

/**
 * Set up file system watcher
 */
function setupFileWatcher() {
  console.log(`👀 Watching ${DOWNLOADS_DIR} for changes...`);

  const watcher = chokidar.watch(path.join(DOWNLOADS_DIR, '*.epub'), {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });

  watcher.on('add', async filePath => {
    console.log(`📥 New EPUB detected: ${path.basename(filePath)}`);
    try {
      await processEPUBFile(filePath);
    } catch (error) {
      console.warn(`⚠️  Failed to process new file: ${error.message}`);
    }
  });

  watcher.on('change', async filePath => {
    console.log(`📝 EPUB changed: ${path.basename(filePath)}`);
    try {
      await processEPUBFile(filePath);
    } catch (error) {
      console.warn(`⚠️  Failed to process changed file: ${error.message}`);
    }
  });

  watcher.on('unlink', filePath => {
    console.log(`🗑️  EPUB deleted: ${path.basename(filePath)}`);
    removeEPUBFile(filePath);
  });

  watcher.on('error', error => {
    console.error(`❌ Watcher error: ${error.message}`);
  });

  return watcher;
}

/**
 * Express routes
 */

// Serve OPDS feed
app.get('/opds.xml', (req, res) => {
  try {
    const opdsXML = generateOPDSFeed(bookCatalog, {
      title: 'EDITME Development Library',
      description: 'EPUB books from EDITME editor for development and testing',
      feedUrl: FEED_URL,
      siteUrl: SITE_URL,
    });

    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(opdsXML);

    console.log(`📡 Served OPDS feed (${bookCatalog.size} books)`);
  } catch (error) {
    console.error(`❌ Failed to generate OPDS feed: ${error.message}`);
    res.status(500).send('Failed to generate OPDS feed');
  }
});

// Serve EPUB files
app.get('/books/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(DOWNLOADS_DIR, filename);

  // Verify file exists and is in our catalog
  let bookExists = false;
  for (const bookData of bookCatalog.values()) {
    if (path.basename(bookData.file) === filename) {
      bookExists = true;
      break;
    }
  }

  if (!bookExists || !fs.existsSync(filePath)) {
    return res.status(404).send('Book not found');
  }

  res.setHeader('Content-Type', 'application/epub+zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);

  console.log(`📖 Served book: ${filename}`);
});

// Catalog info endpoint
app.get('/catalog-info', (req, res) => {
  const info = getCatalogInfo(bookCatalog);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(info);
});

// Debug catalog endpoint
app.get('/debug-catalog', (req, res) => {
  const catalogEntries = [];

  for (const [identifier, bookData] of bookCatalog.entries()) {
    catalogEntries.push({
      bookId: identifier,
      title: bookData.metadata.title,
      fileName: path.basename(bookData.file),
      filePath: bookData.file,
      dctermsModified: bookData.metadata.dctermsModified,
      modifiedDate: bookData.metadata.modifiedDate.toISOString(),
      creator: bookData.metadata.creator,
      description: bookData.metadata.description,
    });
  }

  catalogEntries.sort((a, b) => a.title.localeCompare(b.title));

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    totalEntries: catalogEntries.length,
    catalogEntries: catalogEntries,
  });

  console.log(`🐛 Debug catalog requested (${catalogEntries.length} entries)`);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    books: bookCatalog.size,
    watchingDirectory: DOWNLOADS_DIR,
    uptime: process.uptime(),
  });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/opds.xml');
});

/**
 * Start server
 */
async function startServer() {
  console.log('🚀 Starting EDITME OPDS Server...');
  console.log(`📁 Downloads directory: ${DOWNLOADS_DIR}`);

  // Check if downloads directory exists
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    console.error(`❌ Downloads directory does not exist: ${DOWNLOADS_DIR}`);
    process.exit(1);
  }

  // Build initial catalog
  await scanEPUBFiles();

  // Set up file watcher
  const watcher = setupFileWatcher();

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`🌐 OPDS Server running at ${SITE_URL}`);
    console.log(`📡 OPDS Feed available at ${FEED_URL}`);
    console.log(`📊 Catalog info at ${SITE_URL}/catalog-info`);
    console.log(`🐛 Debug catalog at ${SITE_URL}/debug-catalog`);
    console.log('');
    console.log('Add this OPDS catalog to your reading app:');
    console.log(`   ${FEED_URL}`);
    console.log('');
    console.log('Press Ctrl+C to stop');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Shutting down OPDS server...');
    watcher.close();
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch(error => {
  console.error(`❌ Failed to start server: ${error.message}`);
  process.exit(1);
});
