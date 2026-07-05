/**
 * Audio Clip Editor Plugin — entry point.
 *
 * A `panel` plugin hosted in the spine item editor. Receives the project
 * workspace root OPFS handle from the host via `init`, lists the manifest's
 * audio files itself, and inserts clip directives at the editor cursor via the
 * `insert` message.
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';
import { dirHandle, projectId } from './store.js';
import { setPluginMessages } from './i18n.js';
import type { ContextMessage, InitMessage, MainToPlugin } from './types.js';

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.origin) {
    console.warn('Ignoring message from different origin:', event.origin);
    return;
  }

  const message: MainToPlugin = event.data;

  if (message.type === 'init') {
    handleInit(message);
  } else if (message.type === 'context') {
    handleContext(message);
  }
}

// Mirror the host's ambient environment onto our own document root: theme drives
// the [data-theme] CSS, lang/dir keep the iframe in sync with the app's locale.
function handleContext(message: ContextMessage) {
  const root = document.documentElement;
  root.setAttribute('data-theme', message.theme);
  root.lang = message.locale;
  root.dir = message.dir;
  setPluginMessages(message.messages ?? {});
}

function handleInit(message: InitMessage) {
  if (!message.projectId || message.opfsDirHandle?.kind !== 'directory') {
    console.error('Invalid init message: missing projectId or opfsDirHandle');
    return;
  }
  projectId.set(message.projectId);
  dirHandle.set(message.opfsDirHandle);
}

function initPlugin() {
  mount(App, { target: document.getElementById('app')! });
  window.addEventListener('message', handleMessage);
  window.parent.postMessage(
    {
      type: 'plugin-ready',
      pluginType: 'audio-clip-editor',
    },
    window.origin,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlugin);
} else {
  initPlugin();
}
