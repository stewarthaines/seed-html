<script lang="ts">
  import {
    loadGoogleScripts,
    authorizeGoogleDrive,
    pickGoogleDriveFolder,
  } from '../google-drive.js';
  import { authorizeDropbox, listDropboxFolders } from '../dropbox.js';
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
    googleClientId,
    googleApiKey,
    dropboxAppKey,
    dropboxRedirectUri,
    canCancel,
    onSave,
    onCancel,
    onStatus,
  }: {
    editingRemote: RemoteConfig | null;
    googleClientId: string;
    googleApiKey: string;
    dropboxAppKey: string;
    dropboxRedirectUri: string;
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
    | 'webdav';

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

  let dbxBrowserPath: string = $state('');
  let dbxBrowserFolders: { name: string; path: string }[] = $state([]);
  let dbxBrowserLoading: boolean = $state(false);
  let dbxBrowserError: string | null = $state(null);
  let dbxBrowserActive: boolean = $state(false);

  $effect(() => {
    if (editingRemote) {
      populateForm(editingRemote);
    } else {
      resetForm();
    }
  });

  function populateForm(remote: RemoteConfig) {
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
    }
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
    previousBucketForAutoName = '';
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
        onStatus('Google Drive credentials not configured', 'error');
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
      onStatus(`Selected folder: ${folderName}`, 'success');
    } catch (error) {
      onStatus(`Google Drive setup failed: ${String(error)}`, 'error');
    }
  }

  async function onConnectDropbox(): Promise<void> {
    try {
      if (!dropboxAppKey) {
        onStatus('Dropbox app key not configured', 'error');
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
      onStatus(`Dropbox authorization failed: ${String(error)}`, 'error');
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
        onStatus('Session expired — please reconnect', 'error');
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
        onStatus('Please fill all required fields', 'error');
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
        onStatus('Please select a folder', 'error');
        return null;
      }
      return {
        id: editingRemote?.id || crypto.randomUUID(),
        name: form.name.trim() || form.folderName.trim(),
        type: 'google-drive',
        clientId: googleClientId,
        apiKey: googleApiKey,
        folderId: form.folderId.trim(),
        folderName: form.folderName.trim(),
        accessToken: form.accessToken || undefined,
      };
    } else if (remoteType === 'dropbox') {
      if (!form.accessToken || pickedFolderName === null) {
        onStatus('Please select a folder and authorize first', 'error');
        return null;
      }
      return {
        id: editingRemote?.id || crypto.randomUUID(),
        name: form.name.trim() || form.folderName.trim(),
        type: 'dropbox',
        appKey: dropboxAppKey,
        folderId: form.folderId,
        folderPath: form.folderName,
        accessToken: form.accessToken,
        refreshToken: form.refreshToken,
        tokenExpiry: form.tokenExpiry,
      };
    } else if (remoteType === 'webdav') {
      if (!form.url || !form.username || !form.password) {
        onStatus('Please fill all required fields', 'error');
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
      };
    }
    onStatus('Please select a remote type', 'error');
    return null;
  }

  function handleSave() {
    const remote = buildRemote();
    if (remote) onSave(remote, !editingRemote);
  }
</script>

<div class="form-container">
  {#if remoteType === 'none'}
    <div class="type-selector">
      <h3>Add Remote Storage</h3>
      <div class="type-buttons">
        <button class="btn-type" onclick={() => (remoteType = 's3-compatible')}>
          S3-Compatible
        </button>
        <button class="btn-type" onclick={onConnectGoogleDrive}> Google Drive </button>
        <button class="btn-type" onclick={() => (remoteType = 'dropbox')}> Dropbox </button>
        <button class="btn-type" onclick={() => (remoteType = 'webdav')}> WebDAV </button>
      </div>
      {#if canCancel}
        <div class="form-actions">
          <button class="btn btn-secondary" onclick={onCancel}>Cancel</button>
        </div>
      {/if}
    </div>
  {:else if remoteType === 's3-compatible'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}
        >← Back</button
      >
      <h3>S3-Compatible Storage</h3>
    </div>

    <div class="form-group">
      <label for="preset">Preset</label>
      <select
        id="preset"
        onchange={(e) =>
          onPresetSelected(e.currentTarget.value as keyof typeof S3_PRESETS)}
      >
        <option value="">-- Choose a preset --</option>
        <option value="cloudflare-r2">Cloudflare R2</option>
        <option value="backblaze-b2">Backblaze B2</option>
        <option value="digitalocean-spaces">DigitalOcean Spaces</option>
        <option value="bunny-storage">Bunny Storage</option>
      </select>
    </div>

    <div class="form-group">
      <label for="name">Remote Name (optional)</label>
      <input
        id="name"
        type="text"
        placeholder="Auto-filled from bucket name"
        bind:value={form.name}
      />
    </div>

    <div class="form-group">
      <label for="endpoint">Endpoint URL</label>
      <input
        id="endpoint"
        type="url"
        placeholder="https://account-id.r2.cloudflarestorage.com"
        bind:value={form.endpoint}
      />
    </div>

    <div class="form-group">
      <label for="bucket">Bucket Name</label>
      <input
        id="bucket"
        type="text"
        placeholder="my-bucket"
        bind:value={form.bucket}
        onchange={autoUpdateName}
      />
    </div>

    <div class="form-group">
      <label for="access-key">Access Key ID</label>
      <input
        id="access-key"
        type="text"
        placeholder="Access Key"
        bind:value={form.accessKeyId}
      />
    </div>

    <div class="form-group">
      <label for="secret-key">Secret Access Key</label>
      <input
        id="secret-key"
        type="password"
        placeholder="Secret Key"
        bind:value={form.secretAccessKey}
      />
    </div>

    <div class="form-group">
      <label for="region">Region (optional)</label>
      <input
        id="region"
        type="text"
        placeholder="auto"
        bind:value={form.region}
      />
    </div>

    <div class="form-group">
      <label for="public-url">Public URL Base (optional)</label>
      <input
        id="public-url"
        type="url"
        placeholder="https://pub-xxx.r2.dev"
        bind:value={form.publicUrlBase}
      />
    </div>

    <div class="form-group">
      <label for="catalog-filename">Catalog Filename (optional)</label>
      <input
        id="catalog-filename"
        type="text"
        placeholder="catalog.xml"
        bind:value={form.catalogFilename}
      />
    </div>

    <div class="form-actions">
      <button onclick={handleSave} class="btn btn-primary"
        >Save & Connect</button
      >
      <button onclick={onCancel} class="btn btn-secondary">Cancel</button>
    </div>
  {:else if remoteType === 'google-drive'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}
        >← Back</button
      >
      <h3>Google Drive</h3>
    </div>

    {#if pickedFolderName}
      <div class="form-group folder-selected">
        <p><strong>Folder selected:</strong> {pickedFolderName}</p>
        <button
          class="btn btn-secondary btn-sm"
          onclick={() => {
            form.folderId = '';
            form.folderName = '';
            pickedFolderName = null;
          }}
        >
          Change Folder
        </button>
      </div>
    {:else}
      <div class="form-actions">
        <button onclick={onConnectGoogleDrive} class="btn btn-primary">
          Connect & Pick Folder
        </button>
      </div>
    {/if}

    {#if form.folderId}
      <div class="form-group">
        <label for="gd-name">Remote Name (optional)</label>
        <input
          id="gd-name"
          type="text"
          placeholder="Auto-filled from folder name"
          bind:value={form.name}
        />
      </div>

      <div class="form-actions">
        <button onclick={handleSave} class="btn btn-primary"
          >Save & Connect</button
        >
        <button onclick={onCancel} class="btn btn-secondary">Cancel</button>
      </div>
    {/if}
  {:else if remoteType === 'dropbox'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}
        >← Back</button
      >
      <h3>Dropbox</h3>
    </div>

    {#if !form.accessToken}
      <div class="form-actions">
        <button onclick={() => onConnectDropbox()} class="btn btn-primary">
          Connect to Dropbox
        </button>
      </div>
    {:else if dbxBrowserActive}
      <div class="folder-browser">
        <div class="browser-path">
          Location: <strong
            >{dbxBrowserPath === '' ? '/' : dbxBrowserPath}</strong
          >
        </div>

        {#if dbxBrowserLoading}
          <div class="browser-loading">Loading folders...</div>
        {:else if dbxBrowserError}
          <div class="browser-error">{dbxBrowserError}</div>
          <button
            class="btn btn-secondary"
            onclick={() => openDropboxBrowser(dbxBrowserPath)}
          >
            Retry
          </button>
        {:else}
          <div class="folder-list">
            {#if dbxBrowserPath !== ''}
              <button
                class="folder-item folder-item--up"
                onclick={() => openDropboxBrowser(parentOf(dbxBrowserPath))}
              >
                .. (up)
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
              <p class="empty-message">No subfolders here</p>
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
              Select This Folder
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="form-group folder-selected">
        <p><strong>Folder selected:</strong> {pickedFolderName}</p>
        <button
          class="btn btn-secondary btn-sm"
          onclick={() => openDropboxBrowser(form.folderId)}
        >
          Change Folder
        </button>
      </div>

      <div class="form-group">
        <label for="db-name">Remote Name (optional)</label>
        <input
          id="db-name"
          type="text"
          placeholder="Auto-filled from folder name"
          bind:value={form.name}
        />
      </div>

      <div class="form-actions">
        <button onclick={handleSave} class="btn btn-primary"
          >Save & Connect</button
        >
        <button onclick={onCancel} class="btn btn-secondary">Cancel</button>
      </div>
    {/if}
  {:else if remoteType === 'webdav'}
    <div class="form-header">
      <button class="btn btn-link" onclick={() => (remoteType = 'none')}
        >← Back</button
      >
      <h3>WebDAV Storage</h3>
    </div>

    <div class="form-group">
      <label for="webdav-name">Remote Name (optional)</label>
      <input
        id="webdav-name"
        type="text"
        placeholder="Auto-filled from URL"
        bind:value={form.name}
      />
    </div>

    <div class="form-group">
      <label for="webdav-url">WebDAV URL</label>
      <input
        id="webdav-url"
        type="url"
        placeholder="https://host/remote.php/dav/files/user/books"
        bind:value={form.url}
      />
    </div>

    <div class="form-group">
      <label for="webdav-username">Username</label>
      <input
        id="webdav-username"
        type="text"
        placeholder="username"
        bind:value={form.username}
      />
    </div>

    <div class="form-group">
      <label for="webdav-password">Password</label>
      <input
        id="webdav-password"
        type="password"
        placeholder="password or app token"
        bind:value={form.password}
      />
    </div>

    <div class="form-group">
      <label for="webdav-public-url">Public URL Base (optional)</label>
      <input
        id="webdav-public-url"
        type="url"
        placeholder="https://host/s/public-share"
        bind:value={form.publicUrlBase}
      />
    </div>

    <div class="form-group">
      <label for="webdav-catalog-filename">Catalog Filename (optional)</label>
      <input
        id="webdav-catalog-filename"
        type="text"
        placeholder="catalog.xml"
        bind:value={form.catalogFilename}
      />
    </div>

    <div class="form-actions">
      <button onclick={handleSave} class="btn btn-primary"
        >Save & Connect</button
      >
      <button onclick={onCancel} class="btn btn-secondary">Cancel</button>
    </div>
  {/if}
</div>

<style>
  .form-container {
    background: var(--color-surface-secondary);
    padding: 20px;
    border-radius: 8px;
  }

  .type-selector {
    text-align: center;
  }

  .type-selector h3 {
    margin-top: 0;
  }

  .type-selector p {
    color: var(--color-text-secondary);
    margin-bottom: 20px;
  }

  .type-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
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
</style>
