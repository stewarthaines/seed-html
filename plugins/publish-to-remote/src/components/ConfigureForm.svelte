<script lang="ts">
  import { onMount } from 'svelte';
  import { t, translate } from '../i18n.js';
  import {
    loadGoogleScripts,
    authorizeGoogleDrive,
    pickGoogleDriveFolder,
  } from '../google-drive.js';
  import { authorizeDropbox, listDropboxFolders } from '../dropbox.js';
  import {
    pickDevice,
    saveDeviceHandle,
    isDeviceSupported,
  } from '../device-upload.js';
  import { ArrowLeft } from 'phosphor-svelte';
  import type { RemoteConfig, DropboxRemoteConfig } from '../types.js';

  const S3_PRESETS = {
    'cloudflare-r2': {
      endpoint: 'https://<account-id>.r2.cloudflarestorage.com',
      region: 'auto',
    },
    'backblaze-b2': {
      endpoint: 'https://s3.<region>.backblazeb2.com',
      region: 'us-west-002',
    },
    'digitalocean-spaces': {
      endpoint: 'https://<region>.digitaloceanspaces.com',
      region: 'nyc3',
    },
    'bunny-storage': {
      endpoint: 'https://<storage-zone>.bunnycdn.com',
      region: 'auto',
    },
  } as const;

  let {
    editingRemote,
    canCancel,
    onSave,
    onCancel,
    onStatus,
  }: {
    editingRemote: RemoteConfig | null;
    canCancel: boolean;
    onSave: (remote: RemoteConfig, isNew: boolean) => void;
    onCancel: () => void;
    onStatus: (text: string, type: 'info' | 'success' | 'error') => void;
  } = $props();

  type RemoteType =
    | 'none'
    | 's3-compatible'
    | 'google-drive'
    | 'dropbox'
    | 'webdav'
    | 'device';

  let remoteType: RemoteType = $state('none');
  let form = $state({
    name: '',
    endpoint: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    region: '',
    publicUrlBase: '',
    folderId: '',
    folderName: '',
    accessToken: '',
    refreshToken: '',
    tokenExpiry: 0,
    url: '',
    username: '',
    password: '',
    catalogFilename: '',
  });
  let previousBucketForAutoName = '';
  let pickedFolderName: string | null = $state(null);

  // WebDAV: route through the app's same-origin /dav proxy (for servers without
  // CORS). Kept out of `form` so the many wholesale `form = {...}` resets don't
  // each need the field. `proxyAvailable` is probed once; new remotes default
  // to using the proxy only when one is actually present on this host.
  let routeViaProxy = $state(true);
  let proxyAvailable = $state(false);

  // This app's origin — the value to register as a Google "Authorized JavaScript
  // origin" (Google wants an origin, not a full URL).
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  // The plugin's OWN page URL (origin + path, no query). The Dropbox OAuth callback
  // must land here — where App.svelte's onMount handles `?code=&state=` and posts it
  // back to the opener — NOT on the host app's root, which has no such handler.
  const pluginPageUrl =
    typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : '';

  // Provider OAuth app credentials, entered by the user per remote (bring-your-own
  // OAuth app) and persisted in the saved config. Kept out of `form` — like
  // routeViaProxy — so the wholesale `form = {...}` resets don't each need them.
  let googleClientId = $state('');
  let googleApiKey = $state('');
  let dropboxAppKey = $state('');
  // Prefilled with the plugin page URL — the value to register as the Dropbox app's
  // redirect URI; dropbox.ts falls back to it when left empty.
  let dropboxRedirectUri = $state(pluginPageUrl);

  onMount(async () => {
    try {
      const res = await fetch(`${location.origin}/dav`, { method: 'GET' });
      proxyAvailable = res.status === 204;
    } catch {
      proxyAvailable = false;
    }
    if (!editingRemote) {
      routeViaProxy = proxyAvailable;
    }
  });

  let dbxBrowserPath: string = $state('');
  let dbxBrowserFolders: { name: string; path: string }[] = $state([]);
  let dbxBrowserLoading: boolean = $state(false);
  let dbxBrowserError: string | null = $state(null);
  let dbxBrowserActive: boolean = $state(false);

  // Device destinations (Chromium-only; see ../device-upload.ts). The picked
  // handle is held here until Save persists it to IndexedDB under the remote id.
  const deviceSupported = isDeviceSupported();
  let pickedDeviceHandle: FileSystemDirectoryHandle | null = $state(null);
  let deviceKind: 'kobo' | 'generic' = $state('generic');
  let deviceVolumeLabel = $state('');
  let deviceDetail = $state('');
  let deviceTargetFolder = $state('');

  async function onPickDevice() {
    try {
      const { handle, sniff } = await pickDevice();
      pickedDeviceHandle = handle;
      deviceKind = sniff.kind;
      deviceVolumeLabel = handle.name;
      deviceDetail = sniff.detail ?? '';
      deviceTargetFolder = '';
      form.name =
        sniff.kind === 'kobo' ? (sniff.detail ?? 'Kobo') : handle.name;
      remoteType = 'device';
    } catch {
      // Picker dismissed — stay on the chooser.
    }
  }

  $effect(() => {
    if (editingRemote) {
      populateForm(editingRemote);
    } else {
      resetForm();
    }
  });

  function populateForm(remote: RemoteConfig) {
    if (populateDeviceForm(remote)) return;
    if (remote.type === 's3-compatible') {
      remoteType = 's3-compatible';
      form = {
        name: remote.name,
        endpoint: remote.endpoint,
        bucket: remote.bucket,
        accessKeyId: remote.accessKeyId,
        secretAccessKey: remote.secretAccessKey,
        region: remote.region || '',
        publicUrlBase: remote.publicUrlBase || '',
        folderId: '',
        folderName: '',
        accessToken: '',
        refreshToken: '',
        tokenExpiry: 0,
        url: '',
        username: '',
        password: '',
        catalogFilename: remote.catalogFilename || '',
      };
      previousBucketForAutoName = remote.bucket;
    } else if (remote.type === 'google-drive') {
      remoteType = 'google-drive';
      form = {
        name: remote.name,
        endpoint: '',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
        publicUrlBase: '',
        folderId: remote.folderId,
        folderName: remote.folderName,
        accessToken: '',
        refreshToken: '',
        tokenExpiry: 0,
        url: '',
        username: '',
        password: '',
        catalogFilename: '',
      };
      googleClientId = remote.clientId;
      googleApiKey = remote.apiKey;
      pickedFolderName = remote.folderName;
    } else if (remote.type === 'dropbox') {
      remoteType = 'dropbox';
      const dropboxRemote = remote as DropboxRemoteConfig;
      form = {
        name: remote.name,
        endpoint: '',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
        publicUrlBase: '',
        folderId: remote.folderId,
        folderName: remote.folderPath,
        accessToken: dropboxRemote.accessToken,
        refreshToken: dropboxRemote.refreshToken,
        tokenExpiry: dropboxRemote.tokenExpiry,
        url: '',
        username: '',
        password: '',
        catalogFilename: '',
      };
      dropboxAppKey = dropboxRemote.appKey;
      dropboxRedirectUri = dropboxRemote.redirectUri || pluginPageUrl;
      pickedFolderName = remote.folderPath;
      if (form.accessToken && form.tokenExpiry > Date.now()) {
        openDropboxBrowser(form.folderId);
      }
    } else if (remote.type === 'webdav') {
      remoteType = 'webdav';
      form = {
        name: remote.name,
        endpoint: '',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        region: '',
        publicUrlBase: remote.publicUrlBase || '',
        folderId: '',
        folderName: '',
        accessToken: '',
        refreshToken: '',
        tokenExpiry: 0,
        url: remote.url,
        username: remote.username,
        password: remote.password,
        catalogFilename: remote.catalogFilename || '',
      };
      routeViaProxy = remote.routeViaProxy !== false;
    }
  }

  function populateDeviceForm(remote: RemoteConfig) {
    if (remote.type !== 'device') return false;
    remoteType = 'device';
    form.name = remote.name;
    deviceKind = remote.deviceKind;
    deviceVolumeLabel = remote.volumeLabel;
    deviceDetail = remote.detail ?? '';
    deviceTargetFolder = remote.targetFolder;
    pickedDeviceHandle = null; // stored handle stays valid unless re-picked
    return true;
  }

  function resetForm() {
    remoteType = 'none';
    form = {
      name: '',
      endpoint: '',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: '',
      publicUrlBase: '',
      folderId: '',
      folderName: '',
      accessToken: '',
      refreshToken: '',
      tokenExpiry: 0,
      url: '',
      username: '',
      password: '',
      catalogFilename: '',
    };
    pickedFolderName = null;
    pickedDeviceHandle = null;
    deviceKind = 'generic';
    deviceVolumeLabel = '';
    deviceDetail = '';
    deviceTargetFolder = '';
    previousBucketForAutoName = '';
    googleClientId = '';
    googleApiKey = '';
    dropboxAppKey = '';
    dropboxRedirectUri = pluginPageUrl;
    dbxBrowserPath = '';
    dbxBrowserFolders = [];
    dbxBrowserLoading = false;
    dbxBrowserError = null;
    dbxBrowserActive = false;
  }

  function autoUpdateName() {
    if (!form.name || form.name === previousBucketForAutoName) {
      form.name = form.bucket;
      previousBucketForAutoName = form.bucket;
    }
  }

  function onPresetSelected(preset: keyof typeof S3_PRESETS) {
    const p = S3_PRESETS[preset];
    form.endpoint = p.endpoint;
    form.region = p.region;
  }

  async function onConnectGoogleDrive() {
    try {
      if (!googleClientId || !googleApiKey) {
        onStatus(translate('Google Drive credentials not configured'), 'error');
        return;
      }
      await loadGoogleScripts();
      const accessToken = await authorizeGoogleDrive(googleClientId);
      const { folderId, folderName } = await pickGoogleDriveFolder(
        accessToken,
        googleApiKey,
      );
      form.folderId = folderId;
      form.folderName = folderName;
      form.accessToken = accessToken;
      pickedFolderName = folderName;
      onStatus(
        translate('Selected folder: {name}', { name: folderName }),
        'success',
      );
    } catch (error) {
      onStatus(
        translate('Google Drive setup failed: {error}', {
          error: String(error),
        }),
        'error',
      );
    }
  }

  async function onConnectDropbox(): Promise<void> {
    try {
      if (!dropboxAppKey) {
        onStatus(translate('Dropbox app key not configured'), 'error');
        return;
      }
      const { accessToken, refreshToken, tokenExpiry } = await authorizeDropbox(
        dropboxAppKey,
        dropboxRedirectUri,
      );
      form.accessToken = accessToken;
      form.refreshToken = refreshToken;
      form.tokenExpiry = tokenExpiry;
      await openDropboxBrowser('');
    } catch (error) {
      onStatus(
        translate('Dropbox authorization failed: {error}', {
          error: String(error),
        }),
        'error',
      );
    }
  }

  async function openDropboxBrowser(path: string): Promise<void> {
    dbxBrowserPath = path;
    dbxBrowserLoading = true;
    dbxBrowserError = null;
    dbxBrowserActive = true;

    try {
      dbxBrowserFolders = await listDropboxFolders(form.accessToken, path);
    } catch (error) {
      if (error instanceof Error && error.message === 'DROPBOX_AUTH_EXPIRED') {
        form.accessToken = '';
        form.refreshToken = '';
        form.tokenExpiry = 0;
        dbxBrowserActive = false;
        onStatus(translate('Session expired — please reconnect'), 'error');
      } else {
        dbxBrowserError =
          error instanceof Error ? error.message : String(error);
      }
    } finally {
      dbxBrowserLoading = false;
    }
  }

  function onSelectDropboxFolder(path: string, displayName: string): void {
    form.folderId = path;
    form.folderName = displayName;
    pickedFolderName = displayName;
    dbxBrowserActive = false;
    if (!form.name) form.name = displayName;
  }

  function parentOf(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash <= 0 ? '' : path.slice(0, lastSlash);
  }

  function buildRemote(): RemoteConfig | null {
    if (remoteType === 's3-compatible') {
      if (
        !form.endpoint ||
        !form.bucket ||
        !form.accessKeyId ||
        !form.secretAccessKey
      ) {
        onStatus(translate('Please fill all required fields'), 'error');
        return null;
      }
      return {
        id: editingRemote?.id || crypto.randomUUID(),
        name: form.name.trim() || form.bucket.trim(),
        type: 's3-compatible',
        endpoint: form.endpoint.trim(),
        bucket: form.bucket.trim(),
        accessKeyId: form.accessKeyId.trim(),
        secretAccessKey: form.secretAccessKey.trim(),
        region: form.region.trim() || undefined,
        publicUrlBase: form.publicUrlBase.trim() || undefined,
        catalogFilename: form.catalogFilename.trim() || undefined,
      };
    } else if (remoteType === 'google-drive') {
      if (!form.folderId) {
        onStatus(translate('Please select a folder'), 'error');
        return null;
      }
      return {
        id: editingRemote?.id || crypto.randomUUID(),
        name: form.name.trim() || form.folderName.trim(),
        type: 'google-drive',
        clientId: googleClientId.trim(),
        apiKey: googleApiKey.trim(),
        folderId: form.folderId.trim(),
        folderName: form.folderName.trim(),
        accessToken: form.accessToken || undefined,
      };
    } else if (remoteType === 'dropbox') {
      if (!form.accessToken || pickedFolderName === null) {
        onStatus(
          translate('Please select a folder and authorize first'),
          'error',
        );
        return null;
      }
      return {
        id: editingRemote?.id || crypto.randomUUID(),
        name: form.name.trim() || form.folderName.trim(),
        type: 'dropbox',
        appKey: dropboxAppKey.trim(),
        redirectUri: dropboxRedirectUri.trim() || undefined,
        folderId: form.folderId,
        folderPath: form.folderName,
        accessToken: form.accessToken,
        refreshToken: form.refreshToken,
        tokenExpiry: form.tokenExpiry,
      };
    } else if (remoteType === 'webdav') {
      if (!form.url || !form.username || !form.password) {
        onStatus(translate('Please fill all required fields'), 'error');
        return null;
      }
      return {
        id: editingRemote?.id || crypto.randomUUID(),
        name: form.name.trim() || form.url.trim(),
        type: 'webdav',
        url: form.url.trim(),
        username: form.username.trim(),
        password: form.password,
        publicUrlBase: form.publicUrlBase.trim() || undefined,
        catalogFilename: form.catalogFilename.trim() || undefined,
        routeViaProxy,
      };
    } else if (remoteType === 'device') {
      if (!pickedDeviceHandle && !editingRemote) {
        onStatus(translate('Choose a device first'), 'error');
        return null;
      }
      return {
        id: editingRemote?.id || crypto.randomUUID(),
        name: form.name.trim() || deviceVolumeLabel || translate('USB device'),
        type: 'device',
        deviceKind,
        volumeLabel: deviceVolumeLabel,
        targetFolder: deviceTargetFolder.trim().replace(/^\/+|\/+$/g, ''),
        detail: deviceDetail || undefined,
      };
    }
    onStatus(translate('Please select a remote type'), 'error');
    return null;
  }

  async function handleSave() {
    const remote = buildRemote();
    if (!remote) return;
    // The directory handle is not JSON-serialisable: persist it separately,
    // BEFORE announcing the remote (saving triggers a listing that needs it).
    if (remote.type === 'device' && pickedDeviceHandle) {
      await saveDeviceHandle(remote.id, pickedDeviceHandle);
    }
    onSave(remote, !editingRemote);
  }
</script>

<div class="form-container">
  {#if remoteType === 'none'}
    <div class="type-selector">
      <h3>{$t('Add Destination')}</h3>
      <p class="type-cluster-label">{$t('Remote storage')}</p>
      <div class="type-buttons">
        <button class="btn-type" onclick={() => (remoteType = 's3-compatible')}>
          {$t('S3-Compatible')}
        </button>
        <button class="btn-type" onclick={() => (remoteType = 'google-drive')}>
          {$t('Google Drive')}
        </button>
        <button class="btn-type" onclick={() => (remoteType = 'dropbox')}>
          {$t('Dropbox')}
        </button>
        <button class="btn-type" onclick={() => (remoteType = 'webdav')}>
          {$t('WebDAV')}
        </button>
      </div>
      <p class="type-cluster-label">{$t('Device')}</p>
      <div class="type-buttons">
        <!-- aria-disabled (not disabled) keeps the button hoverable and focusable
             so the title explaining WHY is reachable in the very browsers that
             lack the API. -->
        <button
          class="btn-type"
          aria-disabled={!deviceSupported}
          title={deviceSupported
            ? undefined
            : $t(
                'Not available in this browser — connecting a USB device needs the File System Access API (Chrome, Edge)'
              )}
          onclick={() => {
            if (deviceSupported) onPickDevice();
          }}
        >
          {$t('USB e-reader (browse…)')}
        </button>
      </div>
      {#if canCancel}
        <div class="form-actions">
          <button class="btn btn-secondary" onclick={onCancel}
            >{$t('Cancel')}</button
          >
        </div>
      {/if}
    </div>
  {:else if remoteType === 's3-compatible'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}>
        <ArrowLeft size={16} aria-hidden="true" />
        {$t('Back')}
      </button>
      <h3>{$t('S3-Compatible Storage')}</h3>
    </div>

    <div class="form-group">
      <label for="preset">{$t('Preset')}</label>
      <select
        id="preset"
        onchange={(e) =>
          onPresetSelected(e.currentTarget.value as keyof typeof S3_PRESETS)}
      >
        <option value="">{$t('-- Choose a preset --')}</option>
        <option value="cloudflare-r2">Cloudflare R2</option>
        <option value="backblaze-b2">Backblaze B2</option>
        <option value="digitalocean-spaces">DigitalOcean Spaces</option>
        <option value="bunny-storage">Bunny Storage</option>
      </select>
    </div>

    <div class="form-group">
      <label for="name">{$t('Remote Name (optional)')}</label>
      <input
        id="name"
        type="text"
        placeholder={$t('Auto-filled from bucket name')}
        bind:value={form.name}
      />
    </div>

    <div class="form-group">
      <label for="endpoint">{$t('Endpoint URL')}</label>
      <input
        id="endpoint"
        type="url"
        placeholder="https://account-id.r2.cloudflarestorage.com"
        bind:value={form.endpoint}
      />
    </div>

    <div class="form-group">
      <label for="bucket">{$t('Bucket Name')}</label>
      <!-- i18n-ignore -->
      <input
        id="bucket"
        type="text"
        placeholder="my-bucket"
        bind:value={form.bucket}
        onchange={autoUpdateName}
      />
    </div>

    <div class="form-group">
      <label for="access-key">{$t('Access Key ID')}</label>
      <input
        id="access-key"
        type="text"
        placeholder={$t('Access Key')}
        bind:value={form.accessKeyId}
      />
    </div>

    <div class="form-group">
      <label for="secret-key">{$t('Secret Access Key')}</label>
      <input
        id="secret-key"
        type="password"
        placeholder={$t('Secret Key')}
        bind:value={form.secretAccessKey}
      />
    </div>

    <div class="form-group">
      <label for="region">{$t('Region (optional)')}</label>
      <!-- i18n-ignore -->
      <input
        id="region"
        type="text"
        placeholder="auto"
        bind:value={form.region}
      />
    </div>

    <div class="form-group">
      <label for="public-url">{$t('Public URL Base (optional)')}</label>
      <input
        id="public-url"
        type="url"
        placeholder="https://pub-xxx.r2.dev"
        bind:value={form.publicUrlBase}
      />
    </div>

    <div class="form-group">
      <label for="catalog-filename">{$t('Catalog Filename (optional)')}</label>
      <!-- i18n-ignore -->
      <input
        id="catalog-filename"
        type="text"
        placeholder="catalog.json"
        bind:value={form.catalogFilename}
      />
    </div>

    <div class="form-actions">
      <button onclick={handleSave} class="btn btn-primary"
        >{$t('Save & Connect')}</button
      >
      <button onclick={onCancel} class="btn btn-secondary"
        >{$t('Cancel')}</button
      >
    </div>
  {:else if remoteType === 'google-drive'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}>
        <ArrowLeft size={16} aria-hidden="true" />
        {$t('Back')}
      </button>
      <h3>{$t('Google Drive')}</h3>
    </div>

    <div class="form-group">
      <label for="gd-client-id">{$t('OAuth Client ID')}</label>
      <!-- i18n-ignore -->
      <input
        id="gd-client-id"
        type="text"
        placeholder="xxxx.apps.googleusercontent.com"
        bind:value={googleClientId}
      />
    </div>

    <div class="form-group">
      <label for="gd-api-key">{$t('API Key')}</label>
      <input
        id="gd-api-key"
        type="text"
        placeholder={$t('Google Cloud API key')}
        bind:value={googleApiKey}
      />
      <small class="field-note">
        {$t(
          'Use your own Google app: create an OAuth client ID and an API key in the Google Cloud console, enable the Drive and Picker APIs, and add this app’s origin ({origin}) to the OAuth client’s Authorized JavaScript origins.',
          { origin: appOrigin },
        )}
      </small>
    </div>

    {#if pickedFolderName}
      <div class="form-group folder-selected">
        <p><strong>{$t('Folder selected:')}</strong> {pickedFolderName}</p>
        <button
          class="btn btn-secondary btn-sm"
          onclick={() => {
            form.folderId = '';
            form.folderName = '';
            pickedFolderName = null;
          }}
        >
          {$t('Change Folder')}
        </button>
      </div>
    {:else}
      <div class="form-actions">
        <button onclick={onConnectGoogleDrive} class="btn btn-primary">
          {$t('Connect & Pick Folder')}
        </button>
      </div>
    {/if}

    {#if form.folderId}
      <div class="form-group">
        <label for="gd-name">{$t('Remote Name (optional)')}</label>
        <input
          id="gd-name"
          type="text"
          placeholder={$t('Auto-filled from folder name')}
          bind:value={form.name}
        />
      </div>

      <div class="form-actions">
        <button onclick={handleSave} class="btn btn-primary"
          >{$t('Save & Connect')}</button
        >
        <button onclick={onCancel} class="btn btn-secondary"
          >{$t('Cancel')}</button
        >
      </div>
    {/if}
  {:else if remoteType === 'dropbox'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}>
        <ArrowLeft size={16} aria-hidden="true" />
        {$t('Back')}
      </button>
      <h3>{$t('Dropbox')}</h3>
    </div>

    {#if !form.accessToken}
      <div class="form-group">
        <label for="db-app-key">{$t('App Key')}</label>
        <!-- i18n-ignore -->
        <input
          id="db-app-key"
          type="text"
          placeholder="xxxxxxxxxxxxxxx"
          bind:value={dropboxAppKey}
        />
      </div>

      <div class="form-group">
        <label for="db-redirect-uri">{$t('Redirect URI')}</label>
        <input
          id="db-redirect-uri"
          type="url"
          bind:value={dropboxRedirectUri}
        />
        <small class="field-note">
          {$t(
            'Use your own Dropbox app: create one in the Dropbox App Console (scoped access), enable files.content.write and files.metadata.read, and register this exact redirect URI in the app’s settings.',
          )}
        </small>
      </div>

      <div class="form-actions">
        <button onclick={() => onConnectDropbox()} class="btn btn-primary">
          {$t('Connect to Dropbox')}
        </button>
      </div>
    {:else if dbxBrowserActive}
      <div class="folder-browser">
        <div class="browser-path">
          {$t('Location:')}
          <strong>{dbxBrowserPath === '' ? '/' : dbxBrowserPath}</strong>
        </div>

        {#if dbxBrowserLoading}
          <div class="browser-loading">{$t('Loading folders...')}</div>
        {:else if dbxBrowserError}
          <div class="browser-error">{dbxBrowserError}</div>
          <button
            class="btn btn-secondary"
            onclick={() => openDropboxBrowser(dbxBrowserPath)}
          >
            {$t('Retry')}
          </button>
        {:else}
          <div class="folder-list">
            {#if dbxBrowserPath !== ''}
              <button
                class="folder-item folder-item--up"
                onclick={() => openDropboxBrowser(parentOf(dbxBrowserPath))}
              >
                {$t('.. (up)')}
              </button>
            {/if}
            {#each dbxBrowserFolders as folder (folder.path)}
              <button
                class="folder-item"
                onclick={() => openDropboxBrowser(folder.path)}
              >
                {folder.name}
              </button>
            {/each}
            {#if dbxBrowserFolders.length === 0}
              <p class="empty-message">{$t('No subfolders here')}</p>
            {/if}
          </div>
          <div class="browser-actions">
            <button
              class="btn btn-primary"
              onclick={() =>
                onSelectDropboxFolder(
                  dbxBrowserPath,
                  dbxBrowserPath === '' ? '/' : dbxBrowserPath,
                )}
            >
              {$t('Select This Folder')}
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="form-group folder-selected">
        <p><strong>{$t('Folder selected:')}</strong> {pickedFolderName}</p>
        <button
          class="btn btn-secondary btn-sm"
          onclick={() => openDropboxBrowser(form.folderId)}
        >
          {$t('Change Folder')}
        </button>
      </div>

      <div class="form-group">
        <label for="db-name">{$t('Remote Name (optional)')}</label>
        <input
          id="db-name"
          type="text"
          placeholder={$t('Auto-filled from folder name')}
          bind:value={form.name}
        />
      </div>

      <div class="form-actions">
        <button onclick={handleSave} class="btn btn-primary"
          >{$t('Save & Connect')}</button
        >
        <button onclick={onCancel} class="btn btn-secondary"
          >{$t('Cancel')}</button
        >
      </div>
    {/if}
  {:else if remoteType === 'webdav'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}>
        <ArrowLeft size={16} aria-hidden="true" />
        {$t('Back')}
      </button>
      <h3>{$t('WebDAV Storage')}</h3>
    </div>

    <div class="form-group">
      <label for="webdav-name">{$t('Remote Name (optional)')}</label>
      <input
        id="webdav-name"
        type="text"
        placeholder={$t('Auto-filled from URL')}
        bind:value={form.name}
      />
    </div>

    <div class="form-group">
      <label for="webdav-url">{$t('WebDAV URL')}</label>
      <input
        id="webdav-url"
        type="url"
        placeholder="https://host/remote.php/dav/files/user/books"
        bind:value={form.url}
      />
    </div>

    <div class="form-group">
      <label for="webdav-username">{$t('Username')}</label>
      <input
        id="webdav-username"
        type="text"
        placeholder={$t('username')}
        bind:value={form.username}
      />
    </div>

    <div class="form-group">
      <label for="webdav-password">{$t('Password')}</label>
      <input
        id="webdav-password"
        type="password"
        placeholder={$t('password or app token')}
        bind:value={form.password}
      />
    </div>

    <div class="form-group">
      <label for="webdav-public-url">{$t('Public URL Base (optional)')}</label>
      <input
        id="webdav-public-url"
        type="url"
        placeholder="https://host/s/public-share"
        bind:value={form.publicUrlBase}
      />
    </div>

    <div class="form-group">
      <label for="webdav-catalog-filename"
        >{$t('Catalog Filename (optional)')}</label
      >
      <!-- i18n-ignore -->
      <input
        id="webdav-catalog-filename"
        type="text"
        placeholder="catalog.json"
        bind:value={form.catalogFilename}
      />
    </div>

    <div class="proxy-toggle">
      <label>
        <input type="checkbox" bind:checked={routeViaProxy} />
        {$t('Route uploads through the app proxy (for servers without CORS)')}
      </label>
      <small class="field-note">
        {#if routeViaProxy}
          {$t(
            'Requests go through this app’s /dav endpoint; your WebDAV credentials transit the app host.',
          )}{#if !proxyAvailable}
            {$t(
              'No proxy was detected on this host, so this only works once the app is deployed with the WebDAV proxy.',
            )}{/if}
        {:else}
          {$t(
            'Requests go straight to the server, which must send CORS headers.',
          )}
        {/if}
      </small>
    </div>

    <div class="form-actions">
      <button onclick={handleSave} class="btn btn-primary"
        >{$t('Save & Connect')}</button
      >
      <button onclick={onCancel} class="btn btn-secondary"
        >{$t('Cancel')}</button
      >
    </div>
  {:else if remoteType === 'device'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}>
        <ArrowLeft size={16} aria-hidden="true" />
        {$t('Back')}
      </button>
      <h3>{$t('USB e-reader')}</h3>
    </div>

    <p class="device-summary">
      {#if deviceKind === 'kobo'}
        {$t('Detected: {detail} on volume "{volume}"', {
          detail: deviceDetail || 'Kobo',
          volume: deviceVolumeLabel,
        })}
      {:else}
        {$t(
          'Volume "{volume}" (no reader markers found — books are copied to it as-is)',
          {
            volume: deviceVolumeLabel,
          },
        )}
      {/if}
    </p>

    <div class="form-group">
      <label for="dev-name">{$t('Name')}</label>
      <input id="dev-name" type="text" bind:value={form.name} />
    </div>

    <div class="form-group">
      <label for="dev-folder">{$t('Folder on device')}</label>
      <!-- i18n-ignore -->
      <input
        id="dev-folder"
        type="text"
        placeholder="/"
        bind:value={deviceTargetFolder}
      />
      <small class="field-note">
        {$t('Leave empty to copy books to the top of the device.')}
      </small>
    </div>

    {#if editingRemote && !pickedDeviceHandle}
      <div class="form-group">
        <button class="btn btn-secondary" onclick={onPickDevice}>
          {$t('Choose device again…')}
        </button>
        <small class="field-note">
          {$t('Only needed if the saved connection stops working.')}
        </small>
      </div>
    {/if}

    <div class="form-actions">
      <button onclick={handleSave} class="btn btn-primary"
        >{$t('Save & Connect')}</button
      >
      <button onclick={onCancel} class="btn btn-secondary"
        >{$t('Cancel')}</button
      >
    </div>
  {/if}
</div>

<style>
  .type-cluster-label {
    margin: 12px 0 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
  }

  .device-summary {
    margin: 0 0 12px;
    color: var(--color-text-secondary);
  }

  .form-container {
    background: var(--color-surface-secondary);
    padding: 20px;
    border-radius: 8px;
  }

  .type-selector {
    text-align: center;
    /* Query the pane width (not the viewport) so the grid reflows with the split. */
    container-type: inline-size;
  }

  .type-selector h3 {
    margin-top: 0;
  }

  /* Responsive grid: one row → 2×2 → single column as the pane narrows. */
  .type-buttons {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  @container (max-width: 34rem) {
    .type-buttons {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (max-width: 17rem) {
    .type-buttons {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .form-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .form-header h3 {
    margin: 0;
    flex: 1;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .folder-selected {
    background: var(--color-success-bg);
    padding: 12px;
    border-radius: 4px;
    border-left: 4px solid var(--color-success-border);
  }

  .folder-selected p {
    margin: 0 0 12px 0;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(0, 116, 217, 0.1);
  }

  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 20px;
  }

  .field-note {
    display: block;
    margin-top: 4px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .folder-browser {
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .browser-path {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
  }

  .folder-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 8px;
  }

  .folder-item {
    text-align: left;
    padding: 8px 12px;
    background: var(--color-surface-secondary);
    border: 1px solid var(--color-border-default);
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
    font-size: 14px;
  }

  .folder-item:hover {
    background: var(--color-info-bg);
    border-color: var(--color-accent);
  }

  .folder-item--up {
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .browser-loading,
  .browser-error {
    padding: 12px;
    margin-bottom: 8px;
  }

  .browser-error {
    color: var(--color-error-border);
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning-border);
    border-radius: 4px;
  }

  .browser-actions {
    margin-top: 12px;
  }

  .proxy-toggle {
    margin-bottom: 16px;
  }

  .proxy-toggle label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .proxy-toggle input {
    width: auto;
  }

  .proxy-toggle .field-note {
    display: block;
    margin-top: 4px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }
</style>
