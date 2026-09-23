/**
 * Publish-to-remote plugin - entry point
 *
 * The host mounts this document three times, naming a surface in `init`
 * (send / published / destinations); each frame receives the shared output
 * directory handle and renders only its surface (process/PUBLISH_REWORK.md).
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';
import {
  dirHandle,
  activeIdentifier,
  knownIdentifiers,
  surface,
} from './store.js';
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
  // Feed the active locale's dictionary to the plugin's `t` store.
  setPluginMessages(message.messages ?? {});
  // Track the open project so its published rows can be outlined.
  activeIdentifier.set(message.activeIdentifier);
  knownIdentifiers.set(new Set(message.knownIdentifiers ?? []));
}

async function handleInit(message: InitMessage) {
  const { projectId, opfsDirHandle, opfsDirPath } = message;

  if (!projectId) {
    console.error('Invalid init message: missing projectId');
    return;
  }

  if (message.surface) {
    surface.set(message.surface);
    // The published surface fills its frame; the others are content-height
    // (the host measures the body), so the stylesheet keys off this.
    document.documentElement.dataset.surface = message.surface;
  }

  if (opfsDirHandle && typeof opfsDirHandle === 'object') {
    dirHandle.set(opfsDirHandle);
    return;
  }

  // No handle rode the message (WebKit refuses to clone handles into
  // iframes) — walk the OPFS path to an equivalent handle ourselves: the
  // plugin iframe is same-origin, so it sees the same OPFS root.
  if (Array.isArray(opfsDirPath) && opfsDirPath.length > 0) {
    try {
      let dir = await navigator.storage.getDirectory();
      for (const segment of opfsDirPath) {
        dir = await dir.getDirectoryHandle(segment, { create: true });
      }
      dirHandle.set(dir);
      return;
    } catch (error) {
      console.error('Failed to resolve OPFS dir from path:', opfsDirPath, error);
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
      pluginType: 'publish-to-remote',
    },
    window.origin,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlugin);
} else {
  initPlugin();
}

// Export for use in module systems
export type {
  InitMessage,
  MainToPlugin,
  S3Credentials,
  S3Object,
} from './types.js';
export {
  findEpubFile,
  readEpubFile,
  getEpubBlob,
  readCredentials,
  writeCredentials,
  deleteCredentials,
} from './opfs.js';
export {
  uploadToS3,
  listObjects,
  deleteObject,
  getPublicUrl,
} from './s3-upload.js';
