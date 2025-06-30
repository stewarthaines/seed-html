import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransformManager } from '../transform-manager.js';
import { MockFileStorage } from './mocks/file-storage.mock.js';
import {
  createCompleteTransformWorkspace,
  createMinimalTransformWorkspace,
  createNoSettingsWorkspace,
  createInvalidSettingsWorkspace,
  createMissingScriptsWorkspace,
  SAMPLE_TRANSFORM_SCRIPTS,
  DEFAULT_TRANSFORM_SETTINGS,
  ALTERNATIVE_TRANSFORM_SETTINGS,
  TEST_WORKSPACE_IDS
} from './fixtures/create-test-data.js';

describe('TransformManager', () => {
  let transformManager: TransformManager;
  let mockFileStorage: MockFileStorage;

  beforeEach(() => {
    mockFileStorage = new MockFileStorage();
    transformManager = new TransformManager(mockFileStorage as any);
  });

  afterEach(() => {
    mockFileStorage.reset();
    vi.clearAllMocks();
  });

  describe('loadTransformSettings()', () => {
    it('should load valid transform settings', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());

      const settings = await transformManager.loadTransformSettings(workspaceId);

      expect(settings).toEqual(DEFAULT_TRANSFORM_SETTINGS);
      expect(settings.transform_pipeline?.text_transform).toBe('markdown-transform.js');
      expect(settings.transform_pipeline?.dom_transforms).toEqual(['heading-ids.js', 'custom-styling.js']);
    });

    it('should handle missing settings file', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.NO_SETTINGS;
      await mockFileStorage.addTestFiles(workspaceId, createNoSettingsWorkspace());

      const settings = await transformManager.loadTransformSettings(workspaceId);

      expect(settings).toEqual({});
    });

    it('should throw error for invalid JSON', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.INVALID_SETTINGS;
      await mockFileStorage.addTestFiles(workspaceId, createInvalidSettingsWorkspace());

      await expect(transformManager.loadTransformSettings(workspaceId)).rejects.toThrow('Invalid JSON');
    });

    it('should handle file access errors', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());
      mockFileStorage.setFailureMode('read');

      await expect(transformManager.loadTransformSettings(workspaceId)).rejects.toThrow('Failed to read file');
    });

    it('should load alternative settings configurations', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify(ALTERNATIVE_TRANSFORM_SETTINGS, null, 2)
      });

      const settings = await transformManager.loadTransformSettings(workspaceId);

      expect(settings.transform_pipeline?.text_transform).toBe('asciidoc-transform.js');
      expect(settings.transform_pipeline?.dom_transforms).toEqual([
        'toc-generator.js',
        'footnote-processor.js', 
        'image-optimizer.js'
      ]);
    });

    it('should handle settings with only text transform', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: {
            text_transform: 'markdown-transform.js'
          }
        }, null, 2)
      });

      const settings = await transformManager.loadTransformSettings(workspaceId);

      expect(settings.transform_pipeline?.text_transform).toBe('markdown-transform.js');
      expect(settings.transform_pipeline?.dom_transforms).toBeUndefined();
    });

    it('should handle settings with only DOM transforms', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: {
            dom_transforms: ['heading-ids.js', 'styling.js']
          }
        }, null, 2)
      });

      const settings = await transformManager.loadTransformSettings(workspaceId);

      expect(settings.transform_pipeline?.text_transform).toBeUndefined();
      expect(settings.transform_pipeline?.dom_transforms).toEqual(['heading-ids.js', 'styling.js']);
    });
  });

  describe('loadTransformScripts()', () => {
    it('should load all configured transform scripts', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      expect(scripts.settings).toEqual(DEFAULT_TRANSFORM_SETTINGS);
      
      // Text transform script
      expect(scripts.textTransform).toBeDefined();
      expect(scripts.textTransform!.filename).toBe('markdown-transform.js');
      expect(scripts.textTransform!.content).toContain('function transformText');
      expect(scripts.textTransform!.size).toBeGreaterThan(0);
      
      // DOM transform scripts
      expect(scripts.domTransforms).toHaveLength(2);
      expect(scripts.domTransforms[0].filename).toBe('heading-ids.js');
      expect(scripts.domTransforms[0].content).toContain('function transformDOM');
      expect(scripts.domTransforms[1].filename).toBe('custom-styling.js');
      expect(scripts.domTransforms[1].content).toContain('function transformDOM');
    });

    it('should load only text transform when DOM transforms not configured', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, createMinimalTransformWorkspace());

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      expect(scripts.textTransform).toBeDefined();
      expect(scripts.textTransform!.filename).toBe('markdown-transform.js');
      expect(scripts.domTransforms).toHaveLength(0);
    });

    it('should handle workspace with no transform settings', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.NO_SETTINGS;
      await mockFileStorage.addTestFiles(workspaceId, createNoSettingsWorkspace());

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      expect(scripts.textTransform).toBeUndefined();
      expect(scripts.domTransforms).toHaveLength(0);
      expect(scripts.settings).toEqual({});
    });

    it('should throw error for missing script files', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MISSING_SCRIPTS;
      await mockFileStorage.addTestFiles(workspaceId, createMissingScriptsWorkspace());

      await expect(transformManager.loadTransformScripts(workspaceId)).rejects.toThrow('File not found');
    });

    it('should include file metadata in script objects', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      expect(scripts.textTransform!.filename).toBe('markdown-transform.js');
      expect(scripts.textTransform!.size).toBeGreaterThan(0);
      expect(scripts.textTransform!.lastModified).toBeInstanceOf(Date);
      
      scripts.domTransforms.forEach(script => {
        expect(script.filename).toBeTruthy();
        expect(script.size).toBeGreaterThan(0);
        expect(script.lastModified).toBeInstanceOf(Date);
      });
    });

    it('should preserve DOM transform order from settings', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: {
            dom_transforms: ['custom-styling.js', 'heading-ids.js'] // Reversed order
          }
        }, null, 2),
        'SOURCE/scripts/heading-ids.js': SAMPLE_TRANSFORM_SCRIPTS['heading-ids.js'],
        'SOURCE/scripts/custom-styling.js': SAMPLE_TRANSFORM_SCRIPTS['custom-styling.js']
      });

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      expect(scripts.domTransforms).toHaveLength(2);
      expect(scripts.domTransforms[0].filename).toBe('custom-styling.js');
      expect(scripts.domTransforms[1].filename).toBe('heading-ids.js');
    });

    it('should handle file reading errors gracefully', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());
      
      // Set failure mode after files are created
      mockFileStorage.setFailureMode('read');

      await expect(transformManager.loadTransformScripts(workspaceId)).rejects.toThrow('Failed to read file');
    });
  });

  describe('validateTransformScript()', () => {
    it('should validate script with required transformText function', () => {
      const scriptContent = SAMPLE_TRANSFORM_SCRIPTS['markdown-transform.js'];
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformText']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate script with required transformDOM function', () => {
      const scriptContent = SAMPLE_TRANSFORM_SCRIPTS['heading-ids.js'];
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformDOM']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate script with both functions when both required', () => {
      const scriptContent = SAMPLE_TRANSFORM_SCRIPTS['both-functions.js'];
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformText', 'transformDOM']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required functions', () => {
      const scriptContent = SAMPLE_TRANSFORM_SCRIPTS['heading-ids.js']; // Only has transformDOM
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformText']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required function: transformText');
      expect(result.requiredFunctions).toContain('transformText');
    });

    it('should detect syntax errors', () => {
      const scriptContent = SAMPLE_TRANSFORM_SCRIPTS['broken-syntax.js'];
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformText']);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('syntax'))).toBe(true);
    });

    it('should warn about potential issues', () => {
      const scriptContent = `
function transformText(plainText, context) {
  eval(plainText); // Dangerous function
  return plainText;
}
      `.trim();
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformText']);

      expect(result.isValid).toBe(true); // Valid syntax, but has warnings
      expect(result.warnings.some(w => w.includes('eval'))).toBe(true);
    });

    it('should handle empty script content', () => {
      const result = transformManager.validateTransformScript('', ['transformText']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Empty script content');
    });

    it('should handle script with only comments', () => {
      const scriptContent = `
// This is just a comment
/* 
 * Multi-line comment
 */
      `.trim();
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformText']);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required function: transformText');
    });

    it('should validate multiple required functions', () => {
      const scriptContent = SAMPLE_TRANSFORM_SCRIPTS['both-functions.js'];
      
      const result = transformManager.validateTransformScript(
        scriptContent, 
        ['transformText', 'transformDOM', 'nonExistent']
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required function: nonExistent');
      expect(result.requiredFunctions).toContain('nonExistent');
    });

    it('should handle scripts with extra functions', () => {
      const scriptContent = `
function transformText(plainText, context) {
  return helper(plainText);
}

function helper(text) {
  return text.toUpperCase();
}

function unused() {
  return 'not used';
}
      `.trim();
      
      const result = transformManager.validateTransformScript(scriptContent, ['transformText']);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0); // Extra functions are fine
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete loading workflow', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());

      // Load settings first
      const settings = await transformManager.loadTransformSettings(workspaceId);
      expect(settings.transform_pipeline).toBeDefined();

      // Then load scripts
      const scripts = await transformManager.loadTransformScripts(workspaceId);
      expect(scripts.textTransform).toBeDefined();
      expect(scripts.domTransforms).toHaveLength(2);

      // Validate loaded scripts
      if (scripts.textTransform) {
        const textValidation = transformManager.validateTransformScript(
          scripts.textTransform.content,
          ['transformText']
        );
        expect(textValidation.isValid).toBe(true);
      }

      scripts.domTransforms.forEach(script => {
        const domValidation = transformManager.validateTransformScript(
          script.content,
          ['transformDOM']
        );
        expect(domValidation.isValid).toBe(true);
      });
    });

    it('should handle loading workflow with mixed validity', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: {
            text_transform: 'good-script.js',
            dom_transforms: ['broken-script.js']
          }
        }, null, 2),
        'SOURCE/scripts/good-script.js': SAMPLE_TRANSFORM_SCRIPTS['markdown-transform.js'],
        'SOURCE/scripts/broken-script.js': SAMPLE_TRANSFORM_SCRIPTS['broken-syntax.js']
      });

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      // Should load both scripts
      expect(scripts.textTransform).toBeDefined();
      expect(scripts.domTransforms).toHaveLength(1);

      // But validation should show issues
      const textValidation = transformManager.validateTransformScript(
        scripts.textTransform!.content,
        ['transformText']
      );
      expect(textValidation.isValid).toBe(true);

      const domValidation = transformManager.validateTransformScript(
        scripts.domTransforms[0].content,
        ['transformDOM']
      );
      expect(domValidation.isValid).toBe(false);
    });

    it('should handle workspace with partial configuration', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.MINIMAL;
      await mockFileStorage.addTestFiles(workspaceId, {
        'SOURCE/settings.json': JSON.stringify({
          transform_pipeline: {
            text_transform: 'markdown-transform.js'
            // No dom_transforms
          },
          other_settings: {
            some_value: true
          }
        }, null, 2),
        'SOURCE/scripts/markdown-transform.js': SAMPLE_TRANSFORM_SCRIPTS['markdown-transform.js']
      });

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      expect(scripts.textTransform).toBeDefined();
      expect(scripts.domTransforms).toHaveLength(0);
      expect(scripts.settings.other_settings).toEqual({ some_value: true });
    });

    it('should provide consistent file metadata', async () => {
      const workspaceId = TEST_WORKSPACE_IDS.COMPLETE;
      await mockFileStorage.addTestFiles(workspaceId, createCompleteTransformWorkspace());

      const scripts = await transformManager.loadTransformScripts(workspaceId);

      // All scripts should have consistent metadata structure
      const allScripts = [scripts.textTransform, ...scripts.domTransforms].filter(Boolean);
      
      allScripts.forEach(script => {
        expect(script).toHaveProperty('filename');
        expect(script).toHaveProperty('content');
        expect(script).toHaveProperty('size');
        expect(script).toHaveProperty('lastModified');
        
        expect(typeof script.filename).toBe('string');
        expect(typeof script.content).toBe('string');
        expect(typeof script.size).toBe('number');
        expect(script.lastModified).toBeInstanceOf(Date);
      });
    });
  });
});