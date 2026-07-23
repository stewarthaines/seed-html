/**
 * Tests for the agent bridge loader stub — the consent state machine the
 * sidebar button drives. The module is injected as a fake, so these pin the
 * loader's own contracts: single-flight connect, deliberate teardown, parking
 * on disconnect (no auto-reconnect), and fetch-failure recovery.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAgentBridge, type AgentBridgeModuleContext } from './loader.svelte.js';

function makeFakeModule() {
  const startCalls: AgentBridgeModuleContext[] = [];
  const stop = vi.fn();
  const module = {
    start: vi.fn((ctx: AgentBridgeModuleContext) => {
      startCalls.push(ctx);
      ctx.onStatus('connecting');
      ctx.onStatus('connected');
      return { stop };
    }),
  };
  return { module, startCalls, stop };
}

const buildContext = () => ({
  wsUrl: 'ws://localhost:8747',
  mountEl: document.createElement('div'),
  getProjectInfo: () => ({ workspaceId: 'ws-1', title: null, language: null }),
  getWorkspaceDir: async () => null,
  getRenderedXhtml: () => null,
  getLastClick: () => null,
  writeTextFile: async () => {},
  writeBinaryFile: async () => {},
  isFileDirty: () => false,
});

describe('agent bridge loader', () => {
  it('connects on toggle and tears down on the second toggle', async () => {
    const { module, stop } = makeFakeModule();
    const bridge = createAgentBridge(buildContext, async () => module);
    expect(bridge.status).toBe('off');
    await bridge.toggle();
    expect(bridge.status).toBe('connected');
    expect(module.start).toHaveBeenCalledTimes(1);
    await bridge.toggle();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(bridge.status).toBe('off');
  });

  it('single-flight: a double-click during a slow module load starts once', async () => {
    const { module } = makeFakeModule();
    let release!: (mod: typeof module) => void;
    const gate = new Promise<typeof module>(resolve => (release = resolve));
    const bridge = createAgentBridge(buildContext, () => gate);
    const first = bridge.toggle();
    const second = bridge.toggle(); // impatient double-click mid-fetch
    release(module);
    await Promise.all([first, second]);
    expect(module.start).toHaveBeenCalledTimes(1);
    expect(bridge.status).toBe('connected');
  });

  it('parks on disconnect — no restart until the next click, which starts fresh', async () => {
    const { module, startCalls, stop } = makeFakeModule();
    const bridge = createAgentBridge(buildContext, async () => module);
    await bridge.toggle();
    // bridge process exits: module reports the drop
    startCalls[0].onStatus('disconnected', 'bridge closed the connection');
    expect(bridge.status).toBe('off');
    expect(bridge.detail).toBe('bridge closed the connection');
    expect(stop).not.toHaveBeenCalled(); // parked, not torn down
    await bridge.toggle(); // fresh click reconnects
    expect(module.start).toHaveBeenCalledTimes(2);
    expect(bridge.status).toBe('connected');
  });

  it('recovers from a failed module fetch and retries on the next click', async () => {
    const { module } = makeFakeModule();
    let attempts = 0;
    const bridge = createAgentBridge(buildContext, async () => {
      attempts++;
      if (attempts === 1) throw new Error('dev middleware not serving');
      return module;
    });
    await bridge.toggle();
    expect(bridge.status).toBe('off');
    expect(bridge.detail).toBe('dev middleware not serving');
    await bridge.toggle();
    expect(bridge.status).toBe('connected');
  });
});
