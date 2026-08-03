#!/usr/bin/env node
/**
 * seed-html — run the packaged SEED.html app on a local server.
 *
 *   npx @stewarthaines/seed-html            serve the app and open the browser
 *   npx @stewarthaines/seed-html --port N   pick a port (default 8417, walks up if taken)
 *   npx @stewarthaines/seed-html --no-open  don't launch the browser
 *   npx @stewarthaines/seed-html bridge     run the agent bridge (MCP over stdio)
 *
 * `bridge` is for coding agents, registered e.g. with:
 *   claude mcp add seed-bridge -- npx -y @stewarthaines/seed-html bridge
 */
if (process.argv[2] === 'bridge') {
  // The bridge speaks MCP on stdio and runs on import; keep this process clean
  // of any server output.
  await import('../scripts/agent-bridge.mjs');
} else {
  const { serve } = await import('../lib/serve.mjs');
  serve(process.argv.slice(2));
}
