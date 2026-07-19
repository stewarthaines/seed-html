import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deriveContentProperties, createSpinePreviewManager } from './spine-preview-manager.js';

/**
 * Unit coverage for the content-derived manifest-property reconciliation
 * (`svg`, `mathml`) extracted from the render pipeline. Parsing uses text/html,
 * which the unit env (happy-dom) handles for <svg>/<math> foreign content.
 */
describe('deriveContentProperties', () => {
  const wrap = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body>${body}</body></html>`;

  it('adds svg when the chapter embeds an <svg>', () => {
    const xhtml = wrap('<div class="fleuron"><svg viewBox="0 0 1 1"><use href="#g"/></svg></div>');
    expect(deriveContentProperties(xhtml, [])).toEqual(['svg']);
  });

  it('adds mathml when the chapter embeds a <math>', () => {
    const xhtml = wrap('<p><math><mi>x</mi></math></p>');
    expect(deriveContentProperties(xhtml, [])).toEqual(['mathml']);
  });

  it('adds both svg and mathml when both are present', () => {
    const xhtml = wrap('<svg><rect/></svg><math><mn>1</mn></math>');
    expect(deriveContentProperties(xhtml, [])).toEqual(['svg', 'mathml']);
  });

  it('returns null (no change) when svg is already flagged and still present', () => {
    const xhtml = wrap('<svg><rect/></svg>');
    expect(deriveContentProperties(xhtml, ['svg'])).toBeNull();
  });

  it('removes svg when the element is gone', () => {
    const xhtml = wrap('<p>no vectors here</p>');
    expect(deriveContentProperties(xhtml, ['svg'])).toEqual([]);
  });

  it('removes mathml but keeps svg when only the math is gone', () => {
    const xhtml = wrap('<svg><rect/></svg>');
    // order preserved: svg stays in place, mathml dropped
    expect(deriveContentProperties(xhtml, ['svg', 'mathml'])).toEqual(['svg']);
  });

  it('preserves non-owned tokens (scripted, cover-image) untouched', () => {
    const xhtml = wrap('<svg><rect/></svg>');
    // scripted (blanket toggle) and cover-image must survive; svg is added.
    expect(deriveContentProperties(xhtml, ['scripted', 'cover-image'])).toEqual([
      'scripted',
      'cover-image',
      'svg',
    ]);
  });

  it('returns null when nothing changes and no owned tokens apply', () => {
    const xhtml = wrap('<p>plain text</p>');
    expect(deriveContentProperties(xhtml, ['scripted'])).toBeNull();
  });

  it('keeps scripted while removing a now-absent svg', () => {
    const xhtml = wrap('<p>plain</p>');
    expect(deriveContentProperties(xhtml, ['scripted', 'svg'])).toEqual(['scripted']);
  });
});

/**
 * Behavioral coverage for the manager's render/persist pipeline. All
 * dependencies are constructor-injected mocks; the debounce runs on fake
 * timers. These pin the fixes from the coverage review: no empty-render
 * overwrite when the source is unreadable, no cross-chapter write race on
 * spine switch, persistence failures surfaced through onError, cleanup
 * invalidating in-flight renders without revoking the shared blob manager.
 */
describe('SpinePreviewManager pipeline', () => {
  const CH1_XHTML_PATH = 'OEBPS/text/ch1.xhtml';
  const CH2_XHTML_PATH = 'OEBPS/text/ch2.xhtml';

  function makeHarness(overrides: {
    fileExists?: (id: string, path: string) => Promise<boolean>;
    readTextFile?: (id: string, path: string) => Promise<string>;
    writeTextFile?: () => Promise<void>;
    writeFile?: () => Promise<void>;
    loadWorkspace?: () => Promise<any>;
    autoSave?: boolean;
  }) {
    const workspace = {
      pathInfo: { basePath: 'OEBPS' },
      opf: {
        manifest: [
          { id: 'ch1', href: 'text/ch1.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'ch2', href: 'text/ch2.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: [],
        metadata: { language: ['ka'] },
      },
    };

    const fileStorage = {
      fileExists: vi.fn(overrides.fileExists ?? (async () => true)),
      readTextFile: vi.fn(
        overrides.readTextFile ??
          (async (_id: string, path: string) => {
            if (path.endsWith('.json')) throw new Error('no sidecar');
            return 'source text';
          })
      ),
      writeTextFile: vi.fn(overrides.writeTextFile ?? (async () => undefined)),
    };

    const blobURLManager = {
      setActiveWorkspace: vi.fn(),
      processXHTMLForPreview: vi.fn(async (x: string) => x),
      cleanup: vi.fn(),
    };

    const workspaceService = {
      loadWorkspace: vi.fn(overrides.loadWorkspace ?? (async () => workspace)),
      writeFile: vi.fn<(...args: any[]) => Promise<void>>(
        overrides.writeFile ?? (async () => undefined)
      ),
      updateManifestItem: vi.fn(async () => workspace),
    };

    // Deferred-resolvable transform engine so tests can park a render mid-flight
    let resolveTransform: ((r: any) => void) | null = null;
    const transformEngine = {
      setTransformScripts: vi.fn(async () => undefined),
      executeTransform: vi.fn(
        () =>
          new Promise(resolve => {
            resolveTransform = resolve;
          })
      ),
      executeGenerator: vi.fn(async () => ({ text: 'generated' })),
    };
    const finishTransform = (html = '<body><p>rendered</p></body>') => {
      resolveTransform?.({ success: true, html });
      resolveTransform = null;
    };

    const settingsService = { loadEPUBSettings: vi.fn(async () => ({})) };
    const onPreviewUpdate = vi.fn();
    const onError = vi.fn();

    const manager = createSpinePreviewManager(
      'ws-1',
      'ch1',
      fileStorage as any,
      {} as any,
      blobURLManager as any,
      workspaceService as any,
      settingsService as any,
      transformEngine as any,
      { debounceMs: 10, autoSave: overrides.autoSave ?? false },
      onPreviewUpdate,
      onError
    );

    return {
      manager,
      fileStorage,
      blobURLManager,
      workspaceService,
      transformEngine,
      finishTransform,
      onPreviewUpdate,
      onError,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders and persists the chapter after a user edit', async () => {
    const h = makeHarness({});

    h.manager.updateContent('text', 'hello world');
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform();
    await vi.advanceTimersByTimeAsync(0);

    expect(h.workspaceService.writeFile).toHaveBeenCalledWith(
      'ws-1',
      CH1_XHTML_PATH,
      expect.stringContaining('<p>rendered</p>')
    );
    expect(h.onPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('does not persist an empty render when the chapter has no text source yet', async () => {
    const h = makeHarness({ fileExists: async () => false });

    await h.manager.loadInitialContent();
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform('<body></body>');
    await vi.advanceTimersByTimeAsync(0);

    expect(h.workspaceService.writeFile).not.toHaveBeenCalled();
    // The preview itself still updates
    expect(h.onPreviewUpdate).toHaveBeenCalledTimes(1);
  });

  it('treats a storage read failure as unreadable — no persist, error surfaced', async () => {
    const h = makeHarness({
      readTextFile: async (_id, path) => {
        if (path.endsWith('.txt')) throw new Error('transient storage failure');
        throw new Error('no sidecar');
      },
    });

    await h.manager.loadInitialContent();
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform('<body></body>');
    await vi.advanceTimersByTimeAsync(0);

    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ stage: 'initialization' }));
    expect(h.workspaceService.writeFile).not.toHaveBeenCalled();
  });

  it('re-allows persistence once the user edits after a failed load', async () => {
    const h = makeHarness({ fileExists: async () => false });
    await h.manager.loadInitialContent();
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform('<body></body>');
    await vi.advanceTimersByTimeAsync(0);
    expect(h.workspaceService.writeFile).not.toHaveBeenCalled();

    h.manager.updateContent('text', 'now real content');
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform();
    await vi.advanceTimersByTimeAsync(0);

    expect(h.workspaceService.writeFile).toHaveBeenCalledWith(
      'ws-1',
      CH1_XHTML_PATH,
      expect.any(String)
    );
  });

  it('switchToSpineItem waits out an in-flight render so it persists to the OLD chapter', async () => {
    const h = makeHarness({});

    h.manager.updateContent('text', 'chapter one text');
    await vi.advanceTimersByTimeAsync(20); // render starts, parked in transform

    const switchDone = h.manager.switchToSpineItem('ch2');
    // Old render completes while the switch is waiting
    h.finishTransform('<body><p>ch1 output</p></body>');
    await vi.advanceTimersByTimeAsync(0);
    await switchDone;
    // The queued post-switch debounce render (from loadInitialContent) fires
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform('<body><p>ch2 output</p></body>');
    await vi.advanceTimersByTimeAsync(0);

    const writes = h.workspaceService.writeFile.mock.calls;
    const ch1Writes = writes.filter(c => c[1] === CH1_XHTML_PATH);
    const ch2Writes = writes.filter(c => c[1] === CH2_XHTML_PATH);
    expect(ch1Writes).toHaveLength(1);
    expect(ch1Writes[0][2]).toContain('ch1 output');
    expect(ch2Writes).toHaveLength(1);
    expect(ch2Writes[0][2]).toContain('ch2 output');
  });

  it('surfaces manifest persistence failures via onError while the preview still updates', async () => {
    const h = makeHarness({
      writeFile: async () => {
        throw new Error('quota exceeded');
      },
    });

    h.manager.updateContent('text', 'content');
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform();
    await vi.advanceTimersByTimeAsync(0);

    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ stage: 'persistence' }));
    expect(h.onPreviewUpdate).toHaveBeenCalledTimes(1);
  });

  it('loads the workspace exactly once per render and threads it through', async () => {
    const h = makeHarness({});

    h.manager.updateContent('text', 'content');
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform();
    await vi.advanceTimersByTimeAsync(0);

    // One load feeds the broker context, chapter metadata, and manifest persistence.
    expect(h.workspaceService.loadWorkspace).toHaveBeenCalledTimes(1);
    expect(h.transformEngine.executeTransform).toHaveBeenCalledWith(
      'content',
      expect.anything(),
      'ch1',
      expect.objectContaining({ basePath: 'OEBPS', language: 'ka' })
    );
    expect(h.workspaceService.writeFile).toHaveBeenCalledWith(
      'ws-1',
      CH1_XHTML_PATH,
      expect.anything()
    );
  });

  it('a workspace load failure still previews (default metadata, no ctx) but surfaces a persistence error', async () => {
    const h = makeHarness({
      loadWorkspace: async () => {
        throw new Error('opf unreadable');
      },
    });

    h.manager.updateContent('text', 'content');
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform();
    await vi.advanceTimersByTimeAsync(0);

    // Transform ran without a brokered file-access context...
    expect(h.transformEngine.executeTransform).toHaveBeenCalledWith(
      'content',
      expect.anything(),
      'ch1',
      undefined
    );
    // ...the preview still updated, but nothing was written and the
    // preview/EPUB divergence was reported.
    expect(h.onPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(h.workspaceService.writeFile).not.toHaveBeenCalled();
    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ stage: 'persistence' }));
  });

  it('surfaces auto-save failures via onError', async () => {
    const h = makeHarness({
      autoSave: true,
      writeTextFile: async () => {
        throw new Error('disk full');
      },
    });

    h.manager.updateContent('text', 'content');
    await vi.advanceTimersByTimeAsync(20);
    h.finishTransform();
    await vi.advanceTimersByTimeAsync(0);

    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ stage: 'auto-save' }));
  });

  it('cleanup invalidates an in-flight render and never revokes the injected blob manager', async () => {
    const h = makeHarness({});

    h.manager.updateContent('text', 'content');
    await vi.advanceTimersByTimeAsync(20); // render parked in transform

    h.manager.cleanup();
    h.finishTransform();
    await vi.advanceTimersByTimeAsync(0);

    expect(h.workspaceService.writeFile).not.toHaveBeenCalled();
    expect(h.onPreviewUpdate).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.blobURLManager.cleanup).not.toHaveBeenCalled();
  });

  it('forcePreviewUpdate waits out an in-flight render, then renders the current content', async () => {
    const h = makeHarness({});

    h.manager.updateContent('text', 'content');
    await vi.advanceTimersByTimeAsync(20); // first render parked

    const forced = h.manager.forcePreviewUpdate();
    h.finishTransform('<body><p>first</p></body>');
    await vi.advanceTimersByTimeAsync(0);
    h.finishTransform('<body><p>second</p></body>');
    await vi.advanceTimersByTimeAsync(0);
    await forced;

    expect(h.onPreviewUpdate).toHaveBeenCalledTimes(2);
    expect(h.workspaceService.writeFile).toHaveBeenCalledTimes(2);
  });

  it('runGenerator propagates a workspace load failure instead of fabricating an empty context', async () => {
    const h = makeHarness({
      loadWorkspace: async () => {
        throw new Error('workspace unavailable');
      },
    });

    await expect(h.manager.runGenerator('function g(){}', {})).rejects.toThrow(
      'workspace unavailable'
    );
    expect(h.transformEngine.executeGenerator).not.toHaveBeenCalled();
  });
});
