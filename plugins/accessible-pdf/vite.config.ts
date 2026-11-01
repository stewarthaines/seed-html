import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(() => {
  return {
    // The plugin is distributed as a self-contained .html (no CDN at runtime),
    // built from plugin.html: PDFKit and fontkit are bundled into it.
    plugins: [svelte(), viteSingleFile()],
    build: {
      target: 'es2022',
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        input: 'plugin.html',
      },
    },
    optimizeDeps: {
      esbuildOptions: { target: 'es2022' },
    },
  };
});
