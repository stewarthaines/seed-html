import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(() => {
  return {
    // The plugin is distributed as a self-contained .html (no CDN at runtime),
    // built from plugin.html. The outline data (geo/, one small file per
    // country) is kept beside it and fetched on demand: copied into dist/geo/
    // so the served plugin folder carries it, the same relative path the dev
    // server answers from the source folder.
    plugins: [
      svelte(),
      viteSingleFile(),
      {
        name: "copy-geo",
        closeBundle() {
          cpSync(`${here}geo`, `${here}dist/geo`, { recursive: true });
        },
      },
    ],
    server: {
      hmr: true,
      port: 5175,
    },
    build: {
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
  };
});
