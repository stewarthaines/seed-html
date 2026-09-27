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

// Register the service worker over http(s): the offline app shell in the
// build, and the served book (process/PREVIEW_SERVED_BOOK.md) in the build and
// on the dev server, which serves the template at /sw.js in a mode that only
// serves books. The standalone single-file build opened via file:// can't
// register a worker, so it never tries.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed SW registration must never break the app.
    });
  });
}

export default app;
