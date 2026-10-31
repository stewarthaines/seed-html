/**
 * Accessible PDF plugin — entry point.
 *
 * A `view` plugin in the Make a PDF card's place on the Share page
 * (process/ACCESSIBLE_PDF_PDFKIT.md). The host lays the book out and measures
 * it; this plugin writes the tagged PDF with PDFKit and offers it to save.
 */
import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';
import { setPluginMessages } from './i18n.js';
import type { ContextMessage } from './types.js';

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.origin) return;
  const message = event.data as ContextMessage | { type?: string };
  // `init` hands over the output directory, which this plugin doesn't use.
  if (message.type === 'context') handleContext(message as ContextMessage);
}

// Mirror the host's theme, language and direction onto our own document.
function handleContext(message: ContextMessage) {
  const root = document.documentElement;
  root.setAttribute('data-theme', message.theme);
  root.lang = message.locale;
  root.dir = message.dir;
  setPluginMessages(message.messages ?? {});
}

function initPlugin() {
  mount(App, { target: document.getElementById('app')! });
  window.addEventListener('message', handleMessage);
  window.parent.postMessage({ type: 'plugin-ready', pluginType: 'accessible-pdf' }, window.origin);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlugin);
} else {
  initPlugin();
}
