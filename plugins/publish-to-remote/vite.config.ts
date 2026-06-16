import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(() => {
  return {
    // The plugin is distributed as a self-contained .html (no CDN at runtime),
    // built from plugin.html (plugin-test.html is the dev-only host harness).
    plugins: [svelte(), viteSingleFile()],
    server: {
      // open: '/test.html',
      hmr: true,
      port: 5173,
    },
    build: {
      // es2022 supports top-level await (libxml2-wasm, via epubcheck-ts, uses it).
      // Vite 7+ defaulted to a TLA-capable target; on Vite 6 we set it explicitly.
      target: "es2022",
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        input: "plugin.html",
      },
    },
    optimizeDeps: {
      esbuildOptions: { target: "es2022" },
    },
    test: {
      environment: "jsdom",
      exclude: ["dist/**", "node_modules/**"],
    },
  };
});
