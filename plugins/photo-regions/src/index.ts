/**
 * Photo Regions Plugin — entry point.
 *
 * A `panel` plugin hosted in the spine item editor. Receives the project
 * workspace root OPFS handle from the host via `init`, reads the OPF manifest
 * itself to list images and chapter ids, and inserts a `photos:` frontmatter
 * block at the editor cursor via the `insert` message.
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';
import { activeChapterId, dirHandle, dirPath, projectId } from './store.js';
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
  activeChapterId.set(message.activeChapterId ?? null);
}

async function handleInit(message: InitMessage) {
  if (!message.projectId) {
    console.error('Invalid init message: missing projectId');
    return;
  }
  projectId.set(message.projectId);
  dirPath.set(Array.isArray(message.opfsDirPath) ? message.opfsDirPath : null);

  if (message.opfsDirHandle?.kind === 'directory') {
    dirHandle.set(message.opfsDirHandle);
    return;
  }

  // No handle rode the message (WebKit refuses to clone handles into
  // iframes) — walk the OPFS path to an equivalent handle ourselves: the
  // plugin iframe is same-origin, so it sees the same OPFS root.
  if (Array.isArray(message.opfsDirPath) && message.opfsDirPath.length > 0) {
    try {
      let dir = await navigator.storage.getDirectory();
      for (const segment of message.opfsDirPath) {
        dir = await dir.getDirectoryHandle(segment, { create: true });
      }
      dirHandle.set(dir);
      return;
    } catch (error) {
      console.error('Failed to resolve OPFS dir from path:', message.opfsDirPath, error);
      return;
    }
  }

  console.error('Invalid init message: no opfsDirHandle and no usable opfsDirPath');
}

function initPlugin() {
  mount(App, { target: document.getElementById('app')! });
  window.addEventListener('message', handleMessage);
  window.parent.postMessage(
    {
      type: 'plugin-ready',
      pluginType: 'photo-regions',
    },
    window.origin,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlugin);
} else {
  initPlugin();
}
