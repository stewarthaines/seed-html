# 16. Preview Iframe

## Overview

Displays transformed XHTML content in an iframe with blob URL substitution for static resources, real-time updates, and device-specific viewport sizing.

## Requirements

- Display transformed XHTML content
- Blob URL substitution for static resources
- Real-time updates from text editor
- Device-specific viewport sizing

## Dependencies

- **#12 Transform Pipeline** - for content generation
- **#13 Text Editor** - for content updates

## Technical Approach

- Sandboxed iframe for content security
- Dynamic content injection with blob URL handling
- Real-time update mechanism with debouncing
- Scroll position preservation during updates

## API Design

```typescript
interface PreviewIframe {
  // Content management
  setContent(xhtmlContent: string): Promise<void>;
  getContent(): string;
  refreshContent(): Promise<void>;

  // URL handling
  substituteResourceURLs(content: string): Promise<string>;
  preloadResources(urls: string[]): Promise<void>;

  // Viewport management
  setViewportSize(width: number, height: number): void;
  getViewportSize(): { width: number; height: number };
  setZoomLevel(zoom: number): void;

  // State management
  preserveScrollPosition(): ScrollPosition;
  restoreScrollPosition(position: ScrollPosition): void;

  // Events
  onContentLoad(callback: () => void): () => void;
  onResourceError(callback: (url: string, error: Error) => void): () => void;
  onNavigationAttempt(callback: (url: string) => boolean): () => void;
}

interface ScrollPosition {
  x: number;
  y: number;
  elementId?: string;
  elementSelector?: string;
}

interface IframeConfig {
  sandbox: string[];
  allowScripts: boolean;
  allowForms: boolean;
  allowSameOrigin: boolean;
  csp?: string;
}
```

## Iframe Component Structure

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let content = '';
  export let workspaceId = '';
  export let width = '100%';
  export let height = '100%';
  export let zoomLevel = 1;
  export let preserveScroll = true;

  let iframeElement;
  let currentScrollPosition = { x: 0, y: 0 };
  let contentHash = '';
  let isLoading = false;
  let loadError = null;

  $: if (content) updateContent(content);
  $: if (iframeElement) setViewportSize(width, height);
</script>

<div class="preview-iframe-container">
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>Loading preview...</span>
    </div>
  {/if}

  {#if loadError}
    <div class="error-overlay">
      <Icon name="alert-circle" />
      <span>Failed to load preview: {loadError.message}</span>
      <button on:click={retryLoad}>Retry</button>
    </div>
  {/if}

  <iframe
    bind:this={iframeElement}
    class="preview-iframe"
    style="
      width: {width};
      height: {height};
      transform: scale({zoomLevel});
      transform-origin: top left;
    "
    sandbox="allow-scripts allow-same-origin"
    title="Content Preview"
    on:load={handleIframeLoad}
    on:error={handleIframeError}
  ></iframe>
</div>

<style>
  .preview-iframe-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .preview-iframe {
    border: none;
    background: white;
    display: block;
  }

  .loading-overlay,
  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    z-index: 10;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
```

## Content Update Implementation

```typescript
const updateContent = async (newContent: string): Promise<void> => {
  if (!iframeElement || !newContent) return;

  try {
    isLoading = true;
    loadError = null;

    // Calculate content hash to avoid unnecessary updates
    const newHash = await calculateContentHash(newContent);
    if (newHash === contentHash) {
      isLoading = false;
      return;
    }

    // Preserve scroll position if requested
    if (preserveScroll) {
      currentScrollPosition = await captureScrollPosition();
    }

    // Process content with resource substitution
    const processedContent = await substituteResourceURLs(newContent);

    // Update iframe content
    await injectContentIntoIframe(processedContent);

    contentHash = newHash;
  } catch (error) {
    loadError = error;
    dispatch('error', { error });
  } finally {
    isLoading = false;
  }
};

const injectContentIntoIframe = async (content: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) {
      reject(new Error('Unable to access iframe document'));
      return;
    }

    // Clear existing content
    iframeDoc.open();

    // Write new content
    iframeDoc.write(content);
    iframeDoc.close();

    // Set up event listeners
    setupIframeEventListeners(iframeDoc);

    // Wait for content to load
    if (iframeDoc.readyState === 'complete') {
      resolve();
    } else {
      iframeDoc.addEventListener('DOMContentLoaded', () => resolve());
      setTimeout(() => reject(new Error('Content load timeout')), 5000);
    }
  });
};
```

## Resource URL Substitution

```typescript
const substituteResourceURLs = async (content: string): Promise<string> => {
  try {
    // Find all resource references
    const resourceReferences = extractResourceReferences(content);

    // Create blob URLs for each resource
    const urlMap = new Map<string, string>();

    for (const ref of resourceReferences) {
      if (isRelativeURL(ref.url) && !urlMap.has(ref.url)) {
        try {
          const blobURL = await blobURLManager.createBlobURL(
            workspaceId,
            ref.url,
            getMimeTypeFromExtension(ref.url)
          );
          urlMap.set(ref.url, blobURL);
        } catch (error) {
          console.warn(`Failed to create blob URL for ${ref.url}:`, error);
          // Keep original URL as fallback
          urlMap.set(ref.url, ref.url);
        }
      }
    }

    // Replace URLs in content
    let processedContent = content;
    for (const [originalURL, blobURL] of urlMap) {
      processedContent = processedContent.replace(
        new RegExp(escapeRegExp(originalURL), 'g'),
        blobURL
      );
    }

    return processedContent;
  } catch (error) {
    console.error('Resource substitution failed:', error);
    return content; // Return original content as fallback
  }
};

const extractResourceReferences = (content: string): ResourceReference[] => {
  const references: ResourceReference[] = [];

  // CSS links
  const linkMatches = content.matchAll(/<link[^>]+href=["']([^"']+)["']/g);
  for (const match of linkMatches) {
    references.push({ type: 'css', url: match[1] });
  }

  // Script sources
  const scriptMatches = content.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
  for (const match of scriptMatches) {
    references.push({ type: 'script', url: match[1] });
  }

  // Images
  const imgMatches = content.matchAll(/<img[^>]+src=["']([^"']+)["']/g);
  for (const match of imgMatches) {
    references.push({ type: 'image', url: match[1] });
  }

  // Audio sources
  const audioMatches = content.matchAll(/<audio[^>]+src=["']([^"']+)["']/g);
  for (const match of audioMatches) {
    references.push({ type: 'audio', url: match[1] });
  }

  // Video sources
  const videoMatches = content.matchAll(/<video[^>]+src=["']([^"']+)["']/g);
  for (const match of videoMatches) {
    references.push({ type: 'video', url: match[1] });
  }

  // CSS @import rules
  const importMatches = content.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g);
  for (const match of importMatches) {
    references.push({ type: 'css', url: match[1] });
  }

  return references;
};
```

## Scroll Position Management

```typescript
const captureScrollPosition = async (): Promise<ScrollPosition> => {
  return new Promise(resolve => {
    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc || !iframeDoc.defaultView) {
      resolve({ x: 0, y: 0 });
      return;
    }

    const win = iframeDoc.defaultView;
    const position: ScrollPosition = {
      x: win.scrollX,
      y: win.scrollY,
    };

    // Try to find a stable element near the current scroll position
    const visibleElement = findVisibleElement(iframeDoc, position.y);
    if (visibleElement) {
      position.elementId = visibleElement.id;
      position.elementSelector = generateElementSelector(visibleElement);
    }

    resolve(position);
  });
};

const restoreScrollPosition = async (position: ScrollPosition): Promise<void> => {
  return new Promise(resolve => {
    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc || !iframeDoc.defaultView) {
      resolve();
      return;
    }

    const win = iframeDoc.defaultView;

    // Try to restore by element first
    if (position.elementId || position.elementSelector) {
      const element = position.elementId
        ? iframeDoc.getElementById(position.elementId)
        : iframeDoc.querySelector(position.elementSelector);

      if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'start' });
        resolve();
        return;
      }
    }

    // Fallback to absolute position
    win.scrollTo(position.x, position.y);
    resolve();
  });
};

const findVisibleElement = (doc: Document, scrollY: number): Element | null => {
  const elements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div[id], section[id]');

  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.top <= 100 && rect.bottom >= 0) {
      return element;
    }
  }

  return null;
};
```

## Iframe Event Handling

```typescript
const setupIframeEventListeners = (iframeDoc: Document) => {
  const win = iframeDoc.defaultView;
  if (!win) return;

  // Handle navigation attempts
  iframeDoc.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link && link.href) {
      event.preventDefault();

      const shouldNavigate = dispatch('navigation-attempt', {
        url: link.href,
        target: link.target,
      });

      if (!shouldNavigate) {
        console.log('Navigation blocked:', link.href);
      }
    }
  });

  // Handle resource load errors
  iframeDoc.addEventListener(
    'error',
    event => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK') {
        const url = target.getAttribute('src') || target.getAttribute('href');
        dispatch('resource-error', { url, error: event });
      }
    },
    true
  );

  // Handle content changes (for debugging)
  const observer = new MutationObserver(mutations => {
    dispatch('content-mutation', { mutations });
  });

  observer.observe(iframeDoc.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  // Store observer for cleanup
  iframeDoc._mutationObserver = observer;
};
```

## Content Security

```typescript
const IFRAME_SANDBOX_PERMISSIONS = [
  'allow-scripts', // Allow JavaScript execution
  'allow-same-origin', // Allow access to same-origin resources
  // Deliberately excluded:
  // - allow-forms: Prevent form submission
  // - allow-navigation: Prevent navigation
  // - allow-popups: Prevent popup windows
  // - allow-top-navigation: Prevent breaking out of iframe
];

const generateCSP = (): string => {
  return [
    "default-src 'self' blob:",
    "script-src 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline' blob:",
    "img-src 'self' blob: data:",
    "font-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
};
```

## Performance Optimization

```typescript
const debounceContentUpdate = debounce(updateContent, 300);

const preloadCriticalResources = async (content: string): Promise<void> => {
  const criticalResources = extractResourceReferences(content)
    .filter(ref => ref.type === 'css' || ref.type === 'script')
    .slice(0, 5); // Limit to first 5 critical resources

  await Promise.all(
    criticalResources.map(ref =>
      blobURLManager.createBlobURL(workspaceId, ref.url, getMimeTypeFromExtension(ref.url))
    )
  );
};

const calculateContentHash = async (content: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
```

## Error Recovery

```typescript
const handleIframeError = (error: Event) => {
  console.error('Iframe load error:', error);

  // Attempt recovery strategies
  setTimeout(async () => {
    try {
      // Try reloading with simplified content
      const simplifiedContent = stripNonEssentialElements(content);
      await injectContentIntoIframe(simplifiedContent);
    } catch (recoveryError) {
      // Show error state
      loadError = new Error('Preview failed to load');
    }
  }, 1000);
};

const stripNonEssentialElements = (content: string): string => {
  // Remove potentially problematic elements
  return content
    .replace(/<script[^>]*>.*?<\/script>/gs, '')
    .replace(/<object[^>]*>.*?<\/object>/gs, '')
    .replace(/<embed[^>]*\/?>/g, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gs, '');
};
```

## Testing Considerations

- Test content injection with various XHTML structures
- Test resource URL substitution accuracy
- Test scroll position preservation
- Test error handling and recovery
- Test iframe security restrictions
- Test performance with large documents

## Implementation Notes

- Start with basic content injection
- Add resource substitution incrementally
- Implement scroll preservation carefully
- Test security sandbox thoroughly
- Consider using existing iframe management libraries
