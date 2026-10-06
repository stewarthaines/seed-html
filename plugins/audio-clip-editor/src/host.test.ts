import { describe, it, expect, vi } from 'vitest';
import { addMedia } from './host.js';
import type { AddMediaMessage } from './types.js';

function fakeHost() {
  const sent: AddMediaMessage[] = [];
  const target = { postMessage: vi.fn((m: AddMediaMessage) => sent.push(m)) } as unknown as Window;
  const reply = (data: unknown, origin = window.origin) =>
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
  return { sent, target, reply };
}

describe('addMedia', () => {
  it('sends the file and resolves with the href from the matching reply', async () => {
    const host = fakeHost();
    const pending = addMedia('take.mp3', 'audio/mpeg', new ArrayBuffer(3), host.target);
    const [message] = host.sent;
    expect(message).toMatchObject({ type: 'add-media', filename: 'take.mp3', mediaType: 'audio/mpeg' });
    expect(message.bytes.byteLength).toBe(3);

    host.reply({ type: 'media-added', requestId: 'someone-else', href: 'Audio/other.mp3' });
    host.reply({ type: 'media-added', requestId: message.requestId, href: 'Audio/x.mp3' }, 'https://evil.example');
    host.reply({ type: 'media-added', requestId: message.requestId, href: 'Audio/take.mp3' });
    await expect(pending).resolves.toBe('Audio/take.mp3');
  });

  it('rejects with the host’s reason', async () => {
    const host = fakeHost();
    const pending = addMedia('take.mp3', 'audio/mpeg', new ArrayBuffer(3), host.target);
    host.reply({ type: 'media-added', requestId: host.sent[0].requestId, error: 'No book is open' });
    await expect(pending).rejects.toThrow('No book is open');
  });
});
