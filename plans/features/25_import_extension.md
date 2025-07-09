# 25. Extension Manager with Cache

## Overview

Provides a unified interface for managing JavaScript extensions in workspaces, including importing new extensions, managing existing ones, and utilizing a global extension cache. Extensions are stored in `SOURCE/extensions/` and automatically cached for reuse across workspaces.

## Requirements

### Functional Requirements

- **Import Extensions**: Upload JavaScript files from desktop to create new extensions
- **Extension Storage**: Store in `SOURCE/extensions/<name>/` directory structure
- **Global Cache**: Maintain cache at `extensions/` in File Storage for reuse
- **Cache Population**: Auto-cache extensions during workspace import and creation
- **Multi-file Support**: Add additional JS files to existing extensions
- **License Management**: Include LICENSE.txt files when present

### User Experience Requirements

- **Unified Interface**: Modal-based workflow in workspace settings view
- **Cache Integration**: Import extensions from cache as alternative to file upload
- **Extension Management**: List, add files to, and remove extensions
- **Cache Management**: View cached extensions, delete unwanted ones
- **Name Confirmation**: Auto-detect names with user override option

## Dependencies

- **File Storage API**: Writing extensions to workspace and global cache
- **SOURCE.zip Integration**: Extensions bundled during EPUB packaging
- **Transform Pipeline**: Extension libraries loaded as globals
- **Workspace Manager**: Extension discovery during import
- **Web APIs**: File upload and handling

## Technical Approach

### Storage Structure

```
# Workspace Extensions
workspace-{id}/
└── OEBPS/
    └── SOURCE/
        └── extensions/
            ├── markdown-it/
            │   ├── markdown-it.min.js    # Main library file
            │   ├── markdown-it-plugin.js # Additional library files
            │   └── LICENSE.txt           # Optional license
            └── abcjs/
                ├── abcjs-basic.min.js
                └── LICENSE

# Global Extension Cache (File Storage)
extensions/
├── markdown-it/
│   ├── markdown-it.min.js
│   ├── markdown-it-plugin.js
│   └── LICENSE.txt
├── abcjs/
│   ├── abcjs-basic.min.js
│   └── LICENSE
└── prism/
    └── prism.min.js
```

### Cache Integration Workflow

#### Cache Population

1. **Workspace Import**: Scan `SOURCE/extensions/` for new extensions
2. **New Extension Creation**: Cache immediately when user creates extension
3. **Automatic Process**: No user prompts, transparent caching
4. **Conflict Handling**: Skip caching if same name exists with different content

#### Cache Usage

1. **Import from Cache**: Alternative to file upload in extension dialog
2. **Copy to Workspace**: Extensions copied from cache to `SOURCE/extensions/`
3. **Independent Copies**: Changes to workspace extension don't affect cache

### Extension Directory Structure

Each extension contains:

- `*.js` - JavaScript library files (one or more)
- `LICENSE.txt` or `LICENSE` - Optional license file
- No metadata.json or transform.js (transforms go in `SOURCE/scripts/`)

## API Design

### Extension Manager Interface

```typescript
interface ExtensionManager {
  // Extension import
  importExtension(workspaceId: string, file: File, extensionName: string): Promise<ExtensionInfo>;
  addFileToExtension(workspaceId: string, extensionName: string, file: File): Promise<void>;

  // Workspace extension management
  listWorkspaceExtensions(workspaceId: string): Promise<ExtensionInfo[]>;
  deleteWorkspaceExtension(workspaceId: string, extensionName: string): Promise<void>;

  // Cache management
  listCachedExtensions(): Promise<ExtensionInfo[]>;
  importFromCache(workspaceId: string, extensionName: string): Promise<void>;
  deleteCachedExtension(extensionName: string): Promise<void>;
  cacheExtension(workspaceId: string, extensionName: string): Promise<void>;

  // Cache population (internal)
  scanAndCacheExtensions(workspaceId: string): Promise<number>; // Returns count of newly cached
}

interface ExtensionInfo {
  name: string; // Extension directory name
  files: ExtensionFile[]; // All JS and license files
  totalSize: number; // Combined size of all files
  location: 'workspace' | 'cache' | 'both';
}

interface ExtensionFile {
  filename: string; // e.g., "markdown-it.min.js", "LICENSE.txt"
  size: number;
  type: 'javascript' | 'license';
}

interface ImportOptions {
  source: 'file' | 'cache';
  extensionName: string; // User-confirmed name
  files?: File[]; // For file upload
  cacheExtensionName?: string; // For cache import
}
```

### Extension Name Detection

```typescript
// Extract extension name from filename
function detectExtensionName(filename: string): string {
  // Remove .min.js, .js extensions and version numbers
  return filename
    .replace(/\.min\.js$/, '')
    .replace(/\.js$/, '')
    .replace(/-\d+\.\d+\.\d+/, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase();
}

// Example: "markdown-it-13.0.1.min.js" → "markdown-it"
```

### Cache Operations

````typescript
class ExtensionCache {
  private cacheBasePath = 'extensions/';

  async addToCache(workspaceId: string, extensionName: string): Promise<void> {
    const sourcePath = `workspace-${workspaceId}/OEBPS/SOURCE/extensions/${extensionName}/`;
    const cachePath = `${this.cacheBasePath}${extensionName}/`;

    // Check if already cached with same content
    if (await this.isCached(extensionName)) {
      const isDifferent = await this.compareExtensions(sourcePath, cachePath);
      if (isDifferent) {
        throw new Error(`Extension '${extensionName}' already cached with different content`);
      }
      return; // Already cached with same content
    }

    // Copy all files from workspace to cache
    await this.copyExtension(sourcePath, cachePath);
  }

  async importFromCache(extensionName: string, workspaceId: string): Promise<void> {
    const cachePath = `${this.cacheBasePath}${extensionName}/`;
    const destPath = `workspace-${workspaceId}/OEBPS/SOURCE/extensions/${extensionName}/`;

    // Copy all files from cache to workspace
    await this.copyExtension(cachePath, destPath);
  }
}

## User Interface Design

### Modal-Based Extension Management
```svelte
<!-- Main Extension List in Settings -->
<ExtensionManager>
  <button on:click={openAddExtensionModal}>Add Extension</button>

  <!-- Current Workspace Extensions -->
  <section>
    <h3>Workspace Extensions</h3>
    {#each workspaceExtensions as ext}
      <ExtensionItem {ext}>
        <button on:click={() => addFileToExtension(ext.name)}>Add File</button>
        <button on:click={() => deleteExtension(ext.name)}>Remove</button>
      </ExtensionItem>
    {/each}
  </section>

  <!-- Cached Extensions -->
  <section>
    <h3>Available from Cache</h3>
    {#each cachedExtensions.filter(e => e.location === 'cache') as ext}
      <ExtensionItem {ext}>
        <button on:click={() => importFromCache(ext.name)}>Import to Workspace</button>
        <button on:click={() => deleteCached(ext.name)}>Delete from Cache</button>
      </ExtensionItem>
    {/each}
  </section>
</ExtensionManager>

<!-- Add Extension Modal -->
<Modal bind:open={addExtensionModalOpen}>
  <h2>Add Extension</h2>

  <Tabs>
    <TabPanel title="Upload File">
      <FileDropZone
        on:files={handleFileUpload}
        accept=".js,.min.js"
        multiple={false}
      />
      {#if detectedName}
        <label>
          Extension Name:
          <input bind:value={extensionName} />
        </label>
      {/if}
    </TabPanel>

    <TabPanel title="Import from Cache">
      <select bind:value={selectedCacheExtension}>
        {#each availableCacheExtensions as ext}
          <option value={ext.name}>{ext.name}</option>
        {/each}
      </select>
    </TabPanel>
  </Tabs>

  <button on:click={confirmAddExtension}>Add Extension</button>
</Modal>
````

## Workflow Integration

### New Extension Creation

1. **File Upload**: User selects JavaScript file from desktop
2. **Name Detection**: Extract name from filename (e.g., "markdown-it.min.js" → "markdown-it")
3. **User Confirmation**: Show detected name, allow user to modify
4. **Conflict Check**: Verify name doesn't conflict with existing extension
5. **Directory Creation**: Create `SOURCE/extensions/<name>/` in workspace
6. **File Storage**: Save JS file (and LICENSE.txt if provided)
7. **Cache Population**: Automatically copy to global cache

### Import from Cache

1. **Cache Selection**: User selects from available cached extensions
2. **Copy to Workspace**: Copy all extension files to `SOURCE/extensions/<name>/`
3. **Independent Copy**: Changes to workspace copy don't affect cache

### Workspace Import/Export

1. **EPUB Import**: Extract SOURCE.zip, scan for new extensions
2. **Auto-Cache**: Silently cache any new extensions found
3. **EPUB Export**: Bundle all extensions into SOURCE.zip
4. **Transform Loading**: Extensions available as globals in transform pipeline

## Testing Considerations

### Unit Tests

- File upload handling and name detection
- Extension name conflict detection
- Cache population during workspace import
- Cache vs workspace extension comparison
- Multi-file extension support

### Integration Tests

- End-to-end extension creation and caching
- Import from cache workflow
- SOURCE.zip bundling with extensions
- Auto-cache during workspace import
- Transform pipeline loading cached extensions

### Browser Compatibility

- File API usage for upload handling
- Fetch API for license detection
- CORS handling for CDN license requests
- Large file handling and memory usage

## Implementation Notes

### Security Considerations

- **File Validation**: Verify .js files before import
- **Name Sanitization**: Ensure safe directory names
- **Cache Isolation**: Each workspace gets independent extension copies

### Performance Optimizations

- **Efficient Caching**: Skip re-caching identical extensions
- **Bulk Operations**: Cache all new extensions in single scan
- **Lazy Loading**: Load extension details only when needed

### Error Handling

- **Name Conflicts**: Clear user notification, no auto-resolution
- **Cache Conflicts**: Warning when same name has different content
- **Import Failures**: Rollback on error, maintain consistency
- **Missing Files**: Handle extensions with no LICENSE gracefully

### User Experience

- **Transparent Caching**: Auto-cache without interrupting workflow
- **Clear Status**: Show which extensions are cached vs workspace-only
- **Simple Actions**: One-click import from cache
- **Conflict Prevention**: Name confirmation prevents most conflicts
