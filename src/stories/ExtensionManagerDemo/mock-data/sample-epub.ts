/**
 * Sample EPUB Structure for Extension Manager Demo
 * 
 * Mock EPUB files with SOURCE/extensions/ directories for testing
 * workspace import workflows.
 */

import { SAMPLE_EXTENSIONS } from './sample-extensions.js';

/**
 * Sample EPUB with extensions for workspace import demo
 */
export interface SampleEPUB {
  name: string;
  description: string;
  files: Record<string, string>;
  extensions: string[];
}

/**
 * Create sample EPUB content with extensions
 */
export const SAMPLE_EPUBS: Record<string, SampleEPUB> = {
  MARKDOWN_BOOK: {
    name: 'markdown-processing-book.epub',
    description: 'Sample book that uses markdown processing extensions',
    files: {
      'mimetype': 'application/epub+zip',
      'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      'OEBPS/content.opf': `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">sample-markdown-book</dc:identifier>
    <dc:title>Markdown Processing Book</dc:title>
    <dc:creator>Demo Author</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="editme" href="EDITME.html" media-type="text/html"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`,
      'OEBPS/chapter1.xhtml': `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
</head>
<body>
  <h1>Chapter 1: Introduction to Markdown</h1>
  <p>This book demonstrates markdown processing in EPUB.</p>
</body>
</html>`,
      'OEBPS/EDITME.html': '<!DOCTYPE html><html><head><title>EDITME</title></head><body><p>EPUB Editor</p></body></html>',
      // Extensions
      'SOURCE/extensions/markdown-it/markdown-it.min.js': SAMPLE_EXTENSIONS.MARKDOWN_IT.files['markdown-it.min.js'],
      'SOURCE/extensions/markdown-it/LICENSE.txt': SAMPLE_EXTENSIONS.MARKDOWN_IT.files['LICENSE.txt'],
      'SOURCE/extensions/highlight/highlight.min.js': SAMPLE_EXTENSIONS.HIGHLIGHT_JS.files['highlight.min.js'],
      'SOURCE/extensions/prism/prism-core.min.js': SAMPLE_EXTENSIONS.PRISM.files['prism-core.min.js'],
      'SOURCE/extensions/prism/prism-javascript.js': SAMPLE_EXTENSIONS.PRISM.files['prism-javascript.js']
    },
    extensions: ['markdown-it', 'highlight', 'prism']
  },

  MUSIC_BOOK: {
    name: 'music-notation-book.epub',
    description: 'Sample book with music notation extensions',
    files: {
      'mimetype': 'application/epub+zip',
      'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      'OEBPS/content.opf': `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">sample-music-book</dc:identifier>
    <dc:title>Music Notation Book</dc:title>
    <dc:creator>Demo Composer</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="editme" href="EDITME.html" media-type="text/html"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`,
      'OEBPS/chapter1.xhtml': `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
</head>
<body>
  <h1>Chapter 1: Music Theory</h1>
  <p>This book demonstrates music notation in EPUB.</p>
</body>
</html>`,
      'OEBPS/EDITME.html': '<!DOCTYPE html><html><head><title>EDITME</title></head><body><p>EPUB Editor</p></body></html>',
      // Extensions
      'SOURCE/extensions/abcjs/abcjs-basic.min.js': SAMPLE_EXTENSIONS.ABCJS.files['abcjs-basic.min.js'],
      'SOURCE/extensions/vexflow/vexflow.min.js': SAMPLE_EXTENSIONS.VEXFLOW.files['vexflow.min.js'],
      'SOURCE/extensions/jquery/jquery.min.js': SAMPLE_EXTENSIONS.JQUERY.files['jquery.min.js']
    },
    extensions: ['abcjs', 'vexflow', 'jquery']
  },

  DATA_VIZ_BOOK: {
    name: 'data-visualization-book.epub', 
    description: 'Sample book with data visualization extensions',
    files: {
      'mimetype': 'application/epub+zip',
      'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      'OEBPS/content.opf': `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">sample-dataviz-book</dc:identifier>
    <dc:title>Data Visualization Book</dc:title>
    <dc:creator>Demo Analyst</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="editme" href="EDITME.html" media-type="text/html"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`,
      'OEBPS/chapter1.xhtml': `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
</head>
<body>
  <h1>Chapter 1: Charts and Graphs</h1>
  <p>This book demonstrates data visualization in EPUB.</p>
</body>
</html>`,
      'OEBPS/EDITME.html': '<!DOCTYPE html><html><head><title>EDITME</title></head><body><p>EPUB Editor</p></body></html>',
      // Extensions
      'SOURCE/extensions/d3/d3.min.js': SAMPLE_EXTENSIONS.D3.files['d3.min.js'],
      'SOURCE/extensions/chart-js/chart.min.js': SAMPLE_EXTENSIONS.CHART_JS.files['chart.min.js'],
      'SOURCE/extensions/lodash/lodash.min.js': SAMPLE_EXTENSIONS.LODASH.files['lodash.min.js'],
    },
    extensions: ['d3', 'chart-js', 'lodash']
  }
};

/**
 * Create workspace files from EPUB structure (simulating EPUB extraction)
 */
export function createWorkspaceFromEPUB(epub: SampleEPUB): Record<string, string> {
  const workspaceFiles: Record<string, string> = {};
  
  // Copy all OEBPS and SOURCE files to workspace
  for (const [filePath, content] of Object.entries(epub.files)) {
    if (filePath.startsWith('OEBPS/') || filePath.startsWith('SOURCE/')) {
      workspaceFiles[filePath] = content;
    }
  }
  
  return workspaceFiles;
}

/**
 * Create File object from EPUB data (for upload simulation)
 */
export function createEPUBFile(epub: SampleEPUB): File {
  // Create a simple ZIP-like representation
  const content = Object.entries(epub.files)
    .map(([path, content]) => `${path}:\n${content}\n`)
    .join('\n---\n');
    
  const blob = new Blob([content], { type: 'application/epub+zip' });
  return new File([blob], epub.name, {
    type: 'application/epub+zip',
    lastModified: Date.now()
  });
}

/**
 * Get extension count from EPUB
 */
export function getEPUBExtensionCount(epub: SampleEPUB): number {
  return epub.extensions.length;
}

/**
 * Get total size of EPUB extensions
 */
export function getEPUBExtensionSize(epub: SampleEPUB): number {
  let totalSize = 0;
  
  for (const [filePath, content] of Object.entries(epub.files)) {
    if (filePath.startsWith('SOURCE/extensions/')) {
      totalSize += content.length;
    }
  }
  
  return totalSize;
}