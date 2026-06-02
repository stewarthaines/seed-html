import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [svelte()],
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
      sourcemap: true,
    },
    optimizeDeps: {
      esbuildOptions: { target: "es2022" },
    },
    test: {
      environment: "jsdom",
      exclude: ["dist/**", "node_modules/**"],
    },
    define: {
      "import.meta.env.VITE_DROPBOX_APP_KEY": JSON.stringify(
        env.VITE_DROPBOX_APP_KEY,
      ),
      "import.meta.env.VITE_DROPBOX_REDIRECT_URI": JSON.stringify(
        env.VITE_DROPBOX_REDIRECT_URI,
      ),
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(
        env.VITE_GOOGLE_CLIENT_ID,
      ),
      "import.meta.env.VITE_GOOGLE_API_KEY": JSON.stringify(
        env.VITE_GOOGLE_API_KEY,
      ),
    },
  };
});
