<!--
  The plugin's root: reads the destinations once, then renders the surface the
  host named in `init` (process/PUBLISH_REWORK.md). An OAuth callback (Dropbox,
  a Solid provider) lands on this same document in a popup and posts the code,
  or the provider's refusal, back to its opener. It also broadcasts it on a
  same-origin channel, which still reaches the plugin when the provider's
  pages have cut the popup's link to its opener.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { surface } from './store.js';
  import { loadRemotes } from './remotes.js';
  import { showStatus } from './status.js';
  import { translate } from './i18n.js';
  import { OAUTH_CHANNEL } from './oauth-channel.js';
  import SendSurface from './components/SendSurface.svelte';
  import PublishedSurface from './components/PublishedSurface.svelte';
  import DestinationsSurface from './components/DestinationsSurface.svelte';
  import Toast from './components/Toast.svelte';

  let ready = $state(false);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('state') && (params.has('code') || params.has('error'))) {
      const message = {
        type: 'oauth-callback',
        code: params.get('code'),
        state: params.get('state'),
        error: params.get('error'),
        errorDescription: params.get('error_description'),
      };
      window.opener?.postMessage(message, window.location.origin);
      try {
        const channel = new BroadcastChannel(OAUTH_CHANNEL);
        channel.postMessage(message);
        channel.close();
      } catch {
        // no BroadcastChannel: the opener message is all there is
      }
      // Give the messages a moment to cross before the window goes.
      setTimeout(() => window.close(), 300);
      return;
    }
    try {
      await loadRemotes();
    } catch (error) {
      showStatus(
        translate('Failed to load config: {error}', { error: String(error) }),
        'error',
      );
    }
    ready = true;
  });
</script>

<div class="plugin-container" class:fill={$surface === 'published'}>
  {#if ready}
    {#if $surface === 'published'}
      <PublishedSurface />
    {:else if $surface === 'destinations'}
      <DestinationsSurface />
    {:else}
      <SendSurface />
    {/if}
  {/if}
  <Toast />
</div>

<style>
  .plugin-container {
    display: flex;
    flex-direction: column;
  }

  .plugin-container.fill {
    block-size: 100%;
    min-block-size: 0;
  }
</style>
