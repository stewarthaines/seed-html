<script lang="ts">
  import ManifestContainer from '../../lib/components/manifest/ManifestContainer.svelte';
  import { createMockManifestItems } from './mock-data/manifest-items.js';
  import { createMockSourceItems } from './mock-data/source-items.js';
  import type { ManifestItem, SourceItem, ValidationResult, CreateTextItemData, ContentPreview } from '../../lib/manifest/types.js';
  import type { IManifestManager } from '../../lib/manifest/manifest-manager.js';
  
  // Story props
  export let itemCount = 6;
  export let isLoading = false;
  export let hasErrors = false;
  export let advancedMode = false;
  export let contentTypes = ['text', 'image', 'audio', 'video', 'binary'];
  export let selectedItemId = '';
  export let filterText = '';
  export let hasWorkspace = true;

  // Demo state
  let manifestItems: ManifestItem[] = [];
  let sourceItems: SourceItem[] = [];
  let validationErrors: ValidationResult[] = [];
  
  // Mock ManifestManager implementation
  const mockManifestManager: IManifestManager = {
    // Core data operations
    async loadManifest(workspaceId: string): Promise<ManifestItem[]> {
      if (isLoading) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      manifestItems = createMockManifestItems({
        count: itemCount,
        includeErrors: hasErrors,
        contentTypes: contentTypes as ('text' | 'image' | 'audio' | 'video' | 'binary')[]
      });
      
      return manifestItems;
    },

    async getManifestItem(workspaceId: string, itemId: string): Promise<ManifestItem> {
      const item = manifestItems.find(item => item.id === itemId);
      if (!item) {
        throw new Error(`Item not found: ${itemId}`);
      }
      return item;
    },

    async updateManifestItem(workspaceId: string, itemId: string, updates: Partial<ManifestItem>): Promise<void> {
      const index = manifestItems.findIndex(item => item.id === itemId);
      if (index === -1) {
        throw new Error(`Item not found: ${itemId}`);
      }
      manifestItems[index] = { ...manifestItems[index], ...updates };
    },

    async deleteManifestItem(workspaceId: string, itemId: string): Promise<void> {
      const index = manifestItems.findIndex(item => item.id === itemId);
      if (index === -1) {
        throw new Error(`Item not found: ${itemId}`);
      }
      manifestItems.splice(index, 1);
    },

    // Content operations
    async getItemContent(workspaceId: string, itemId: string): Promise<ArrayBuffer | string> {
      return 'Mock content for ' + itemId;
    },

    async setItemContent(workspaceId: string, itemId: string, content: ArrayBuffer | string): Promise<void> {
      // Mock implementation
    },

    async getContentPreview(workspaceId: string, itemId: string): Promise<ContentPreview> {
      const item = await this.getManifestItem(workspaceId, itemId);
      return {
        itemId,
        mediaType: item.mediaType,
        contentType: item.mediaType.startsWith('text/') ? 'text' : 'binary',
        textContent: item.mediaType.startsWith('text/') ? 'Mock preview content' : undefined,
      };
    },

    // Item creation operations
    async createTextItem(workspaceId: string, itemData: CreateTextItemData): Promise<ManifestItem> {
      const newItem: ManifestItem = {
        id: itemData.id || `item-${Date.now()}`,
        href: `OEBPS/${itemData.fileName}`,
        mediaType: itemData.mediaType || 'application/xhtml+xml',
        size: itemData.content.length,
        modified: new Date(),
        properties: itemData.properties,
      };
      manifestItems.push(newItem);
      return newItem;
    },

    async createFileItem(workspaceId: string, file: File, targetPath?: string): Promise<ManifestItem> {
      const newItem: ManifestItem = {
        id: `file-${Date.now()}`,
        href: targetPath || `OEBPS/${file.name}`,
        mediaType: file.type || 'application/octet-stream',
        size: file.size,
        modified: new Date(),
      };
      manifestItems.push(newItem);
      return newItem;
    },

    async importFileItem(workspaceId: string, filePath: string, content: ArrayBuffer): Promise<ManifestItem> {
      const fileName = filePath.split('/').pop() || 'imported-file';
      const newItem: ManifestItem = {
        id: `import-${Date.now()}`,
        href: filePath,
        mediaType: 'application/octet-stream',
        size: content.byteLength,
        modified: new Date(),
      };
      manifestItems.push(newItem);
      return newItem;
    },

    // Manifest structure operations
    async reorderManifestItems(workspaceId: string, itemIds: string[]): Promise<void> {
      // Mock implementation
    },

    async getManifestOrder(workspaceId: string): Promise<string[]> {
      return manifestItems.map(item => item.id);
    },

    async validateManifest(workspaceId: string): Promise<ValidationResult[]> {
      if (hasErrors) {
        return [
          {
            field: 'id',
            message: 'Duplicate ID found',
            severity: 'error',
            itemId: 'invalid-missing-href'
          },
          {
            field: 'href',
            message: 'Missing href attribute',
            severity: 'error',
            itemId: 'invalid-missing-href'
          }
        ];
      }
      return [];
    },

    // Advanced mode operations
    async listSourceItems(workspaceId: string): Promise<SourceItem[]> {
      if (advancedMode) {
        sourceItems = createMockSourceItems();
        return sourceItems;
      }
      return [];
    },

    async getSourceItemContent(workspaceId: string, sourcePath: string): Promise<ArrayBuffer | string> {
      return 'Mock SOURCE content for ' + sourcePath;
    },

    async isAdvancedModeEnabled(workspaceId: string): Promise<boolean> {
      return advancedMode;
    },

    // Utility operations
    generateItemId(fileName: string): string {
      return fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    },

    detectMediaType(fileName: string, content?: ArrayBuffer): string {
      const ext = fileName.split('.').pop()?.toLowerCase();
      const mediaTypeMap: Record<string, string> = {
        'xhtml': 'application/xhtml+xml',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'mp3': 'audio/mpeg',
        'mp4': 'video/mp4',
        'pdf': 'application/pdf',
      };
      return mediaTypeMap[ext || ''] || 'application/octet-stream';
    },

    getMediaTypeCategories() {
      return {
        text: [],
        image: [],
        audio: [],
        video: [],
        application: []
      };
    },

    // Cache management
    clearCache(workspaceId?: string): void {
      // Mock implementation
    },

    async preloadManifest(workspaceId: string): Promise<void> {
      // Mock implementation
    },

    clearContentCache(workspaceId: string, itemId?: string): void {
      // Mock implementation
    }
  };

  // Demo workspace ID
  const workspaceId = hasWorkspace ? 'demo-workspace' : '';
</script>

<div class="manifest-container-demo">
  {#if !hasWorkspace}
    <div class="demo-empty">
      <h3>No Workspace Available</h3>
      <p>Create or select a workspace to manage manifest items.</p>
    </div>
  {:else}
    <ManifestContainer
      {workspaceId}
      manifestManager={mockManifestManager}
      {advancedMode}
    />
  {/if}
</div>

<style>
  @import './manifest-demo.css';
  
  .manifest-container-demo {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-surface-primary, #f9fafb);
  }

  .demo-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--spacing-8, 2rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .demo-empty h3 {
    font-size: var(--font-size-lg, 1.125rem);
    font-weight: var(--font-weight-medium, 500);
    margin-bottom: var(--spacing-2, 0.5rem);
    color: var(--color-text-primary, #374151);
  }

  .demo-empty p {
    font-size: var(--font-size-sm, 0.875rem);
    margin-bottom: var(--spacing-6, 1.5rem);
  }
</style>