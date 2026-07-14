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
  const pipeline = new SpineTransformPipeline(
    'ws-1',
    { readTextFile: vi.fn() } as any,
    {} as any,
    {} as any,
    engine as any,
    settingsService as any
  );
  return { pipeline, engine };
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
    });
  });
});
