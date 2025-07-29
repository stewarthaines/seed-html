import { describe, it, expect } from 'vitest';
import {
  getDirectoryFromMediaType,
  generateEPUBPath
} from '../opf-utils.js';

describe('EPUB Path Utilities', () => {
  describe('getDirectoryFromMediaType', () => {
    it('should map core file types to correct directories', () => {
      expect(getDirectoryFromMediaType('text/javascript')).toBe('Scripts/');
      expect(getDirectoryFromMediaType('application/javascript')).toBe('Scripts/');
      expect(getDirectoryFromMediaType('text/css')).toBe('Styles/');
      expect(getDirectoryFromMediaType('application/xhtml+xml')).toBe('Text/');
      expect(getDirectoryFromMediaType('text/html')).toBe('Text/');
      expect(getDirectoryFromMediaType('image/jpeg')).toBe('Images/');
    });

    it('should handle media types with charset parameters', () => {
      expect(getDirectoryFromMediaType('text/css; charset=utf-8')).toBe('Styles/');
      expect(getDirectoryFromMediaType('text/javascript;charset=UTF-8')).toBe('Scripts/');
    });

    it('should default to root level for unknown media types', () => {
      expect(getDirectoryFromMediaType('application/unknown')).toBe('');
      expect(getDirectoryFromMediaType('text/unknown')).toBe('');
      expect(getDirectoryFromMediaType('')).toBe('');
    });

    it('should be case insensitive', () => {
      expect(getDirectoryFromMediaType('TEXT/JAVASCRIPT')).toBe('Scripts/');
      expect(getDirectoryFromMediaType('Image/JPEG')).toBe('Images/');
    });
  });

  describe('generateEPUBPath', () => {
    it('should generate correct paths for core file types', () => {
      expect(generateEPUBPath('app.js', 'text/javascript')).toBe('Scripts/app.js');
      expect(generateEPUBPath('style.css', 'text/css')).toBe('Styles/style.css');
      expect(generateEPUBPath('chapter1.xhtml', 'application/xhtml+xml')).toBe('Text/chapter1.xhtml');
      expect(generateEPUBPath('cover.jpg', 'image/jpeg')).toBe('Images/cover.jpg');
    });

    it('should handle filenames with special characters', () => {
      expect(generateEPUBPath('my-script.js', 'text/javascript')).toBe('Scripts/my-script.js');
      expect(generateEPUBPath('chapter_1.xhtml', 'application/xhtml+xml')).toBe('Text/chapter_1.xhtml');
    });

    it('should default to root level for unknown types', () => {
      expect(generateEPUBPath('data.bin', 'application/octet-stream')).toBe('data.bin');
    });
  });
});