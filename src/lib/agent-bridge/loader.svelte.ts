/**
 * Agent bridge loader stub (dev-only) — the only bridge code in core.
 *
 * Dynamically imported by App.svelte behind `import.meta.env.DEV` (so neither
 * this stub nor the module ever reaches a production bundle), it fetches the
 * real module from the dev-middleware-served asset URL on the author's first
 * click and tracks the button/overlay status. See process/AGENT_BRIDGE.md.
 */

export type AgentBridgeStatus = 'off' | 'connecting' | 'connected';

export interface AgentBridgeModuleContext {
  wsUrl: string;
  mountEl: HTMLElement;
  onStatus: (status: 'connecting' | 'connected' | 'disconnected', detail?: string) => void;
  getProjectInfo: () => {
    workspaceId: string | null;
    title: string | null;
    language: string | null;
  };
  getWorkspaceDir: () => Promise<FileSystemDirectoryHandle | null>;
  getRenderedXhtml: () => { chapterId: string | null; xhtml: string } | null;
  getLastClick: () => Record<string, unknown> | null;
  /**
   * Phase 2 writes — service-routed so state propagation and track-changes
   * copy-on-write hold (raw OPFS writes get clobbered or never render).
   * Text and binary are distinct because only the text path is trackable.
   * `workspaceId` is the project pinned at request time: the write is refused
   * if the open project has changed since (the consent prompt can sit open
   * across a project switch).
   */
  writeTextFile: (path: string, text: string, workspaceId: string) => Promise<void>;
  writeBinaryFile: (path: string, bytes: Uint8Array, workspaceId: string) => Promise<void>;
  /**
   * Whether an open editor pane holds unsaved edits for `path` — its in-memory
   * content differs from `diskText` (the bytes just read for the hash check).
   * Agent writes are refused while dirty, or the author's in-flight typing
   * would be clobbered by the post-write store reload.
   */
  isFileDirty: (path: string, diskText: string | null) => boolean;
}

interface AgentBridgeModule {
  start(ctx: AgentBridgeModuleContext): { stop(): void };
}

export interface AgentBridge {
  readonly status: AgentBridgeStatus;
  readonly detail: string;
  toggle(): Promise<void>;
}

export function createAgentBridge(
  buildContext: () => Omit<AgentBridgeModuleContext, 'onStatus'>,
  loadModule: () => Promise<AgentBridgeModule> = () =>
    import(/* @vite-ignore */ new URL('agent-bridge/module.js', document.baseURI).href)
): AgentBridge {
  let status = $state<AgentBridgeStatus>('off');
  let detail = $state('');
  let handle: { stop(): void } | null = null;
  let modulePromise: Promise<AgentBridgeModule> | null = null;

  return {
    get status() {
      return status;
    },
    get detail() {
      return detail;
    },
    async toggle() {
      if (handle) {
        // Deliberate disallow: tear down socket and overlay.
        const stopping = handle;
        handle = null;
        stopping.stop();
        status = 'off';
        return;
      }
      // Single-flight: a click while the module is still loading is ignored,
      // so a double-click can never open two sockets (whose displaced-socket
      // status events would clobber the live connection's button state).
      if (status !== 'off') return;
      status = 'connecting';
      detail = '';
      try {
        modulePromise ??= loadModule();
        const mod = await modulePromise;
        handle = mod.start({
          ...buildContext(),
          onStatus: (next, statusDetail) => {
            detail = statusDetail ?? '';
            if (next === 'disconnected') {
              // Dropped or refused: park (no auto-reconnect); next click is a
              // fresh start. The overlay stays mounted unless stop() ran.
              handle = null;
              status = 'off';
            } else {
              status = next;
            }
          },
        });
      } catch (error) {
        modulePromise = null;
        status = 'off';
        detail = String(error instanceof Error ? error.message : error);
      }
    },
  };
}
