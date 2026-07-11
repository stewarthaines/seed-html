import { describe, it, expect } from 'vitest';
import {
  buildFolderSyncPlan,
  scanSyncFolder,
  skipReasonFor,
  naturalCompare,
  DEFAULT_SYNC_EXTENSIONS,
} from './scan.js';
import type { BuildPlanInput, FolderSyncRow } from './scan.js';

function planInput(overrides: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    files: [],
    skipped: [],
    spineIds: [],
    manifestIds: [],
    sources: new Map(),
    ...overrides,
  };
}

const kinds = (rows: FolderSyncRow[]) => rows.map(r => `${r.kind}:${r.name}`);

describe('skipReasonFor', () => {
  it('accepts the import extensions, case-insensitively', () => {
    expect(skipReasonFor('chapter.md')).toBeNull();
    expect(skipReasonFor('CHAPTER.TXT')).toBeNull();
    expect(skipReasonFor('notes.markdown')).toBeNull();
  });

  it('rejects other extensions, hidden files, and AppleDouble sidecars', () => {
    expect(skipReasonFor('notes.docx')).toBe('extension');
    expect(skipReasonFor('.DS_Store')).toBe('hidden');
    expect(skipReasonFor('._chapter.md')).toBe('sidecar'); // more specific than hidden
  });

  it('honours a custom extension list', () => {
    expect(skipReasonFor('poem.dj', ['.dj'])).toBeNull();
    expect(skipReasonFor('poem.md', ['.dj'])).toBe('extension');
  });
});

describe('naturalCompare', () => {
  it('sorts numbered prefixes numerically', () => {
    const names = ['10-epilogue.md', '2-title.md', '1-intro.md'];
    expect(names.sort(naturalCompare)).toEqual(['1-intro.md', '2-title.md', '10-epilogue.md']);
  });
});

describe('buildFolderSyncPlan', () => {
  it('classifies adds, updates, unchanged, and removes', () => {
    const plan = buildFolderSyncPlan(
      planInput({
        files: [
          { name: 'chapter01.md', text: 'edited text' }, // update
          { name: 'chapter02.md', text: 'same' }, // unchanged
          { name: 'epilogue.md', text: 'new' }, // add
        ],
        spineIds: ['chapter01', 'chapter02', 'orphan'],
        manifestIds: ['chapter01', 'chapter02', 'orphan', 'nav'],
        sources: new Map([
          ['chapter01', 'original text'],
          ['chapter02', 'same'],
          ['orphan', 'kept text'],
        ]),
      })
    );

    expect(kinds(plan.rows)).toEqual(['update:chapter01.md', 'add:epilogue.md', 'remove:orphan']);
    expect(plan.unchangedCount).toBe(1);
    const update = plan.rows[0] as Extract<FolderSyncRow, { kind: 'update' }>;
    expect(update).toMatchObject({ targetId: 'chapter01', current: 'original text' });
    const remove = plan.rows[2] as Extract<FolderSyncRow, { kind: 'remove' }>;
    expect(remove.current).toBe('kept text');
  });

  it('matches by sanitized id like import ("Chapter 1.md" hits chapter-1)', () => {
    const plan = buildFolderSyncPlan(
      planInput({
        files: [{ name: 'Chapter 1.md', text: 'new text' }],
        spineIds: ['chapter-1'],
        manifestIds: ['chapter-1'],
        sources: new Map([['chapter-1', 'old text']]),
      })
    );

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({ kind: 'update', targetId: 'chapter-1' });
  });

  it('flags an add whose id collides with a non-chapter manifest item', () => {
    const plan = buildFolderSyncPlan(
      planInput({
        files: [{ name: 'cover.md', text: 'text' }],
        spineIds: ['chapter01'],
        manifestIds: ['chapter01', 'cover'],
        sources: new Map([['chapter01', 'x']]),
      })
    );

    const add = plan.rows.find(r => r.kind === 'add') as Extract<FolderSyncRow, { kind: 'add' }>;
    expect(add.collision).toBe('cover');
    // chapter01 has no folder counterpart → remove row, never reordered away.
    expect(plan.rows.some(r => r.kind === 'remove' && r.targetId === 'chapter01')).toBe(true);
  });

  it('appends adds natural-sorted while never reordering existing chapters', () => {
    const plan = buildFolderSyncPlan(
      planInput({
        files: [
          { name: '10-end.md', text: 'a' },
          { name: '2-middle.md', text: 'b' },
        ],
        spineIds: [],
        manifestIds: [],
        sources: new Map(),
      })
    );

    expect(kinds(plan.rows)).toEqual(['add:2-middle.md', 'add:10-end.md']);
  });

  it('keeps removes in spine order and lists skipped entries last, sorted', () => {
    const plan = buildFolderSyncPlan(
      planInput({
        skipped: [
          { name: 'z-notes.docx', reason: 'extension' },
          { name: '.obsidian', reason: 'hidden' },
        ],
        spineIds: ['zeta', 'alpha'],
        manifestIds: ['zeta', 'alpha'],
        sources: new Map([
          ['zeta', 'z'],
          ['alpha', 'a'],
        ]),
      })
    );

    expect(kinds(plan.rows)).toEqual([
      'remove:zeta',
      'remove:alpha',
      'skipped:.obsidian',
      'skipped:z-notes.docx',
    ]);
  });

  it('treats a matched chapter without readable source as an update against empty', () => {
    const plan = buildFolderSyncPlan(
      planInput({
        files: [{ name: 'chapter01.md', text: 'incoming' }],
        spineIds: ['chapter01'],
        manifestIds: ['chapter01'],
        sources: new Map([['chapter01', null]]),
      })
    );

    expect(plan.rows[0]).toMatchObject({ kind: 'update', current: '' });
  });

  it('reports everything-up-to-date as empty rows with a count', () => {
    const plan = buildFolderSyncPlan(
      planInput({
        files: [{ name: 'chapter01.md', text: 'same' }],
        spineIds: ['chapter01'],
        manifestIds: ['chapter01'],
        sources: new Map([['chapter01', 'same']]),
      })
    );

    expect(plan.rows).toEqual([]);
    expect(plan.unchangedCount).toBe(1);
  });
});

describe('scanSyncFolder', () => {
  function fakeDir(
    entries: Array<
      { kind: 'file'; name: string; text: string } | { kind: 'directory'; name: string }
    >
  ): FileSystemDirectoryHandle {
    return {
      entries: async function* () {
        for (const entry of entries) {
          if (entry.kind === 'directory') {
            yield [entry.name, { kind: 'directory' }] as const;
          } else {
            yield [
              entry.name,
              { kind: 'file', getFile: async () => ({ text: async () => entry.text }) },
            ] as const;
          }
        }
      },
    } as unknown as FileSystemDirectoryHandle;
  }

  it('reads eligible files, skips junk and subdirectories, and diffs sources', async () => {
    const plan = await scanSyncFolder({
      dir: fakeDir([
        { kind: 'file', name: 'chapter01.md', text: 'edited' },
        { kind: 'file', name: '._chapter01.md', text: 'resource fork' },
        { kind: 'file', name: 'notes.docx', text: 'binary-ish' },
        { kind: 'directory', name: 'drafts' },
        { kind: 'file', name: 'epilogue.md', text: 'new chapter' },
      ]),
      spineIds: ['chapter01'],
      manifestIds: ['chapter01'],
      readSource: async id => (id === 'chapter01' ? 'original' : null),
    });

    expect(kinds(plan.rows)).toEqual([
      'update:chapter01.md',
      'add:epilogue.md',
      'skipped:._chapter01.md',
      'skipped:drafts',
      'skipped:notes.docx',
    ]);
    const skippedReasons = plan.rows
      .filter(r => r.kind === 'skipped')
      .map(r => (r as Extract<FolderSyncRow, { kind: 'skipped' }>).reason);
    expect(skippedReasons).toEqual(['sidecar', 'directory', 'extension']);
  });

  it('uses the default extension list unless overridden', async () => {
    const dir = fakeDir([{ kind: 'file', name: 'poem.dj', text: 'djot' }]);
    const base = { spineIds: [], manifestIds: [], readSource: async () => null };

    const defaultPlan = await scanSyncFolder({ dir, ...base });
    expect(defaultPlan.rows[0].kind).toBe('skipped');
    expect(DEFAULT_SYNC_EXTENSIONS).toContain('.md');

    const djotPlan = await scanSyncFolder({
      dir: fakeDir([{ kind: 'file', name: 'poem.dj', text: 'djot' }]),
      ...base,
      extensions: ['.dj'],
    });
    expect(djotPlan.rows[0]).toMatchObject({ kind: 'add', name: 'poem.dj' });
  });
});
