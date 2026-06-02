/**
 * EPUB OPF Metadata Parser
 *
 * Extracts dc:identifier and dcterms:modified from EPUB package documents
 * following EPUB 3 specification standards.
 */

import StreamZip from 'node-stream-zip';
import xml2js from 'xml2js';

/**
 * Parse EPUB metadata from package document
 * @param {string} epubPath - Path to EPUB file
 * @returns {Promise<{identifier: string, dctermsModified: string, title: string, creator: string}>}
 */
export async function parseEPUBMetadata(epubPath) {
  let zip;

  try {
    // Open EPUB as ZIP file using node-stream-zip (more robust than yauzl)
    zip = new StreamZip.async({ file: epubPath });

    // Find container.xml to locate package document
    const containerXML = await zip.entryData('META-INF/container.xml');
    const containerData = await xml2js.parseStringPromise(containerXML.toString('utf8'));

    // Get package document path from container
    const rootfile = containerData.container.rootfiles[0].rootfile[0];
    const packagePath = rootfile.$['full-path'];

    // Extract package document (content.opf)
    const packageXML = await zip.entryData(packagePath);
    const packageData = await xml2js.parseStringPromise(packageXML.toString('utf8'));

    // Extract metadata from package document
    return extractMetadataFromPackage(packageData);
  } catch (error) {
    throw new Error(`Failed to parse EPUB metadata from ${epubPath}: ${error.message}`);
  } finally {
    if (zip) {
      await zip.close();
    }
  }
}

// Removed extractFileFromZip function - no longer needed with node-stream-zip

/**
 * Extract metadata from parsed package document
 * @param {Object} packageData - Parsed XML package document
 * @returns {Object} - Extracted metadata
 */
function extractMetadataFromPackage(packageData) {
  const metadata = packageData.package.metadata[0];

  // Extract Dublin Core identifier
  const identifierElements = metadata['dc:identifier'] || [];
  const identifier =
    identifierElements.length > 0 ? identifierElements[0]._ || identifierElements[0] : null;

  if (!identifier) {
    throw new Error('No dc:identifier found in EPUB metadata');
  }

  // Extract dcterms:modified from meta elements
  const metaElements = metadata.meta || [];
  let dctermsModified = null;

  for (const meta of metaElements) {
    if (meta.$ && meta.$.property === 'dcterms:modified') {
      dctermsModified = meta._ || meta;
      break;
    }
  }

  if (!dctermsModified) {
    throw new Error('No dcterms:modified property found in EPUB metadata');
  }

  // Validate dcterms:modified format (must end with Z for UTC)
  if (!dctermsModified.endsWith('Z')) {
    throw new Error(
      `Invalid dcterms:modified format: ${dctermsModified} (must be UTC with Z suffix)`
    );
  }

  // Extract additional metadata for OPDS feed
  const titleElements = metadata['dc:title'] || [];
  const title =
    titleElements.length > 0
      ? titleElements[0]._ || titleElements[0] || 'Unknown Title'
      : 'Unknown Title';

  const creatorElements = metadata['dc:creator'] || [];
  const creator =
    creatorElements.length > 0
      ? creatorElements[0]._ || creatorElements[0] || 'Unknown Author'
      : 'Unknown Author';

  const descriptionElements = metadata['dc:description'] || [];
  const description =
    descriptionElements.length > 0 ? descriptionElements[0]._ || descriptionElements[0] || '' : '';

  const languageElements = metadata['dc:language'] || [];
  const language =
    languageElements.length > 0 ? languageElements[0]._ || languageElements[0] || 'en' : 'en';

  return {
    identifier,
    dctermsModified,
    title,
    creator,
    description,
    language,
    // Parse dcterms:modified into Date object for comparison
    modifiedDate: new Date(dctermsModified),
  };
}
