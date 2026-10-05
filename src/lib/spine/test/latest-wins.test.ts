import { describe, it, expect } from 'vitest';
import { createLatestWinsRunner } from '../latest-wins.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createLatestWinsRunner', () => {
  it('loads the selection once when nothing changes', async () => {
    const loaded: string[] = [];
    const runner = createLatestWinsRunner(
      () => 'a',
      async id => {
        loaded.push(id);
      }
    );
    await runner.run();
    expect(loaded).toEqual(['a']);
  });

  it('reloads for a selection that changed while a load was in flight', async () => {
    let selected = 'first';
    const loaded: string[] = [];
    const gates: Record<string, ReturnType<typeof deferred>> = {
      first: deferred(),
      renamed: deferred(),
    };
    const runner = createLatestWinsRunner(
      () => selected,
      async id => {
        loaded.push(id);
        await gates[id].promise;
      }
    );

    const done = runner.run();
    // The selection moves on mid-load, and its own run() joins the first.
    selected = 'renamed';
    const joined = runner.run();
    expect(joined).toBe(done);

    gates.first.resolve();
    gates.renamed.resolve();
    await done;
    expect(loaded).toEqual(['first', 'renamed']);
  });

  it('settles on the latest of several changes without loading the ones in between', async () => {
    let selected = 'a';
    const loaded: string[] = [];
    const gate = deferred();
    const runner = createLatestWinsRunner(
      () => selected,
      async id => {
        loaded.push(id);
        if (id === 'a') await gate.promise;
      }
    );

    const done = runner.run();
    selected = 'b';
    runner.run();
    selected = 'c';
    runner.run();
    gate.resolve();
    await done;
    expect(loaded).toEqual(['a', 'c']);
  });

  it('keeps going after a failed load', async () => {
    let selected = 'a';
    const loaded: string[] = [];
    const runner = createLatestWinsRunner(
      () => selected,
      async id => {
        loaded.push(id);
        if (id === 'a') {
          selected = 'b';
          throw new Error('load failed');
        }
      }
    );
    await runner.run();
    expect(loaded).toEqual(['a', 'b']);
  });

  it('starts a fresh run once the previous one has settled', async () => {
    let selected = 'a';
    const loaded: string[] = [];
    const runner = createLatestWinsRunner(
      () => selected,
      async id => {
        loaded.push(id);
      }
    );
    await runner.run();
    selected = 'b';
    await runner.run();
    expect(loaded).toEqual(['a', 'b']);
  });
});
