# EPUB Embedding Guide

This guide explains how to create Active EPUBs by embedding EDITME.html within EPUB files, enabling self-editing capabilities.

## Table of Contents

1. [Active EPUB Format](#active-epub-format)
2. [Embedding Process](#embedding-process)
3. [Extraction Instructions](#extraction-instructions)
4. [Technical Requirements](#technical-requirements)
5. [Automation Tools](#automation-tools)
6. [Best Practices](#best-practices)

## Active EPUB Format

### Overview

An Active EPUB is a standard EPUB that includes EDITME.html, allowing readers to extract and use the editor to modify the book. This creates a self-contained, editable publication.

### Structure

```
ActiveEPUB/
├── mimetype
├── META-INF/
│   ├── container.xml
│   └── manifest.xml
└── OEBPS/
    ├── content.opf          # EPUB manifest
    ├── toc.ncx              # Navigation
    ├── EDITME.html          # The editor application
    ├── SOURCE.zip           # Editor source files
    ├── EXTRACT_EDITOR.txt   # User instructions
    └── [book content files]
```

### Key Components

1. **EDITME.html** - The complete editor application
2. **SOURCE.zip** - Contains:
   - Plain text source files
   - Transform scripts
   - Editor settings
   - Custom extensions
3. **EXTRACT_EDITOR.txt** - Instructions for users

## Embedding Process

### Step 1: Prepare the Editor

```bash
# Build the production version
npm run build

# Result: dist/EDITME.html
```

### Step 2: Create SOURCE.zip

The SOURCE.zip should contain:

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

Create programmatically:

```javascript
// Using the ZIP library
import { ZIPBuilder } from './src/lib/zip/zip-builder.js';

const builder = new ZIPBuilder();
await builder.addTextFile('settings.json', JSON.stringify(settings));
await builder.addDirectory('text/', textFiles);
await builder.addDirectory('scripts/', scripts);
const sourceZip = await builder.build();
```

### Step 3: Update content.opf

Add entries to the manifest:

```xml
<manifest>
  <!-- Existing book content -->
  <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  
  <!-- Active EPUB components -->
  <item id="editme" 
        href="EDITME.html" 
        media-type="text/html" 
        properties="scripted"/>
  <item id="source" 
        href="SOURCE.zip" 
        media-type="application/zip"/>
  <item id="extract-instructions" 
        href="EXTRACT_EDITOR.txt" 
        media-type="text/plain"/>
</manifest>
```

### Step 4: Create Extraction Instructions

Create `OEBPS/EXTRACT_EDITOR.txt`:

```text
EXTRACTING THE EDITME EDITOR
============================

This EPUB contains EDITME.html, a browser-based editor that can modify this book.

To extract and use the editor:

METHOD 1 - Using Any EDITME Instance (Recommended)
--------------------------------------------------
1. If you already have EDITME.html, open it in your browser
2. Import this EPUB file
3. Navigate to the Manifest view
4. Find "EDITME.html" and click Download
5. Save to your preferred location

METHOD 2 - Manual Extraction
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

LICENSE
-------
EDITME.html is freeware for personal use.
Commercial use requires a separate license.
(c) 2025 Stewart Haines
```

### Step 5: Package the EPUB

```bash
# Correct EPUB packaging order
cd ActiveEPUB/
zip -0 -X ../book.epub mimetype
zip -r ../book.epub META-INF/ OEBPS/ -x mimetype
```

## Extraction Instructions

### For End Users

Include clear instructions in multiple places:

1. **In EXTRACT_EDITOR.txt** (as shown above)
2. **In the book's introduction or preface**
3. **As a separate chapter titled "About the Editor"**

### Sample Chapter Content

```html
<h1>About the Embedded Editor</h1>

<p>This book includes EDITME.html, a powerful EPUB editor that allows you to modify, 
annotate, and personalize this text. The editor runs entirely in your web browser 
without requiring any installation.</p>

<h2>Extracting the Editor</h2>

<p>To extract EDITME.html from this EPUB:</p>

<ol>
  <li>See the file EXTRACT_EDITOR.txt in this EPUB</li>
  <li>Or visit [website] for the latest version</li>
  <li>Or extract manually by renaming .epub to .zip</li>
</ol>

<p>Once extracted, open EDITME.html in your browser to begin editing.</p>
```

## Technical Requirements

### File Size Considerations

- EDITME.html: ~2-3MB
- SOURCE.zip: Varies by content
- Total overhead: 3-5MB typically

### EPUB Validation

Active EPUBs should still validate:

```bash
# Check with epubcheck
java -jar epubcheck.jar book.epub

# Expected: May warn about scripted content
# Should not have errors
```

### Reader Compatibility

- Most EPUB readers will ignore EDITME.html
- Files remain in the EPUB but don't affect reading
- No impact on standard EPUB functionality

## Automation Tools

### Embedding Script

Create `scripts/embed-editor.js`:

```javascript
#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ZIPReader, ZIPBuilder } from '../src/lib/zip/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function embedEditor(epubPath, outputPath) {
    // Read the EPUB
    const epubData = await fs.readFile(epubPath);
    const reader = new ZIPReader(new Uint8Array(epubData));
    const entries = await reader.getEntries();
    
    // Create new EPUB with editor
    const builder = new ZIPBuilder();
    
    // Copy existing entries
    for (const entry of entries) {
        if (!entry.directory) {
            const data = await reader.getData(entry);
            await builder.addFile(entry.filename, data);
        }
    }
    
    // Add EDITME.html
    const editorPath = join(__dirname, '../dist/EDITME.html');
    const editorData = await fs.readFile(editorPath);
    await builder.addFile('OEBPS/EDITME.html', editorData);
    
    // Add extraction instructions
    const instructions = await fs.readFile(
        join(__dirname, 'EXTRACT_EDITOR.txt'), 
        'utf8'
    );
    await builder.addTextFile('OEBPS/EXTRACT_EDITOR.txt', instructions);
    
    // Update content.opf
    await updateManifest(builder, entries);
    
    // Build and save
    const newEpub = await builder.build();
    await fs.writeFile(outputPath, Buffer.from(newEpub));
    
    console.log(`Created Active EPUB: ${outputPath}`);
}

// Usage
const [,, input, output] = process.argv;
if (!input || !output) {
    console.error('Usage: node embed-editor.js input.epub output.epub');
    process.exit(1);
}

embedEditor(input, output).catch(console.error);
```

### Batch Processing

For multiple EPUBs:

```bash
#!/bin/bash
# embed-all.sh

EDITOR_PATH="dist/EDITME.html"
INPUT_DIR="books"
OUTPUT_DIR="active-books"

mkdir -p "$OUTPUT_DIR"

for epub in "$INPUT_DIR"/*.epub; do
    filename=$(basename "$epub")
    echo "Processing $filename..."
    node scripts/embed-editor.js "$epub" "$OUTPUT_DIR/$filename"
done

echo "Done! Active EPUBs created in $OUTPUT_DIR"
```

## Best Practices

### Version Management

1. **Include Version Info**
   ```html
   <!-- In EDITME.html -->
   <meta name="editme-version" content="1.2.3">
   ```

2. **Version in Instructions**
   ```text
   EDITME.html version 1.2.3
   Embedded on: 2025-01-15
   ```

### Security Considerations

1. **Inform Users**
   - Clearly state the editor runs locally
   - No data is sent to servers
   - All editing is private

2. **License Compliance**
   - Include license terms
   - State "personal use only"
   - Provide commercial license info

### SOURCE.zip Best Practices

1. **Include Only Necessary Files**
   - Source texts
   - Active transforms
   - Required settings

2. **Exclude**
   - Temporary files
   - Build artifacts
   - Personal data

3. **Compression**
   - Use DEFAULT compression
   - Optimize for size
   - Test extraction

### User Experience

1. **Clear Instructions**
   - Multiple extraction methods
   - Step-by-step guidance
   - Troubleshooting tips

2. **Accessibility**
   - Text-based instructions
   - No images required
   - Screen reader friendly

3. **Discoverability**
   - Mention in book intro
   - Clear file naming
   - Consistent placement

### Testing

Before distribution:

1. **Test Extraction**
   - Try all documented methods
   - Verify on different systems
   - Check file integrity

2. **Test Functionality**
   - Import the Active EPUB
   - Verify SOURCE.zip extraction
   - Test editing workflow

3. **Test Compatibility**
   - Various EPUB readers
   - Different browsers
   - File size limits

## Troubleshooting

### Common Issues

**Problem**: EPUB reader shows errors
**Solution**: Ensure proper manifest entries and valid XHTML

**Problem**: EDITME.html won't extract
**Solution**: Check ZIP structure and file permissions

**Problem**: SOURCE.zip missing or corrupt
**Solution**: Verify packaging process and compression

### Validation Errors

- "Scripted content" warnings are expected
- Ensure all files are listed in manifest
- Check MIME types are correct

### Size Limitations

- Some EPUB stores limit file size
- Consider separate distribution for large books
- Optimize images and remove unnecessary files

For additional support, see the main documentation or contact the maintainer.