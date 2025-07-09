/**
 * Utility functions for ManifestManager
 * 
 * Pure utility functions for ID generation, media type detection, and file handling.
 */

import type { MediaTypeCategories } from './types.js';

/**
 * Utility class with static methods for manifest operations
 */
export class ManifestUtils {
  /**
   * Generate a valid XML ID from a filename
   * @param fileName - File name to base ID on
   * @returns Valid XML ID string
   */
  static generateItemId(fileName: string): string {
    if (!fileName || fileName.trim() === '') {
      return 'item';
    }

    // Remove file extension
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    
    // Convert to lowercase and replace non-alphanumeric characters with underscores
    const cleanId = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_') // Keep each special char as separate underscore
      .replace(/^[0-9]/, 'item_$&') // Ensure doesn't start with number
      .replace(/^[^a-z_]/, 'item') // Ensure starts with letter or underscore
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores only

    return cleanId || 'item';
  }

  /**
   * Detect media type from filename and optional content
   * @param fileName - File name with extension
   * @param content - Optional file content for content-based detection
   * @returns Detected MIME type
   */
  static detectMediaType(fileName: string, content?: ArrayBuffer): string {
    const extension = this.getFileExtension(fileName).toLowerCase();

    // Primary detection based on file extension
    const extensionMap: Record<string, string> = {
      // Text formats
      'xhtml': 'application/xhtml+xml',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain',
      
      // Image formats
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon',
      
      // Audio formats
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      
      // Video formats
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogv': 'video/ogg',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      
      // Font formats
      'ttf': 'font/ttf',
      'otf': 'font/otf',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'eot': 'application/vnd.ms-fontobject',
      
      // Document formats
      'pdf': 'application/pdf',
      'epub': 'application/epub+zip',
      'zip': 'application/zip',
    };

    // Try extension-based detection first
    const detectedType = extensionMap[extension];
    if (detectedType) {
      return detectedType;
    }

    // Content-based detection if content is provided
    if (content && content.byteLength > 0) {
      return this.detectMediaTypeFromContent(content);
    }

    // Fallback to generic binary type
    return 'application/octet-stream';
  }

  /**
   * Detect media type from file content (magic bytes)
   * @param content - File content as ArrayBuffer
   * @returns Detected MIME type
   */
  private static detectMediaTypeFromContent(content: ArrayBuffer): string {
    const bytes = new Uint8Array(content);
    
    // Check for common file signatures (magic bytes)
    if (bytes.length >= 8) {
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return 'image/png';
      }
      
      // JPEG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return 'image/jpeg';
      }
      
      // GIF: 47 49 46 38
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
        return 'image/gif';
      }
      
      // PDF: 25 50 44 46
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return 'application/pdf';
      }
      
      // ZIP/EPUB: 50 4B 03 04 or 50 4B 05 06
      if (bytes[0] === 0x50 && bytes[1] === 0x4B && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
        return 'application/zip';
      }
    }

    // Check for text content (UTF-8 or ASCII)
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
      if (text.includes('<?xml')) {
        return 'application/xml';
      }
      if (text.includes('<html') || text.includes('<!DOCTYPE html')) {
        return 'text/html';
      }
      return 'text/plain';
    } catch {
      // Not valid UTF-8 text
    }

    return 'application/octet-stream';
  }

  /**
   * Get media type categories for UI organization
   * @returns Complete media type categorization
   */
  static getMediaTypeCategories(): MediaTypeCategories {
    return {
      text: [
        { mediaType: 'application/xhtml+xml', extensions: ['xhtml'], description: 'XHTML Document', isEpubCore: true },
        { mediaType: 'text/html', extensions: ['html', 'htm'], description: 'HTML Document' },
        { mediaType: 'text/css', extensions: ['css'], description: 'CSS Stylesheet', isEpubCore: true },
        { mediaType: 'application/javascript', extensions: ['js'], description: 'JavaScript' },
        { mediaType: 'application/json', extensions: ['json'], description: 'JSON Data' },
        { mediaType: 'text/plain', extensions: ['txt'], description: 'Plain Text' },
        { mediaType: 'application/xml', extensions: ['xml'], description: 'XML Document' },
      ],
      image: [
        { mediaType: 'image/jpeg', extensions: ['jpg', 'jpeg'], description: 'JPEG Image', isEpubCore: true },
        { mediaType: 'image/png', extensions: ['png'], description: 'PNG Image', isEpubCore: true },
        { mediaType: 'image/gif', extensions: ['gif'], description: 'GIF Image', isEpubCore: true },
        { mediaType: 'image/svg+xml', extensions: ['svg'], description: 'SVG Image', isEpubCore: true },
        { mediaType: 'image/webp', extensions: ['webp'], description: 'WebP Image' },
        { mediaType: 'image/bmp', extensions: ['bmp'], description: 'Bitmap Image' },
      ],
      audio: [
        { mediaType: 'audio/mpeg', extensions: ['mp3'], description: 'MP3 Audio', isEpubCore: true },
        { mediaType: 'audio/mp4', extensions: ['m4a'], description: 'MP4 Audio', isEpubCore: true },
        { mediaType: 'audio/ogg', extensions: ['ogg'], description: 'OGG Audio' },
        { mediaType: 'audio/wav', extensions: ['wav'], description: 'WAV Audio' },
        { mediaType: 'audio/aac', extensions: ['aac'], description: 'AAC Audio' },
      ],
      video: [
        { mediaType: 'video/mp4', extensions: ['mp4'], description: 'MP4 Video', isEpubCore: true },
        { mediaType: 'video/webm', extensions: ['webm'], description: 'WebM Video' },
        { mediaType: 'video/ogg', extensions: ['ogv'], description: 'OGG Video' },
        { mediaType: 'video/quicktime', extensions: ['mov'], description: 'QuickTime Video' },
      ],
      application: [
        { mediaType: 'font/ttf', extensions: ['ttf'], description: 'TrueType Font', isEpubCore: true },
        { mediaType: 'font/otf', extensions: ['otf'], description: 'OpenType Font', isEpubCore: true },
        { mediaType: 'font/woff', extensions: ['woff'], description: 'WOFF Font', isEpubCore: true },
        { mediaType: 'font/woff2', extensions: ['woff2'], description: 'WOFF2 Font', isEpubCore: true },
        { mediaType: 'application/pdf', extensions: ['pdf'], description: 'PDF Document' },
        { mediaType: 'application/zip', extensions: ['zip'], description: 'ZIP Archive' },
        { mediaType: 'application/octet-stream', extensions: [], description: 'Binary Data' },
      ],
    };
  }

  /**
   * Create blob URL for content preview
   * @param content - Content as ArrayBuffer or string
   * @param mediaType - MIME type for the blob
   * @returns Blob URL string
   */
  static createBlobUrl(content: ArrayBuffer | string, mediaType: string): string {
    const blob = typeof content === 'string' 
      ? new Blob([content], { type: mediaType })
      : new Blob([content], { type: mediaType });
    
    return URL.createObjectURL(blob);
  }

  /**
   * Revoke a blob URL to free memory
   * @param url - Blob URL to revoke
   */
  static revokeBlobUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * Format file size in human-readable format
   * @param bytes - Size in bytes
   * @returns Formatted size string
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract file extension from filename
   * @param fileName - File name
   * @returns File extension (without dot)
   */
  static getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.slice(lastDot + 1) : '';
  }

  /**
   * Sanitize filename for safe storage
   * @param fileName - Original filename
   * @returns Sanitized filename
   */
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  }
}