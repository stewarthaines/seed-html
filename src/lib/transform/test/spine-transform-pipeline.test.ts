import { describe, it, expect, vi } from 'vitest';
import { SpineTransformPipeline } from '../spine-transform-pipeline.js';

const WS = 'ws-1';

/** Minimal fileStorage stub: serves the given files, throws for anything else. */
function fsWith(files: Record<string, string>) {
  return {
    readTextFile: vi.fn(async (_ws: string, path: string) => {
      if (path in files) return files[path];
      throw new Error(`not found: ${path}`);
    }),
  };
}

function makePipeline(fileStorage: any, settings: any) {
  const settingsService = { loadEPUBSettings: vi.fn().mockResolvedValue(settings) };
  // extensionManager / blobURLManager / transformEngine are unused by loadTransformScripts.
  return new SpineTransformPipeline(
    WS,
    fileStorage,
    null as any,
    null as any,
    null as any,
    settingsService as any
  );
}

describe('SpineTransformPipeline.loadTransformScripts', () => {
  it('resolves a bare filename under SOURCE/scripts/', async () => {
    const fs = fsWith({
      'SOURCE/scripts/transformText.js': 'function transformText(t){return t;}',
    });
    const pipeline = makePipeline(fs, { text_transform: 'transformText.js', dom_transforms: [] });

    const scripts = await pipeline.loadTransformScripts();

    expect(scripts.textTransform).toContain('transformText');
    expect(fs.readTextFile).toHaveBeenCalledWith(WS, 'SOURCE/scripts/transformText.js');
  });

  it('accepts an already-prefixed SOURCE path without double-prefixing', async () => {
    // Regression: the default settings store a full path; the pipeline used to
    // prepend SOURCE/scripts/ again, producing an unresolvable path and an empty
    // transform (the first-load "transformText is not defined" error).
    const fs = fsWith({
      'SOURCE/scripts/transformText.js': 'function transformText(t){return t;}',
    });
    const pipeline = makePipeline(fs, {
      text_transform: 'SOURCE/scripts/transformText.js',
      dom_transforms: [],
    });

    const scripts = await pipeline.loadTransformScripts();

    expect(scripts.textTransform).toContain('transformText');
    expect(fs.readTextFile).toHaveBeenCalledWith(WS, 'SOURCE/scripts/transformText.js');
    expect(fs.readTextFile).not.toHaveBeenCalledWith(
      WS,
      'SOURCE/scripts/SOURCE/scripts/transformText.js'
    );
  });

  it('retries until a transiently-unavailable script becomes readable', async () => {
    // Mirrors the first-load race: the script file isn't written yet on the
    // first read, then appears.
    let calls = 0;
    const fs = {
      readTextFile: vi.fn(async () => {
        calls++;
        if (calls < 3) throw new Error('not written yet');
        return 'function transformText(t){return t.toUpperCase();}';
      }),
    };
    const pipeline = makePipeline(fs, { text_transform: 'transformText.js', dom_transforms: [] });

    const scripts = await pipeline.loadTransformScripts();

    expect(scripts.textTransform).toContain('toUpperCase');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('leaves the transform empty (no throw) when a script never becomes readable', async () => {
    const fs = fsWith({}); // nothing available
    const pipeline = makePipeline(fs, {
      text_transform: 'missing.js',
      dom_transforms: ['gone.js'],
    });

    const scripts = await pipeline.loadTransformScripts();

    // Empty rather than throwing — the engine passes input through unchanged.
    expect(scripts.textTransform).toBe('');
    expect(scripts.domTransforms).toEqual([]);
  });
});
