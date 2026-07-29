import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { MockFileStorage } from '../../test/mocks/file-storage.mock.js';
import type { FileStorageAPI } from '../../storage/index.js';
import type { SettingsService, EPUBSettings } from '../../services/settings/settings.service.js';
import type { ExtensionManager } from '../../extensions/extension-manager.js';
import { buildSwitchContext } from '../chapter-switch.service.js';

// The counts in these tests are the acceptance criteria of
// process/CHAPTER_SWITCH_SERVICE.md: a switch performs ONE workspace
// enumeration, shared by every consumer. Raising a count here needs a
// justification in review.

const SETTINGS: EPUBSettings = {
  text_transform: 'SOURCE/transforms/transformText.js',
  dom_transforms: ['SOURCE/transforms/transformDom.js'],
  preview: { head: 'preview/head.xml' },
} as unknown as EPUBSettings;

describe('buildSwitchContext', () => {
  const ws = 'ws1';
  let storage: FileStorageAPI;
  let listFilesSpy: MockInstance<MockFileStorage['listFiles']>;
  let settingsService: SettingsService;
  let extensionManager: ExtensionManager;
  let extensionKnownFiles: string[] | undefined;

  beforeEach(async () => {
    const mock = new MockFileStorage();
    storage = mock as unknown as FileStorageAPI;
    await storage.writeTextFile(ws, 'SOURCE/preview/head.xml', '<style>p{}</style>');
    await storage.writeTextFile(
      ws,
      'SOURCE/generators/lorem/generator.json',
      JSON.stringify({ id: 'lorem', name: 'Lorem', script: 'lorem.js' })
    );
    await storage.writeTextFile(ws, 'SOURCE/generators/lorem/lorem.js', '//');
    listFilesSpy = vi.spyOn(mock, 'listFiles');

    settingsService = {
      loadEPUBSettings: vi.fn().mockResolvedValue(SETTINGS),
    } as unknown as SettingsService;

    extensionKnownFiles = undefined;
    extensionManager = {
      listWorkspaceExtensions: vi.fn(async (_id: string, knownFiles?: string[]) => {
        extensionKnownFiles = knownFiles;
        return [];
      }),
    } as unknown as ExtensionManager;
  });

  function deps() {
    return { fileStorage: storage, settingsService, extensionManager, workspaceId: ws };
  }

  it('enumerates the workspace exactly once and shares the list', async () => {
    const context = await buildSwitchContext(deps());

    expect(listFilesSpy).toHaveBeenCalledTimes(1);
    // Extensions received the shared enumeration instead of walking again.
    expect(extensionKnownFiles).toBe(context.files);
    // Generators were discovered from the same list.
    expect(context.generators.map(g => g.manifest.id)).toEqual(['lorem']);
  });

  it('loads settings and the preview head fragment', async () => {
    const context = await buildSwitchContext(deps());

    expect(settingsService.loadEPUBSettings).toHaveBeenCalledTimes(1);
    expect(context.settings).toBe(SETTINGS);
    expect(context.previewHeadPath).toBe('SOURCE/preview/head.xml');
    expect(context.previewHeadContent).toBe('<style>p{}</style>');
  });

  it('degrades each field independently on failure', async () => {
    settingsService = {
      loadEPUBSettings: vi.fn().mockRejectedValue(new Error('no settings')),
    } as unknown as SettingsService;
    extensionManager = {
      listWorkspaceExtensions: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as ExtensionManager;

    const context = await buildSwitchContext(deps());

    expect(context.settings).toBeNull();
    expect(context.extensionPreviewHead).toBe('');
    // The default head path still applies without settings.
    expect(context.previewHeadPath).toBe('SOURCE/preview/head.xml');
    // Generators still resolved from the enumeration.
    expect(context.generators).toHaveLength(1);
  });

  it('yields empty fields when the workspace cannot be enumerated', async () => {
    const failing = {
      listFiles: vi.fn().mockRejectedValue(new Error('gone')),
      readTextFile: vi.fn().mockRejectedValue(new Error('gone')),
    } as unknown as FileStorageAPI;

    const context = await buildSwitchContext({ ...deps(), fileStorage: failing });

    expect(context.files).toEqual([]);
    expect(context.generators).toEqual([]);
    expect(context.previewHeadContent).toBe('');
  });
});
