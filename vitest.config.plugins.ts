import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Browser-mode tests for the host ↔ plugin boundary and for plugin code that
 * needs a real browser (real Chromium via Playwright): the OPFS handle
 * hand-off, and the audio plugin's recorder (MediaRecorder, decodeAudioData,
 * the WASM encoder). Separate from the happy-dom/jsdom unit suite; run with
 * `npm run test:plugins`.
 */
export default defineConfig({
  plugins: [svelte()],
  test: {
    name: 'plugins',
    include: ['src/lib/plugins/**/*.browser.test.ts', 'plugins/*/src/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      // Audio must run without a user gesture for the recorder test.
      instances: [
        { browser: 'chromium', launch: { args: ['--autoplay-policy=no-user-gesture-required'] } },
      ],
    },
  },
});
