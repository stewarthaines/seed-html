<!--
  The Send band on Share: what the open book's latest package is doing on each
  destination, one Send per row, an "In the catalog" switch where the
  destination has a catalog (one switch per catalog when it carries several). The head names the latest package with its
  epubcheck state; the foot links to the host's Published page and to the
  Destinations settings (process/PUBLISH_REWORK.md).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { t, translate } from '../i18n.js';
  import { dirHandle, activeIdentifier } from '../store.js';
  import { remotesStore, remotesLoaded, contentVersions } from '../remotes.js';
  import {
    loadLocalPackages,
    latestPackageFor,
    type LocalPackage,
  } from '../local-packages.js';
  import {
    listRemote,
    sendStateFor,
    identifiersOnRemote,
    type RemoteListing,
    type SendState,
  } from '../remote-status.js';
  import { hasCatalog, loadCatalogs, type CatalogInfo } from '../catalog.js';
  import { sendPackage, setInCatalog } from '../send.js';
  import { reconnectGoogle, reconnectDevice } from '../reconnect.js';
  import { showStatus } from '../status.js';
  import { formatFileSize, relativeTime } from '../format.js';
  import {
    validateEpub,
    saveValidationReport,
    loadValidationReport,
    deleteValidationReport,
    publishLatestReport,
    clearLatestReport,
    summarizeReport,
    type ValidationReport,
  } from '../epub-validation.js';
  import type { NavigateMessage, OpenMessage, RemoteConfig } from '../types.js';
  import DestinationBadge from './DestinationBadge.svelte';
  import Switch from './Switch.svelte';
  import ValidationModal from './ValidationModal.svelte';

  // --- This book's packages ------------------------------------------------
  let packages = $state<LocalPackage[]>([]);
  const latest = $derived(latestPackageFor(packages, $activeIdentifier));

  // Reload on every hand-over of the directory (the host re-sends init after
  // packaging), and when the open book changes.
  $effect(() => {
    const dir = $dirHandle;
    if (!dir) return;
    void reloadPackages(dir);
  });

  async function reloadPackages(dir: FileSystemDirectoryHandle) {
    try {
      packages = await loadLocalPackages(dir);
    } catch (error) {
      showStatus(
        translate('Failed to load EPUBs: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  // --- Validation of the latest package -------------------------------------
  let report = $state<ValidationReport | null>(null);
  let validating = $state(false);
  let showReport = $state(false);
  const summary = $derived(report ? summarizeReport(report) : null);

  $effect(() => {
    const current = latest;
    report = null;
    if (!current) return;
    void (async () => {
      let saved = await loadValidationReport(current.name);
      // A report older than the file is about a package that no longer exists.
      if (saved && current.lastModified > saved.timestamp) {
        await deleteValidationReport(current.name);
        clearLatestReport(current.name);
        saved = null;
      }
      if (latest === current) report = saved;
    })();
  });

  async function validate() {
    if (!latest) return;
    validating = true;
    try {
      const result = await validateEpub(latest.file, latest.identifier);
      await saveValidationReport(result);
      publishLatestReport(result);
      report = result;
      if (result.errorCount > 0 || result.warningCount > 0) showReport = true;
    } catch (error) {
      showStatus(
        translate('Validation failed: {error}', { error: String(error) }),
        'error',
      );
    } finally {
      validating = false;
    }
  }

  function openReport() {
    if (!report) return;
    publishLatestReport(report);
    showReport = true;
  }

  function onValidationNavigate(path: string) {
    const message: NavigateMessage = { type: 'navigate', path };
    window.parent.postMessage(message, window.origin);
  }

  // --- Each destination's listing and catalog --------------------------------
  interface RowData {
    listing: RemoteListing | null;
    /** Every feed on the destination, its own first; empty until listed. */
    catalogs: CatalogInfo[];
    sending: number | null;
    /** The feed being rewritten, by file. */
    toggling: string | null;
  }
  const rows: Map<string, RowData> = new SvelteMap();

  function rowFor(id: string): RowData {
    return (
      rows.get(id) ?? {
        listing: null,
        catalogs: [],
        sending: null,
        toggling: null,
      }
    );
  }

  async function refreshRow(remote: RemoteConfig) {
    const listing = await listRemote(remote);
    const catalogs =
      hasCatalog(remote) && listing.reach === 'ok'
        ? await loadCatalogs(remote, listing.objects)
        : [];
    rows.set(remote.id, { ...rowFor(remote.id), listing, catalogs });
  }

  // Entries from every feed, for matching a book that only a feed names.
  function entriesOf(row: RowData) {
    return row.catalogs.flatMap((c) => c.entries);
  }

  // List every destination once the list is known, and again when another
  // frame changes one (a send from Published, a removal in Settings). Only
  // the destinations and the change counters are tracked: `rows` is read
  // untracked, or every listing that lands would re-list the ones still
  // pending (five destinations became fifteen listings).
  const listedVersions = new Map<string, number>();
  $effect(() => {
    if (!$remotesLoaded) return;
    const versions = $contentVersions;
    const remotes = $remotesStore.remotes;
    untrack(() => {
      for (const remote of remotes) {
        const version = versions[remote.id] ?? 0;
        if (listedVersions.get(remote.id) === version) continue;
        listedVersions.set(remote.id, version);
        void refreshRow(remote);
      }
      for (const id of [...rows.keys()]) {
        if (!remotes.some((r) => r.id === id)) {
          rows.delete(id);
          listedVersions.delete(id);
        }
      }
    });
  });

  function stateFor(remote: RemoteConfig, row: RowData): SendState | null {
    if (!row.listing || row.listing.reach !== 'ok') return null;
    return sendStateFor(
      remote,
      row.listing.objects,
      packages,
      entriesOf(row),
      $activeIdentifier,
    );
  }

  // The keys of this book's packages on a destination (for the switch).
  function keysOfBook(remote: RemoteConfig, row: RowData): string[] {
    if (!row.listing || !$activeIdentifier) return [];
    const ids = identifiersOnRemote(
      remote,
      row.listing.objects,
      packages,
      entriesOf(row),
    );
    return [...ids]
      .filter(([, id]) => id === $activeIdentifier)
      .map(([key]) => key);
  }

  function inCatalog(
    remote: RemoteConfig,
    row: RowData,
    catalog: CatalogInfo,
  ): boolean {
    return keysOfBook(remote, row).some((key) => catalog.keys.has(key));
  }

  // --- Actions ----------------------------------------------------------------
  async function send(remote: RemoteConfig) {
    if (!latest) return;
    rows.set(remote.id, { ...rowFor(remote.id), sending: 0 });
    const result = await sendPackage(remote, latest, packages, (percent) => {
      rows.set(remote.id, { ...rowFor(remote.id), sending: percent });
    });
    rows.set(remote.id, {
      ...rowFor(remote.id),
      sending: null,
      listing: result.listing ?? rowFor(remote.id).listing,
    });
    // The send may have changed the destination's own feed; read them all again.
    if (result.listing?.reach === 'ok' && hasCatalog(remote)) {
      const catalogs = await loadCatalogs(remote, result.listing.objects);
      rows.set(remote.id, { ...rowFor(remote.id), catalogs });
    }
    if (result.success) {
      showStatus(
        remote.type === 'device'
          ? translate(
              '{name} copied — eject the device to finish adding the book',
              {
                name: latest.name,
              },
            )
          : translate('Sent to {name}', { name: remote.name }),
        'success',
      );
    } else {
      showStatus(result.error || translate('Upload failed'), 'error');
      if (result.listing?.reach !== 'ok') void refreshRow(remote);
    }
  }

  async function toggleCatalog(
    remote: RemoteConfig,
    catalog: CatalogInfo,
    include: boolean,
  ) {
    const row = rowFor(remote.id);
    if (!row.listing) return;
    rows.set(remote.id, { ...row, toggling: catalog.file });
    const result = await setInCatalog(
      remote,
      row.listing,
      catalog,
      keysOfBook(remote, row),
      include,
      packages,
    );
    const after = rowFor(remote.id);
    rows.set(remote.id, {
      ...after,
      toggling: null,
      catalogs: result.catalog
        ? after.catalogs.map((c) =>
            c.file === catalog.file ? result.catalog! : c,
          )
        : after.catalogs,
    });
    if (!result.success)
      showStatus(result.error || translate('Catalog update failed'), 'error');
  }

  async function reconnect(remote: RemoteConfig) {
    try {
      if (remote.type === 'google-drive') {
        await reconnectGoogle(remote);
      } else if (remote.type === 'device') {
        const ok = await reconnectDevice(remote);
        if (!ok) {
          showStatus(
            translate('Choose the device again in Settings › Destinations.'),
            'info',
          );
          return;
        }
      }
      const current =
        $remotesStore.remotes.find((r) => r.id === remote.id) ?? remote;
      await refreshRow(current);
    } catch (error) {
      showStatus(
        translate('Authorization failed: {error}', { error: String(error) }),
        'error',
      );
    }
  }

  function open(target: OpenMessage['target']) {
    const message: OpenMessage = { type: 'open', target };
    window.parent.postMessage(message, window.origin);
  }
</script>

<div class="send-surface">
  <div class="head">
    {#if latest}
      <span class="package-name">{latest.name}</span>
      <span class="muted">· {formatFileSize(latest.size)}</span>
      {#if summary}
        {#if summary.error > 0}
          <span class="check invalid">
            {summary.error === 1
              ? $t('{n} error', { n: summary.error })
              : $t('{n} errors', { n: summary.error })}
          </span>
        {:else if summary.warning > 0}
          <span class="check warning">
            {summary.warning === 1
              ? $t('{n} warning', { n: summary.warning })
              : $t('{n} warnings', { n: summary.warning })}
          </span>
        {:else}
          <span class="check valid">{$t('Valid EPUB')}</span>
        {/if}
        <button type="button" class="btn btn-link" onclick={openReport}
          >{$t('Report')}</button
        >
      {:else}
        <span class="muted">· {$t('Not checked')}</span>
        <button
          type="button"
          class="btn btn-link"
          onclick={validate}
          disabled={validating}
        >
          {validating ? $t('Validating...') : $t('Validate')}
        </button>
      {/if}
    {:else}
      <span class="muted">{$t('No package yet.')}</span>
    {/if}
  </div>

  {#if !$remotesLoaded}
    <p class="empty">{$t('Loading…')}</p>
  {:else if $remotesStore.remotes.length === 0}
    <p class="empty">
      {$t('No destinations yet.')}
      <button
        type="button"
        class="btn btn-link"
        onclick={() => open('destinations')}
      >
        {$t('Add a destination…')}
      </button>
    </p>
  {:else}
    <ul class="rows">
      {#each $remotesStore.remotes as remote (remote.id)}
        {@const row = rowFor(remote.id)}
        {@const state = stateFor(remote, row)}
        {@const reach = row.listing?.reach ?? null}
        <li class="row">
          <DestinationBadge {remote} />
          <div class="text">
            <b class="name">{remote.name}</b>
            <span class="status" class:warn={state?.kind === 'newer-here'}>
              {#if row.sending !== null}
                {$t('Sending… {percent}%', { percent: row.sending })}
              {:else if !row.listing}
                {$t('Checking…')}
              {:else if reach === 'sign-in'}
                {$t('Sign in needed')}
              {:else if reach === 'reconnect'}
                {$t('Needs permission')}
              {:else if reach === 'unplugged'}
                {$t('Not plugged in · plug the reader in to send')}
              {:else if reach === 'error'}
                {row.listing.error}
              {:else if state?.kind === 'current'}
                {$t('Sent {when} · this is the latest package', {
                  when: relativeTime(state.sentAt),
                })}
              {:else if state?.kind === 'newer-here'}
                {$t('Sent {when} · a newer package is here', {
                  when: relativeTime(state.sentAt),
                })}
              {:else}
                {$t('Not sent')}
              {/if}
            </span>
          </div>
          {#if hasCatalog(remote)}
            <div class="switches">
              {#each row.catalogs as catalog (catalog.file)}
                <Switch
                  checked={inCatalog(remote, row, catalog)}
                  label={row.catalogs.length > 1
                    ? $t('In {catalog}', { catalog: catalog.identity.title })
                    : $t('In the catalog')}
                  disabled={!state || state.kind === 'not-sent' || !!catalog.error}
                  busy={row.toggling === catalog.file}
                  title={catalog.error
                    ? catalog.error
                    : !state || state.kind === 'not-sent'
                      ? $t('Send the book first')
                      : catalog.file}
                  onChange={(next) => toggleCatalog(remote, catalog, next)}
                />
              {/each}
            </div>
          {:else}
            <span class="no-catalog">{$t('No catalog')}</span>
          {/if}
          {#if reach === 'sign-in' || reach === 'reconnect'}
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              onclick={() => reconnect(remote)}
            >
              {reach === 'sign-in' ? $t('Connect') : $t('Reconnect')}
            </button>
          {:else}
            <button
              type="button"
              class="btn btn-sm"
              class:btn-primary={state?.kind !== 'current'}
              class:btn-secondary={state?.kind === 'current'}
              disabled={!latest ||
                row.sending !== null ||
                !row.listing ||
                reach !== 'ok'}
              onclick={() => send(remote)}
            >
              {state?.kind === 'current' ? $t('Send again') : $t('Send')}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="foot">
    <button
      type="button"
      class="btn btn-link"
      onclick={() => open('published')}
    >
      {$t('Published — every book on a destination')}
    </button>
    <button
      type="button"
      class="btn btn-link"
      onclick={() => open('destinations')}
    >
      {$t('Destinations…')}
    </button>
  </div>

  <ValidationModal
    {report}
    show={showReport}
    onClose={() => (showReport = false)}
    onNavigate={onValidationNavigate}
  />
</div>

<style>
  .send-surface {
    border: 1px solid var(--color-border-strong);
    border-radius: 2px;
    background: var(--color-surface-primary);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    padding: 10px 20px;
    border-block-end: 1px solid var(--color-border-default);
    font-size: 13px;
  }

  .package-name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .check {
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .check.valid {
    background: var(--color-success-bg);
    color: var(--color-success-text);
  }

  .check.warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }

  .check.invalid {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }

  .empty {
    margin: 0;
    padding: 16px 20px;
    color: var(--color-text-secondary);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 12px 20px;
    border-block-end: 1px solid var(--color-border-default);
  }

  .text {
    flex: 1 1 240px;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    overflow-wrap: anywhere;
  }

  .status {
    font-size: 13px;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .status.warn {
    color: var(--color-warning-text);
  }

  .switches {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }

  .no-catalog {
    font-size: 13px;
    color: var(--color-text-tertiary);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    padding: 10px 20px;
    background: var(--color-surface-secondary);
    font-size: 13px;
  }

  .foot .btn-link,
  .head .btn-link,
  .empty .btn-link {
    font-size: inherit;
    text-decoration: none;
  }

  .foot .btn-link:hover,
  .head .btn-link:hover,
  .empty .btn-link:hover {
    text-decoration: underline;
  }
</style>
