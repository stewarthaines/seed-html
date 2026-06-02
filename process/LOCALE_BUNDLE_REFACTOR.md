# I18N Bundle System Refactor: JSON-Stringified Bundle → ZIP Archive

## Executive Summary

This document outlines a refactoring plan to replace the current problematic JSON-stringified gzip bundle system with a simpler ZIP archive containing individual locale files. This change will eliminate JSON parsing corruption issues and simplify the codebase.

## Current System Analysis

### Build Pipeline

```
npm run i18n:build
├── npm run i18n:extract    # Extract translatable strings from code
├── npm run i18n:convert    # Convert .po files to .json
└── npm run i18n:compress   # Create compressed bundle
```

### Current Data Flow (Problematic)

```
Build Time:
locales/ar.json → JSON.stringify() → Bundle: {"ar.json": "{\n\"key\":\"value\"\n}"}
                                   → JSON.stringify() → gzip → static/i18n-bundle.gz

Runtime:
static/i18n-bundle.gz → gunzip → JSON.parse(bundle) → JSON.parse(each file) → storage
```

### Issues with Current System

1. **Double JSON Parsing**: Content is stringified twice, causing parsing complexity
2. **Corruption Prone**: Character encoding issues in stringified JSON content
3. **Complex Version Checking**: localStorage-based cache invalidation logic
4. **Debugging Difficulty**: Cannot easily inspect individual locale files
5. **Poor Compression**: JSON escaping reduces compression efficiency

### Current File Structure

```
static/i18n-bundle.gz (12KB compressed)
├── Contains: {"ar.json": "stringified content", "de.json": "...", ...}
└── Runtime extracts to: storage/locales/ar.json, de.json, etc.
```

## Proposed System Design

### New Data Flow (Simplified)

```
Build Time:
locales/ar.json → ZIP archive → static/i18n-bundle.zip
locales/de.json ↗
locales/en.json ↗

Runtime:
static/i18n-bundle.zip → unzip → storage/locales/ar.json, de.json, etc.
```

### Benefits

1. **Single Parse Operation**: No JSON parsing during extraction
2. **Standard Format**: ZIP is universally supported and debuggable
3. **Better Compression**: Raw JSON compresses better than escaped strings
4. **Simplified Logic**: Remove version checking, cache invalidation, and parsing layers
5. **Tool Compatibility**: Can inspect bundle with standard ZIP tools

### New File Structure

```
static/i18n-bundle.zip (estimated 10KB compressed)
├── ar.json (raw JSON content)
├── de.json (raw JSON content)
├── en.json (raw JSON content)
├── he.json (raw JSON content)
├── ja.json (raw JSON content)
├── ka.json (raw JSON content)
└── zh-Hant.json (raw JSON content)
```

## Dependencies

### Hybrid Approach: Node.js Build + Browser Runtime

This refactor uses a hybrid approach to leverage the best tools for each environment:

- **Build-time (Node.js)**: `node-stream-zip` for efficient ZIP creation
- **Runtime (Browser)**: Existing `src/lib/zip` for ZIP extraction
- **Compatibility**: Standard ZIP format ensures seamless interoperability

### Required Dependencies

```json
{
  "devDependencies": {
    "node-stream-zip": "^1.15.0"
  }
}
```

**Installation:**

```bash
npm install --save-dev node-stream-zip
```

### Why This Hybrid Approach?

1. **`node-stream-zip`**: Optimized for Node.js, fast file I/O, simple API
2. **`src/lib/zip`**: Already exists, browser-optimized, no additional runtime dependencies
3. **Standard ZIP**: Both libraries create/read standard ZIP format, ensuring compatibility
4. **Minimal Changes**: Leverages existing browser infrastructure while using appropriate build tools

## Implementation Changes

### 1. Build Script Changes

#### File: `build-scripts/i18n-compress.js`

**Current Implementation:**

```javascript
// Creates JSON object with stringified content
const archive = {};
for (const file of jsonFiles) {
  const content = fs.readFileSync(file, 'utf8');
  archive[path.basename(file)] = content; // This stringifies the JSON
}
const jsonString = JSON.stringify(archive);
const compressed = await gzip(jsonString);
```

**New Implementation:**

```javascript
const StreamZip = require('node-stream-zip');
const fs = require('fs');
const path = require('path');

async function createI18nBundle() {
  console.log('📦 Creating i18n ZIP bundle...');

  try {
    // Create new ZIP with compression
    const zip = new StreamZip.async({ level: 9 });

    // Add each locale file to ZIP
    const localesDir = 'src/lib/i18n/locales';
    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(localesDir, file);
      const stats = fs.statSync(filePath);

      console.log(`📄 Adding ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
      await zip.addFile(file, filePath);
    }

    // Write ZIP to static directory
    await zip.close('static/i18n-bundle.zip');

    // Log final size
    const bundleStats = fs.statSync('static/i18n-bundle.zip');
    console.log(`✅ Created i18n-bundle.zip (${(bundleStats.size / 1024).toFixed(1)} KB)`);

    return bundleStats.size;
  } catch (error) {
    console.error('❌ Failed to create i18n bundle:', error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  createI18nBundle().catch(console.error);
}

module.exports = { createI18nBundle };
```

### 2. Runtime Loader Changes

#### File: `src/lib/i18n/loader.ts`

**Remove Complex Logic:**

- Remove `needsUpdate()` method and version checking
- Remove `decompressGzip()` method
- Remove JSON parsing of bundle wrapper
- Remove localStorage version management

**New `extractTranslations()` method:**

```typescript
import { Zip } from '../zip/index.js'; // Use existing browser ZIP library

async extractTranslations(): Promise<void> {
  try {
    console.log('📦 Extracting translations from embedded ZIP...');

    // Get embedded ZIP data URL
    const dataUrl = (globalThis as any).__EDITME_I18N_BUNDLE__;
    if (!dataUrl) {
      throw new Error('Translation data URL not found');
    }

    // Fetch ZIP data
    const response = await fetch(dataUrl);
    const zipData = await response.arrayBuffer();
    console.log(`📥 Fetched ZIP data, size: ${zipData.byteLength} bytes`);

    // Initialize storage
    if (!this.storage.isInitialized()) {
      await this.storage.init();
    }
    await this.storage.createWorkspace(LOCALES_WORKSPACE_ID);

    // Extract ZIP using existing browser library
    const zip = new Zip(zipData);
    console.log(`📄 Found ${zip.entries.length} entries in ZIP`);

    for (const entry of zip.entries) {
      if (entry.fileName.endsWith('.json')) {
        console.log(`📝 Extracting ${entry.fileName}...`);

        // Extract file and convert blob to text
        const blob = await entry.extract();
        const content = await blob.text();

        await this.storage.writeTextFile(LOCALES_WORKSPACE_ID, entry.fileName, content);
        console.log(`✅ Extracted ${entry.fileName} (${content.length} chars)`);
      }
    }

    console.log('🎉 Translation extraction complete');
  } catch (error) {
    console.error('❌ Failed to extract translations:', error);
    throw error;
  }
}
```

**Note**: This implementation uses the existing `src/lib/zip/Zip` class with its current API - no modifications to the ZIP library are needed.

**Simplified `loadTranslations()` method:**

```typescript
async loadTranslations(): Promise<Record<string, TranslationCatalog>> {
  const catalogs: Record<string, TranslationCatalog> = {};

  // Always extract on startup (no version checking)
  await this.extractTranslations();

  // Load from storage
  const filePaths = await this.storage.listFiles(LOCALES_WORKSPACE_ID);
  const localeFiles = filePaths.filter(path => path.endsWith('.json'));

  for (const filePath of localeFiles) {
    try {
      const content = await this.storage.readTextFile(LOCALES_WORKSPACE_ID, filePath);
      const jsonData = JSON.parse(content); // Single parse operation

      const locale = filePath.replace('.json', '');
      catalogs[locale] = {
        locale,
        messages: this.extractMessages(jsonData),
        headers: jsonData[''] || {},
      };
    } catch (error) {
      console.error(`Failed to load ${filePath}:`, error);
    }
  }

  return catalogs;
}
```

### 3. Initialization Changes

#### File: `src/lib/i18n/index.ts`

**Simplified `initI18n()` function:**

```typescript
export async function initI18n(): Promise<void> {
  const state = get(i18nState);
  if (state.initialized || state.loading) return;

  i18nState.update(s => ({ ...s, loading: true }));

  try {
    const loader = createI18nLoader();

    // Always load translations (no version checking)
    const catalogs = await loader.loadTranslations();

    // Continue with locale detection and setup...
    const preferredLocale = getBrowserLocale();
    const initialLocale = catalogs[preferredLocale] ? preferredLocale : DEFAULT_LOCALE;

    i18nState.update(s => ({
      ...s,
      catalogs,
      currentLocale: initialLocale,
      initialized: true,
      loading: false,
    }));
  } catch (error) {
    console.error('Failed to initialize i18n:', error);
    // Fallback to English
    i18nState.update(s => ({
      ...s,
      catalogs: { en: englishFallback },
      currentLocale: 'en',
      initialized: true,
      loading: false,
    }));
  }
}
```

### 4. Build Pipeline Updates

#### Update `package.json` scripts:

```json
{
  "scripts": {
    "i18n:compress": "node build-scripts/i18n-compress.js",
    "build": "npm run i18n:build && vite build"
  }
}
```

#### Update Vite build configuration to embed ZIP:

- Change from `static/i18n-bundle.gz` to `static/i18n-bundle.zip`
- Update Vite plugin to embed ZIP data URL

## File Changes Required

### Build Scripts

- **`build-scripts/i18n-compress.js`** - Complete rewrite to use `node-stream-zip`
- **`package.json`** - Add `node-stream-zip` dev dependency
- **Update build pipeline references** in package.json

### Runtime Code

- **`src/lib/i18n/loader.ts`** - Replace gzip with ZIP using existing `src/lib/zip`
- **`src/lib/i18n/index.ts`** - Remove version checking logic
- **`src/lib/i18n/types.ts`** - Remove version-related interfaces

### Static Assets

- **`static/i18n-bundle.gz`** → **`static/i18n-bundle.zip`**
- Update Vite configuration for new file extension

### Dependencies

- **Build-time**: Add `node-stream-zip` dependency for ZIP creation
- **Runtime**: Use existing `src/lib/zip` for ZIP extraction
- **Remove**: gzip dependencies from build scripts

## Benefits & Risks

### Benefits

1. **Eliminates JSON Parsing Issues**: No more double-parsing corruption
2. **Simpler Codebase**: Remove ~100 lines of complex version/cache logic
3. **Better Debugging**: Can examine ZIP contents with standard tools
4. **Improved Compression**: Raw JSON compresses better than escaped strings
5. **Faster Startup**: No version checking means immediate extraction
6. **More Reliable**: Standard ZIP format reduces browser compatibility issues

### Risks

1. **Browser Compatibility**: ZIP reading in older browsers (mitigated by existing `src/lib/zip` library)
2. **File Size Changes**: Need to verify ZIP compression vs gzip (likely similar or better)
3. **Always Extract**: No caching means extraction on every startup (acceptable for fast ZIP)
4. **Node.js Dependency**: Adding `node-stream-zip` increases build dependencies (minimal impact)

## Testing Strategy

### Unit Tests

```typescript
// Test Node.js ZIP creation in build
describe('i18n-compress', () => {
  it('should create valid ZIP with all locale files using node-stream-zip');
  it('should maintain JSON content integrity');
  it('should compress files efficiently');
});

// Test browser ZIP extraction in loader
describe('TranslationLoader', () => {
  it('should extract ZIP to storage correctly using src/lib/zip');
  it('should handle ZIP extraction errors gracefully');
  it('should parse extracted JSON files correctly');
});

// Test compatibility between Node.js creation and browser extraction
describe('ZIP Compatibility', () => {
  it('should extract files created by node-stream-zip using src/lib/zip');
  it('should maintain content integrity across build->runtime pipeline');
});
```

### Integration Tests

- **Browser Compatibility**: Test in Chrome, Firefox, Safari, Edge
- **Performance Testing**: Compare startup time vs current system
- **File Size Verification**: Ensure ZIP compression is efficient

### Manual Testing

- **Bundle Inspection**: Verify ZIP contents with external tools
- **Error Scenarios**: Test with corrupted ZIP files
- **Locale Switching**: Ensure all languages load correctly

## Migration Strategy

### Phase 1: Implement New System (Parallel)

1. Create new ZIP-based build script
2. Implement ZIP extraction in loader (feature-flagged)
3. Generate both bundle formats during build

### Phase 2: Switch Runtime (Gradual)

1. Switch development environment to use ZIP
2. Test thoroughly across browsers
3. Switch production to use ZIP

### Phase 3: Remove Old System (Cleanup)

1. Remove gzip/JSON bundle generation
2. Remove old loader logic
3. Update documentation

### Phase 4: Optimize (Polish)

1. Fine-tune ZIP compression settings
2. Optimize extraction performance
3. Add enhanced error handling

## Success Criteria

1. ✅ **No JSON Parsing Errors**: Translation loading works reliably
2. ✅ **Bundle Size Similar**: ZIP ≤ current gzip size (12KB)
3. ✅ **Startup Performance**: Extraction time ≤ current parsing time
4. ✅ **Browser Support**: Works in all target browsers
5. ✅ **Debugging Improved**: Can inspect bundle with ZIP tools
6. ✅ **Code Simplified**: Reduced complexity in loader logic

## Conclusion

This refactoring addresses the root cause of translation loading issues by eliminating the problematic double-JSON parsing approach. The ZIP-based system provides a simpler, more reliable, and more maintainable solution while leveraging the existing ZIP library already present in the codebase.

The change is low-risk due to the existing ZIP library support and the ability to phase the migration gradually. The primary benefit is eliminating the JSON parsing corruption that currently prevents non-English translations from loading correctly.
