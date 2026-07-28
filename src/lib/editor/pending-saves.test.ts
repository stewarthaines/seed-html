import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPendingSaves, type PendingSaves } from './pending-saves';

interface WriteCall {
  workspaceId: string;
  path: string;
  content: string;
}

function recordingWriter() {
  const calls: WriteCall[] = [];
  const write = vi.fn(async (workspaceId: string, path: string, content: string) => {
    calls.push({ workspaceId, path, content });
  });
  return { calls, write };
}

/** A writer whose promises resolve only when released, for in-flight tests. */
function gatedWriter() {
  const calls: WriteCall[] = [];
  const gates: Array<() => void> = [];
  const write = vi.fn((workspaceId: string, path: string, content: string) => {
    calls.push({ workspaceId, path, content });
    return new Promise<void>(resolve => {
      gates.push(resolve);
    });
  });
  const releaseAll = () => {
    while (gates.length) gates.shift()!();
  };
  return { calls, write, releaseAll };
}

describe('pending-saves', () => {
  let manager: PendingSaves | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    manager = null;
    vi.restoreAllMocks();
  });

  it('debounces: repeated schedules of one key produce one write with the latest content', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });

    let content = 'v1';
    manager.schedule('ws-a', 'SOURCE/text/contents.txt', () => content);
    content = 'v2';
    manager.schedule('ws-a', 'SOURCE/text/contents.txt', () => content);
    content = 'v3';
    manager.schedule('ws-a', 'SOURCE/text/contents.txt', () => content);

    await vi.advanceTimersByTimeAsync(300);
    await manager.settled();

    expect(calls).toEqual([
      { workspaceId: 'ws-a', path: 'SOURCE/text/contents.txt', content: 'v3' },
    ]);
  });

  it('keeps different keys independent and concurrent', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });

    manager.schedule('ws-a', 'a.txt', () => 'A');
    manager.schedule('ws-a', 'b.txt', () => 'B');

    await vi.advanceTimersByTimeAsync(300);
    await manager.settled();

    expect(calls).toHaveLength(2);
    expect(calls.map(c => c.path).sort()).toEqual(['a.txt', 'b.txt']);
  });

  it('honors per-schedule delay overrides', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });

    manager.schedule('ws-a', 'page.css', () => 'css', { delay: 500 });

    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    await manager.settled();
    expect(calls).toHaveLength(1);
  });

  it('cross-project clobber: a save scheduled in workspace A never writes into workspace B', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });
    const onSavedA = vi.fn();

    // Both projects have a chapter named `contents` — the incident's collision.
    manager.schedule('ws-a', 'SOURCE/text/contents.txt', () => 'A text', { onSaved: onSavedA });
    manager.invalidateWorkspace(); // user switches project

    manager.schedule('ws-b', 'SOURCE/text/contents.txt', () => 'B text');
    await vi.advanceTimersByTimeAsync(300);
    await manager.settled();

    // A's content flushed to A; B's content saved to B; nothing crossed.
    expect(calls).toEqual([
      { workspaceId: 'ws-a', path: 'SOURCE/text/contents.txt', content: 'A text' },
      { workspaceId: 'ws-b', path: 'SOURCE/text/contents.txt', content: 'B text' },
    ]);
    expect(onSavedA).not.toHaveBeenCalled();
  });

  it('flush-on-switch preserves the last keystrokes before the switch', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });

    let content = 'draft';
    manager.schedule('ws-a', 'chapter.txt', () => content);
    content = 'draft + last keystrokes';
    manager.invalidateWorkspace();
    await manager.settled();

    expect(calls).toEqual([
      { workspaceId: 'ws-a', path: 'chapter.txt', content: 'draft + last keystrokes' },
    ]);
    // The orphaned timer must not produce a second write.
    await vi.advanceTimersByTimeAsync(1000);
    await manager.settled();
    expect(calls).toHaveLength(1);
  });

  it('suppresses onSaved when the workspace switches while the write is in flight', async () => {
    const { calls, write, releaseAll } = gatedWriter();
    manager = createPendingSaves({ write });
    const onSaved = vi.fn();

    manager.schedule('ws-a', 'chapter.txt', () => 'text', { onSaved });
    await vi.advanceTimersByTimeAsync(300); // fires; write now in flight

    expect(calls).toHaveLength(1);
    manager.invalidateWorkspace(); // switch lands mid-write
    releaseAll();
    await manager.settled();

    expect(calls).toEqual([{ workspaceId: 'ws-a', path: 'chapter.txt', content: 'text' }]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('runs onSaved with the saved content when no switch intervenes', async () => {
    const { write } = recordingWriter();
    manager = createPendingSaves({ write });
    const onSaved = vi.fn();

    manager.schedule('ws-a', 'chapter.txt', () => 'text', { onSaved });
    await vi.advanceTimersByTimeAsync(300);
    await manager.settled();

    expect(onSaved).toHaveBeenCalledExactlyOnceWith('text');
  });

  it('serializes writes per key: a newer write waits for the older one and lands last', async () => {
    const { calls, write, releaseAll } = gatedWriter();
    manager = createPendingSaves({ write });

    manager.schedule('ws-a', 'chapter.txt', () => 'old');
    await vi.advanceTimersByTimeAsync(300); // write('old') in flight, unresolved

    manager.schedule('ws-a', 'chapter.txt', () => 'new');
    await vi.advanceTimersByTimeAsync(300); // fired, but must queue behind 'old'

    expect(calls.map(c => c.content)).toEqual(['old']);
    releaseAll(); // resolve 'old'; the chained 'new' write starts…
    await vi.advanceTimersByTimeAsync(0);
    releaseAll(); // …and gets its own gate released
    await manager.settled();
    expect(calls.map(c => c.content)).toEqual(['old', 'new']);
  });

  it('flushAll writes everything pending, without onSaved, and clears timers', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });
    const onSaved = vi.fn();

    manager.schedule('ws-a', 'a.txt', () => 'A', { onSaved });
    manager.schedule('ws-a', 'b.txt', () => 'B', { onSaved });
    manager.flushAll();
    await manager.settled();

    expect(calls).toHaveLength(2);
    expect(onSaved).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    await manager.settled();
    expect(calls).toHaveLength(2); // no duplicate writes from cleared timers
  });

  it('flush targets one key and leaves the rest pending', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });

    manager.schedule('ws-a', 'a.txt', () => 'A');
    manager.schedule('ws-a', 'b.txt', () => 'B');
    manager.flush('ws-a', 'a.txt');
    // b.txt's timer is still pending, so settled() must not resolve yet —
    // drain only the flush write's microtasks.
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toEqual([{ workspaceId: 'ws-a', path: 'a.txt', content: 'A' }]);
    await vi.advanceTimersByTimeAsync(300);
    await manager.settled();
    expect(calls).toHaveLength(2);
  });

  it('cancel drops a pending save without writing', async () => {
    const { calls, write } = recordingWriter();
    manager = createPendingSaves({ write });

    manager.schedule('ws-a', 'broken.js', () => 'not valid js');
    manager.cancel('ws-a', 'broken.js');
    await vi.advanceTimersByTimeAsync(1000);
    await manager.settled();

    expect(calls).toHaveLength(0);
  });

  it('destroy flushes and rejects further schedules without throwing', async () => {
    const { calls, write } = recordingWriter();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    manager = createPendingSaves({ write });

    manager.schedule('ws-a', 'chapter.txt', () => 'text');
    manager.destroy();
    await manager.settled();
    expect(calls).toEqual([{ workspaceId: 'ws-a', path: 'chapter.txt', content: 'text' }]);

    manager.schedule('ws-a', 'chapter.txt', () => 'late');
    await vi.advanceTimersByTimeAsync(1000);
    await manager.settled();
    expect(calls).toHaveLength(1);
    expect(error).toHaveBeenCalled();
  });

  it('logs and swallows write failures; the next edit re-schedules cleanly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls: WriteCall[] = [];
    let failNext = true;
    const write = vi.fn(async (workspaceId: string, path: string, content: string) => {
      if (failNext) {
        failNext = false;
        throw new Error('disk full');
      }
      calls.push({ workspaceId, path, content });
    });
    manager = createPendingSaves({ write });
    const onSaved = vi.fn();

    manager.schedule('ws-a', 'chapter.txt', () => 'v1', { onSaved });
    await vi.advanceTimersByTimeAsync(300);
    await manager.settled();
    expect(calls).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();

    manager.schedule('ws-a', 'chapter.txt', () => 'v2', { onSaved });
    await vi.advanceTimersByTimeAsync(300);
    await manager.settled();
    expect(calls).toEqual([{ workspaceId: 'ws-a', path: 'chapter.txt', content: 'v2' }]);
    expect(onSaved).toHaveBeenCalledExactlyOnceWith('v2');
  });

  it('settled resolves only after timers and writes quiesce', async () => {
    const { write, releaseAll } = gatedWriter();
    manager = createPendingSaves({ write });

    manager.schedule('ws-a', 'chapter.txt', () => 'text');
    let resolved = false;
    const wait = manager.settled().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(300); // fired, write in flight
    expect(resolved).toBe(false);
    releaseAll();
    await wait;
    expect(resolved).toBe(true);

    // Quiet manager resolves immediately.
    await expect(manager.settled()).resolves.toBeUndefined();
  });
});
