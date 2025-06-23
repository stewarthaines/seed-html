# Service Worker Cache for Preview - Spike

## Overview
A self-contained single HTML file spike to test using a service worker to intercept asset requests from preview iframes and serve manifest item files from browser storage. Preview XHTML will use standard EPUB-style relative URLs like `styles/page.css` and `scripts/responsive.js`.

## Goals
- Single HTML file that demonstrates the complete workflow
- Register service worker that intercepts CSS/JS/SVG asset requests from preview iframe
- Store mock EPUB manifest items in IndexedDB
- Preview XHTML uses normal EPUB relative URLs without workspace references
- Prove concept without blob URL creation and management

## Single File Structure
```html
<!DOCTYPE html>
<html>
<head>
  <title>Service Worker Preview Spike</title>
  <style>/* Spike UI styles */</style>
</head>
<body>
  <!-- Simple UI for testing -->
  
  <script>
    // Service worker registration and management
    // IndexedDB mock workspace storage
    // Preview iframe creation and testing
  </script>
  
  <!-- Inline service worker script as data URL or blob -->
  <script id="service-worker-script" type="text/plain">
    // Service worker code that intercepts preview asset requests
  </script>
</body>
</html>
```

## Technical Approach

### Mock Data Setup
```javascript
// Mock EPUB manifest items stored in IndexedDB
const mockManifestItems = {
  'OEBPS/styles/page.css': 'body { font-family: serif; color: #333; }',
  'OEBPS/scripts/responsive.js': 'console.log("EPUB script loaded");',
  'OEBPS/images/play.svg': '<svg>...</svg>',
  'OEBPS/chapter1.xhtml': `<!DOCTYPE html>
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <link rel="stylesheet" href="styles/page.css">
      <script src="scripts/responsive.js"></script>
    </head>
    <body>
      <img src="images/play.svg" alt="Play">
      <p>Chapter content with assets</p>
    </body>
    </html>`
}
```

### Service Worker Creation
```javascript
// Create service worker from inline script
const swScript = document.getElementById('service-worker-script').textContent
const swBlob = new Blob([swScript], { type: 'application/javascript' })
const swUrl = URL.createObjectURL(swBlob)

// Register with appropriate scope
navigator.serviceWorker.register(swUrl, { scope: '/preview/' })
```

### Preview Testing Flow
1. Store mock manifest items in IndexedDB
2. Register service worker from blob URL
3. Create preview iframe at `/preview/test/chapter.xhtml`
4. Iframe loads mock XHTML with relative asset URLs
5. Service worker intercepts asset requests and serves from IndexedDB
6. Verify CSS styling, JS execution, SVG display

### Service Worker Logic (Inline)
```javascript
// Inside service worker script
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  
  // Check if request is from preview iframe
  if (url.pathname.startsWith('/preview/')) {
    event.respondWith(handlePreviewRequest(event.request))
  }
})

async function handlePreviewRequest(request) {
  const url = new URL(request.url)
  
  // Extract relative asset path
  const pathMatch = url.pathname.match(/^\/preview\/[^\/]+\/(.+)$/)
  if (!pathMatch) return fetch(request)
  
  const assetPath = pathMatch[1]
  const manifestPath = `OEBPS/${assetPath}`
  
  // Get from IndexedDB (service worker can access IndexedDB)
  const content = await getFromIndexedDB(manifestPath)
  if (!content) return new Response('Not found', { status: 404 })
  
  return new Response(content, {
    headers: {
      'Content-Type': getMimeType(assetPath),
      'Cache-Control': 'max-age=3600'
    }
  })
}
```

## Test Scenarios
1. **CSS Loading**: Preview iframe applies styles from `styles/page.css`
2. **JavaScript Execution**: Script from `scripts/responsive.js` runs and logs to console
3. **SVG Display**: Image from `images/play.svg` renders correctly
4. **Multiple Assets**: Chapter with multiple CSS, JS, and image references

## Success Criteria
- [ ] Single HTML file runs without external dependencies
- [ ] Service worker registers successfully from blob URL
- [ ] Mock manifest items stored in IndexedDB
- [ ] Preview iframe created at `/preview/test/chapter.xhtml` URL
- [ ] Service worker intercepts relative asset requests
- [ ] CSS applies correctly to preview content
- [ ] JavaScript executes in preview iframe
- [ ] SVG images display properly
- [ ] Browser devtools show intercepted requests

## Implementation Steps
1. Create basic HTML structure with inline styles
2. Add IndexedDB storage for mock manifest items
3. Create service worker script as inline text
4. Register service worker from blob URL
5. Create preview iframe with mock XHTML content
6. Test asset loading and verify in browser devtools
7. Add UI controls for testing different scenarios

## File Output
- Single file: `spike_service_worker_preview.html`
- Self-contained with no external dependencies
- Can be opened directly in browser via file:// URL
- Demonstrates complete service worker asset interception workflow