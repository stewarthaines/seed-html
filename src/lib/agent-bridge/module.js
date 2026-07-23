/* eslint-disable @typescript-eslint/ban-ts-comment -- runtime asset, not a
   lib module: served raw by the dev middleware (never bundled) and typed at
   its boundary (AgentBridgeModuleContext in loader.svelte.ts). The unit tests
   exercise it; TS doesn't vet its internals. */
// @ts-nocheck
/**
 * Agent bridge module (dev-only) — the app-realm half of the live-session
 * bridge (process/AGENT_BRIDGE.md). Lazily fetched by the core loader stub
 * when the author clicks "Allow agent assistance"; never part of the bundle.
 *
 * Connects OUT to the local MCP bridge process (scripts/agent-bridge.mjs)
 * over ws://localhost:8747, serves read-only tool requests against the
 * context object the app hands over, and owns the activity overlay UI —
 * the pill + action feed painted into the host-provided mount element.
 *
 * No auto-reconnect by design: a dropped socket parks the overlay at
 * disconnected and reattaching is a fresh click on the sidebar button.
 * Deliberately untranslated (dev tool, outside the app's catalogs).
 */

const FEED_LIMIT = 100;
/** Decoded byte cap for binary overwrites riding base64 through JSON-RPC. */
const WRITE_SIZE_LIMIT = 2 * 1024 * 1024;
/** Consent prompt auto-denies before the bridge's tool-call timeout fires. */
const CONSENT_TIMEOUT_MS = 90_000;

/**
 * Phase 2 write policy (process/AGENT_BRIDGE.md): modify-in-place on
 * non-generated files only. The boundary is pipeline-shaped — the agent may
 * write pipeline inputs and standalone assets, never generated outputs
 * (OEBPS/Text, toc.ncx, the OPF) and never app-owned bookkeeping
 * (settings.json, SOURCE/main track-changes snapshots, SOURCE/data generator
 * scratch, META-INF, mimetype). Deny-by-default: only listed shapes pass.
 */
export function isWritablePath(path) {
  if (typeof path !== 'string') return false;
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2 || parts.some(p => p === '..' || p === '.')) return false;
  const normalized = parts.join('/');
  // generated at OEBPS root by the outline generator — an edit would be
  // regenerated away (the delayed-silent-revert trap)
  if (/(^|\/)nav\.xhtml$/i.test(normalized)) return false;
  if (/\.opf$/i.test(normalized) || /(^|\/)toc\.ncx$/i.test(normalized)) return false;
  if (
    normalized.startsWith('SOURCE/text/') ||
    normalized.startsWith('SOURCE/scripts/') ||
    normalized.startsWith('SOURCE/preview/')
  ) {
    return true;
  }
  if (normalized.startsWith('OEBPS/')) {
    return !normalized.startsWith('OEBPS/Text/');
  }
  return false;
}

/** SHA-256 hex of bytes — the staleness token read_file hands out. */
async function contentHash(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Start with an AgentBridgeModuleContext (loader.svelte.ts); returns { stop }. */
export function start(ctx) {
  // Write grants are per-connection by design: this state lives and dies with
  // one start()/socket, so every new connection re-prompts.
  const session = { grant: 'none' }; // 'none' | 'session'
  const ui = buildOverlay(ctx.mountEl, () => stop());
  let socket = null;
  let stopped = false;

  function setStatus(status, detail) {
    ui.setStatus(status, detail);
    ctx.onStatus(status, detail);
  }

  setStatus('connecting');
  let opened = false;
  socket = new WebSocket(ctx.wsUrl);
  socket.onopen = () => {
    opened = true;
    setStatus('connected');
    socket.send(
      JSON.stringify({ hello: 'seed-agent-bridge', projectId: ctx.getProjectInfo().workspaceId })
    );
  };
  // Guarded send: tool handlers can finish after the socket died (e.g. a
  // consent prompt auto-denied post-disconnect) — never throw into that.
  const send = data => {
    if (socket && socket.readyState === 1) socket.send(data);
  };
  socket.onclose = () => {
    // Unexpected drop or bridge exit: park at disconnected (no auto-reconnect).
    // A connect failure fires error-then-close, so the message is chosen here,
    // by whether a connection ever opened — never overwritten by close.
    // A prompt the agent is no longer waiting on must not stay actionable.
    ui.cancelPrompts();
    if (!stopped) {
      setStatus(
        'disconnected',
        opened ? 'bridge closed the connection' : 'bridge not reachable — is it running?'
      );
    }
  };
  socket.onmessage = async event => {
    let request;
    try {
      request = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!request || typeof request.id !== 'number' || typeof request.tool !== 'string') return;
    try {
      const result = await handleTool(ctx, session, ui, request.tool, request.params ?? {});
      ui.addAction(describeAction(request.tool, request.params, result));
      send(JSON.stringify({ id: request.id, ok: true, result }));
    } catch (error) {
      ui.addAction(`${describeAction(request.tool, request.params)} — failed`);
      send(JSON.stringify({ id: request.id, ok: false, error: String(error?.message ?? error) }));
    }
  };

  function stop() {
    // Deliberate teardown (toggle off): close and remove the overlay.
    stopped = true;
    ui.cancelPrompts();
    try {
      socket?.close();
    } catch {
      /* already closed */
    }
    ui.destroy();
    ctx.onStatus('disconnected', 'stopped');
  }

  return { stop };
}

// --- tools ----------------------------------------------------------------------

async function handleTool(ctx, session, ui, tool, params) {
  switch (tool) {
    case 'project_info':
      return ctx.getProjectInfo();
    case 'list_files': {
      const dir = await ctx.getWorkspaceDir();
      if (!dir) throw new Error('no project open');
      const files = [];
      await walk(dir, '', files);
      files.sort((a, b) => a.path.localeCompare(b.path));
      return { files };
    }
    case 'read_file': {
      if (typeof params.path !== 'string') throw new Error('path required');
      const dir = await ctx.getWorkspaceDir();
      if (!dir) throw new Error('no project open');
      const file = await (await resolveFile(dir, params.path)).getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      // hash always included: it is the staleness token write_file requires
      const hash = await contentHash(bytes);
      if (file.size > 512 * 1024) return { binary: true, size: file.size, hash };
      // NUL byte in the first KB → binary; report size only
      if (bytes.slice(0, 1024).includes(0)) return { binary: true, size: file.size, hash };
      return { text: new TextDecoder().decode(bytes), size: file.size, hash };
    }
    case 'get_rendered_xhtml': {
      const rendered = ctx.getRenderedXhtml();
      if (!rendered) throw new Error('no chapter rendered');
      return rendered;
    }
    case 'get_selection': {
      const click = ctx.getLastClick();
      return click ?? { kind: 'none' };
    }
    case 'write_file':
      return writeFile(ctx, session, ui, params);
    default:
      throw new Error('unknown tool: ' + tool);
  }
}

// --- write_file (phase 2: modify-in-place, consent-gated) -----------------------

async function writeFile(ctx, session, ui, params) {
  const { path, text, base64, expectedHash } = params;
  if (typeof path !== 'string') throw new Error('path required');
  if (!isWritablePath(path)) {
    throw new Error(
      'not writable: agent writes are limited to existing non-generated files ' +
        '(sources, transforms, styles, media) — never generated XHTML, the OPF, or settings'
    );
  }
  let bytes;
  if (typeof text === 'string') bytes = new TextEncoder().encode(text);
  else if (typeof base64 === 'string') bytes = base64ToBytes(base64);
  else throw new Error('text or base64 required');
  if (bytes.length > WRITE_SIZE_LIMIT) {
    throw new Error(`write of ${bytes.length} bytes exceeds the ${WRITE_SIZE_LIMIT} byte limit`);
  }
  if (typeof expectedHash !== 'string') {
    throw new Error('expectedHash required — read the file first and pass its hash');
  }
  const isText = typeof text === 'string';
  // Pin the workspace at request time: the consent prompt can sit open while
  // the author switches projects, and the write must never follow them.
  const requestWorkspaceId = ctx.getProjectInfo().workspaceId;
  if (!requestWorkspaceId) throw new Error('no project open');

  // Existence, staleness, and dirty-editor checks — run before the consent
  // prompt (fail cheaply, no pointless prompt) and AGAIN after it: the prompt
  // can sit open for up to 90s, and the author may edit the file or switch
  // projects in that window. Consent approves the write that was validated,
  // not whatever the world looks like later.
  const validate = async () => {
    if (ctx.getProjectInfo().workspaceId !== requestWorkspaceId) {
      throw new Error('the open project changed while the write was pending');
    }
    const dir = await ctx.getWorkspaceDir();
    if (!dir) throw new Error('no project open');
    let currentFile;
    try {
      currentFile = await (await resolveFile(dir, path)).getFile();
    } catch {
      throw new Error(
        'file does not exist — creating files is not supported (modify-in-place only)'
      );
    }
    const currentBytes = new Uint8Array(await currentFile.arrayBuffer());
    if ((await contentHash(currentBytes)) !== expectedHash) {
      throw new Error('changed since read — re-read the file and retry with its current hash');
    }
    // Dirty check applies to text files only (binary never opens in a text pane).
    const diskText = isText ? new TextDecoder().decode(currentBytes) : null;
    if (ctx.isFileDirty(path, diskText)) {
      throw new Error(
        'the editor has unsaved changes for this file — ask the author to save first'
      );
    }
  };
  await validate();
  if (session.grant !== 'session') {
    const choice = await ui.promptWrite(path, bytes.length);
    if (choice === 'deny') throw new Error('the author denied this write');
    if (choice === 'session') session.grant = 'session';
    await validate();
  }
  if (isText) await ctx.writeTextFile(path, text, requestWorkspaceId);
  else await ctx.writeBinaryFile(path, bytes, requestWorkspaceId);
  return { written: true, size: bytes.length, hash: await contentHash(bytes) };
}

function base64ToBytes(base64) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function walk(dir, prefix, out) {
  for await (const [name, entry] of dir.entries()) {
    const path = prefix ? prefix + '/' + name : name;
    if (entry.kind === 'directory') await walk(entry, path, out);
    else out.push({ path, size: (await entry.getFile()).size });
  }
}

async function resolveFile(root, path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some(p => p === '..')) throw new Error('invalid path');
  let dir = root;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  return dir.getFileHandle(parts[parts.length - 1]);
}

function describeAction(tool, params, result) {
  if (tool === 'read_file' && params && typeof params.path === 'string')
    return `read ${params.path}`;
  if (tool === 'write_file' && params && typeof params.path === 'string')
    return result ? `wrote ${params.path} (${result.size} bytes)` : `write ${params.path}`;
  if (tool === 'list_files') return 'listed project files';
  if (tool === 'get_rendered_xhtml') return 'read rendered chapter';
  if (tool === 'get_selection') return 'read last click';
  if (tool === 'project_info') return 'read project info';
  return tool;
}

// --- overlay (module-owned; sr-caption family: dark in both themes) -------------

function buildOverlay(mountEl, onDisconnect) {
  mountEl.textContent = '';
  const root = document.createElement('div');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Agent activity');
  Object.assign(root.style, {
    position: 'fixed',
    insetBlockEnd: '16px',
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
    zIndex: '1600',
    font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#f5f5f6',
    background: 'rgba(20, 20, 22, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
    maxInlineSize: 'min(90vw, 480px)',
  });

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.setAttribute('aria-expanded', 'false');
  Object.assign(pill.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    border: '0',
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    maxInlineSize: '100%',
  });
  const dot = document.createElement('span');
  Object.assign(dot.style, {
    inlineSize: '8px',
    blockSize: '8px',
    borderRadius: '50%',
    background: '#fbc02d',
    flex: 'none',
  });
  const label = document.createElement('span');
  label.textContent = 'agent: connecting…';
  Object.assign(label.style, {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });
  pill.append(dot, label);

  const panel = document.createElement('div');
  panel.hidden = true;
  Object.assign(panel.style, {
    borderBlockStart: '1px solid rgba(255,255,255,0.15)',
    padding: '4px 0',
  });
  const feed = document.createElement('ol');
  // the trust surface should not be sighted-only: announce actions to AT
  feed.setAttribute('aria-live', 'polite');
  Object.assign(feed.style, {
    margin: '0',
    padding: '4px 0',
    listStyle: 'none',
    maxBlockSize: '30vh',
    overflowY: 'auto',
  });
  const disconnect = document.createElement('button');
  disconnect.type = 'button';
  disconnect.textContent = 'Disconnect';
  Object.assign(disconnect.style, {
    margin: '4px 12px 6px',
    padding: '3px 10px',
    font: 'inherit',
    color: 'inherit',
    background: 'rgba(255,255,255,0.12)',
    border: '0',
    borderRadius: '4px',
    cursor: 'pointer',
  });
  disconnect.addEventListener('click', onDisconnect);
  panel.append(feed, disconnect);

  pill.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    pill.setAttribute('aria-expanded', String(!panel.hidden));
  });

  root.append(pill, panel);
  mountEl.appendChild(root);

  let lastAction = '';
  // Live consent prompts, cancellable when the connection or module goes away.
  const pendingPrompts = new Set();
  return {
    cancelPrompts() {
      for (const finish of [...pendingPrompts]) finish('deny');
    },
    setStatus(status, detail) {
      dot.style.background =
        status === 'connected' ? '#2e7d32' : status === 'connecting' ? '#fbc02d' : '#b3261e';
      label.textContent =
        status === 'connected'
          ? lastAction
            ? `agent: ${lastAction}`
            : 'agent: connected'
          : `agent: ${status}${detail ? ` — ${detail}` : ''}`;
    },
    addAction(text) {
      lastAction = text;
      label.textContent = `agent: ${text}`;
      const li = document.createElement('li');
      li.textContent = text;
      Object.assign(li.style, { padding: '1px 12px', overflowWrap: 'anywhere' });
      feed.appendChild(li);
      while (feed.children.length > FEED_LIMIT) feed.removeChild(feed.firstChild);
      li.scrollIntoView({ block: 'nearest' });
    },
    /**
     * Inline write-consent prompt in the feed (never a modal). Resolves
     * 'once' | 'session' | 'deny'; auto-denies before the bridge's tool
     * timeout so an unattended prompt fails cleanly on the agent side.
     */
    promptWrite(path, size) {
      panel.hidden = false;
      pill.setAttribute('aria-expanded', 'true');
      return new Promise(resolve => {
        const li = document.createElement('li');
        Object.assign(li.style, { padding: '4px 12px', overflowWrap: 'anywhere' });
        const question = document.createElement('div');
        question.textContent = `agent wants to write ${path} (${size} bytes)`;
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '6px', marginBlockStart: '4px' });
        const finish = choice => {
          pendingPrompts.delete(finish);
          clearTimeout(timer);
          row.remove();
          question.textContent = `${choice === 'deny' ? 'denied' : 'allowed'}: write ${path}`;
          resolve(choice);
        };
        pendingPrompts.add(finish);
        const timer = setTimeout(() => finish('deny'), CONSENT_TIMEOUT_MS);
        for (const [labelText, choice] of [
          ['Allow once', 'once'],
          ['Allow this session', 'session'],
          ['Deny', 'deny'],
        ]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = labelText;
          Object.assign(button.style, {
            padding: '2px 8px',
            font: 'inherit',
            color: 'inherit',
            background: choice === 'deny' ? 'rgba(255,255,255,0.12)' : 'rgba(46,125,50,0.5)',
            border: '0',
            borderRadius: '4px',
            cursor: 'pointer',
          });
          button.addEventListener('click', () => finish(choice));
          row.append(button);
        }
        li.append(question, row);
        feed.appendChild(li);
        li.scrollIntoView({ block: 'nearest' });
      });
    },
    destroy() {
      root.remove();
    },
  };
}
