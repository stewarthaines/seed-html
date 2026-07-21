import { describe, it, expect, vi } from 'vitest';
import {
  resolveAnnounceTarget,
  isStructuralPhrase,
  isTerminalPhrase,
  speakablePhrase,
  walkAnnouncements,
  type SpokenLookup,
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

describe('speakablePhrase', () => {
  it('speaks role tokens as words and list context as "x of y"', () => {
    expect(speakablePhrase('listitem, level 2, position 3, set size 12')).toBe(
      'list item, level 2, 3 of 12'
    );
    expect(speakablePhrase('end of listitem, level 1, position 1, set size 3')).toBe(
      'end of list item, level 1, 1 of 3'
    );
  });

  it('speaks graphics and DPUB roles', () => {
    expect(speakablePhrase('graphics-document')).toBe('graphic');
    expect(speakablePhrase('doc-noteref, note 1')).toBe('note reference, note 1');
    expect(speakablePhrase('end of doc-footnote')).toBe('end of footnote');
    expect(speakablePhrase('doc-pagebreak')).toBe('page break');
    expect(speakablePhrase('doc-glossary')).toBe('glossary');
  });

  it('speaks table roles', () => {
    expect(speakablePhrase('columnheader, Date')).toBe('column header, Date');
    expect(speakablePhrase('end of rowgroup')).toBe('end of row group');
  });

  it('leaves ordinary roles and content text untouched', () => {
    expect(speakablePhrase('paragraph')).toBe('paragraph');
    expect(speakablePhrase('table, December broadcasts')).toBe('table, December broadcasts');
    expect(speakablePhrase('The listitem token appears in this sentence.')).toBe(
      'The listitem token appears in this sentence.'
    );
  });

  it('passes unknown future roles through as English', () => {
    expect(speakablePhrase('doc-futurerole')).toBe('futurerole');
    expect(speakablePhrase('end of doc-futurerole')).toBe('end of futurerole');
  });

  it('resolves vocabulary through the lookup — per-role end msgids, no concatenation', () => {
    const seen: Array<[string, Record<string, string | number> | undefined]> = [];
    const spoken: SpokenLookup = (msgid, params) => {
      seen.push([msgid, params]);
      return `«${msgid}»`;
    };
    expect(speakablePhrase('end of listitem, level 2, position 3, set size 12', spoken)).toBe(
      '«end of list item», «level {n}», «{x} of {y}»'
    );
    expect(seen).toEqual([
      ['end of list item', undefined],
      ['level {n}', { n: '2' }],
      ['{x} of {y}', { x: '3', y: '12' }],
    ]);
    expect(speakablePhrase('doc-noteref, note 1', spoken)).toBe('«note reference», note 1');
  });

  it('never sends content text through the lookup', () => {
    const spoken = vi.fn((msgid: string) => msgid);
    expect(speakablePhrase('Recorded in the village of Kotelia.', spoken)).toBe(
      'Recorded in the village of Kotelia.'
    );
    expect(spoken).not.toHaveBeenCalled();
  });
});

describe('isStructuralPhrase', () => {
  it('recognises role and end-of phrases', () => {
    expect(isStructuralPhrase('listitem, level 2, position 3, set size 12')).toBe(true);
    expect(isStructuralPhrase('paragraph')).toBe(true);
    expect(isStructuralPhrase('end of doc-footnote')).toBe(true);
    expect(isStructuralPhrase('table, December broadcasts')).toBe(true);
  });

  it('classifies content text as content, even lowercase with commas', () => {
    expect(isStructuralPhrase('Recorded in the village of Kotelia.')).toBe(false);
    expect(isStructuralPhrase('hello, world')).toBe(false);
    expect(isStructuralPhrase('მრავალხმიანობა')).toBe(false);
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

  it('jumps to a target via focus, announces full context, stops at its end', async () => {
    // Session starts on the container ('document'); focusing the target moves
    // the cursor to the nested listitem, announced with document-level context.
    const timeline = [
      'document',
      'listitem, level 2, position 2, set size 3',
      'inner b',
      'end of listitem, level 2, position 2, set size 3',
      'end of list',
    ];
    let index = 0;
    const stop = vi.fn(async () => {});
    const vsr: VsrLike = {
      start: async () => {},
      next: async () => {
        if (index < timeline.length - 1) index++;
      },
      stop,
      lastSpokenPhrase: async () => timeline[index],
    };
    const container = document.createElement('div');
    const target = document.createElement('li');
    container.appendChild(target);
    // simulate the virtual screen reader following DOM focus
    (target as HTMLElement).focus = () => {
      index = 1;
    };
    const heard: string[] = [];
    await walkAnnouncements(vsr, container, {
      signal: new AbortController().signal,
      stepDelayMs: 0,
      target,
      onPhrase: phrase => heard.push(phrase),
    });
    // the container's own announcement is skipped; the walk ends with the
    // target's end phrase, never reaching content past the target
    expect(heard).toEqual(timeline.slice(1, 4));
    expect(target.hasAttribute('tabindex')).toBe(false);
    expect(stop).toHaveBeenCalled();
  });

  it('stops when the cursor leaves a target that never announces an end phrase', async () => {
    // headings flatten into a single phrase — no "end of heading" ever comes,
    // so the walk must stop on the cursor structurally leaving the target
    const timeline = ['document', 'heading, Title, level 2', 'paragraph', 'Text after.'];
    let index = 0;
    const container = document.createElement('div');
    const target = document.createElement('h2');
    const outside = document.createElement('p');
    container.append(target, outside);
    const nodes = [container, target, outside, outside];
    const vsr: VsrLike = {
      start: async () => {},
      next: async () => {
        if (index < timeline.length - 1) index++;
      },
      stop: async () => {},
      lastSpokenPhrase: async () => timeline[index],
      get activeNode() {
        return nodes[index];
      },
    };
    (target as HTMLElement).focus = () => {
      index = 1;
    };
    const heard: string[] = [];
    await walkAnnouncements(vsr, container, {
      signal: new AbortController().signal,
      stepDelayMs: 0,
      target,
      onPhrase: phrase => heard.push(phrase),
    });
    expect(heard).toEqual(['heading, Title, level 2']);
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
