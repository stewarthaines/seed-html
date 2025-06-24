/**
 * ManifestDependencyTracker Class
 * 
 * File dependency analysis using CSSOM + regex fallback for robust parsing.
 */

import type { FileStorageAPI } from '../storage/index.js';
import type { ManifestItem } from './types.js';
import { WorkspaceError } from './types.js';

export class ManifestDependencyTracker {
  private storage: FileStorageAPI;

  constructor(storage: FileStorageAPI) {
    this.storage = storage;
  }

  /**
   * Find all dependencies for a manifest item
   */
  async findDependencies(workspaceId: string, manifestItem: ManifestItem): Promise<string[]> {
    try {
      const dependencies: string[] = [];

      if (manifestItem.mediaType === "application/xhtml+xml") {
        const xhtmlDeps = await this.findXHTMLDependencies(workspaceId, manifestItem);
        dependencies.push(...xhtmlDeps);
      } else if (manifestItem.mediaType === "text/css") {
        const cssDeps = await this.findCSSDependencies(workspaceId, manifestItem);
        dependencies.push(...cssDeps);
      }
      // Add more media types as needed (JS, etc.)

      return dependencies.filter((dep, index, array) => 
        dep.length > 0 && array.indexOf(dep) === index // Remove duplicates and empty strings
      );
    } catch (error) {
      throw new WorkspaceError(
        `Failed to analyze dependencies for ${manifestItem.href}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DEPENDENCY_ERROR',
        workspaceId
      );
    }
  }

  /**
   * Find dependencies in XHTML files
   */
  private async findXHTMLDependencies(workspaceId: string, manifestItem: ManifestItem): Promise<string[]> {
    try {
      const content = await this.storage.readTextFile(workspaceId, manifestItem.href);
      const doc = new DOMParser().parseFromString(content, "application/xml");
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        // Fall back to regex parsing for malformed XML
        return this.findXHTMLDependenciesRegex(content, manifestItem.href);
      }

      const dependencies: string[] = [];

      // Find CSS links
      const cssLinks = doc.querySelectorAll('link[rel="stylesheet"]');
      cssLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (href) {
          dependencies.push(this.resolveRelativePath(manifestItem.href, href));
        }
      });

      // Find images
      const images = doc.querySelectorAll("img");
      images.forEach((img) => {
        const src = img.getAttribute("src");
        if (src) {
          dependencies.push(this.resolveRelativePath(manifestItem.href, src));
        }
      });

      // Find audio/video sources
      const mediaSources = doc.querySelectorAll("audio source, video source, audio, video");
      mediaSources.forEach((source) => {
        const src = source.getAttribute("src");
        if (src) {
          dependencies.push(this.resolveRelativePath(manifestItem.href, src));
        }
      });

      // Find object/embed elements
      const objects = doc.querySelectorAll("object, embed");
      objects.forEach((obj) => {
        const data = obj.getAttribute("data") || obj.getAttribute("src");
        if (data) {
          dependencies.push(this.resolveRelativePath(manifestItem.href, data));
        }
      });

      // Find script sources
      const scripts = doc.querySelectorAll("script[src]");
      scripts.forEach((script) => {
        const src = script.getAttribute("src");
        if (src) {
          dependencies.push(this.resolveRelativePath(manifestItem.href, src));
        }
      });

      return dependencies;
    } catch (error) {
      // If DOM parsing fails completely, fall back to regex
      try {
        const content = await this.storage.readTextFile(workspaceId, manifestItem.href);
        return this.findXHTMLDependenciesRegex(content, manifestItem.href);
      } catch {
        return [];
      }
    }
  }

  /**
   * Regex fallback for XHTML dependency parsing
   */
  private findXHTMLDependenciesRegex(content: string, basePath: string): string[] {
    const dependencies: string[] = [];
    
    // CSS links
    const cssMatches = content.match(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
    if (cssMatches) {
      cssMatches.forEach(match => {
        const hrefMatch = match.match(/href=["']([^"']+)["']/i);
        if (hrefMatch && hrefMatch[1]) {
          dependencies.push(this.resolveRelativePath(basePath, hrefMatch[1]));
        }
      });
    }

    // Images
    const imgMatches = content.match(/<img[^>]+src=["']([^"']+)["']/gi);
    if (imgMatches) {
      imgMatches.forEach(match => {
        const srcMatch = match.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          dependencies.push(this.resolveRelativePath(basePath, srcMatch[1]));
        }
      });
    }

    // Audio/Video sources
    const mediaMatches = content.match(/<(?:audio|video|source)[^>]+src=["']([^"']+)["']/gi);
    if (mediaMatches) {
      mediaMatches.forEach(match => {
        const srcMatch = match.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          dependencies.push(this.resolveRelativePath(basePath, srcMatch[1]));
        }
      });
    }

    // Scripts
    const scriptMatches = content.match(/<script[^>]+src=["']([^"']+)["']/gi);
    if (scriptMatches) {
      scriptMatches.forEach(match => {
        const srcMatch = match.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          dependencies.push(this.resolveRelativePath(basePath, srcMatch[1]));
        }
      });
    }

    return dependencies;
  }

  /**
   * Find dependencies in CSS files
   */
  private async findCSSDependencies(workspaceId: string, manifestItem: ManifestItem): Promise<string[]> {
    try {
      const content = await this.storage.readTextFile(workspaceId, manifestItem.href);
      const dependencies: string[] = [];

      try {
        // Try CSSOM parsing first (supported in all target browsers)
        const sheet = new CSSStyleSheet();
        await sheet.replace(content);
        
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSImportRule && rule.href) {
            dependencies.push(this.resolveRelativePath(manifestItem.href, rule.href));
          }
          
          if (rule instanceof CSSStyleRule) {
            // Extract URLs from style declarations
            const urls = this.extractUrlsFromStyle(rule.style);
            dependencies.push(...urls.map(url => 
              this.resolveRelativePath(manifestItem.href, url)
            ));
          }

          // Handle @font-face rules
          if (rule instanceof CSSFontFaceRule) {
            const urls = this.extractUrlsFromStyle(rule.style);
            dependencies.push(...urls.map(url => 
              this.resolveRelativePath(manifestItem.href, url)
            ));
          }
        }
      } catch {
        // Fallback to regex parsing if CSSOM fails (malformed CSS)
        const regexDeps = this.findCSSDependenciesRegex(content, manifestItem.href);
        dependencies.push(...regexDeps);
      }

      return dependencies;
    } catch {
      return [];
    }
  }

  /**
   * Regex fallback for CSS dependency parsing
   */
  private findCSSDependenciesRegex(content: string, basePath: string): string[] {
    const dependencies: string[] = [];

    // @import rules
    const importMatches = content.match(/@import\s+(?:url\()?["']?([^"');\s]+)["']?\)?/gi);
    if (importMatches) {
      importMatches.forEach(match => {
        const urlMatch = match.match(/@import\s+(?:url\()?["']?([^"');\s]+)["']?\)?/i);
        if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('http') && !urlMatch[1].startsWith('data:')) {
          dependencies.push(this.resolveRelativePath(basePath, urlMatch[1]));
        }
      });
    }

    // url() references
    const urlMatches = content.match(/url\(['"]?([^'")]+)['"]?\)/gi);
    if (urlMatches) {
      urlMatches.forEach(match => {
        const urlMatch = match.match(/url\(['"]?([^'")]+)['"]?\)/i);
        if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('http') && !urlMatch[1].startsWith('data:') && !urlMatch[1].startsWith('#')) {
          dependencies.push(this.resolveRelativePath(basePath, urlMatch[1]));
        }
      });
    }

    return dependencies;
  }

  /**
   * Extract URLs from CSS style declarations
   */
  private extractUrlsFromStyle(style: CSSStyleDeclaration): string[] {
    const urls: string[] = [];
    
    // Check common properties that reference URLs
    const urlProperties = [
      'background-image', 'border-image', 'list-style-image', 
      'content', 'cursor', 'src' // for @font-face
    ];
    
    for (const prop of urlProperties) {
      const value = style.getPropertyValue(prop);
      if (value) {
        const urlMatches = value.match(/url\(['"]?([^'")]+)['"]?\)/g);
        if (urlMatches) {
          urls.push(...urlMatches.map(match => 
            match.replace(/url\(['"]?([^'")]+)['"]?\)/, '$1')
          ));
        }
      }
    }
    
    return urls.filter(url => 
      !url.startsWith('http') && 
      !url.startsWith('data:') && 
      !url.startsWith('#')
    );
  }

  /**
   * Resolve relative paths relative to base file
   */
  private resolveRelativePath(basePath: string, relativePath: string): string {
    // Handle absolute URLs and data URLs
    if (relativePath.startsWith('http') || relativePath.startsWith('data:') || relativePath.startsWith('#')) {
      return '';
    }

    // Get directory of base file
    const baseDir = basePath.split("/").slice(0, -1).join("/");
    
    // Handle different relative path patterns
    if (relativePath.startsWith('./')) {
      relativePath = relativePath.substring(2);
    }

    let resolved: string;
    if (relativePath.startsWith('/')) {
      // Absolute path from workspace root
      resolved = relativePath.substring(1);
    } else if (baseDir) {
      // Relative to base directory
      resolved = `${baseDir}/${relativePath}`;
    } else {
      // Base is in root directory
      resolved = relativePath;
    }

    // Resolve .. patterns
    const parts = resolved.split('/');
    const resolvedParts: string[] = [];
    
    for (const part of parts) {
      if (part === '..') {
        resolvedParts.pop();
      } else if (part !== '.' && part !== '') {
        resolvedParts.push(part);
      }
    }

    return resolvedParts.join('/');
  }

  /**
   * Analyze circular dependencies (placeholder for future implementation)
   */
  async findCircularDependencies(workspaceId: string, manifestItems: ManifestItem[]): Promise<string[][]> {
    // TODO: Implement circular dependency detection
    // This would involve building a dependency graph and detecting cycles
    return [];
  }

  /**
   * Get all dependencies for multiple manifest items
   */
  async findAllDependencies(workspaceId: string, manifestItems: ManifestItem[]): Promise<Map<string, string[]>> {
    const dependencyMap = new Map<string, string[]>();
    
    for (const item of manifestItems) {
      try {
        const dependencies = await this.findDependencies(workspaceId, item);
        dependencyMap.set(item.href, dependencies);
      } catch {
        // Skip items that can't be analyzed
        dependencyMap.set(item.href, []);
      }
    }

    return dependencyMap;
  }

  /**
   * Check if a file is referenced by any manifest item
   */
  async isFileReferenced(workspaceId: string, filePath: string, manifestItems: ManifestItem[]): Promise<boolean> {
    for (const item of manifestItems) {
      try {
        const dependencies = await this.findDependencies(workspaceId, item);
        if (dependencies.includes(filePath)) {
          return true;
        }
      } catch {
        // Skip items that can't be analyzed
      }
    }
    return false;
  }
}