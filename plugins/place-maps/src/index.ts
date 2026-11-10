/**
 * Place Maps Plugin — entry point.
 *
 * A `panel` plugin hosted in the spine item editor (process/PLACE_MAPS.md).
 * Receives the workspace root OPFS handle via `init` and the open chapter via
 * `context`; lists the places that chapter's records use (the neutral list
 * family-history writes), geocodes one on request, draws its locator map,
 * adds the file through the host's `add-media`, keeps the register, and
 * inserts the map directive through `insert`.
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';
import { activeChapterId, dirHandle, dirPath } from './store.js';
import { setPluginMessages } from './i18n.js';
import { answerMediaAdded } from './host.js';
import type { ContextMessage, InitMessage, MainToPlugin } from './types.js';

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.origin) return;
  const message: MainToPlugin = event.data;
  if (message.type === 'init') void handleInit(message);
  else if (message.type === 'context') handleContext(message);
  else if (message.type === 'media-added') answerMediaAdded(message);
}

function handleContext(message: ContextMessage) {
  const root = document.documentElement;
  root.setAttribute('data-theme', message.theme);
  root.lang = message.locale;
  root.dir = message.dir;
  setPluginMessages(message.messages ?? {});
  activeChapterId.set(message.activeChapterId ?? null);
}

async function handleInit(message: InitMessage) {
  dirPath.set(Array.isArray(message.opfsDirPath) ? message.opfsDirPath : null);
  if (message.opfsDirHandle?.kind === 'directory') {
    dirHandle.set(message.opfsDirHandle);
    return;
  }
  // WebKit refuses to clone handles into iframes: walk the same OPFS path.
  if (Array.isArray(message.opfsDirPath) && message.opfsDirPath.length > 0) {
    try {
      let dir = await navigator.storage.getDirectory();
      for (const segment of message.opfsDirPath) {
        dir = await dir.getDirectoryHandle(segment, { create: true });
      }
      dirHandle.set(dir);
    } catch (error) {
      console.error('place-maps: could not resolve the workspace folder', error);
    }
  }
}

function initPlugin() {
  mount(App, { target: document.getElementById('app')! });
  window.addEventListener('message', handleMessage);
  window.parent.postMessage({ type: 'plugin-ready', pluginType: 'place-maps' }, window.origin);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPlugin);
else initPlugin();
