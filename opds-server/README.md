# EDITME OPDS Server

A standalone OPDS feed generator that watches your Downloads directory for EPUB files and serves a clean catalog with automatic deduplication based on EPUB metadata.

## Features

- **Automatic File Watching**: Monitors `~/Downloads` for EPUB files
- **Smart Deduplication**: Uses EPUB `dc:identifier` and `dcterms:modified` to keep only the latest version of each book
- **OPDS Compliance**: Generates standards-compliant OPDS Atom feeds for reading apps
- **Direct Downloads**: Serves EPUB files with proper headers for reading apps
- **Real-time Updates**: Feed updates automatically when files are added/removed/changed

## Installation

From the main EDITME project directory:

```bash
npm run opds:install
```

## Usage

### Start the OPDS Server

```bash
npm run opds:serve
```

The server will:
- Scan `~/Downloads` for existing EPUB files
- Start watching for changes
- Serve OPDS feed at `http://localhost:3001/opds.xml`
- Provide direct download links for EPUB files

### Development Mode

```bash
npm run opds:dev
```

Runs with additional file watching for server code changes.

### Add to Reading Apps

Add this OPDS catalog URL to your reading app:
```
http://localhost:3001/opds.xml
```

**Tested with:**
- Thorium Reader
- Calibre
- Moon+ Reader
- KyBook

## How It Works

### Deduplication Logic

1. **Extract Metadata**: Parses each EPUB's `content.opf` file
2. **Get Book ID**: Uses `dc:identifier` as unique book identifier  
3. **Get Modified Time**: Uses `dcterms:modified` property (EPUB 3 standard)
4. **Deduplicate**: Keeps only the most recent version per book ID
5. **Update Feed**: Regenerates OPDS XML when catalog changes

### EDITME Integration

Perfect for EDITME's iterative development workflow:

1. Edit book in EDITME → Click "Package EPUB" → Downloads to `~/Downloads`
2. OPDS server detects new file → Extracts metadata → Updates feed
3. Reading app sees updated catalog with latest version only
4. Download and test immediately in your preferred reading environment

### File Handling

- **OS Collisions**: Handles "Book.epub", "Book (2).epub" etc. gracefully
- **Cache Busting**: Works with EDITME's draft versioning system
- **Metadata Authority**: Uses EPUB content metadata, not filenames or filesystem dates

## API Endpoints

- **`GET /opds.xml`** - OPDS Atom feed
- **`GET /books/:filename`** - Download EPUB file  
- **`GET /catalog-info`** - Catalog statistics (JSON)
- **`GET /health`** - Server health check
- **`GET /`** - Redirects to OPDS feed

## Configuration

Environment variables:

- `PORT` - Server port (default: 3001)
- `DOWNLOADS_DIR` - Directory to watch (default: ~/Downloads)

## Troubleshooting

### No Books in Feed
- Check that EPUB files are in `~/Downloads`
- Verify EPUBs have valid `dc:identifier` and `dcterms:modified` metadata
- Check server logs for parsing errors

### Reading App Not Updating
- Some apps cache OPDS feeds - try refreshing manually
- Verify the OPDS URL is exactly `http://localhost:3001/opds.xml`
- Check that server is running on port 3001

### Permission Errors
- Ensure read access to Downloads directory
- Check file permissions on EPUB files

## Technical Details

### Dependencies
- `chokidar` - File system watching
- `yauzl` + `xml2js` - EPUB metadata parsing
- `feed` - OPDS Atom XML generation  
- `express` - HTTP server

### EPUB 3 Compliance
- Follows EPUB 3 specification for metadata parsing
- Requires `dcterms:modified` property with UTC timestamps
- Validates metadata format and structure

### Performance
- Efficient file watching with debounced updates
- In-memory catalog for fast feed generation
- Streaming file downloads for large EPUBs