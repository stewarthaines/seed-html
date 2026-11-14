<!--
  The plugin's root: reads the destinations once, then renders the surface the
  host named in `init` (process/PUBLISH_REWORK.md). An OAuth callback (Dropbox,
  a Solid provider) lands on this same document in a popup and posts the code,
  or the provider's refusal, back to its opener.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { surface } from './store.js';
  import { loadRemotes } from './remotes.js';
  import { showStatus } from './status.js';
  import { translate } from './i18n.js';
  import SendSurface from './components/SendSurface.svelte';
  import PublishedSurface from './components/PublishedSurface.svelte';
  import DestinationsSurface from './components/DestinationsSurface.svelte';
  import Toast from './components/Toast.svelte';

  let ready = $state(false);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    if (
      window.opener &&
      params.has('state') &&
      (params.has('code') || params.has('error'))
    ) {
      window.opener.postMessage(
        {
          type: 'oauth-callback',
          code: params.get('code'),
          state: params.get('state'),
          error: params.get('error'),
          errorDescription: params.get('error_description'),
        },
        window.location.origin,
      );
      window.close();
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
