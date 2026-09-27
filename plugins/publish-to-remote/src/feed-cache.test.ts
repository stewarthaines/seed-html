import { describe, it, expect, vi } from 'vitest';
import { createFeedCache, type FeedCacheStore } from './feed-cache.js';

function memoryStore(initial: string | null = null) {
  let text = initial;
  const store: FeedCacheStore = {
    read: vi.fn(async () => text),
    write: vi.fn(async (next: string) => {
      text = next;
    }),
  };
  return { store, current: () => text };
}

describe('feed cache', () => {
  it('fetches once per stamp and serves the rest from the cache', async () => {
    const { store } = memoryStore();
    const cache = createFeedCache(store);
    const fetch = vi.fn(async () => '<feed/>');
    expect(await cache.text('r1', 'catalog.xml', 'stamp-1', fetch)).toBe('<feed/>');
    expect(await cache.text('r1', 'catalog.xml', 'stamp-1', fetch)).toBe('<feed/>');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.write).toHaveBeenCalledTimes(1);
  });

  it('reads again when the stamp moves', async () => {
    const cache = createFeedCache(memoryStore().store);
    const fetch = vi.fn(async () => 'v2');
    await cache.text('r1', 'catalog.xml', 'stamp-1', async () => 'v1');
    expect(await cache.text('r1', 'catalog.xml', 'stamp-2', fetch)).toBe('v2');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never caches a missing feed', async () => {
    const { store } = memoryStore();
    const cache = createFeedCache(store);
    const fetch = vi.fn(async () => null);
    await cache.text('r1', 'catalog.xml', 'stamp-1', fetch);
    await cache.text('r1', 'catalog.xml', 'stamp-1', fetch);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(store.write).not.toHaveBeenCalled();
  });

  it('finds an entry another frame stored, by re-reading the shared file', async () => {
    const shared = memoryStore();
    const first = createFeedCache(shared.store);
    const second = createFeedCache(shared.store);
    await second.text('r1', 'a.xml', 's', async () => 'seeded');
    await first.text('r1', 'a.xml', 's', async () => 'seeded');
    const fetch = vi.fn(async () => 'fresh');
    await second.text('r1', 'b.xml', 's', async () => 'from second');
    expect(await first.text('r1', 'b.xml', 's', fetch)).toBe('from second');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a feed the plugin just wrote', async () => {
    const cache = createFeedCache(memoryStore().store);
    await cache.put('r1', 'catalog.json', 'stamp-9', '{"written":true}');
    const fetch = vi.fn(async () => 'remote');
    expect(await cache.text('r1', 'catalog.json', 'stamp-9', fetch)).toBe('{"written":true}');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('survives an unreadable cache file', async () => {
    const cache = createFeedCache(memoryStore('not json').store);
    expect(await cache.text('r1', 'a.xml', 's', async () => 'ok')).toBe('ok');
  });

  it('prunes the oldest entries past the cap', async () => {
    const { store, current } = memoryStore();
    const cache = createFeedCache(store);
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => ++now);
    for (let i = 0; i < 70; i += 1) {
      await cache.text('r1', `f${i}.xml`, 's', async () => `t${i}`);
    }
    const stored = JSON.parse(current() ?? '{}') as Record<string, unknown>;
    expect(Object.keys(stored)).toHaveLength(64);
    expect(Object.keys(stored).some((k) => k.includes('f0.xml'))).toBe(false);
    expect(Object.keys(stored).some((k) => k.includes('f69.xml'))).toBe(true);
    vi.restoreAllMocks();
  });
});
