/**
 * MIME Type Detection Utilities
 * 
 * Shared MIME type detection for EPUB files and assets.
 * Used by EPUBPackager, BlobURLManager, and other components.
 */

const MIME_TYPES: Record<string, string> = {
  // Text formats
  'html': 'text/html',
  'xhtml': 'application/xhtml+xml',
  'xml': 'application/xml',
  'css': 'text/css',
  'js': 'application/javascript',
  'txt': 'text/plain',
  'json': 'application/json',
  
  // EPUB-specific formats
  'opf': 'application/oebps-package+xml',
  'ncx': 'application/x-dtbncx+xml',
  'epub': 'application/epub+zip',
  
  // Image formats
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  
  // Audio formats
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'm4a': 'audio/mp4',
  
  // Video formats
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'ogv': 'video/ogg',
  
  // Archive formats
  'gz': 'application/gzip',
  'zip': 'application/zip'
};

/**
 * Get MIME type for a file based on its extension
 * @param fileName File name or path with extension
 * @returns MIME type string, defaults to 'application/octet-stream' for unknown extensions
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext || ''] || 'application/octet-stream';
}

/**
 * Get all supported MIME types
 * @returns Record of extension to MIME type mappings
 */
export function getAllMimeTypes(): Record<string, string> {
  return { ...MIME_TYPES };
}

/**
 * Check if a file extension has a known MIME type
 * @param fileName File name or path with extension
 * @returns True if extension is recognized
 */
export function hasMimeType(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? ext in MIME_TYPES : false;
}