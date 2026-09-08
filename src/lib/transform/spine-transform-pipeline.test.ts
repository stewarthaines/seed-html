/**
 * Unit tests for SpineTransformPipeline error labeling — script-loading
 * failures are storage problems ('scripts'), not iframe-engine problems
 * ('communication'), so the UI points debugging at the right subsystem.
 */

import { describe, it, expect, vi } from 'vitest';
import { SpineTransformPipeline } from './spine-transform-pipeline.js';

function makePipeline(overrides: {
  loadEPUBSettings?: () => Promise<any>;
  executeTransform?: () => Promise<any>;
}) {
  const engine = {
    setTransformScripts: vi.fn(async () => undefined),
    executeTransform: vi.fn(
      overrides.executeTransform ?? (async () => ({ success: true, html: '<body/>' }))
    ),
  };
  const settingsService = {
    loadEPUBSettings: vi.fn(overrides.loadEPUBSettings ?? (async () => ({}))),
  };
  // An in-memory SOURCE/data/ so the frontmatter store can be observed.
  const stored = new Map<string, string>();
  const fileStorage = {
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(async (_ws: string, path: string, text: string) => {
      stored.set(path, text);
    }),
    fileExists: vi.fn(async (_ws: string, path: string) => stored.has(path)),
    deleteFile: vi.fn(async (_ws: string, path: string) => {
      stored.delete(path);
    }),
  };
  const pipeline = new SpineTransformPipeline(
    'ws-1',
    fileStorage as any,
    {} as any,
    {} as any,
    engine as any,
    settingsService as any
  );
  return { pipeline, engine, fileStorage, stored };
}

describe('executeTransform error stages', () => {
  it('labels a settings/script-load failure as stage "scripts"', async () => {
    const { pipeline, engine } = makePipeline({
      loadEPUBSettings: async () => {
        throw new Error('settings unreadable');
      },
    });

    const result = await pipeline.executeTransform('text');

    expect(result.success).toBe(false);
    expect(result.error?.stage).toBe('scripts');
    expect(result.error?.message).toContain('settings unreadable');
    expect(engine.executeTransform).not.toHaveBeenCalled();
  });

  it('labels an engine failure as stage "communication"', async () => {
    const { pipeline } = makePipeline({
      executeTransform: async () => {
        throw new Error('iframe gone');
      },
    });

    const result = await pipeline.executeTransform('text');

    expect(result.success).toBe(false);
    expect(result.error?.stage).toBe('communication');
    expect(result.error?.message).toContain('iframe gone');
  });

  it('passes the workspace-scoped broker context through to the engine', async () => {
    const { pipeline, engine } = makePipeline({});

    await pipeline.executeTransform('text', 1000, 'ch1', {
      basePath: 'OEBPS',
      manifest: [],
    });

    expect(engine.executeTransform).toHaveBeenCalledWith('text', 1000, 'ch1', {
      workspaceId: 'ws-1',
      basePath: 'OEBPS',
      manifest: [],
      frontmatter: null,
    });
  });
});

describe('chapter frontmatter', () => {
  const SOURCE = '---\ndisplay: Thomas Pattenden\nbirth: 1821\n---\n\n# Thomas\n';

  it('strips the block before the transform, passes it as ctx.frontmatter, and stores it', async () => {
    const { pipeline, engine, stored } = makePipeline({});

    await pipeline.executeTransform(SOURCE, 1000, 'thomas', { basePath: 'OEBPS', manifest: [] });

    expect(engine.executeTransform).toHaveBeenCalledWith('\n# Thomas\n', 1000, 'thomas', {
      workspaceId: 'ws-1',
      basePath: 'OEBPS',
      manifest: [],
      frontmatter: { display: 'Thomas Pattenden', birth: 1821 },
    });
    expect(JSON.parse(stored.get('SOURCE/data/frontmatter/thomas.json')!)).toEqual({
      display: 'Thomas Pattenden',
      birth: 1821,
    });
  });

  it('strips the block even without a broker context — nav generation renders the body alone', async () => {
    const { pipeline, engine } = makePipeline({});

    await pipeline.executeTransform(SOURCE, 1000, 'thomas');

    expect(engine.executeTransform).toHaveBeenCalledWith('\n# Thomas\n', 1000, 'thomas', undefined);
  });

  it('writes the record once per change, not once per render', async () => {
    const { pipeline, fileStorage } = makePipeline({});
    const ctx = { basePath: 'OEBPS', manifest: [] };

    await pipeline.executeTransform(SOURCE, 1000, 'thomas', ctx);
    await pipeline.executeTransform(SOURCE + 'more prose\n', 1000, 'thomas', ctx);
    expect(fileStorage.writeTextFile).toHaveBeenCalledTimes(1);

    await pipeline.executeTransform(SOURCE.replace('1821', '1822'), 1000, 'thomas', ctx);
    expect(fileStorage.writeTextFile).toHaveBeenCalledTimes(2);
  });

  it('removing the block deletes the record; a chapter that never had one writes nothing', async () => {
    const { pipeline, fileStorage, stored } = makePipeline({});
    const ctx = { basePath: 'OEBPS', manifest: [] };

    await pipeline.executeTransform(SOURCE, 1000, 'thomas', ctx);
    expect(stored.has('SOURCE/data/frontmatter/thomas.json')).toBe(true);

    await pipeline.executeTransform('# Thomas\n', 1000, 'thomas', ctx);
    expect(stored.has('SOURCE/data/frontmatter/thomas.json')).toBe(false);

    await pipeline.executeTransform('# Plain\n', 1000, 'plain', ctx);
    expect(fileStorage.writeTextFile).toHaveBeenCalledTimes(1);
    expect(fileStorage.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('a block that fails to parse is stripped, stored as absent, and reported — never rendered raw', async () => {
    const { pipeline, engine, stored } = makePipeline({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await pipeline.executeTransform('---\nkey: [1, 2\n---\n# Body\n', 1000, 'bad', {
        basePath: 'OEBPS',
        manifest: [],
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('frontmatter in bad'));
    } finally {
      warn.mockRestore();
    }

    expect(engine.executeTransform).toHaveBeenCalledWith(
      '# Body\n',
      1000,
      'bad',
      expect.objectContaining({ frontmatter: null })
    );
    expect(stored.has('SOURCE/data/frontmatter/bad.json')).toBe(false);
  });

  it('a storage failure is logged and does not fail the render', async () => {
    const { pipeline, fileStorage } = makePipeline({});
    fileStorage.writeTextFile.mockRejectedValueOnce(new Error('disk full'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await pipeline.executeTransform(SOURCE, 1000, 'thomas', {
        basePath: 'OEBPS',
        manifest: [],
      });
      expect(result.success).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('frontmatter'), expect.any(Error));
    } finally {
      warn.mockRestore();
    }
  });
});
