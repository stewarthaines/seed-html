<!--
  Host for a `panel`-presentation plugin (see src/lib/plugins/API.md): an iframe
  embedded inside an editor surface, driven by the same postMessage contract as
  the full-frame `view` plugins (PublishView.svelte is the reference host).

  The plugin owns the panel only after completing the `plugin-ready` handshake
  within a grace period; on failure — offline with an uncached plugin.html, a
  404, a crashed plugin, or no OPFS backend to hand over — the `fallback`
  snippet (typically the built-in feature) renders instead, with a retry
  affordance.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t, currentLocale, documentDirection, i18nService } from '$lib/i18n';
  import { themeStore } from '$lib/stores/theme';
  import {
    createInitMessage,
    createContextMessage,
    isPluginReadyMessage,
    isInsertMessage,
  } from '$lib/plugins/contract';

  interface Props {
    /** Resolved iframe src for the plugin (from resolvePluginEntryUrl). */
    pluginUrl: string;
    /** Identifier echoed to the plugin in its `init` message. */
    projectId: string;
    /** Directory handle handed over in `init`; null (no OPFS backend) fails over. */
    getDirHandle: () => Promise<FileSystemDirectoryHandle | null>;
    /** Receives the payload of the plugin's `insert` messages. */
    onInsert?: (content: string) => void;
    /** Accessible iframe title. */
    title: string;
    /** Rendered instead of the iframe when the plugin fails to come alive. */
    fallback?: Snippet;
  }

  let { pluginUrl, projectId, getDirHandle, onInsert, title, fallback }: Props = $props();

  let pluginFrame = $state<HTMLIFrameElement | null>(null);
  let pluginReady = $state(false);
  let pluginFailed = $state(false);
  let pluginAttempt = $state(0);
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let capTimer: ReturnType<typeof setTimeout> | undefined;

  // Route the plugin's messages: the handshake arms the hand-over, `insert`
  // forwards to the host callback. Same source/origin gating as PublishView.
  $effect(() => {
    if (pluginFailed) return;
    const handler = (event: MessageEvent) => {
      if (!pluginFrame || event.source !== pluginFrame.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      if (isPluginReadyMessage(event.data)) {
        pluginReady = true;
        clearTimeout(readyTimer);
        clearTimeout(capTimer);
        void sendPluginInit();
        sendPluginContext();
      } else if (isInsertMessage(event.data)) {
        onInsert?.(event.data.content);
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
      // No OPFS backend (e.g. the IndexedDB fallback) — the plugin can't work
      // without a handle, and the built-in fallback can. Fail over.
      pluginFailed = true;
      return;
    }
    const targetOrigin = new URL(pluginUrl, window.location.href).origin;
    frameWindow.postMessage(createInitMessage(projectId, handle), targetOrigin);
  }

  // Hand the ambient app environment (theme/locale/dir + the active locale's
  // dictionary) to the plugin so it mirrors the app on its own document.
  function sendPluginContext(): void {
    const frameWindow = pluginFrame?.contentWindow;
    if (!frameWindow) return;
    const targetOrigin = new URL(pluginUrl, window.location.href).origin;
    const dir = $documentDirection === 'rtl' ? 'rtl' : 'ltr';
    const messages = i18nService.getCatalogs()[$currentLocale]?.messages ?? {};
    frameWindow.postMessage(
      createContextMessage($themeStore.current, $currentLocale, dir, messages),
      targetOrigin
    );
  }

  // Re-send context whenever the theme, locale, or direction changes, so the
  // iframe tracks the app live — no reload, no lost plugin state.
  $effect(() => {
    if (!pluginReady || pluginFailed) return;
    void $themeStore.current;
    void $currentLocale;
    void $documentDirection;
    sendPluginContext();
  });

  // (Re)arm failure detection whenever the panel mounts or a retry is requested.
  // `onerror` doesn't fire for a failed iframe navigation, so liveness is judged
  // purely by the handshake (fast onload grace + slow backstop).
  $effect(() => {
    void pluginAttempt; // re-arm on retry
    pluginReady = false;
    pluginFailed = false;
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
  <div class="plugin-panel-fallback" role="status">
    <span class="plugin-panel-fallback-text">
      {$t('The plugin could not be loaded — you may be offline.')}
    </span>
    <button type="button" class="btn btn-secondary btn-sm" onclick={retryPlugin}>
      {$t('Retry plugin')}
    </button>
  </div>
  {@render fallback?.()}
{:else}
  {#key pluginAttempt}
    <iframe
      bind:this={pluginFrame}
      class="plugin-panel-frame"
      src={pluginUrl}
      {title}
      onload={handlePluginFrameLoad}
    ></iframe>
  {/key}
{/if}

<style>
  .plugin-panel-frame {
    width: 100%;
    /* Panel height: enough for the plugin's controls without dominating the
       editor column; the embedding container may override via height on the
       wrapper it renders this component into. */
    height: 16rem;
    border: 0;
    display: block;
  }

  .plugin-panel-fallback {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
    background-color: var(--color-bg-accent);
    font-size: var(--text-sm);
  }

  .plugin-panel-fallback-text {
    flex: 1;
    min-width: 12rem;
    color: var(--color-text-secondary);
  }
</style>
