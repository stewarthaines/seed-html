import { mount } from 'svelte';
import './styles/index.css';
import App from './App.svelte';
import { initI18n } from './lib/i18n';

// Initialize i18n system
initI18n().catch(error => {
  console.error('Failed to initialize i18n:', error);
});

const app = mount(App, {
  target: document.getElementById('app')!,
});

// Register the offline-PWA service worker. Only in production over http(s): dev
// has no emitted sw.js, and the standalone single-file build opened via file://
// can't register a worker — both would just error.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  location.protocol.startsWith('http')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed SW registration must never break the app.
    });
  });
}

export default app;
