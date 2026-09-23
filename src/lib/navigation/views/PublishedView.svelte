<!--
  PublishedView — the Published page beside Books: every book on a destination
  and whether it is in the destination's catalog. The page is the publish
  plugin's `published` surface filling the frame; the host adds the heading
  and routes the plugin's requests (import a book, open Settings › Destinations).
  Reachable only while the plugin is on (process/PUBLISH_REWORK.md).
-->
<script lang="ts">
  import { t } from '$lib/i18n';
  import type { OpenMessage } from '$lib/plugins/contract';
  import PluginFrame from '$lib/components/plugins/PluginFrame.svelte';
  import { openEpubUrlInReader } from '$lib/reader/open-in-reader';

  interface Props {
    pluginUrl: string;
    getDirHandle: () => Promise<FileSystemDirectoryHandle | null>;
    /** dc:identifiers of every book on this device. */
    knownIdentifiers: string[];
    /** The plugin fetched a remote EPUB; the host imports it. */
    onImportEpub: (filename: string, bytes: ArrayBuffer) => void;
    onOpen: (target: OpenMessage['target']) => void;
  }

  let { pluginUrl, getDirHandle, knownIdentifiers, onImportEpub, onOpen }: Props = $props();

  function handleRead(source: { filename?: string; url?: string }): void {
    if (source.url) openEpubUrlInReader(source.url);
  }
</script>

<div class="published-view">
  <div class="published-page">
    <h1 class="page-title">{$t('Published')}</h1>
    <p class="status-line">
      {$t('Every book on a destination, and whether it is in the destination’s catalog.')}
    </p>
    <div class="frame">
      <PluginFrame
        {pluginUrl}
        surface="published"
        {getDirHandle}
        {knownIdentifiers}
        title={$t('Published')}
        fill
        onReadEpub={handleRead}
        {onImportEpub}
        {onOpen}
      />
    </div>
  </div>
</div>

<style>
  .published-view {
    block-size: 100%;
    background: var(--color-bg-primary);
  }

  .published-page {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    max-inline-size: 1040px;
    margin-inline: auto;
    padding-block: var(--space-8) 0;
    padding-inline: var(--space-6);
  }

  .page-title {
    margin: 0 0 var(--space-1);
    font-size: var(--text-4xl);
    font-weight: var(--font-bold);
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
  }

  .status-line {
    margin: 0 0 var(--space-5);
    color: var(--color-text-secondary);
  }

  .frame {
    flex: 1;
    min-block-size: 0;
  }

  @media (max-width: 720px) {
    .published-page {
      padding-block-start: var(--space-6);
      padding-inline: var(--space-4);
    }
  }
</style>
