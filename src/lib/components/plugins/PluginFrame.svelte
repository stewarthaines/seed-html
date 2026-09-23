<!--
  Host for one surface of a `view`-style plugin (src/lib/plugins/API.md): the
  iframe, the `plugin-ready` handshake with failure fallback, the `init` (with
  the surface) and `context` messages, and the routing of the plugin's own
  messages to callbacks. The publish plugin is mounted this way three times:
  the Send band on Share, the Published page and the Destinations section of
  Settings (process/PUBLISH_REWORK.md).

  A frame is either content-height (the host watches the plugin document's
  height, same-origin, like PluginPanel) or fills its container.
-->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { t, currentLocale, documentDirection, i18nService } from '$lib/i18n';
  import { themeStore } from '$lib/stores/theme';
  import {
    createInitMessage,
    createContextMessage,
    isPluginReadyMessage,
    isNavigateMessage,
    isReadEpubMessage,
    isImportEpubMessage,
    isOpenMessage,
    workspaceOpfsPath,
    type PluginSurface,
    type OpenMessage,
  } from '$lib/plugins/contract';
  import { PUBLISH_WORKSPACE_ID } from '$lib/workspace/types';

  interface Props {
    /** Resolved iframe src for the plugin (from resolvePluginEntryUrl). */
    pluginUrl: string;
    /** Which surface this frame shows. */
    surface: PluginSurface;
    /** Identifier echoed to the plugin in its `init` message. */
    projectId?: string;
    /** The shared output directory handed over in `init`; null (no OPFS) fails over. */
    getDirHandle: () => Promise<FileSystemDirectoryHandle | null>;
    /** The open book's dc:identifier, for the Send band. */
    activeIdentifier?: string;
    /** dc:identifiers of every book on this device, for the shelf. */
    knownIdentifiers?: string[];
    /** Accessible iframe title. */
    title: string;
    /** Content-height (default) or fill the container. */
    fill?: boolean;
    /** Re-send `init` whenever this changes (a new package was made). */
    refreshKey?: number;
    onNavigate?: (path: string) => void;
    onReadEpub?: (source: { filename?: string; url?: string }) => void;
    onImportEpub?: (filename: string, bytes: ArrayBuffer) => void;
    onOpen?: (target: OpenMessage['target']) => void;
    /** Rendered instead of the iframe when the plugin fails to come alive. */
    fallback?: Snippet;
  }

  let {
    pluginUrl,
    surface,
    projectId = PUBLISH_WORKSPACE_ID,
    getDirHandle,
    activeIdentifier,
    knownIdentifiers,
    title,
    fill = false,
    refreshKey = 0,
    onNavigate,
    onReadEpub,
    onImportEpub,
    onOpen,
    fallback,
  }: Props = $props();

  let pluginFrame = $state<HTMLIFrameElement | null>(null);
  let pluginReady = $state(false);
  let pluginFailed = $state(false);
  let pluginAttempt = $state(0);
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let capTimer: ReturnType<typeof setTimeout> | undefined;

  // Content-driven height for the in-flow surfaces: same-origin, so the host
  // reads the plugin document's height directly. The plugin body must be
  // auto-height on those surfaces.
  let contentHeight = $state<number | null>(null);
  $effect(() => {
    if (fill || !pluginReady || pluginFailed) return;
    const body = pluginFrame?.contentDocument?.body;
    if (!body) return;
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(body.scrollHeight);
      if (height > 0) contentHeight = height;
    });
    observer.observe(body);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (pluginFailed) return;
    const handler = (event: MessageEvent) => {
      if (!pluginFrame || event.source !== pluginFrame.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (isPluginReadyMessage(data)) {
        pluginReady = true;
        clearTimeout(readyTimer);
        clearTimeout(capTimer);
        void sendPluginInit();
        sendPluginContext();
      } else if (isNavigateMessage(data)) {
        onNavigate?.(data.path);
      } else if (isReadEpubMessage(data)) {
        onReadEpub?.({ filename: data.filename, url: data.url });
      } else if (isImportEpubMessage(data)) {
        onImportEpub?.(data.filename, data.bytes);
      } else if (isOpenMessage(data)) {
        onOpen?.(data.target);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  });

  async function sendPluginInit(): Promise<void> {
    const frameWindow = pluginFrame?.contentWindow;
    if (!frameWindow) return;
    const handle = await getDirHandle();
    if (!handle) {
      // No OPFS backend (the IndexedDB fallback): nothing to hand over.
      pluginFailed = true;
      return;
    }
    const targetOrigin = new URL(pluginUrl, window.location.href).origin;
    const dirPath = workspaceOpfsPath(PUBLISH_WORKSPACE_ID);
    try {
      frameWindow.postMessage(createInitMessage(projectId, handle, dirPath, surface), targetOrigin);
    } catch {
      // WebKit refuses to clone a directory handle into an iframe; the plugin
      // walks the path instead (same origin, same OPFS root).
      frameWindow.postMessage(
        createInitMessage(projectId, undefined, dirPath, surface),
        targetOrigin
      );
    }
  }

  function sendPluginContext(): void {
    const frameWindow = pluginFrame?.contentWindow;
    if (!frameWindow) return;
    const targetOrigin = new URL(pluginUrl, window.location.href).origin;
    const dir = $documentDirection === 'rtl' ? 'rtl' : 'ltr';
    const messages = i18nService.getCatalogs()[$currentLocale]?.messages ?? {};
    frameWindow.postMessage(
      createContextMessage(
        $themeStore.current,
        $currentLocale,
        dir,
        messages,
        activeIdentifier,
        undefined,
        knownIdentifiers
      ),
      targetOrigin
    );
  }

  // Context follows the app live: theme, locale, direction, the open book and
  // the books on this device.
  $effect(() => {
    if (!pluginReady || pluginFailed) return;
    void $themeStore.current;
    void $currentLocale;
    void $documentDirection;
    void activeIdentifier;
    void knownIdentifiers;
    sendPluginContext();
  });

  // A fresh package: hand the directory over again so the plugin re-reads it.
  // Only the key is tracked; the handshake sends its own first init.
  $effect(() => {
    void refreshKey;
    untrack(() => {
      if (pluginReady && !pluginFailed) void sendPluginInit();
    });
  });

  // Liveness is the handshake: `onerror` never fires for a failed navigation.
  $effect(() => {
    void pluginAttempt;
    pluginReady = false;
    pluginFailed = false;
    contentHeight = null;
    capTimer = setTimeout(() => {
      if (!pluginReady) pluginFailed = true;
    }, 20000);
    return () => {
      clearTimeout(capTimer);
      clearTimeout(readyTimer);
    };
  });

  function handlePluginFrameLoad(): void {
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      if (!pluginReady) pluginFailed = true;
    }, 2000);
  }

  function retryPlugin(): void {
    pluginAttempt += 1;
  }
</script>

{#if pluginFailed}
  <div class="plugin-fallback" role="status">
    <p class="plugin-fallback-text">
      {$t('The publishing plugin could not be loaded — you may be offline.')}
    </p>
    <button type="button" class="btn btn-secondary btn-sm" onclick={retryPlugin}>
      {$t('Retry plugin')}
    </button>
  </div>
  {@render fallback?.()}
{:else}
  {#key pluginAttempt}
    <iframe
      bind:this={pluginFrame}
      class="plugin-frame"
      class:fill
      style:height={!fill && contentHeight ? `${contentHeight}px` : undefined}
      src={pluginUrl}
      {title}
      onload={handlePluginFrameLoad}
    ></iframe>
  {/key}
{/if}

<style>
  .plugin-frame {
    display: block;
    inline-size: 100%;
    border: 0;
    background: transparent;
    /* Until the first measurement, room for a short list. */
    block-size: 160px;
  }

  .plugin-frame.fill {
    block-size: 100%;
    min-block-size: 0;
  }

  .plugin-fallback {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-tertiary);
  }

  .plugin-fallback-text {
    flex: 1;
    min-inline-size: 16rem;
    margin: 0;
    color: var(--color-text-secondary);
  }
</style>
