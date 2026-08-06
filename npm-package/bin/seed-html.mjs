#!/usr/bin/env node
/**
 * seed-html — run the packaged SEED.html app on a local server.
 *
 *   npx seed-html            serve the app and open the browser
 *   npx seed-html --port N   pick a port (default 8417, walks up if taken)
 *   npx seed-html --no-open  don't launch the browser
 *   npx seed-html bridge     run the agent bridge (MCP over stdio)
 *
 * `bridge` is for coding agents, registered e.g. with:
 *   claude mcp add seed-bridge -- npx -y seed-html bridge
 */
if (process.argv[2] === 'bridge') {
  // The bridge speaks MCP on stdio and runs on import; keep this process clean
  // of any server output.
  await import('../scripts/agent-bridge.mjs');
} else {
  const { serve } = await import('../lib/serve.mjs');
  serve(process.argv.slice(2));
}
