/**
 * TransformEngine contract tests. The engine's iframe is a seam that cannot
 * exist in the unit env (happy-dom loads no blob: documents and runs no iframe
 * scripts), so the tests drive the engine's public API and simulate the iframe
 * side of the postMessage protocol: `document.body.appendChild` is stubbed so
 * the real iframe never connects, and after initialize() the engine's iframe is
 * swapped for a recording channel whose replies are dispatched as window
 * `message` events with a matching `source`.
 *
 * First block — setTransformScripts send-dedup: the pipeline calls it on every
 * render, so a content-identical bundle must not cost an iframe message
 * round-trip — but changed scripts, failed sends, and cleanup must all
 * re-send. The engine is not initialized there; the iframe is faked and
 * sendMessage stubbed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransformEngine, type TransformBrokerContext } from './transform-engine.js';
import type { BlobURLManager } from '../blob-url/blob-url-manager.js';
import type { ExtensionManager } from '../extensions/extension-manager.js';
import type { ExtensionInfo } from '../extensions/types.js';
import type { ManifestItem } from '../epub/opf-utils.js';
import { FileStorageAPI } from '../storage/index.js';
import { createVitestMockFileStorage } from '../test/mocks/file-storage-vitest.mock.js';

function makeEngine() {
  const engine = new TransformEngine({} as any);
  (engine as any).iframe = { remove: () => {} };
  const sendMessage = vi.fn(async () => undefined);
  (engine as any).sendMessage = sendMessage;
  return { engine, sendMessage };
}

const SCRIPTS = {
  textTransform: 'function transformText(t){return t;}',
  domTransforms: ['function transformDOM(d){return d;}'],
};

describe('TransformEngine.setTransformScripts dedup', () => {
  let engine: TransformEngine;
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ engine, sendMessage } = makeEngine());
  });

  it('skips the round-trip when the scripts are content-identical', async () => {
    await engine.setTransformScripts(SCRIPTS);
    // Same content, fresh objects — the render path rebuilds the bundle.
    await engine.setTransformScripts({
      textTransform: SCRIPTS.textTransform,
      domTransforms: [...SCRIPTS.domTransforms],
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('re-sends when any script content changes', async () => {
    await engine.setTransformScripts(SCRIPTS);
    await engine.setTransformScripts({
      ...SCRIPTS,
      domTransforms: ['function transformDOM(d){/*v2*/return d;}'],
    });
    await engine.setTransformScripts({ ...SCRIPTS, domTransforms: [] });

    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it('is immune to caller mutation of the sent bundle', async () => {
    const bundle = { textTransform: 'a', domTransforms: ['b'] };
    await engine.setTransformScripts(bundle);
    bundle.domTransforms.push('c');

    await engine.setTransformScripts({ textTransform: 'a', domTransforms: ['b', 'c'] });

    // The mutated array must not be mistaken for what the iframe holds.
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('a failed send is not recorded — the retry goes through', async () => {
    sendMessage.mockRejectedValueOnce(new Error('iframe gone'));

    await expect(engine.setTransformScripts(SCRIPTS)).rejects.toThrow('iframe gone');
    await engine.setTransformScripts(SCRIPTS);

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('cleanup drops the record, so a re-initialized engine re-sends', async () => {
    await engine.setTransformScripts(SCRIPTS);
    engine.cleanup();

    (engine as any).iframe = { remove: () => {} };
    await engine.setTransformScripts(SCRIPTS);

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------------------- */
/* Full-protocol harness                                                     */
/* ------------------------------------------------------------------------- */

/** A message the engine posted toward the (simulated) iframe. */
interface PostedMessage {
  type: string;
  messageId?: number;
  payload?: unknown;
  [key: string]: unknown;
}

interface EngineHarness {
  engine: TransformEngine;
  /** Everything the engine posted to the iframe, in order. */
  posted: PostedMessage[];
  /** Dispatch `data` to the engine as if the iframe sent it. */
  replyFromIframe: (data: unknown) => void;
  removeIframe: ReturnType<typeof vi.fn>;
}

const blobURLManager = {} as unknown as BlobURLManager;

/**
 * Initialize an engine for real (covering iframe creation and the ready
 * handshake), then swap the engine's iframe for a recording channel the test
 * controls. appendChild is stubbed so happy-dom never tries to load the blob:
 * document.
 */
async function makeInitializedEngine(extensionManager?: ExtensionManager): Promise<EngineHarness> {
  const appendSpy = vi
    .spyOn(document.body, 'appendChild')
    .mockImplementation(<T extends Node>(node: T): T => node);
  try {
    const engine = new TransformEngine(blobURLManager, extensionManager);
    const initPromise = engine.initialize();

    const iframe = appendSpy.mock.calls[0]?.[0] as HTMLIFrameElement;
    expect(iframe?.tagName).toBe('IFRAME');
    // Simulate the iframe's ready signal (source must match the engine's iframe).
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'IFRAME_READY' },
        source: iframe.contentWindow as unknown as MessageEventSource,
      })
    );
    await initPromise;
    // Cover the load-time blob URL cleanup hook.
    iframe.dispatchEvent(new Event('load'));

    const posted: PostedMessage[] = [];
    const contentWindow = {
      postMessage: vi.fn((message: PostedMessage) => {
        posted.push(message);
      }),
    };
    const removeIframe = vi.fn();
    (engine as unknown as { iframe: unknown }).iframe = {
      contentWindow,
      remove: removeIframe,
    };
    const replyFromIframe = (data: unknown) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data,
          source: contentWindow as unknown as MessageEventSource,
        })
      );
    };
    return { engine, posted, replyFromIframe, removeIframe };
  } finally {
    appendSpy.mockRestore();
  }
}

/** Reply success for the engine's most recent request message. */
function resolveLastRequest(harness: EngineHarness, result: Record<string, unknown>): void {
  const last = harness.posted[harness.posted.length - 1];
  harness.replyFromIframe({
    type: 'TRANSFORM_RESULT',
    messageId: last.messageId,
    payload: { result },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------------- */
/* Initialization                                                            */
/* ------------------------------------------------------------------------- */

describe('TransformEngine initialization', () => {
  it('appends a hidden blob-backed iframe and resolves on IFRAME_READY', async () => {
    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(<T extends Node>(node: T): T => node);
    const engine = new TransformEngine(blobURLManager);
    const initPromise = engine.initialize();

    const iframe = appendSpy.mock.calls[0]?.[0] as HTMLIFrameElement;
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.src.startsWith('blob:')).toBe(true);
    expect(iframe.style.visibility).toBe('hidden');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'IFRAME_READY' },
        source: iframe.contentWindow as unknown as MessageEventSource,
      })
    );
    await expect(initPromise).resolves.toBeUndefined();
  });

  it('rejects when the iframe never signals ready', async () => {
    vi.useFakeTimers();
    vi.spyOn(document.body, 'appendChild').mockImplementation(<T extends Node>(node: T): T => node);
    const engine = new TransformEngine(blobURLManager);

    const promise = engine.initialize();
    const assertion = expect(promise).rejects.toThrow('Transform engine initialization timeout');
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});

/* ------------------------------------------------------------------------- */
/* Uninitialized guards                                                      */
/* ------------------------------------------------------------------------- */

describe('uninitialized engine guards', () => {
  const ctx: TransformBrokerContext = { workspaceId: 'ws', basePath: '', manifest: [] };

  it('every iframe-backed method throws before initialize()', async () => {
    const engine = new TransformEngine(blobURLManager);
    const notInitialized = 'Transform engine not initialized';

    await expect(engine.setTransformScripts(SCRIPTS)).rejects.toThrow(notInitialized);
    await expect(engine.executeTransform('text')).rejects.toThrow(notInitialized);
    await expect(engine.executeGenerator('script', {}, ctx)).rejects.toThrow(notInitialized);
    await expect(engine.setDebugMode(true)).rejects.toThrow(notInitialized);
    await expect(engine.ping('hello')).rejects.toThrow(notInitialized);
  });
});

/* ------------------------------------------------------------------------- */
/* executeTransform                                                          */
/* ------------------------------------------------------------------------- */

const MANIFEST: ManifestItem[] = [
  { id: 'img', href: 'Images/pic.png', mediaType: 'image/png' },
  { id: 'ch1', href: 'Text/ch1.xhtml', mediaType: 'application/xhtml+xml' },
];

const BROKER_CONTEXT: TransformBrokerContext = {
  workspaceId: 'ws1',
  basePath: 'OEBPS',
  manifest: MANIFEST,
  language: 'de',
  spine: [{ idref: 'ch1', linear: true }],
};

describe('executeTransform', () => {
  it('posts EXECUTE_TRANSFORM with an empty ctx and resolves with the iframe result', async () => {
    const harness = await makeInitializedEngine();
    const promise = harness.engine.executeTransform('hello world');

    expect(harness.posted).toHaveLength(1);
    expect(harness.posted[0].type).toBe('EXECUTE_TRANSFORM');
    expect(harness.posted[0].payload).toEqual({
      plainText: 'hello world',
      timeout: 3000,
      idref: undefined,
      transformCtx: { idref: undefined, basePath: '', manifest: [], language: '', spine: [] },
    });

    resolveLastRequest(harness, { success: true, html: '<p>hi</p>' });
    await expect(promise).resolves.toEqual({ success: true, html: '<p>hi</p>' });
  });

  it('forwards the broker context as the script-facing ctx', async () => {
    const harness = await makeInitializedEngine();
    const promise = harness.engine.executeTransform('text', 2000, 'ch1', BROKER_CONTEXT);

    expect(harness.posted[0].payload).toEqual({
      plainText: 'text',
      timeout: 2000,
      idref: 'ch1',
      transformCtx: {
        idref: 'ch1',
        basePath: 'OEBPS',
        manifest: MANIFEST,
        language: 'de',
        spine: [{ idref: 'ch1', linear: true }],
      },
    });

    resolveLastRequest(harness, { success: true });
    await promise;
  });

  it('rejects with the normalized TransformError from the iframe', async () => {
    const harness = await makeInitializedEngine();
    const promise = harness.engine.executeTransform('text');

    resolveLastRequest(harness, {
      success: false,
      error: { stage: 'dom', message: 'boom', line: 3, column: 7, stack: 'trace' },
    });

    await expect(promise).rejects.toMatchObject({
      stage: 'dom',
      message: 'boom',
      line: 3,
      column: 7,
      stack: 'trace',
    });
  });

  it('normalizes a failure without error details to an unknown-stage error', async () => {
    const harness = await makeInitializedEngine();
    const promise = harness.engine.executeTransform('text');

    resolveLastRequest(harness, { success: false });

    await expect(promise).rejects.toMatchObject({
      stage: 'unknown',
      message: 'Unknown transform error',
    });
  });

  it('times out when the iframe never responds', async () => {
    vi.useFakeTimers();
    const harness = await makeInitializedEngine();

    const promise = harness.engine.executeTransform('text', 1000);
    const assertion = expect(promise).rejects.toThrow('Message timeout: EXECUTE_TRANSFORM');
    // messageTimeout = max(5000, timeout + 5000) = 6000
    await vi.advanceTimersByTimeAsync(6000);
    await assertion;
  });

  it('rejects immediately when the iframe window is gone', async () => {
    const harness = await makeInitializedEngine();
    (harness.engine as unknown as { iframe: unknown }).iframe = {
      contentWindow: null,
      remove: () => undefined,
    };

    await expect(harness.engine.executeTransform('text')).rejects.toThrow('Iframe not available');
  });
});

/* ------------------------------------------------------------------------- */
/* executeGenerator                                                          */
/* ------------------------------------------------------------------------- */

describe('executeGenerator', () => {
  it('posts EXECUTE_GENERATOR with structured-clone-safe options and resolves', async () => {
    const harness = await makeInitializedEngine();
    const options = { depth: 2, title: 'Index' };
    const promise = harness.engine.executeGenerator(
      'export function generateText() {}',
      options,
      BROKER_CONTEXT,
      'ch1'
    );

    expect(harness.posted[0].type).toBe('EXECUTE_GENERATOR');
    const payload = harness.posted[0].payload as {
      script: string;
      options: Record<string, unknown>;
      timeout: number;
      idref?: string;
      transformCtx: { basePath: string };
    };
    expect(payload.script).toBe('export function generateText() {}');
    expect(payload.timeout).toBe(5000);
    expect(payload.idref).toBe('ch1');
    expect(payload.transformCtx.basePath).toBe('OEBPS');
    // Options are JSON round-tripped so $state proxies survive postMessage.
    expect(payload.options).toEqual(options);
    expect(payload.options).not.toBe(options);

    resolveLastRequest(harness, { success: true, text: '- generated -' });
    await expect(promise).resolves.toEqual({ success: true, text: '- generated -' });
  });
});

/* ------------------------------------------------------------------------- */
/* setDebugMode / ping                                                       */
/* ------------------------------------------------------------------------- */

describe('setDebugMode and ping', () => {
  it('setDebugMode posts SET_DEBUG_MODE with the flag', async () => {
    const harness = await makeInitializedEngine();
    const promise = harness.engine.setDebugMode(true);

    expect(harness.posted[0]).toMatchObject({ type: 'SET_DEBUG_MODE', payload: true });
    resolveLastRequest(harness, { success: true });
    await promise;
  });

  it('ping posts PING and resolves with the iframe result', async () => {
    const harness = await makeInitializedEngine();
    const promise = harness.engine.ping({ probe: 1 });

    expect(harness.posted[0]).toMatchObject({ type: 'PING', payload: { probe: 1 } });
    resolveLastRequest(harness, { success: true, echoed: { probe: 1 } });
    await expect(promise).resolves.toEqual({ success: true, echoed: { probe: 1 } });
  });
});

/* ------------------------------------------------------------------------- */
/* Message filtering and global errors                                       */
/* ------------------------------------------------------------------------- */

describe('iframe message handling', () => {
  it('ignores replies that do not come from the engine iframe', async () => {
    const harness = await makeInitializedEngine();
    const promise = harness.engine.executeTransform('text');
    const messageId = harness.posted[0].messageId;

    // A matching messageId from a foreign source must not resolve the call.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'TRANSFORM_RESULT',
          messageId,
          payload: { result: { success: true, html: 'forged' } },
        },
        source: { postMessage: () => undefined } as unknown as MessageEventSource,
      })
    );
    resolveLastRequest(harness, { success: true, html: 'genuine' });

    await expect(promise).resolves.toEqual({ success: true, html: 'genuine' });
  });

  it('logs iframe global errors without rejecting in-flight work', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const harness = await makeInitializedEngine();
    const promise = harness.engine.executeTransform('text');

    harness.replyFromIframe({ type: 'GLOBAL_ERROR', payload: { message: 'script blew up' } });
    harness.replyFromIframe({ type: 'UNHANDLED_REJECTION', payload: { message: 'late failure' } });
    expect(errorSpy).toHaveBeenCalledTimes(2);

    resolveLastRequest(harness, { success: true, html: 'still fine' });
    await expect(promise).resolves.toEqual({ success: true, html: 'still fine' });
  });
});

/* ------------------------------------------------------------------------- */
/* Broker requests                                                           */
/* ------------------------------------------------------------------------- */

describe('broker requests', () => {
  let mockStorage: ReturnType<typeof createVitestMockFileStorage>;

  beforeEach(async () => {
    mockStorage = createVitestMockFileStorage();
    vi.spyOn(FileStorageAPI, 'getInstance').mockReturnValue(
      mockStorage as unknown as FileStorageAPI
    );
    await mockStorage.addTestFiles('ws1', {
      'OEBPS/Text/ch1.xhtml': '<p>chapter one</p>',
      'OEBPS/Images/pic.png': new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
      'SOURCE/notes.txt': 'source notes',
    });
  });

  /** Run a broker op inside an in-flight transform; returns the BROKER_RESPONSE. */
  async function brokerRoundTrip(
    op: string,
    args: Record<string, unknown>
  ): Promise<PostedMessage> {
    const harness = await makeInitializedEngine();
    const transform = harness.engine.executeTransform('text', 3000, 'ch1', BROKER_CONTEXT);

    harness.replyFromIframe({ type: 'BROKER_REQUEST', requestId: 42, op, args });
    await vi.waitFor(() => {
      expect(harness.posted.some(m => m.type === 'BROKER_RESPONSE')).toBe(true);
    });

    harness.replyFromIframe({
      type: 'TRANSFORM_RESULT',
      messageId: harness.posted[0].messageId,
      payload: { result: { success: true } },
    });
    await transform;

    const response = harness.posted.find(m => m.type === 'BROKER_RESPONSE');
    expect(response).toBeDefined();
    expect(response?.requestId).toBe(42);
    return response as PostedMessage;
  }

  it('readManifestText serves a declared manifest item', async () => {
    const response = await brokerRoundTrip('readManifestText', { href: 'Text/ch1.xhtml' });
    expect(response.ok).toBe(true);
    expect(response.result).toBe('<p>chapter one</p>');
  });

  it('readManifestText refuses an undeclared href', async () => {
    const response = await brokerRoundTrip('readManifestText', { href: '../settings.json' });
    expect(response.ok).toBe(false);
    expect(response.error).toContain('Not a manifest item');
  });

  it('readManifestDataURL encodes bytes with the declared media type', async () => {
    const response = await brokerRoundTrip('readManifestDataURL', { href: 'Images/pic.png' });
    expect(response.ok).toBe(true);
    expect(response.result).toBe('data:image/png;base64,AQID');
  });

  it('readSourceText reads under SOURCE/', async () => {
    const response = await brokerRoundTrip('readSourceText', { path: 'notes.txt' });
    expect(response.ok).toBe(true);
    expect(response.result).toBe('source notes');
  });

  it('readSourceText rejects path traversal', async () => {
    const response = await brokerRoundTrip('readSourceText', { path: '../OEBPS/content.opf' });
    expect(response.ok).toBe(false);
    expect(response.error).toContain('Invalid SOURCE path');
  });

  it('writeSourceText lands writes under SOURCE/data/', async () => {
    const response = await brokerRoundTrip('writeSourceText', {
      path: 'cache.json',
      text: '{"a":1}',
    });
    expect(response.ok).toBe(true);
    expect(response.result).toBe('SOURCE/data/cache.json');
    expect(mockStorage.writeTextFile).toHaveBeenCalledWith(
      'ws1',
      'SOURCE/data/cache.json',
      '{"a":1}'
    );
  });

  it('writeSourceText refuses writes outside SOURCE/data/', async () => {
    const response = await brokerRoundTrip('writeSourceText', {
      path: 'SOURCE/settings.json',
      text: 'x',
    });
    expect(response.ok).toBe(false);
    expect(response.error).toContain('Writes are limited to SOURCE/data/');
    expect(mockStorage.writeTextFile).not.toHaveBeenCalled();
  });

  it('rejects an unknown op', async () => {
    const response = await brokerRoundTrip('formatDisk', {});
    expect(response.ok).toBe(false);
    expect(response.error).toContain('Unknown broker op: formatDisk');
  });

  it('refuses file access outside a transform run (context cleared after completion)', async () => {
    const harness = await makeInitializedEngine();
    // Run one transform WITH a context to completion…
    const transform = harness.engine.executeTransform('text', 3000, 'ch1', BROKER_CONTEXT);
    resolveLastRequest(harness, { success: true });
    await transform;

    // …then a late broker request must find no context.
    harness.replyFromIframe({
      type: 'BROKER_REQUEST',
      requestId: 7,
      op: 'readSourceText',
      args: {},
    });
    await vi.waitFor(() => {
      expect(harness.posted.some(m => m.type === 'BROKER_RESPONSE')).toBe(true);
    });

    const response = harness.posted.find(m => m.type === 'BROKER_RESPONSE');
    expect(response).toMatchObject({
      requestId: 7,
      ok: false,
      error: 'File access is unavailable for this transform',
    });
  });
});

/* ------------------------------------------------------------------------- */
/* Workspace extensions                                                      */
/* ------------------------------------------------------------------------- */

describe('setWorkspaceExtensions', () => {
  let mockStorage: ReturnType<typeof createVitestMockFileStorage>;

  const extensionInfo = (name: string, filenames: string[]): ExtensionInfo => ({
    name,
    files: filenames.map(filename => ({
      filename,
      size: 1,
      type: filename.endsWith('.js') ? ('javascript' as const) : ('license' as const),
    })),
    totalSize: filenames.length,
    location: 'workspace',
  });

  function makeExtensionManager(extensions: ExtensionInfo[] | Error): ExtensionManager {
    const listWorkspaceExtensions =
      extensions instanceof Error
        ? vi.fn().mockRejectedValue(extensions)
        : vi.fn().mockResolvedValue(extensions);
    return { listWorkspaceExtensions } as unknown as ExtensionManager;
  }

  beforeEach(() => {
    mockStorage = createVitestMockFileStorage();
    vi.spyOn(FileStorageAPI, 'getInstance').mockReturnValue(
      mockStorage as unknown as FileStorageAPI
    );
  });

  it('is a no-op without an extension manager', async () => {
    const harness = await makeInitializedEngine();
    await harness.engine.setWorkspaceExtensions('ws1');
    expect(harness.posted).toHaveLength(0);
  });

  it('loads only the manifest-declared lib scripts as blob URLs', async () => {
    await mockStorage.addTestFiles('ws1', {
      'SOURCE/extensions/yaml/extension.json': JSON.stringify({
        scripts: [{ file: 'js-yaml.min.js' }, 'helper.js'],
      }),
      'SOURCE/extensions/yaml/js-yaml.min.js': 'lib code',
      'SOURCE/extensions/yaml/helper.js': 'helper code',
      'SOURCE/extensions/yaml/undeclared.js': 'should not load',
    });
    const manager = makeExtensionManager([
      extensionInfo('yaml', ['js-yaml.min.js', 'helper.js', 'undeclared.js', 'LICENSE.txt']),
    ]);
    const harness = await makeInitializedEngine(manager);

    const promise = harness.engine.setWorkspaceExtensions('ws1');
    await vi.waitFor(() => {
      expect(harness.posted).toHaveLength(1);
    });
    expect(harness.posted[0].type).toBe('SET_EXTENSION_SCRIPTS');
    expect(harness.posted[0].payload).toEqual([
      { name: 'yaml/js-yaml.min.js', blobUrl: expect.stringMatching(/^blob:/) },
      { name: 'yaml/helper.js', blobUrl: expect.stringMatching(/^blob:/) },
    ]);

    resolveLastRequest(harness, { success: true });
    await promise;
  });

  it('falls back to excluding transform-named scripts when there is no manifest', async () => {
    await mockStorage.addTestFiles('ws1', {
      'SOURCE/extensions/md/markdown-it.min.js': 'lib code',
      'SOURCE/extensions/md/transformText.js': 'pipeline script',
    });
    const manager = makeExtensionManager([
      extensionInfo('md', ['markdown-it.min.js', 'transformText.js']),
    ]);
    const harness = await makeInitializedEngine(manager);

    const promise = harness.engine.setWorkspaceExtensions('ws1');
    await vi.waitFor(() => {
      expect(harness.posted).toHaveLength(1);
    });
    expect(harness.posted[0].payload).toEqual([
      { name: 'md/markdown-it.min.js', blobUrl: expect.stringMatching(/^blob:/) },
    ]);

    resolveLastRequest(harness, { success: true });
    await promise;
  });

  it('a broken extension is skipped; the others still load', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mockStorage.addTestFiles('ws1', {
      // 'broken' declares lib.js but the file is missing from storage.
      'SOURCE/extensions/good/lib.js': 'good lib',
    });
    const manager = makeExtensionManager([
      extensionInfo('broken', ['lib.js']),
      extensionInfo('good', ['lib.js']),
    ]);
    const harness = await makeInitializedEngine(manager);

    const promise = harness.engine.setWorkspaceExtensions('ws1');
    await vi.waitFor(() => {
      expect(harness.posted).toHaveLength(1);
    });
    expect(harness.posted[0].payload).toEqual([
      { name: 'good/lib.js', blobUrl: expect.stringMatching(/^blob:/) },
    ]);
    expect(warnSpy).toHaveBeenCalled();

    resolveLastRequest(harness, { success: true });
    await promise;
  });

  it('swallows a listing failure instead of breaking transforms', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const manager = makeExtensionManager(new Error('storage offline'));
    const harness = await makeInitializedEngine(manager);

    await expect(harness.engine.setWorkspaceExtensions('ws1')).resolves.toBeUndefined();
    expect(harness.posted).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to load workspace extensions:',
      expect.any(Error)
    );
  });
});

/* ------------------------------------------------------------------------- */
/* Cleanup                                                                   */
/* ------------------------------------------------------------------------- */

describe('cleanup', () => {
  it('rejects in-flight messages, removes the iframe, and de-initializes', async () => {
    const harness = await makeInitializedEngine();
    const inFlight = harness.engine.executeTransform('text');
    const assertion = expect(inFlight).rejects.toThrow('Transform engine shutting down');

    harness.engine.cleanup();

    await assertion;
    expect(harness.removeIframe).toHaveBeenCalledTimes(1);
    await expect(harness.engine.ping('x')).rejects.toThrow('Transform engine not initialized');
  });
});
