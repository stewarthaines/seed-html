/**
 * Mock content previews for Storybook demonstrations
 * 
 * Provides realistic preview content for different media types
 * to demonstrate the preview functionality in manifest stories.
 */

import type { ContentPreview, ContentMetadata } from '../../../lib/manifest/types.js';

/**
 * Sample XHTML content for text previews
 */
const sampleXhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
    <title>Chapter 1: The Beginning</title>
    <link rel="stylesheet" type="text/css" href="../styles/main.css"/>
</head>
<body>
    <section epub:type="chapter">
        <h1>Chapter 1: The Beginning</h1>
        
        <p>This is the opening chapter of our story, where we introduce the main characters and set the scene for the adventure that follows.</p>
        
        <p>The morning sun cast long shadows across the meadow as Sarah stepped out of her cottage. She had been preparing for this day for weeks, gathering supplies and studying the ancient maps her grandmother had left her.</p>
        
        <blockquote>
            <p>"The journey of a thousand miles begins with a single step."</p>
            <cite>— Ancient Proverb</cite>
        </blockquote>
        
        <p>With determination in her heart and her backpack securely fastened, Sarah began walking toward the mysterious forest that had called to her in her dreams.</p>
    </section>
</body>
</html>`;

/**
 * Sample CSS content
 */
const sampleCssContent = `/* Main stylesheet for EPUB */

body {
    font-family: "Source Serif Pro", Georgia, serif;
    font-size: 1.1em;
    line-height: 1.6;
    margin: 2em;
    color: #333;
}

h1, h2, h3 {
    font-family: "Source Sans Pro", Arial, sans-serif;
    color: #2c3e50;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
}

h1 {
    font-size: 2.2em;
    text-align: center;
    border-bottom: 2px solid #3498db;
    padding-bottom: 0.5em;
}

p {
    margin-bottom: 1em;
    text-align: justify;
}

blockquote {
    margin: 1.5em 2em;
    padding: 1em;
    border-left: 4px solid #3498db;
    background-color: #f8f9fa;
    font-style: italic;
}

cite {
    display: block;
    text-align: right;
    margin-top: 0.5em;
    font-size: 0.9em;
    color: #666;
}`;

/**
 * Sample navigation content
 */
const sampleNavContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
    <title>Table of Contents</title>
    <link rel="stylesheet" type="text/css" href="../styles/nav.css"/>
</head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>Table of Contents</h1>
        <ol>
            <li><a href="chapter1.xhtml">Chapter 1: The Beginning</a></li>
            <li><a href="chapter2.xhtml">Chapter 2: The Journey Starts</a></li>
            <li><a href="chapter3.xhtml">Chapter 3: Challenges Ahead</a></li>
            <li><a href="chapter4.xhtml">Chapter 4: New Discoveries</a></li>
            <li><a href="chapter5.xhtml">Chapter 5: The Resolution</a></li>
        </ol>
    </nav>
</body>
</html>`;

/**
 * Mock content data mapped by href
 */
const mockContentMap: Record<string, string> = {
  'OEBPS/nav.xhtml': sampleNavContent,
  'OEBPS/chapter1.xhtml': sampleXhtmlContent,
  'OEBPS/chapter2.xhtml': sampleXhtmlContent.replace('Chapter 1: The Beginning', 'Chapter 2: The Journey Starts'),
  'OEBPS/styles/main.css': sampleCssContent,
  'SOURCE/text/chapter1.txt': `# Chapter 1: The Beginning

This is the plain text source for the first chapter.

The morning sun cast long shadows across the meadow as Sarah stepped out of her cottage. She had been preparing for this day for weeks, gathering supplies and studying the ancient maps her grandmother had left her.

> "The journey of a thousand miles begins with a single step." — Ancient Proverb

With determination in her heart and her backpack securely fastened, Sarah began walking toward the mysterious forest that had called to her in her dreams.`,
  'SOURCE/transforms/custom.js': `// Custom transform script for EPUB processing

function transformText(content) {
    // Convert markdown-style headers
    content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    
    // Convert blockquotes
    content = content.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
    
    // Convert paragraphs
    content = content.replace(/^([^<>]+)$/gm, '<p>$1</p>');
    
    return content;
}

module.exports = { transformText };`,
};

/**
 * Create mock content preview for a given item
 */
export function createMockContentPreview(itemId: string, href: string, mediaType: string): ContentPreview {
  const contentType = getContentTypeFromMediaType(mediaType);
  
  const preview: ContentPreview = {
    itemId,
    mediaType,
    contentType,
  };

  // Add content based on type
  if (contentType === 'text') {
    const textContent = mockContentMap[href] || 'Sample content not available for this item.';
    preview.textContent = textContent;
    preview.metadata = extractTextMetadata(textContent);
  } else if (contentType === 'image') {
    // For images, create a placeholder blob URL
    preview.previewUrl = createMockImageUrl(href);
    preview.metadata = {
      width: 800,
      height: 600,
    };
  } else if (contentType === 'audio') {
    preview.previewUrl = createMockAudioUrl(href);
    preview.metadata = {
      duration: 245, // 4:05 minutes
      bitrate: 128,
    };
  } else if (contentType === 'video') {
    preview.previewUrl = createMockVideoUrl(href);
    preview.metadata = {
      duration: 1200, // 20 minutes
      bitrate: 1024,
      width: 1920,
      height: 1080,
    };
  }

  return preview;
}

/**
 * Create content preview with error for testing error states
 */
export function createErrorContentPreview(itemId: string, mediaType: string): ContentPreview {
  return {
    itemId,
    mediaType,
    contentType: 'binary',
    error: 'Failed to load content: File not found or corrupted',
  };
}

/**
 * Get all available mock content hrefs
 */
export function getAvailableMockContent(): string[] {
  return Object.keys(mockContentMap);
}

/**
 * Helper function to determine content type from media type
 */
function getContentTypeFromMediaType(mediaType: string): 'text' | 'image' | 'audio' | 'video' | 'binary' {
  if (mediaType.startsWith('text/') || mediaType.includes('xml') || mediaType.includes('css')) {
    return 'text';
  }
  if (mediaType.startsWith('image/')) {
    return 'image';
  }
  if (mediaType.startsWith('audio/')) {
    return 'audio';
  }
  if (mediaType.startsWith('video/')) {
    return 'video';
  }
  return 'binary';
}

/**
 * Extract metadata from text content
 */
function extractTextMetadata(content: string): ContentMetadata {
  return {
    characterCount: content.length,
    lineCount: content.split('\n').length,
    wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
  };
}

/**
 * Create mock image URL (placeholder)
 */
function createMockImageUrl(href: string): string {
  // Create a data URL for a simple colored rectangle
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Create a gradient background
    const gradient = ctx.createLinearGradient(0, 0, 400, 300);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#2c3e50');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 300);
    
    // Add text overlay
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Mock Image', 200, 140);
    ctx.font = '14px Arial';
    ctx.fillText(href, 200, 170);
  }
  
  return canvas.toDataURL();
}

/**
 * Create mock audio URL (placeholder)
 */
function createMockAudioUrl(href: string): string {
  // Return a data URL for a silent audio file
  return 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODQlWl+Wyu2kdBDOU3PHNeSsFJHfH8N2QQAoUXrTp7KFODR==';
}

/**
 * Create mock video URL (placeholder) 
 */
function createMockVideoUrl(href: string): string {
  // Return a data URL for a small video file
  return 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAFWxtZGF0AAACrgYF//Vc3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSByMjkxNyAwYTg0ZDk4IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxOCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTIgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAga2Y9MSByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAA=';
}