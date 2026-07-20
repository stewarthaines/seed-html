import { describe, it, expect, vi } from 'vitest';
import {
  resolveAnnounceTarget,
  isTerminalPhrase,
  walkAnnouncements,
  type VsrLike,
} from './sr-walk';

describe('resolveAnnounceTarget', () => {
  const container = document.createElement('div');
  container.innerHTML = `
    <h2 id="h">Title <em id="h-em">now</em></h2>
    <ul id="list"><li id="item"><span id="date">1 July</span> Concert</li></ul>
    <blockquote id="quote"><p id="quote-p">Quoted <span id="quote-span">text</span></p></blockquote>
    <div id="plain"><b id="plain-b">not announceable</b></div>
  `;
  const el = (id: string) => container.querySelector(`#${id}`)!;

  it('resolves the deepest announceable ancestor: li, not ul', () => {
    expect(resolveAnnounceTarget(el('date'))).toBe(el('item'));
    expect(resolveAnnounceTarget(el('item'))).toBe(el('item'));
  });

  it('resolves inline content to its block', () => {
    expect(resolveAnnounceTarget(el('h-em'))).toBe(el('h'));
    expect(resolveAnnounceTarget(el('quote-span'))).toBe(el('quote-p'));
  });

  it('resolves a nested block to itself, not the outer block', () => {
    expect(resolveAnnounceTarget(el('quote-p'))).toBe(el('quote-p'));
    expect(resolveAnnounceTarget(el('quote'))).toBe(el('quote'));
  });

  it('returns null outside any announceable block', () => {
    expect(resolveAnnounceTarget(el('plain-b'))).toBeNull();
  });
});

describe('isTerminalPhrase', () => {
  it('ends on the end of the start container', () => {
    expect(isTerminalPhrase('end of list', 'x', 'list')).toBe(true);
    expect(isTerminalPhrase('end of document', 'x', 'list')).toBe(true);
  });

  it('does not end on the end of a nested container', () => {
    expect(isTerminalPhrase('end of listitem, level 1, position 1, set size 3', 'x', 'list')).toBe(
      false
    );
    expect(isTerminalPhrase('end of paragraph', 'x', 'region, Sample chapter')).toBe(false);
  });

  it('ends on a stuck or wrapped cursor', () => {
    expect(isTerminalPhrase('same', 'same', 'list')).toBe(true);
    expect(isTerminalPhrase('list', 'other', 'list')).toBe(true);
  });
});

/** A scripted stand-in: start() announces phrases[0], each next() advances. */
function fakeVsr(phrases: string[]) {
  let index = 0;
  const calls: string[] = [];
  const vsr: VsrLike = {
    start: vi.fn(async () => {
      calls.push('start');
      index = 0;
    }),
    next: vi.fn(async () => {
      calls.push('next');
      if (index < phrases.length - 1) index++;
    }),
    stop: vi.fn(async () => {
      calls.push('stop');
    }),
    lastSpokenPhrase: vi.fn(async () => phrases[index]),
  };
  return { vsr, calls };
}

const walk = async (vsr: VsrLike, opts: { signal?: AbortSignal } = {}) => {
  const container = document.createElement('div');
  const heard: string[] = [];
  await walkAnnouncements(vsr, container, {
    signal: opts.signal ?? new AbortController().signal,
    stepDelayMs: 0,
    onPhrase: phrase => heard.push(phrase),
  });
  return heard;
};

describe('walkAnnouncements', () => {
  it('emits phrases in order, including the terminal phrase, then stops', async () => {
    const { vsr, calls } = fakeVsr(['list', 'listitem', 'one', 'end of listitem', 'end of list']);
    const heard = await walk(vsr);
    expect(heard).toEqual(['list', 'listitem', 'one', 'end of listitem', 'end of list']);
    expect(calls[0]).toBe('start');
    expect(calls[calls.length - 1]).toBe('stop');
  });

  it('stops on a stuck cursor without emitting the repeat', async () => {
    const { vsr } = fakeVsr(['paragraph', 'text']); // next() past the end repeats 'text'
    const heard = await walk(vsr);
    expect(heard).toEqual(['paragraph', 'text']);
  });

  it('honors abort mid-walk and still calls stop()', async () => {
    const { vsr, calls } = fakeVsr(['a', 'b', 'c', 'd', 'end of a']);
    const controller = new AbortController();
    const heard: string[] = [];
    await walkAnnouncements(vsr, document.createElement('div'), {
      signal: controller.signal,
      stepDelayMs: 0,
      onPhrase: phrase => {
        heard.push(phrase);
        if (heard.length === 2) controller.abort();
      },
    });
    expect(heard).toEqual(['a', 'b']);
    expect(calls[calls.length - 1]).toBe('stop');
  });

  it('always stops the reader when the walk throws, and swallows stop() failures', async () => {
    const stop = vi.fn(async () => {
      throw new Error('document rewritten');
    });
    const vsr: VsrLike = {
      start: async () => {},
      next: async () => {
        throw new Error('boom');
      },
      stop,
      lastSpokenPhrase: async () => 'first',
    };
    await expect(walk(vsr)).rejects.toThrow('boom');
    expect(stop).toHaveBeenCalled();
  });
});
