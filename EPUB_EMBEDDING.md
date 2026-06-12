# EPUB Embedding Guide

This guide explains how to create Active EPUBs by embedding EDITME.html within EPUB files, enabling self-editing capabilities.

## Table of Contents

1. [Active EPUB Format](#active-epub-format)
2. [Extraction Instructions](#extraction-instructions)

## Active EPUB Format

### Overview

An Active EPUB is a standard EPUB that includes EDITME.html, allowing readers to extract and use the editor to modify the book. This creates a self-contained, editable publication.

### Structure

```
ActiveEPUB/
├── mimetype
├── META-INF/
│   └── container.xml
└── OEBPS/
    ├── content.opf          # EPUB manifest
    ├── nav.xhtml            # Navigation
    ├── EDITME.html          # The editor application
    ├── SEED.zip           # Editor source files
    └── [book content files]
```

### Key Components

1. **EDITME.html** - The complete editor application
2. **SEED.zip** (the editor-source archive; formerly `SOURCE.zip`, which imports
   still accept) - Contains:
   - Plain text source files
   - Transform scripts
   - Editor settings
   - Custom extensions

   The archive filename is `SEED.zip`; its contents are extracted to a `SOURCE/`
   working directory during editing (the directory name is unchanged).

The SEED.zip should contain:

```
SOURCE/
├── settings.json        # Editor configuration
├── text/               # Plain text sources
│   ├── chapter1.txt
│   ├── chapter2.txt
│   └── ...
├── scripts/            # Transform scripts
│   ├── transformText.js
│   └── transformDom.js
└── extensions/         # Optional extensions
```

#### Manifest treatment

SEED.zip is a **non-publication data file** and is intentionally **not** listed in the
OPF manifest — do not add it. Per [EPUB 3.3](https://www.w3.org/TR/epub-33/#sec-manifest-elem),
the manifest lists _only_ publication resources (those that contribute to rendering), and
the container _may_ carry data files "to allow data files to travel with an EPUB
publication" — which is exactly SEED.zip's role. Declaring it would be non-conformant (a
non-publication resource in the manifest) and could invite other validator flags.

Validation is unaffected: reading systems ignore undeclared container files, the bundled
checker (`@likecoin/epubcheck-ts`) emits nothing for it, and full Java EPUBCheck reports at
most a non-blocking `OPF-003` _warning_ — expected, not a bug. Note the contrast with an
_orphaned_ content file (e.g. a stray `OEBPS/Images/*` that triggers `PKG-010`): that's an
accident to clean up, whereas SEED.zip is a deliberate payload.

### 3: Create Extraction Instructions

Create a new Spine Item with instructions like this;

```text
EXTRACTING THE EDITME EDITOR
============================

This EPUB contains EDITME.html, a browser-based editor that can modify this book.

To extract and use the editor:

METHOD 1 - Manual Extraction
----------------------------
1. Make a copy of this EPUB file
2. Change the file extension from .epub to .zip
3. Extract the ZIP file to a folder
4. Navigate to OEBPS/EDITME.html
5. Copy EDITME.html to your preferred location

USING THE EDITOR
----------------
1. Open EDITME.html in a modern web browser
2. The editor works completely offline
3. Import this EPUB to begin editing
4. Export your changes as a new EPUB

SYSTEM REQUIREMENTS
-------------------
- Chrome/Edge 119+, Firefox 119+, or Safari 17+
- No installation required
- All editing happens in your browser
```
