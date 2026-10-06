<!--
  The Published page: a destination picker, the destination's catalog with
  its identity and state (a catalog picker when it carries several), and its shelf — every EPUB on it as a card, with
  Import… for books not on this device, and the books on this device that
  have not been sent here (process/PUBLISH_REWORK.md).
-->
<script lang="ts">
  import { t, translate } from '../i18n.js';
  import { dirHandle, knownIdentifiers } from '../store.js';
  import {
    remotesStore,
    remotesLoaded,
    contentVersions,
    selectRemote,
    updateRemote,
    announceContentChanged,
  } from '../remotes.js';
  import {
    loadLocalPackages,
    sidecarMap,
    type LocalPackage,
  } from '../local-packages.js';
  import {
    listRemote,
    shelfFor,
    type RemoteListing,
    type ShelfBook,
  } from '../remote-status.js';
  import {
    hasCatalog,
    loadCatalogs,
    writeCatalog,
    formatLabel,
    emptyCatalog,
    unusedCatalogFile,
    type CatalogInfo,
  } from '../catalog.js';
  import { sendPackage, setInCatalog } from '../send.js';
  import { reconnectGoogle, reconnectDevice } from '../reconnect.js';
  import { deleteFile, downloadFile } from '../remote-ops.js';
  import { showStatus } from '../status.js';
  import {
    canShareLinks,
    copyShareLink,
    publicLinkFor,
    readerLinkTemplate,
    copyText,
  } from '../share-links.js';
  import { formatFileSize, relativeTime } from '../format.js';
  import type { CatalogIdentity } from '../opds.js';
  import type {
    ImportEpubMessage,
    OpenMessage,
    RemoteConfig,
  } from '../types.js';
  import CatalogIdentityForm from './CatalogIdentityForm.svelte';
  import ImportDialog from './ImportDialog.svelte';
  import Switch from './Switch.svelte';

  // --- Packages on this device ------------------------------------------------
  let packages = $state<LocalPackage[]>([]);
  $effect(() => {
    const dir = $dirHandle;
    if (!dir) return;
    void (async () => {
      try {
        packages = await loadLocalPackages(dir);
      } catch (error) {
        showStatus(
          translate('Failed to load EPUBs: {error}', { error: String(error) }),
          'error',
        );
      }
    })();
  });

  // --- The picked destination ---------------------------------------------------
  const remotes = $derived($remotesStore.remotes);
  const selected = $derived(
    remotes.find((r) => r.id === $remotesStore.activeRemoteId) ??
      remotes[0] ??
      null,
  );

  let listing = $state<RemoteListing | null>(null);
  // Every feed on the destination, its own first, and which one the page
  // shows: a destination can carry several catalogs (one per shelf of books).
  let catalogs = $state<CatalogInfo[]>([]);
  let catalogFile = $state<string | null>(null);
  const catalog = $derived(
    catalogs.find((c) => c.file === catalogFile) ?? catalogs[0] ?? null,
  );
  let loadedFor = $state<string | null>(null);
  let loadedVersion = $state(-1);

  async function refresh(remote: RemoteConfig) {
    listing = null;
    catalogs = [];
    const result = await listRemote(remote);
    if (selected?.id !== remote.id) return;
    listing = result;
    if (hasCatalog(remote) && result.reach === 'ok') {
      const infos = await loadCatalogs(remote, result.objects);
      if (selected?.id === remote.id) catalogs = infos;
    }
  }

  // A book named only by one of the feeds still gets its identifier and title.
  const allEntries = $derived(catalogs.flatMap((c) => c.entries));

  // List the picked destination, and again when another frame changes it.
  $effect(() => {
    if (!$remotesLoaded || !selected) return;
    const version = $contentVersions[selected.id] ?? 0;
    if (loadedFor === selected.id && loadedVersion === version) return;
    if (loadedFor !== selected.id) catalogFile = null;
    loadedFor = selected.id;
    loadedVersion = version;
    editingIdentity = false;
    creatingCatalog = null;
    confirmDeleteCatalog = false;
    void refresh(selected);
  });

  const shelf = $derived.by(() => {
    if (!selected || !listing || listing.reach !== 'ok') return null;
    return shelfFor(
      selected,
      listing.objects,
      packages,
      allEntries,
      catalog?.keys ?? new Set(),
      $knownIdentifiers,
    );
  });

  const totalSize = $derived(
    listing?.objects.reduce((sum, o) => sum + o.size, 0) ?? 0,
  );

  // --- Catalog ------------------------------------------------------------------------
  let editingIdentity = $state(false);
  let writingCatalog = $state(false);
  // A second (third…) catalog being added: the form's blank starting point.
  let creatingCatalog = $state<CatalogInfo | null>(null);

  function startNewCatalog() {
    if (!selected || !listing || !hasCatalog(selected)) return;
    editingIdentity = false;
    creatingCatalog = emptyCatalog(
      selected,
      unusedCatalogFile(listing.objects),
    );
  }

  // The feed's own address: for Dropbox a shared link set to download (the
  // feed URL recorded in the catalog is a placeholder there), else the
  // public address.
  async function copyFeedLink() {
    if (!catalog || !selected) return;
    const url =
      selected.type === 'dropbox'
        ? await publicLinkFor(selected, catalog.file, listing?.objects ?? [])
        : catalog.feedUrl;
    if (!url) {
      showStatus(translate('This file has no public link'), 'error');
      return;
    }
    if (await copyText(url)) showStatus(translate('URL copied to clipboard'), 'success');
    else showStatus(url, 'info');
  }

  /**
   * Write a feed with `identity` under `file`, starting from `from`: its own
   * books when it exists, every EPUB for a destination's first feed, and none
   * for a further feed (the switches fill it).
   */
  async function writeIdentityOf(
    from: CatalogInfo,
    file: string,
    identity: Required<CatalogIdentity>,
    isNew: boolean,
  ) {
    if (!selected || !listing || !hasCatalog(selected)) return;
    if (isNew && catalogs.some((c) => c.exists && c.file === file)) {
      showStatus(
        translate('A catalog with that name is already here.'),
        'error',
      );
      return;
    }
    writingCatalog = true;
    try {
      const keys = from.exists
        ? from.keys
        : isNew
          ? new Set<string>()
          : new Set(
              listing.objects
                .filter((o) => o.key.toLowerCase().endsWith('.epub'))
                .map((o) => o.key),
            );
      const result = await writeCatalog(
        selected,
        listing.objects,
        keys,
        sidecarMap(packages),
        identity,
        file,
      );
      if (!result.success) {
        showStatus(result.error || translate('Catalog update failed'), 'error');
        return;
      }
      // The destination's own feed follows a rename of the first catalog.
      if (!isNew && from === catalogs[0] && file !== from.file) {
        await updateRemote({ ...selected, catalogFilename: file });
      }
      announceContentChanged(selected.id);
      editingIdentity = false;
      creatingCatalog = null;
      catalogFile = file;
      showStatus(
        translate('Catalog updated: {url}', {
          url: result.url || from.feedUrl,
        }),
        'success',
      );
      await refresh(selected);
    } finally {
      writingCatalog = false;
    }
  }

  async function writeIdentity(
    file: string,
    identity: Required<CatalogIdentity>,
  ) {
    if (!catalog) return;
    await writeIdentityOf(catalog, file, identity, false);
  }

  async function writeNewCatalog(
    file: string,
    identity: Required<CatalogIdentity>,
  ) {
    if (!creatingCatalog) return;
    await writeIdentityOf(creatingCatalog, file, identity, true);
  }

  /** Rewrite the feed from what is on the destination now (files gone). */
  async function updateCatalog() {
    if (!catalog) return;
    await writeIdentity(catalog.file, catalog.identity);
  }

  // Delete the feed file itself; the books stay. The thumbnails hosted for
  // it stay too (another feed may use them).
  let confirmDeleteCatalog = $state(false);

  async function deleteCatalog() {
    if (!selected || !catalog) return;
    confirmDeleteCatalog = false;
    writingCatalog = true;
    try {
      const result = await deleteFile(selected, catalog.file);
      if (!result.success) {
        showStatus(result.error || translate('Delete failed'), 'error');
        return;
      }
      announceContentChanged(selected.id);
      showStatus(translate('{key} deleted', { key: catalog.file }), 'success');
      catalogFile = null;
      editingIdentity = false;
      await refresh(selected);
    } finally {
      writingCatalog = false;
    }
  }

  // --- Per-book actions ------------------------------------------------------------
  let busyKeys = $state<Set<string>>(new Set());
  let confirmRemove = $state<string | null>(null);
  let sendingName = $state<string | null>(null);
  let sendingPercent = $state<number | null>(null);

  function setBusy(key: string, busy: boolean) {
    const next = new Set(busyKeys);
    if (busy) next.add(key);
    else next.delete(key);
    busyKeys = next;
  }

  async function toggle(book: ShelfBook, include: boolean) {
    if (!selected || !listing || !catalog) return;
    setBusy(book.key, true);
    try {
      const target = catalog;
      const result = await setInCatalog(
        selected,
        listing,
        target,
        [book.key],
        include,
        packages,
      );
      if (result.success && result.catalog) {
        catalogs = catalogs.map((c) =>
          c.file === target.file ? result.catalog! : c,
        );
      } else if (!result.success) {
        showStatus(result.error || translate('Catalog update failed'), 'error');
      }
    } finally {
      setBusy(book.key, false);
    }
  }

  async function remove(book: ShelfBook) {
    if (!selected) return;
    confirmRemove = null;
    setBusy(book.key, true);
    try {
      const result = await deleteFile(selected, book.key);
      if (!result.success) {
        showStatus(result.error || translate('Delete failed'), 'error');
        return;
      }
      // No feed lists it any more.
      if (listing && hasCatalog(selected)) {
        for (const feed of catalogs) {
          if (!feed.keys.has(book.key)) continue;
          const keys = new Set(feed.keys);
          keys.delete(book.key);
          await writeCatalog(
            selected,
            listing.objects.filter((o) => o.key !== book.key),
            keys,
            sidecarMap(packages),
            feed.identity,
            feed.file,
          );
        }
      }
      announceContentChanged(selected.id);
      showStatus(translate('{key} deleted', { key: book.key }), 'success');
      await refresh(selected);
    } finally {
      setBusy(book.key, false);
    }
  }

  async function send(pkg: LocalPackage) {
    if (!selected) return;
    sendingName = pkg.name;
    sendingPercent = 0;
    try {
      const result = await sendPackage(
        selected,
        pkg,
        packages,
        (percent) => {
          sendingPercent = percent;
        },
        listing ?? undefined,
      );
      if (result.success) {
        showStatus(
          translate('Sent to {name}', { name: selected.name }),
          'success',
        );
      } else {
        showStatus(result.error || translate('Upload failed'), 'error');
      }
      if (result.listing && result.catalogs?.some((c) => c.error)) {
        // A feed could not be read during the send: show the sent book from
        // the fresh listing and the feeds as read, rather than read again.
        listing = result.listing;
        catalogs = result.catalogs;
      } else {
        await refresh(selected);
      }
    } finally {
      sendingName = null;
      sendingPercent = null;
    }
  }

  // --- Import ----------------------------------------------------------------------------
  let importing = $state<ShelfBook | null>(null);
  let downloading = $state(false);

  async function importBook() {
    if (!selected || !importing) return;
    const book = importing;
    downloading = true;
    try {
      const result = await downloadFile(selected, book.key, book.fileId);
      if (result.error || !result.blob) {
        showStatus(
          result.error || translate('Could not read that file'),
          'error',
        );
        return;
      }
      const bytes = await result.blob.arrayBuffer();
      const message: ImportEpubMessage = {
        type: 'import-epub',
        filename: book.key,
        bytes,
      };
      window.parent.postMessage(message, window.origin, [bytes]);
      importing = null;
    } finally {
      downloading = false;
    }
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
      loadedVersion = -1;
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

<div class="published-surface">
  {#if !$remotesLoaded}
    <p class="empty">{$t('Loading…')}</p>
  {:else}
    <div class="picker" role="group" aria-label={$t('Destination')}>
      {#each remotes as remote (remote.id)}
        <button
          type="button"
          class="chip"
          class:on={selected?.id === remote.id}
          aria-pressed={selected?.id === remote.id}
          onclick={() => selectRemote(remote.id)}
        >
          {remote.name}
        </button>
      {/each}
      <button
        type="button"
        class="chip add"
        onclick={() => open('destinations')}
      >
        {$t('+ Destination…')}
      </button>
    </div>

    {#if !selected}
      <p class="empty">{$t('No destinations yet.')}</p>
    {:else}
      {#if hasCatalog(selected)}
        <section class="catalog" aria-label={$t('Catalog')}>
          {#if !listing}
            <p class="muted">{$t('Checking…')}</p>
          {:else if listing.reach !== 'ok'}
            <p class="muted">{$t('The catalog cannot be read right now.')}</p>
          {:else if creatingCatalog}
            <div class="catalog-head">
              <b>{$t('New catalog')}</b>
            </div>
            <CatalogIdentityForm
              catalog={creatingCatalog}
              busy={writingCatalog}
              onSave={writeNewCatalog}
              onCancel={() => (creatingCatalog = null)}
            />
          {:else if catalog}
            {#if catalogs.length > 1}
              <div
                class="catalog-picker"
                role="group"
                aria-label={$t('Catalogs')}
              >
                {#each catalogs as feed (feed.file)}
                  <button
                    type="button"
                    class="chip small"
                    class:on={feed.file === catalog.file}
                    aria-pressed={feed.file === catalog.file}
                    title={feed.file}
                    onclick={() => (catalogFile = feed.file)}
                  >
                    {feed.identity.title}
                  </button>
                {/each}
              </div>
            {/if}
            <div class="catalog-head">
              <b>{catalog.identity.title}</b>
              <div class="acts">
                {#if catalog.exists}
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    onclick={copyFeedLink}
                  >
                    {$t('Copy feed link')}
                  </button>
                {/if}
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  aria-expanded={editingIdentity}
                  onclick={() => (editingIdentity = !editingIdentity)}
                >
                  {$t('Edit…')}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onclick={startNewCatalog}
                >
                  {$t('New catalog…')}
                </button>
                {#if catalog.exists}
                  {#if confirmDeleteCatalog}
                    <span class="confirm">
                      {$t('Delete {file}? The books stay.', { file: catalog.file })}
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onclick={deleteCatalog}
                        disabled={writingCatalog}
                      >
                        {$t('Yes')}
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        onclick={() => (confirmDeleteCatalog = false)}
                      >
                        {$t('No')}
                      </button>
                    </span>
                  {:else}
                    <button
                      type="button"
                      class="btn btn-link danger"
                      onclick={() => (confirmDeleteCatalog = true)}
                      disabled={writingCatalog}
                    >
                      {$t('Delete catalog')}
                    </button>
                  {/if}
                {/if}
              </div>
            </div>
            <div class="catalog-row">
              <span
                ><i>{$t('Catalog')}</i>
                {formatLabel(catalog.format)} · {catalog.file}</span
              >
              <span
                ><i>{$t('By')}</i>
                {catalog.identity.authorName} · {catalog.identity
                  .authorUri}</span
              >
              {#if catalog.exists}
                <span>
                  <i>{$t('Updated')}</i>
                  {catalog.lastModified
                    ? relativeTime(catalog.lastModified)
                    : ''} ·
                  {catalog.keys.size === 1
                    ? $t('{n} book', { n: catalog.keys.size })
                    : $t('{n} books', { n: catalog.keys.size })}
                </span>
              {/if}
            </div>
            <div class="catalog-row">
              {#if catalog.error}
                <span class="warn">
                  {$t('The catalog could not be read: {error}', { error: catalog.error })}
                </span>
              {:else if !catalog.exists}
                <span class="muted">{$t('No catalog yet.')}</span>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  aria-expanded={editingIdentity}
                  onclick={() => (editingIdentity = true)}
                  disabled={writingCatalog}
                >
                  {$t('Create catalog…')}
                </button>
              {:else if catalog.missingHrefs.length > 0}
                <span class="warn">
                  {catalog.missingHrefs.length === 1
                    ? $t('The catalog lists {n} file that is no longer here.', {
                        n: 1,
                      })
                    : $t(
                        'The catalog lists {n} files that are no longer here.',
                        {
                          n: catalog.missingHrefs.length,
                        },
                      )}
                </span>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  onclick={updateCatalog}
                  disabled={writingCatalog}
                >
                  {writingCatalog ? $t('Updating...') : $t('Update catalog')}
                </button>
              {:else}
                <span class="ok"
                  >{$t('✓ Catalog matches the switches below')}</span
                >
              {/if}
            </div>
            {#if editingIdentity}
              <CatalogIdentityForm
                {catalog}
                busy={writingCatalog}
                onSave={writeIdentity}
                onCancel={() => (editingIdentity = false)}
              />
            {/if}
          {/if}
        </section>
      {/if}

      <h2 class="label">
        {$t('On this destination')}
        {#if listing?.reach === 'ok'}
          <span>
            {listing.objects.length === 1
              ? $t('{n} file', { n: 1 })
              : $t('{n} files', { n: listing.objects.length })} · {formatFileSize(
              totalSize,
            )}
          </span>
        {/if}
      </h2>

      {#if !listing}
        <p class="empty">{$t('Checking…')}</p>
      {:else if listing.reach === 'sign-in'}
        <p class="empty">
          {$t('Sign in needed')}
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => reconnect(selected)}
          >
            {$t('Connect')}
          </button>
        </p>
      {:else if listing.reach === 'reconnect'}
        <p class="empty">
          {$t('Needs permission')}
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => reconnect(selected)}
          >
            {$t('Reconnect')}
          </button>
        </p>
      {:else if listing.reach === 'unplugged'}
        <p class="empty">
          {$t('Not plugged in · plug the reader in and refresh')}
        </p>
      {:else if listing.reach === 'error'}
        <p class="empty">{listing.error}</p>
      {:else if shelf}
        {#if shelf.onDestination.length === 0}
          <p class="empty">{$t('Nothing sent here yet.')}</p>
        {:else}
          <ul class="shelf">
            {#each shelf.onDestination as book (book.key)}
              <li class="book">
                {#if book.thumbnailUrl}
                  <img
                    src={book.thumbnailUrl}
                    alt=""
                    class="cover"
                    onerror={(e) =>
                      ((e.currentTarget as HTMLImageElement).style.display =
                        'none')}
                  />
                {:else}
                  <div class="cover file">
                    <span
                      >{book.known
                        ? ''
                        : $t('No cover · not packaged here')}</span
                    >
                    <code>{book.key}</code>
                  </div>
                {/if}
                <b class="title">{book.title}</b>
                <span class="status">
                  {#if book.known}
                    {book.latest
                      ? $t('Sent {when} · latest', {
                          when: relativeTime(book.sentAt),
                        })
                      : $t('Sent {when} · an older package', {
                          when: relativeTime(book.sentAt),
                        })}
                  {:else}
                    {$t('Not on this device · {size}', {
                      size: formatFileSize(book.size),
                    })}
                  {/if}
                </span>
                <div class="acts">
                  {#if catalog}
                    <Switch
                      checked={book.inCatalog}
                      label={catalogs.length > 1
                        ? $t('In {catalog}', {
                            catalog: catalog.identity.title,
                          })
                        : $t('In catalog')}
                      busy={busyKeys.has(book.key)}
                      onChange={(next) => toggle(book, next)}
                    />
                  {/if}
                  {#if canShareLinks(selected)}
                    <button
                      type="button"
                      class="btn btn-link"
                      onclick={() =>
                        copyShareLink(selected, book.key, listing?.objects ?? [], 'file')}
                    >
                      {$t('Copy link')}
                    </button>
                    {#if readerLinkTemplate(selected)}
                      <button
                        type="button"
                        class="btn btn-link"
                        onclick={() =>
                          copyShareLink(selected, book.key, listing?.objects ?? [], 'reader')}
                      >
                        {$t('Copy reader link')}
                      </button>
                    {/if}
                  {/if}
                  {#if !book.known}
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      onclick={() => (importing = book)}
                      disabled={busyKeys.has(book.key)}
                    >
                      {$t('Import…')}
                    </button>
                  {/if}
                  {#if confirmRemove === book.key}
                    <span class="confirm">
                      {$t('Confirm delete?')}
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onclick={() => remove(book)}
                      >
                        {$t('Yes')}
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        onclick={() => (confirmRemove = null)}
                      >
                        {$t('No')}
                      </button>
                    </span>
                  {:else}
                    <button
                      type="button"
                      class="btn btn-link"
                      onclick={() => (confirmRemove = book.key)}
                      disabled={busyKeys.has(book.key)}
                    >
                      {$t('Remove')}
                    </button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}

        {#if shelf.notSent.length > 0}
          <h2 class="label">{$t('On this device, not sent here')}</h2>
          <ul class="shelf">
            {#each shelf.notSent as pkg (pkg.name)}
              <li class="book dim">
                {#if pkg.thumbnailUrl}
                  <img src={pkg.thumbnailUrl} alt="" class="cover" />
                {:else}
                  <div class="cover file"><code>{pkg.name}</code></div>
                {/if}
                <b class="title">{pkg.title || pkg.name}</b>
                <span class="status">
                  {$t('Packaged {when}', {
                    when: relativeTime(pkg.lastModified),
                  })}
                </span>
                <div class="acts">
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    onclick={() => send(pkg)}
                    disabled={sendingName !== null}
                  >
                    {sendingName === pkg.name
                      ? $t('Sending… {percent}%', {
                          percent: sendingPercent ?? 0,
                        })
                      : $t('Send')}
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    {/if}
  {/if}

  {#if importing && selected}
    <ImportDialog
      book={importing}
      destinationName={selected.name}
      busy={downloading}
      onCancel={() => (importing = null)}
      onImport={importBook}
    />
  {/if}
</div>

<style>
  .published-surface {
    box-sizing: border-box;
    block-size: 100%;
    overflow-y: auto;
    padding-block-end: 32px;
  }

  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-block-end: 20px;
  }

  .chip {
    padding: 5px 12px;
    border: 1px solid var(--color-border-strong);
    border-radius: 14px;
    background: var(--color-surface-primary);
    font: inherit;
    font-size: 13px;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .chip.on {
    background: var(--color-text-primary);
    border-color: var(--color-text-primary);
    color: var(--color-surface-primary);
  }

  .chip.small {
    padding-block: 3px;
    font-size: 12px;
  }

  .catalog-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px 16px 0;
  }

  .chip.add {
    color: var(--color-text-secondary);
    border-style: dashed;
  }

  .chip:hover:not(.on) {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .chip:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-button-focus-ring);
  }

  .catalog {
    margin-block-end: 24px;
    border: 1px solid var(--color-border-strong);
    border-radius: 2px;
    background: var(--color-surface-primary);
  }

  .catalog > .muted {
    margin: 0;
    padding: 12px 16px;
  }

  .catalog-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 12px 16px 6px;
    font-size: 15px;
  }

  .catalog-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 24px;
    padding: 4px 16px 8px;
    font-size: 13px;
  }

  .catalog-row i {
    font-style: normal;
    color: var(--color-text-tertiary);
    margin-inline-end: 4px;
  }

  .catalog-row span {
    overflow-wrap: anywhere;
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }

  .muted {
    color: var(--color-text-secondary);
  }

  .ok {
    color: var(--color-success-text);
  }

  .warn {
    color: var(--color-warning-text);
  }

  .label {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 16px;
    margin: 0 0 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .label span {
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    font-size: 13px;
  }

  .empty {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin: 0 0 24px;
    color: var(--color-text-secondary);
  }

  .shelf {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 24px 20px;
    margin: 0 0 32px;
    padding: 0;
  }

  .book {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-inline-size: 0;
  }

  .book.dim {
    opacity: 0.6;
  }

  .book.dim:hover,
  .book.dim:focus-within {
    opacity: 1;
  }

  .cover {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border: 1px solid var(--color-border-default);
    border-radius: 2px;
    margin-block-end: 6px;
    background: var(--color-surface-secondary);
  }

  .cover.file {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 4px;
    padding: 10px;
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .cover.file code {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    overflow-wrap: anywhere;
    color: var(--color-text-primary);
  }

  .title {
    overflow-wrap: anywhere;
  }

  .status {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .book .acts {
    margin-block-start: 4px;
  }

  .book .btn-link {
    font-size: 12px;
    text-decoration: none;
  }

  .book .btn-link:hover {
    text-decoration: underline;
  }

  .btn-link.danger {
    color: var(--color-error-text);
    font-size: 12px;
    text-decoration: none;
  }

  .btn-link.danger:hover {
    text-decoration: underline;
  }

  .confirm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
</style>
