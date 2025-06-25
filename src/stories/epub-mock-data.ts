/**
 * Mock EPUB data for demo scenarios
 */
import { ZipWriter } from '$lib/zip';

// Valid EPUB 3.0 files
const validMimetype = 'application/epub+zip';

const validContainerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const validContentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">demo-epub-001</dc:identifier>
    <dc:title>Demo EPUB Book</dc:title>
    <dc:creator>EPUB Demo Author</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2024-01-01T12:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

const validChapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
</head>
<body>
  <h1>Chapter 1: Demo Content</h1>
  <p>This is a sample chapter in the demo EPUB.</p>
  <p>It contains basic XHTML content to demonstrate the structure.</p>
</body>
</html>`;

const validNavXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1</a></li>
    </ol>
  </nav>
</body>
</html>`;

// Corrupted XML versions
const corruptedContainerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"
    <!-- Missing closing tag -->
  </rootfiles>
</container>`;

const corruptedContentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">demo-epub-001</dc:identifier>
    <dc:title>Demo EPUB Book</dc:title>
    <dc:creator>EPUB Demo Author</dc:creator>
    <dc:language>en</dc:language>
    <!-- Invalid XML: unclosed meta tag -->
    <meta property="dcterms:modified">2024-01-01T12:00:00Z
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

/**
 * Creates a valid EPUB 3.0 ZIP file
 */
export async function createValidEPUB(): Promise<ArrayBuffer> {
  const writer = new ZipWriter();

  await writer.addFile('mimetype', validMimetype);
  await writer.addFile('META-INF/container.xml', validContainerXml);
  await writer.addFile('OEBPS/content.opf', validContentOpf);
  await writer.addFile('OEBPS/chapter1.xhtml', validChapterXhtml);
  await writer.addFile('OEBPS/nav.xhtml', validNavXhtml);

  const blob = await writer.buildBlob();
  return blob.arrayBuffer();
}

/**
 * Creates an EPUB missing required files (no mimetype)
 */
export async function createMissingFilesEPUB(): Promise<ArrayBuffer> {
  const writer = new ZipWriter();

  // Missing mimetype file
  await writer.addFile('META-INF/container.xml', validContainerXml);
  await writer.addFile('OEBPS/content.opf', validContentOpf);
  await writer.addFile('OEBPS/chapter1.xhtml', validChapterXhtml);

  const blob = await writer.buildBlob();
  return blob.arrayBuffer();
}

/**
 * Creates an EPUB with missing container.xml
 */
export async function createMissingContainerEPUB(): Promise<ArrayBuffer> {
  const writer = new ZipWriter();

  await writer.addFile('mimetype', validMimetype);
  // Missing META-INF/container.xml
  await writer.addFile('OEBPS/content.opf', validContentOpf);
  await writer.addFile('OEBPS/chapter1.xhtml', validChapterXhtml);

  const blob = await writer.buildBlob();
  return blob.arrayBuffer();
}

/**
 * Creates an EPUB with corrupted XML in container.xml
 */
export async function createCorruptedContainerEPUB(): Promise<ArrayBuffer> {
  const writer = new ZipWriter();

  await writer.addFile('mimetype', validMimetype);
  await writer.addFile('META-INF/container.xml', corruptedContainerXml);
  await writer.addFile('OEBPS/content.opf', validContentOpf);
  await writer.addFile('OEBPS/chapter1.xhtml', validChapterXhtml);

  const blob = await writer.buildBlob();
  return blob.arrayBuffer();
}

/**
 * Creates an EPUB with corrupted XML in content.opf
 */
export async function createCorruptedOPFEPUB(): Promise<ArrayBuffer> {
  const writer = new ZipWriter();

  await writer.addFile('mimetype', validMimetype);
  await writer.addFile('META-INF/container.xml', validContainerXml);
  await writer.addFile('OEBPS/content.opf', corruptedContentOpf);
  await writer.addFile('OEBPS/chapter1.xhtml', validChapterXhtml);

  const blob = await writer.buildBlob();
  return blob.arrayBuffer();
}

/**
 * Creates an EPUB with incorrect mimetype content
 */
export async function createWrongMimetypeEPUB(): Promise<ArrayBuffer> {
  const writer = new ZipWriter();

  await writer.addFile('mimetype', 'application/zip'); // Wrong mimetype
  await writer.addFile('META-INF/container.xml', validContainerXml);
  await writer.addFile('OEBPS/content.opf', validContentOpf);
  await writer.addFile('OEBPS/chapter1.xhtml', validChapterXhtml);

  const blob = await writer.buildBlob();
  return blob.arrayBuffer();
}

export const mockEPUBScenarios = {
  validEPUB: {
    name: 'Valid EPUB 3.0',
    description: 'Standard compliant EPUB with all required files',
    create: createValidEPUB,
  },
  missingFiles: {
    name: 'Missing Files',
    description: 'EPUB missing mimetype file',
    create: createMissingFilesEPUB,
  },
  missingContainer: {
    name: 'Missing Container',
    description: 'EPUB missing container.xml file',
    create: createMissingContainerEPUB,
  },
  corruptedContainer: {
    name: 'Corrupted Container',
    description: 'EPUB with invalid XML in container.xml',
    create: createCorruptedContainerEPUB,
  },
  corruptedOPF: {
    name: 'Corrupted OPF',
    description: 'EPUB with invalid XML in content.opf',
    create: createCorruptedOPFEPUB,
  },
  wrongMimetype: {
    name: 'Wrong Mimetype',
    description: 'EPUB with incorrect mimetype content',
    create: createWrongMimetypeEPUB,
  },
};
