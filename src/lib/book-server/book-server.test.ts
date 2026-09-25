import { describe, it, expect } from 'vitest';
import {
  answerBookFile,
  bookRoutePath,
  parseBookRoute,
  serveDocument,
  BOOK_ROUTE,
} from './book-server';

describe('book route', () => {
  it('builds a served URL from a workspace id and a container path', () => {
    expect(bookRoutePath('ws-1', 'EPUB/xhtml/raw/ch1.xhtml', 'http://localhost:5173')).toBe(
      'http://localhost:5173/__book/ws-1/EPUB/xhtml/raw/ch1.xhtml'
    );
    expect(bookRoutePath('ws 1', 'OEBPS/Images/my cover.png')).toBe(
      `${BOOK_ROUTE}ws%201/OEBPS/Images/my%20cover.png`
    );
  });

  it('parses a served path back, decoding segments and refusing traversal', () => {
    expect(parseBookRoute('/__book/ws%201/OEBPS/Images/my%20cover.png')).toEqual({
      workspaceId: 'ws 1',
      path: 'OEBPS/Images/my cover.png',
    });
    expect(parseBookRoute('/__book/ws/EPUB/../x.js')).toBeNull();
    expect(parseBookRoute('/__book/ws')).toBeNull();
    expect(parseBookRoute('/SEED.html')).toBeNull();
  });

  it('round-trips', () => {
    const path = bookRoutePath('ws-1', 'EPUB/video/lisa-ios_1760052804.mp4');
    expect(parseBookRoute(path)).toEqual({
      workspaceId: 'ws-1',
      path: 'EPUB/video/lisa-ios_1760052804.mp4',
    });
  });
});

describe('answering a request', () => {
  const bytes = new TextEncoder().encode('body {}').buffer as ArrayBuffer;
  const reader = {
    async readFile(workspaceId: string, path: string) {
      if (workspaceId === 'ws' && path === 'EPUB/css/base.css') return bytes;
      throw new Error('not found');
    },
    async listWorkspaces() {
      return ['ws'];
    },
  };

  it('replies with the bytes and a media type from the extension', async () => {
    const reply = await answerBookFile(reader, {
      type: 'book-file',
      workspaceId: 'ws',
      path: 'EPUB/css/base.css',
    });
    expect(reply).toEqual({ ok: true, bytes, contentType: 'text/css' });
  });

  it('replies not found when the workspace is here but the file is not', async () => {
    const reply = await answerBookFile(reader, {
      type: 'book-file',
      workspaceId: 'ws',
      path: 'EPUB/js/missing.js',
    });
    expect(reply).toEqual({ ok: false, reason: 'not-found' });
  });

  it('replies not mine when the workspace is not here, so another page may answer', async () => {
    const reply = await answerBookFile(reader, {
      type: 'book-file',
      workspaceId: 'a-readers-book',
      path: 'EPUB/video/clip.mp4',
    });
    expect(reply).toEqual({ ok: false, reason: 'not-mine' });
  });
});

describe('a prepared document', () => {
  const reader = {
    async readFile() {
      return new TextEncoder().encode('<p>stored</p>').buffer as ArrayBuffer;
    },
    async listWorkspaces() {
      return ['ws'];
    },
  };
  const ask = { type: 'book-file' as const, workspaceId: 'ws', path: 'EPUB/text/ch1.xhtml' };
  const text = async () => {
    const reply = await answerBookFile(reader, ask);
    if (!reply.ok) throw new Error('expected ok');
    return { body: new TextDecoder().decode(reply.bytes), type: reply.contentType };
  };

  it('is answered in place of the stored file until released', async () => {
    const release = serveDocument('ws', 'EPUB/text/ch1.xhtml', '<p>rendered</p>');
    expect(await text()).toEqual({ body: '<p>rendered</p>', type: 'text/html' });
    release();
    expect((await text()).body).toBe('<p>stored</p>');
  });

  it('is replaced by a newer registration, which an old release leaves alone', async () => {
    const first = serveDocument('ws', 'EPUB/text/ch1.xhtml', '<p>first</p>');
    const second = serveDocument('ws', 'EPUB/text/ch1.xhtml', '<p>second</p>');
    first();
    expect((await text()).body).toBe('<p>second</p>');
    second();
    expect((await text()).body).toBe('<p>stored</p>');
  });
});
