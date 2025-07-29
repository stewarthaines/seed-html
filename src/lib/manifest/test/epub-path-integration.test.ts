import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManifestManagerImpl } from '../manifest-manager.js';
import { createMockWorkspaceManagerVi } from '../../test/mocks/workspace-manager-vitest.mock.js';
import type { CreateTextItemData } from '../types.js';

describe('ManifestManager EPUB Path Integration', () => {
  let manifestManager: ManifestManagerImpl;
  let mockWorkspaceManager: ReturnType<typeof createMockWorkspaceManagerVi>;
  const workspaceId = 'test-workspace';

  beforeEach(async () => {
    mockWorkspaceManager = createMockWorkspaceManagerVi();
    
    // Setup basic OPF structure for path resolution
    mockWorkspaceManager.getWorkspaceOPF.mockResolvedValue({
      metadata: { title: 'Test', language: 'en', identifier: 'test' },
      manifest: [],
      spine: []
    });
    
    mockWorkspaceManager.getWorkspacePathInfo.mockResolvedValue({
      rootfilePath: 'OEBPS/content.opf',
      basePath: 'OEBPS',
      opfFileName: 'content.opf'
    });

    manifestManager = new ManifestManagerImpl(mockWorkspaceManager as any);
  });

  describe('createTextItem with proper path routing', () => {
    it('should create JavaScript files in Scripts directory', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'app.js',
        content: 'console.log("Hello");',
        mediaType: 'text/javascript'
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Scripts/app.js');
      expect(result.mediaType).toBe('text/javascript');
      
      // Verify file was written to correct file system path
      expect(mockWorkspaceManager.writeFile).toHaveBeenCalledWith(
        workspaceId, 
        'OEBPS/Scripts/app.js', 
        'console.log("Hello");'
      );
    });

    it('should create CSS files in Styles directory', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'main.css',
        content: 'body { margin: 0; }',
        mediaType: 'text/css'
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Styles/main.css');
      expect(mockWorkspaceManager.writeFile).toHaveBeenCalledWith(
        workspaceId, 
        'OEBPS/Styles/main.css', 
        'body { margin: 0; }'
      );
    });

    it('should auto-detect media type and use appropriate directory', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'script.js',
        content: 'const x = 1;'
        // No mediaType provided - should auto-detect
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Scripts/script.js');
      expect(result.mediaType).toBe('application/javascript');
    });

    it('should allow custom target directory override', async () => {
      const itemData: CreateTextItemData = {
        fileName: 'custom.js',
        content: 'console.log("custom");',
        mediaType: 'text/javascript',
        targetDirectory: 'Custom/' // Override default Scripts/
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      expect(result.href).toBe('Custom/custom.js');
      expect(mockWorkspaceManager.writeFile).toHaveBeenCalledWith(
        workspaceId, 
        'OEBPS/Custom/custom.js', 
        'console.log("custom");'
      );
    });

    it('should demonstrate the original bug fix', async () => {
      // This test shows that JS files now go to Scripts/ instead of OEBPS/
      const itemData: CreateTextItemData = {
        fileName: 'new_file.js',
        content: 'console.log("Fixed bug!");',
        mediaType: 'text/javascript'
      };

      const result = await manifestManager.createTextItem(workspaceId, itemData);

      // Before fix: result.href would have been 'OEBPS/new_file.js'
      // After fix: result.href is now 'Scripts/new_file.js'
      expect(result.href).toBe('Scripts/new_file.js');
      
      // The file system path is still OEBPS/Scripts/new_file.js
      expect(mockWorkspaceManager.writeFile).toHaveBeenCalledWith(
        workspaceId,
        'OEBPS/Scripts/new_file.js',
        'console.log("Fixed bug!");'
      );
    });
  });
});