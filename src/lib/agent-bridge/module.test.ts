/**
 * Tests for the agent bridge module asset (src/lib/agent-bridge/module.js,
 * served at agent-bridge/module.js by the dev middleware). The asset is plain
 * ESM, imported directly; the WebSocket is a scripted fake and the workspace
 * directory is a plain-object handle tree. The consent-timeout auto-deny is
 * deliberately untested (fake timers fight the crypto/microtask polling);
 * cancellation-on-disconnect covers the same finish path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { start, isWritablePath } from './module.js';

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
  // world while a consent prompt sits open (the revalidation scenarios).
  let cssContent = 'body { color: red }';
  let workspaceId = 'ws-1';
  const cssFile = {
    kind: 'file' as const,
    getFile: async () => {
      const data = new TextEncoder().encode(cssContent);
      return { size: data.length, arrayBuffer: async () => data.buffer };
    },
  };
  const workspace = fakeDir({
    OEBPS: fakeDir({
      Styles: fakeDir({ 'page.css': cssFile }),
      'audio.mp3': fakeFile(new Uint8Array([0, 1, 2, 0])),
    }),
    SOURCE: fakeDir({ 'settings.json': fakeFile('{}') }),
  });
  const statuses: Array<[string, string | undefined]> = [];
  const ctx = {
    wsUrl: 'ws://localhost:8747',
    mountEl: document.createElement('div'),
    onStatus: (status: string, detail?: string) => statuses.push([status, detail]),
    getProjectInfo: () => ({ workspaceId, title: 'Bulletin', language: 'en' }),
    getWorkspaceDir: async () => workspace,
    getRenderedXhtml: () => ({ chapterId: 'ch-1', xhtml: '<html/>' }),
    getLastClick: () => null,
    writeTextFile: vi.fn(async () => {}),
    writeBinaryFile: vi.fn(async () => {}),
    isFileDirty: vi.fn(() => false),
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
      result: { workspaceId: 'ws-1', title: 'Bulletin', language: 'en' },
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

  it('lists files sorted with sizes', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const response = (await socket.receive({ id: 1, tool: 'list_files' })) as {
      result: { files: Array<{ path: string; size: number }> };
    };
    // localeCompare: case-insensitive, so audio.mp3 sorts before Styles/
    expect(response.result.files.map(f => f.path)).toEqual([
      'OEBPS/audio.mp3',
      'OEBPS/Styles/page.css',
      'SOURCE/settings.json',
    ]);
    expect(response.result.files[1].size).toBe(19);
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

  it('write policy: pipeline inputs and standalone assets only', () => {
    // allowed: sources, transforms, preview head, styles, media, RS scripts
    for (const path of [
      'SOURCE/text/item-2-the-news.txt',
      'SOURCE/scripts/transformDom.js',
      'SOURCE/preview/head.xml',
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
    expect(response).toMatchObject({ id: 1, ok: true, result: { written: true, size: 20 } });
    expect(ctx.writeTextFile).toHaveBeenCalledWith(
      'OEBPS/Styles/page.css',
      'body { color: blue }',
      'ws-1'
    );
    expect(ctx.writeBinaryFile).not.toHaveBeenCalled();
    // feed shows the write
    const items = [...ctx.mountEl.querySelectorAll('li')].map(li => li.textContent);
    expect(items.some(t => t?.includes('wrote OEBPS/Styles/page.css (20 bytes)'))).toBe(true);
  });

  it('Allow this session skips the prompt for the next write', async () => {
    const { ctx } = makeContext();
    start(ctx);
    const socket = FakeWebSocket.last!;
    socket.open();
    const hash = await sha256('body { color: red }');
    const send = (id: number) =>
      socket.onmessage?.({
        data: JSON.stringify({
          id,
          tool: 'write_file',
          params: { path: 'OEBPS/Styles/page.css', text: 'x', expectedHash: hash },
        }),
      });
    send(1);
    await waitFor(() =>
      [...ctx.mountEl.querySelectorAll('button')].some(b => b.textContent === 'Allow this session')
    );
    [...ctx.mountEl.querySelectorAll('button')]
      .find(b => b.textContent === 'Allow this session')!
      .click();
    await waitFor(() => socket.sent.filter(s => s.includes('"written"')).length === 1);
    send(2);
    await waitFor(() => socket.sent.filter(s => s.includes('"written"')).length === 2);
    // no second prompt appeared
    expect(
      [...ctx.mountEl.querySelectorAll('button')].filter(b => b.textContent === 'Allow once')
    ).toHaveLength(0);
    expect(ctx.writeTextFile).toHaveBeenCalledTimes(2);
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
      [
        { path: 'OEBPS/Styles/page.css', text: 'x', expectedHash: 'deadbeef' },
        'changed since read',
      ],
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
    await waitFor(() => socket.sent.some(s => s.includes('changed since read')));
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
