/**
 * Test Fixtures for Settings Manager
 *
 * Comprehensive test data for validating Settings Manager functionality.
 * Fixtures provide both valid settings objects and validation test cases.
 */

import type { GlobalSettings, WorkspaceSettings, EPUBSettings, TransformOption } from '../index.js';
import type { ExtensionInfo } from '../../extensions/index.js';

// ============================================================================
// Valid Settings Fixtures
// ============================================================================

export const SETTINGS_FIXTURES = {
  global: {
    valid: (): GlobalSettings => ({
      theme: 'dark',
      locale: 'en',
      editor_font_size: 14,
    }),
    minimal: (): GlobalSettings => ({
      theme: 'system',
      locale: 'de',
      editor_font_size: 12,
    }),
    hebrew: (): GlobalSettings => ({
      theme: 'light',
      locale: 'he',
      editor_font_size: 16,
    }),
    large_font: (): GlobalSettings => ({
      theme: 'dark',
      locale: 'ja',
      editor_font_size: 24,
    }),
  },

  workspace: {
    valid: (): WorkspaceSettings => ({
      bust_cache: false,
      draft_id: 0,
      editor: {
        advanced_mode: false,
        preview_delay_ms: 500,
      },
    }),
    advanced: (): WorkspaceSettings => ({
      bust_cache: true,
      draft_id: 7,
      editor: {
        advanced_mode: true,
        preview_delay_ms: 1000,
      },
    }),
    minimal: (): WorkspaceSettings => ({
      bust_cache: false,
      draft_id: 0,
      // No editor object
    }),
    high_draft_id: (): WorkspaceSettings => ({
      bust_cache: true,
      draft_id: 42,
      editor: {
        advanced_mode: true,
        preview_delay_ms: 750,
      },
    }),
  },

  epub: {
    valid: (): EPUBSettings => ({
      text_transform: 'SOURCE/scripts/transform.js',
      dom_transforms: ['SOURCE/extensions/markdown-it/transform.js'],
      spine_basename: 'chapter',
      cover: {
        template: 'minimal',
        background_color: '#ffffff',
        text_color: '#000000',
        font_family: 'serif',
      },
    }),
    minimal: (): EPUBSettings => ({
      text_transform: 'SOURCE/scripts/transform.js',
      dom_transforms: [],
      spine_basename: 'section',
      // No cover config
    }),
    multiple_transforms: (): EPUBSettings => ({
      text_transform: 'SOURCE/scripts/custom.js',
      dom_transforms: [
        'SOURCE/extensions/markdown-it/transform.js',
        'SOURCE/extensions/highlight-js/highlight.min.js',
      ],
      spine_basename: 'part',
      cover: {
        template: 'elegant',
        background_color: '#f8f9fa',
        text_color: '#212529',
        font_family: 'sans-serif',
      },
    }),
  },
};

// ============================================================================
// Validation Test Cases
// ============================================================================

export const VALIDATION_TEST_CASES = {
  globalSettings: [
    {
      name: 'invalid theme',
      input: { theme: 'purple' },
      expectedErrors: ['Theme must be light, dark, or system'],
    },
    {
      name: 'invalid locale',
      input: { locale: 'invalid-locale' },
      expectedErrors: ['Locale invalid-locale is not supported'],
    },
    {
      name: 'font size too small',
      input: { editor_font_size: 5 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
    {
      name: 'font size too large',
      input: { editor_font_size: 50 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
    {
      name: 'negative font size',
      input: { editor_font_size: -10 },
      expectedErrors: ['Font size must be between 8 and 32 pixels'],
    },
    {
      name: 'non-integer font size',
      input: { editor_font_size: 14.5 },
      expectedErrors: ['Font size must be an integer'],
    },
    {
      name: 'multiple validation errors',
      input: { theme: 'purple', locale: 'invalid', editor_font_size: 100 },
      expectedErrors: [
        'Theme must be light, dark, or system',
        'Locale invalid is not supported',
        'Font size must be between 8 and 32 pixels',
      ],
    },
  ],

  workspaceSettings: [
    {
      name: 'negative draft ID',
      input: { draft_id: -1 },
      expectedErrors: ['Draft ID must be non-negative'],
    },
    {
      name: 'non-integer draft ID',
      input: { draft_id: 3.14 },
      expectedErrors: ['Draft ID must be an integer'],
    },
    {
      name: 'preview delay too short',
      input: { editor: { preview_delay_ms: 50 } },
      expectedErrors: ['Preview delay must be between 100-2000ms'],
    },
    {
      name: 'preview delay too long',
      input: { editor: { preview_delay_ms: 3000 } },
      expectedErrors: ['Preview delay must be between 100-2000ms'],
    },
    {
      name: 'invalid bust_cache type',
      input: { bust_cache: 'yes' },
      expectedErrors: ['Bust cache must be a boolean'],
    },
    {
      name: 'invalid advanced_mode type',
      input: { editor: { advanced_mode: 'true' } },
      expectedErrors: ['Advanced mode must be a boolean'],
    },
    {
      name: 'non-integer preview delay',
      input: { editor: { preview_delay_ms: 500.5 } },
      expectedErrors: ['Preview delay must be an integer'],
    },
  ],

  epubSettings: [
    {
      name: 'invalid transform path - outside SOURCE',
      input: { text_transform: '../../../etc/passwd' },
      expectedErrors: ['Transform path must start with SOURCE/'],
    },
    {
      name: 'invalid transform path - no .js extension',
      input: { text_transform: 'SOURCE/scripts/transform.txt' },
      expectedErrors: ['Transform path must end with .js'],
    },
    {
      name: 'empty spine basename',
      input: { spine_basename: '' },
      expectedErrors: ['Spine basename cannot be empty'],
    },
    {
      name: 'spine basename with invalid characters',
      input: { spine_basename: 'chapter/../evil' },
      expectedErrors: ['Spine basename contains invalid characters'],
    },
    {
      name: 'spine basename with spaces',
      input: { spine_basename: 'my chapter' },
      expectedErrors: ['Spine basename contains invalid characters'],
    },
    {
      name: 'invalid background color',
      input: { cover: { background_color: 'red' } },
      expectedErrors: ['Background color must be a valid hex color (#RRGGBB)'],
    },
    {
      name: 'invalid text color',
      input: { cover: { text_color: '#xyz' } },
      expectedErrors: ['Text color must be a valid hex color (#RRGGBB)'],
    },
    {
      name: 'short hex color',
      input: { cover: { background_color: '#fff' } },
      expectedErrors: ['Background color must be a valid hex color (#RRGGBB)'],
    },
    {
      name: 'invalid dom transform path',
      input: { dom_transforms: ['../malicious.js'] },
      expectedErrors: ['DOM transform path must start with SOURCE/'],
    },
    {
      name: 'empty cover template',
      input: { cover: { template: '' } },
      expectedErrors: ['Cover template cannot be empty'],
    },
    {
      name: 'multiple cover validation errors',
      input: {
        cover: {
          template: '',
          background_color: 'blue',
          text_color: '#gg',
          font_family: '',
        },
      },
      expectedErrors: [
        'Cover template cannot be empty',
        'Background color must be a valid hex color (#RRGGBB)',
        'Text color must be a valid hex color (#RRGGBB)',
        'Font family cannot be empty',
      ],
    },
  ],
};

// ============================================================================
// Extension Mock Data
// ============================================================================

export const EXTENSION_FIXTURES = {
  singleExtension: (): ExtensionInfo[] => [
    {
      name: 'markdown-it',
      files: [
        { filename: 'transform.js', size: 15000, type: 'javascript' },
        { filename: 'LICENSE.txt', size: 1200, type: 'license' },
      ],
      totalSize: 16200,
      location: 'workspace',
    },
  ],

  multipleExtensions: (): ExtensionInfo[] => [
    {
      name: 'markdown-it',
      files: [
        { filename: 'transform.js', size: 15000, type: 'javascript' },
        { filename: 'markdown-it.min.js', size: 45000, type: 'javascript' },
      ],
      totalSize: 60000,
      location: 'workspace',
    },
    {
      name: 'highlight-js',
      files: [{ filename: 'highlight.min.js', size: 32000, type: 'javascript' }],
      totalSize: 32000,
      location: 'workspace',
    },
    {
      name: 'math-renderer',
      files: [
        { filename: 'katex.min.js', size: 85000, type: 'javascript' },
        { filename: 'katex.min.css', size: 12000, type: 'javascript' }, // CSS files treated as JS for extension purposes
        { filename: 'transform.js', size: 3000, type: 'javascript' },
      ],
      totalSize: 100000,
      location: 'workspace',
    },
  ],

  expectedTransformOptions: (): TransformOption[] => [
    {
      path: 'SOURCE/scripts/transform.js',
      extensionName: 'built-in',
      fileName: 'transform.js',
    },
    {
      path: 'SOURCE/scripts/custom.js',
      extensionName: 'built-in',
      fileName: 'custom.js',
    },
    {
      path: 'SOURCE/extensions/markdown-it/transform.js',
      extensionName: 'markdown-it',
      fileName: 'transform.js',
    },
    {
      path: 'SOURCE/extensions/markdown-it/markdown-it.min.js',
      extensionName: 'markdown-it',
      fileName: 'markdown-it.min.js',
    },
    {
      path: 'SOURCE/extensions/highlight-js/highlight.min.js',
      extensionName: 'highlight-js',
      fileName: 'highlight.min.js',
    },
    {
      path: 'SOURCE/extensions/math-renderer/katex.min.js',
      extensionName: 'math-renderer',
      fileName: 'katex.min.js',
    },
    {
      path: 'SOURCE/extensions/math-renderer/transform.js',
      extensionName: 'math-renderer',
      fileName: 'transform.js',
    },
  ],
};

// ============================================================================
// Error Scenario Data
// ============================================================================

export const ERROR_SCENARIOS = {
  corrupted_json: '{ "theme": "dark", "locale": incomplete...',
  invalid_json: 'not-json-at-all',
  empty_file: '',
  malformed_settings: {
    global: { theme: null, locale: undefined, editor_font_size: 'large' },
    workspace: { bust_cache: 'maybe', draft_id: 'none', editor: 'advanced' },
    epub: { text_transform: null, dom_transforms: 'none', spine_basename: 123 },
  },
};

// ============================================================================
// localStorage Mock Values
// ============================================================================

export const LOCALSTORAGE_FIXTURES = {
  validGlobalSettings: JSON.stringify(SETTINGS_FIXTURES.global.valid()),
  corruptedData: '{"theme":"dark","locale"', // Incomplete JSON
  emptyData: null,
  invalidData: 'not-json',
};
