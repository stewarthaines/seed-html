# EDITME.html Deployment Guide

This guide covers building and deploying EDITME.html for various distribution methods.

## Table of Contents

1. [Building for Production](#building-for-production)
2. [Web Server Deployment](#web-server-deployment)
3. [Standalone Distribution](#standalone-distribution)
4. [EPUB Embedding](#epub-embedding)
5. [Version Management](#version-management)
6. [Security Considerations](#security-considerations)

## Building for Production

### Prerequisites

- Node.js 18+ installed
- All dependencies installed (`npm install`)
- All tests passing (`npm test`)

### Production Build

```bash
# Run quality checks first
npm run check && npm run lint && npm test

# Create production build
npm run build
```

This creates a single `EDITME.html` file in the `dist/` directory with:
- All JavaScript and CSS inlined
- Assets encoded as data URLs
- Optimized and minified code
- Source maps excluded

### Build Verification

```bash
# Preview the production build
npm run preview

# Test in browser at http://localhost:4173
```

### Build Output

The build produces:
- `dist/EDITME.html` - Single file application (~2-3MB)
- All external dependencies bundled
- No additional files required

## Web Server Deployment

### Basic Requirements

- HTTPS strongly recommended (required for OPFS)
- Modern web server (nginx, Apache, Caddy, etc.)
- Proper MIME types configured

### Server Configuration

#### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name editme.example.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/editme;
    
    location / {
        try_files $uri /EDITME.html;
    }

    # Ensure proper MIME type
    location ~ \.html$ {
        add_header Content-Type "text/html; charset=utf-8";
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header Referrer-Policy "same-origin";
    }

    # Enable compression
    gzip on;
    gzip_types text/html application/javascript text/css;
}
```

#### Apache

```apache
<VirtualHost *:443>
    ServerName editme.example.com
    DocumentRoot /var/www/editme

    # SSL configuration
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    # Serve EDITME.html as default
    DirectoryIndex EDITME.html

    # Security headers
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-Content-Type-Options "nosniff"
    Header set Referrer-Policy "same-origin"

    # Enable compression
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html
    </IfModule>
</VirtualHost>
```

### CDN Deployment

For global distribution:

1. Upload `EDITME.html` to CDN origin
2. Configure caching headers:
   ```
   Cache-Control: public, max-age=3600
   ```
3. Enable compression at CDN level
4. Set up custom domain with SSL

### GitHub Pages

For simple hosting:

```bash
# Build the project
npm run build

# Copy to docs folder (GitHub Pages default)
mkdir -p docs
cp dist/EDITME.html docs/index.html

# Commit and push
git add docs/index.html
git commit -m "Deploy EDITME.html"
git push
```

Enable GitHub Pages in repository settings.

## Standalone Distribution

### Preparing for Download

1. **Build with Download Features**
   ```bash
   npm run build
   ```

2. **Create Download Package**
   ```bash
   # Create a ZIP with documentation
   mkdir editme-download
   cp dist/EDITME.html editme-download/
   cp USER_GUIDE.md editme-download/README.txt
   cp LICENSE.txt editme-download/
   zip -r editme-standalone.zip editme-download/
   ```

### Download Instructions Template

Create a `DOWNLOAD_README.txt`:

```text
EDITME.html - Standalone EPUB Editor

To use:
1. Save EDITME.html to your computer
2. Double-click to open in your web browser
3. Bookmark for easy access

Works offline after first use.
See README.txt for full user guide.

License: Freeware for personal use
(c) 2025 Stewart Haines
```

### Self-Download Feature

The application includes a self-download feature:
- Users can download their own copy from the web version
- Accessed via File → Download Editor
- Includes current version with all updates

## EPUB Embedding

### Creating Active EPUBs

To embed EDITME.html in an EPUB:

1. **Prepare the EPUB Structure**
   ```
   EPUB/
   ├── mimetype
   ├── META-INF/
   │   └── container.xml
   └── OEBPS/
       ├── content.opf
       ├── EDITME.html
       └── SOURCE.zip
   ```

2. **Add to Manifest** (in content.opf)
   ```xml
   <item id="editme" 
         href="EDITME.html" 
         media-type="text/html" 
         properties="scripted"/>
   ```

3. **Include Extraction Instructions**
   
   Create `OEBPS/EXTRACT_EDITOR.txt`:
   ```text
   To extract the EDITME.html editor:
   
   1. Rename this .epub file to .zip
   2. Extract the ZIP file
   3. Find OEBPS/EDITME.html
   4. Copy to your desired location
   5. Open in a web browser to edit EPUBs
   ```

4. **Package the EPUB**
   ```bash
   cd EPUB/
   zip -0 -X ../book-with-editor.epub mimetype
   zip -r ../book-with-editor.epub * -x mimetype
   ```

### Automation Script

Create `scripts/embed-editor.js`:

```javascript
import { promises as fs } from 'fs';
import { join } from 'path';

async function embedEditor(epubPath, editorPath) {
    // Implementation for automated embedding
    // See EPUB_EMBEDDING.md for details
}
```

## Version Management

### Version Tracking

1. **Update Version in package.json**
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. **Build with Version**
   ```bash
   npm run build
   ```

3. **Version Identification**
   - Version embedded in HTML meta tag
   - Accessible via Help → About
   - Shown in browser console on load

### Update Strategy

For web deployment:
1. Deploy new version to server
2. Users get update on next visit
3. Cache busting handled by build

For standalone/embedded:
- Users must manually download updates
- Include version check feature
- Provide update notifications

### Backwards Compatibility

- Maintain workspace format compatibility
- Migration for breaking changes
- Version detection in storage

## Security Considerations

### Content Security Policy

For web deployment, configure CSP headers:

```
Content-Security-Policy: 
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    connect-src 'self';
    frame-src 'none';
```

Note: `unsafe-eval` required for transform scripts.

### CORS Configuration

If serving from CDN:
```
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Methods: GET, HEAD
```

### File System Access

- OPFS provides origin-isolated storage
- No access to user's file system
- Sandbox security model

### Transform Script Security

- Scripts run in isolated context
- Limited API access
- User must explicitly install extensions

## Monitoring and Analytics

### Error Tracking

Consider client-side error tracking:
- Sentry for error monitoring
- Custom error reporting endpoint
- Privacy-respecting analytics

### Performance Monitoring

- Core Web Vitals tracking
- Loading time metrics
- Storage usage statistics

### Usage Analytics (Optional)

If implementing analytics:
- Respect user privacy
- Make it opt-in
- Document data collection

## Deployment Checklist

Before deploying:

- [ ] Run full test suite
- [ ] Verify zero TypeScript errors
- [ ] Test production build locally
- [ ] Update version number
- [ ] Review security headers
- [ ] Test in target browsers
- [ ] Verify offline functionality
- [ ] Check file size (~2-3MB expected)
- [ ] Update documentation
- [ ] Prepare download packages

## Troubleshooting

### Build Failures

- Clear `node_modules` and reinstall
- Check Node.js version (18+ required)
- Verify no local modifications

### Deployment Issues

- Verify HTTPS configuration
- Check MIME types
- Test CORS if using CDN
- Confirm compression enabled

### Browser Issues

- Test in private/incognito mode
- Clear browser storage
- Check browser console for errors
- Verify browser compatibility

For additional deployment support, see project documentation or contact the maintainer.