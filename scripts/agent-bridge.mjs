/**
 * Agent bridge (dev-only) — the process-side half of the live-session bridge
 * (process/AGENT_BRIDGE.md).
 *
 * Speaks MCP (newline-delimited JSON-RPC over stdio) to a coding agent, and
 * relays tool calls over a localhost WebSocket to the app module the author
 * enabled with "Allow agent assistance". Read-only tools; the app executes
 * them against the open project.
 *
 * Register once:  claude mcp add seed-bridge -- node scripts/agent-bridge.mjs
 *
 * Hand-rolled JSON-RPC rather than the MCP SDK: a handful of methods,
 * dev-only, no new dependencies (ws is already hoisted by vite).
 */
import { WebSocketServer } from 'ws';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = 8747;

// The authoring guide is knowledge, not project state: served straight from
// the repo by the bridge process itself, so it works before a tab connects.
const GUIDE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'docs',
  'AGENT_AUTHORING.md'
);
let guideText;
try {
  guideText = readFileSync(GUIDE_PATH, 'utf8');
} catch {
  guideText = 'authoring guide missing at ' + GUIDE_PATH;
}

// --- tab side -----------------------------------------------------------------

let tab = null; // the one connected plugin socket
let tabProject = null;
let nextRequestId = 1;
const pending = new Map(); // request id → { resolve, reject, timer }

// Fail alive on a taken port (design resolution 5, process/AGENT_BRIDGE.md):
// the MCP server keeps running and every tool call returns the explanation
// in-band, where the agent reads it — a crashed process would leave the user
// a dead server and a mystery.
let bindError = null;
const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
wss.on('error', error => {
  bindError =
    error?.code === 'EADDRINUSE'
      ? `port ${PORT} is in use — another agent session or an orphaned bridge is already running`
      : String(error?.message ?? error);
  process.stderr.write(`[bridge] ${bindError}\n`);
});
wss.on('connection', socket => {
  tab?.close();
  tab = socket;
  socket.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (message.hello === 'seed-agent-bridge') {
      tabProject = message.projectId ?? null;
      process.stderr.write(`[bridge] tab connected, project ${tabProject}\n`);
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.ok) entry.resolve(message.result);
    else entry.reject(new Error(message.error ?? 'tool failed'));
  });
  socket.on('close', () => {
    if (tab === socket) {
      tab = null;
      tabProject = null;
      process.stderr.write('[bridge] tab disconnected\n');
    }
  });
});

function callTab(tool, params) {
  if (bindError) return Promise.reject(new Error(bindError));
  if (!tab || tab.readyState !== 1) {
    return Promise.reject(
      new Error('No SEED tab connected — click "Allow agent assistance" in the app (dev server).')
    );
  }
  const id = nextRequestId++;
  // Generous timeout: a write waits on the author's in-app consent prompt,
  // which auto-denies at 90s — this must outlast it.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('tab did not answer within 120s'));
    }, 120000);
    pending.set(id, { resolve, reject, timer });
    tab.send(JSON.stringify({ id, tool, params }));
  });
}

// --- agent side (MCP over stdio) ----------------------------------------------

const TOOLS = [
  {
    name: 'seed_get_authoring_guide',
    description:
      'READ THIS FIRST when asked to work on EPUB content, styles, or scripts: the authoring contract for SEED.html projects — EPUB CSS fallback rules, progressive-enhancement scripting, the Paged.js PDF quirks, accessibility/epubcheck constraints, and the project-setup steps to take before editing. Available even before the app tab connects.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'seed_get_project_setup',
    description:
      "The open project's configuration: settings.json (configured transform scripts, media insertion templates, preview setup) plus project identity. Call before editing — chapter markup is produced by the configured transforms, and templates are per-project.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'seed_project_info',
    description:
      "The open SEED.html project's identity (workspace id) and bridge connection state.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'seed_list_files',
    description:
      "List every file in the open project's workspace (path + size). Paths are workspace-relative: SOURCE/ holds authoring files (text sources, scripts, settings.json), OEBPS/ holds packaged content (styles, images, OPF).",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'seed_read_file',
    description:
      "Read a file from the open project's workspace as text (workspace-relative path from seed_list_files). Binary or oversized files report { binary: true, size } instead of content.",
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'workspace-relative file path' } },
      required: ['path'],
    },
  },
  {
    name: 'seed_get_rendered_xhtml',
    description:
      "The currently previewed chapter's generated XHTML — the transform pipeline's output the author is looking at right now.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'seed_get_selection',
    description:
      'What the author last pointed at in the preview: the clicked element type, a text snippet, its position, and the chapter. { kind: "none" } when nothing has been clicked.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'seed_write_file',
    description:
      'Overwrite an EXISTING non-generated project file (sources, transform scripts, styles, media). Requires seed_get_authoring_guide to have been called this session, and expected_hash from a prior seed_read_file of the same path — rejected if the file changed since. Cannot create files, and cannot touch generated XHTML, the nav, the OPF, or settings. The author approves the first write in the app (per write, or once for the whole session) and sees every write in the activity feed; a prompt they ignore times out as a denial.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'workspace-relative path of an existing file' },
        text: { type: 'string', description: 'new UTF-8 content (for text files)' },
        base64: { type: 'string', description: 'new binary content, base64 (for media)' },
        expected_hash: {
          type: 'string',
          description: 'the hash returned by seed_read_file for this path',
        },
      },
      required: ['path', 'expected_hash'],
    },
  },
];

const respond = (id, result) =>
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
const respondError = (id, code, message) =>
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');

// Writes are gated on the guide having been served THIS session: the bridge
// lives exactly one agent session, so this is "the current agent has the
// authoring contract in context" — enforcement, not a nudge. Reads stay open.
let guideServed = false;

async function handleToolCall(name, args) {
  switch (name) {
    case 'seed_get_authoring_guide':
      guideServed = true;
      return { guide: guideText };
    case 'seed_get_project_setup':
      return callTab('project_setup', {});
    case 'seed_project_info': {
      if (bindError) return { connected: false, error: bindError };
      const connected = !!tab && tab.readyState === 1;
      if (!connected) return { connected, hint: 'click "Allow agent assistance" in the SEED tab' };
      return { connected, ...(await callTab('project_info', {})) };
    }
    case 'seed_list_files':
      return callTab('list_files', {});
    case 'seed_read_file':
      return callTab('read_file', { path: args?.path });
    case 'seed_get_rendered_xhtml':
      return callTab('get_rendered_xhtml', {});
    case 'seed_get_selection':
      return callTab('get_selection', {});
    case 'seed_write_file':
      if (!guideServed) {
        throw new Error(
          'call seed_get_authoring_guide first — writes require the authoring contract in context (EPUB CSS fallbacks, generated-file boundaries, per-project transforms)'
        );
      }
      return callTab('write_file', {
        path: args?.path,
        text: args?.text,
        base64: args?.base64,
        expectedHash: args?.expected_hash,
      });
    default:
      throw new Error('unknown tool: ' + name);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', async line => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = request;
  try {
    switch (method) {
      case 'initialize':
        respond(id, {
          protocolVersion: params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'seed-agent-bridge', version: '0.1.0' },
        });
        break;
      case 'notifications/initialized':
        break; // notification, no response
      case 'ping':
        respond(id, {});
        break;
      case 'tools/list':
        respond(id, { tools: TOOLS });
        break;
      case 'tools/call': {
        try {
          const result = await handleToolCall(params?.name, params?.arguments);
          respond(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        } catch (error) {
          respond(id, {
            content: [{ type: 'text', text: String(error?.message ?? error) }],
            isError: true,
          });
        }
        break;
      }
      default:
        if (id !== undefined) respondError(id, -32601, 'method not found: ' + method);
    }
  } catch (error) {
    if (id !== undefined) respondError(id, -32603, String(error?.message ?? error));
  }
});

process.stderr.write(`[bridge] listening on ws://127.0.0.1:${PORT}, MCP on stdio\n`);
