# AGENTS.md

Best practices for agents working on this Svelte plugin project.

## Architecture

The host mounts this one build three times, naming a **surface** in the `init` message (see `process/PUBLISH_REWORK.md` and `src/lib/plugins/API.md` in the host repo):

- `send` — the "Publish to the web" band on the host's Share page: one row per destination saying what the open book's latest package is doing there, with Send and an "In the catalog" switch. Content-height (the host measures the body).
- `published` — the host's Published page: a destination picker, the catalog's identity and state, the shelf of EPUBs on the destination (Import… for books not on this device), and the books here not sent there. Fills the frame.
- `destinations` — Settings › You › Destinations: the list with Edit / Reconnect / Remove and the add form. Content-height.

**Separation of concerns:**
- `src/index.ts` — message handling: records the surface, the directory handle, the open book's identifier and the identifiers of every book on the device
- `src/App.svelte` — loads the destinations once, renders the surface, hosts the toast
- `src/components/{Send,Published,Destinations}Surface.svelte` — the three surfaces; `ConfigureForm.svelte` (add/edit a destination), `ValidationModal.svelte` (the epubcheck report), `CatalogIdentityForm.svelte`, `ImportDialog.svelte`, `Switch.svelte`, `DestinationBadge.svelte`, `Toast.svelte`
- `src/remotes.ts` — the destinations store (remotes.json in OPFS) synced across frames over a BroadcastChannel; `announceContentChanged` tells other frames to list a destination again
- `src/local-packages.ts` — the packages in the handed directory joined with their sidecars
- `src/remote-status.ts` — listing with reachability named (`ok` / `sign-in` / `reconnect` / `unplugged` / `error`), and the pure derivations: `sendStateFor` (the Send row) and `shelfFor` (the Published shelf); tested
- `src/catalog.ts` — list every feed on a destination (`catalogFilesOn`, the destination's own first), read them (`loadCatalog`, `loadCatalogs`), write one from a key set (`writeCatalog`, hosting the cover thumbnails), feed URL per remote type; tested
- `src/feed-cache.ts` — feed texts cached in OPFS by destination, file and listing stamp, shared by every frame; tested with a memory store
- `src/send.ts` — `sendPackage` (upload, then rewrite every feed that already lists the book, the new package replacing the old; a first send goes into the first feed) with its decision in the pure `catalogWritesForSend`, and `setInCatalog`; tested
- `src/share-links.ts` — a file's public link (`publicLinkFor`, a Dropbox shared link made on demand), the destination's reader link with `{url}` filled (`readerLinkFor`), and `copyShareLink` (copy and toast) behind every Copy link / Copy reader link button; tested
- `src/reconnect.ts` — a fresh Google token; a device permission re-granted
- `src/types.ts` — message shapes mirrored from the host contract; discriminated union of remote configs
- `src/remote-ops.ts` — dispatch layer for remote storage operations, including `downloadFile` for every type
- `src/opfs.ts` — remotes.json and the sidecars; `src/s3-upload.ts`, `src/dropbox.ts` + `src/dropbox-upload.ts`, `src/google-drive.ts` + `src/google-drive-upload.ts`, `src/webdav-upload.ts`, `src/device-upload.ts` — one module per remote type

**Data flow:**
- Destinations live in the plugin's own OPFS (`remotes.json`), shared by every frame; the host never sees them
- "Known on this device" = the host's `knownIdentifiers` (dc:identifiers of its books); a remote EPUB's identifier comes from the local sidecar of the same filename or from the catalog entry with the same acquisition URL
- The feed on the destination is the truth for catalog membership and identity; every change regenerates the whole file. A destination can carry several feeds; each is handled on its own, and Send updates every feed that lists the book and no other; a first send goes into the destination's first feed only
- Import: the plugin downloads the bytes and posts `import-epub` to the host, which runs its normal importer

## Key Patterns

### Svelte 5 Runes

**`$state()` vs `$derived()` — the critical distinction:**
- `$state()` — mutable variable; can be reassigned (`view = 'configure'` works)
- `$derived()` — read-only computed value; assigning to it silently fails or throws

Rule: if a variable is ever directly assigned in an event handler or async function, use `$state()`. Only use `$derived()` for values that are always computed from other state (e.g., `activeRemote` computed from `remotesStore`).

**`SvelteMap` from `svelte/reactivity`** — already deeply reactive, no `$state()` wrapper. Mutate in place:
```ts
let epubValidationStatus: Map<string, ...> = new SvelteMap();
epubValidationStatus.set(key, value);  // reactive — do this
epubValidationStatus = new SvelteMap(...);  // do NOT reassign
```

**Event syntax:** Use `onclick` not `on:click`. No modifiers — call `e.stopPropagation()` explicitly.

**One-time initialization — use `onMount`:**
```svelte
onMount(async () => {
  await doOneTimeSetup();
});
```

### File System Access

**Reading files from OPFS (shared credentials):**
```ts
const root = await navigator.storage.getDirectory();
const fileHandle = await root.getFileHandle('config.json', { create: true });
const file = await fileHandle.getFile();
const content = await file.text();
```

**Enumerating project files (via dirHandle from parent):**
```ts
for await (const entry of dirHandle.values()) {
  if (entry.kind === 'file' && entry.name.endsWith('.epub')) {
    const file = await entry.getFile();
  }
}
```
See [MDN: File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).

### OAuth + Folder Browser Pattern (Dropbox, Google Drive)

**Dropbox folder browser flow:**
1. User clicks "Connect to Dropbox" → calls `authorizeDropbox()` (OAuth PKCE flow)
2. OAuth popup opens, user authenticates, tokens stored in form object
3. `openDropboxBrowser(path)` lists folders at that path via `/2/files/list_folder`
4. User navigates folders or selects current folder
5. `onSelectDropboxFolder()` saves path and folder name to form
6. On save, config is persisted and files are listed

**Dropbox API key points:**
- OAuth scope: `files.content.write files.metadata.read sharing.read sharing.write`
- Root folder path is empty string `''`, not `'/'`
- Path construction: `config.folderId ? \`${config.folderId}/${objectKey}\` : \`/${objectKey}\``
- Shared links: use `/2/files/get_temporary_link` for direct downloads, or `/2/sharing/create_shared_link_with_settings` for persistent sharing
- Token refresh: catch 401 errors and call `refreshDropboxToken()` to get new access token

**Google Drive auth pattern:**
1. User clicks "Connect to Google" → calls `authorizeGoogleDrive(clientId)` (Google Identity Services popup)
2. Google Picker widget opens for folder selection; folderId and folderName stored in config
3. `accessToken` is persisted in the remote config (OPFS) after authorization
4. On page load, token is used directly; if missing/expired, a banner with "Connect to Google Drive" button is shown (no auto-popup — browsers block popups without user gesture)
5. `GOOGLE_AUTH_REQUIRED` sentinel error string propagates through the stack; `refreshObjectList` handles it by setting `googleAuthRequired = true` and showing the banner

### Error Handling

**Remote operations return `{ success, error?, ... }` — check the error field:**
```ts
const result = await listDropboxFiles(config);
if (result.error) {
  if (result.error === 'DROPBOX_AUTH_EXPIRED') {
    // Specific error: token expired, trigger re-auth
    dbxBrowserActive = false;
  } else {
    // General error: display message
    dbxBrowserError = result.error;
  }
}
```

All remote-ops functions return result objects with optional `error` field, never throw. This allows UI to handle errors gracefully without try-catch blocks.

## Linting

Run `npm run lint` to check for errors. Run `npm run lint:fix` to auto-fix. Config is in `eslint.config.js` (ESLint 9 flat config format). Rules:
- `@typescript-eslint/no-explicit-any`: off (too noisy for this project)
- `@typescript-eslint/no-unused-vars`: error, with `argsIgnorePattern: '^_'` (prefix unused args with `_`)
- Svelte a11y rules from `eslint-plugin-svelte` flat/recommended config

## Testing

**Manual testing workflow** (in the host app, served over http, with the plugin enabled in Settings › Plugins):
1. Open Settings › Destinations; add a destination
2. Select remote type (S3, Dropbox, or Google Drive)
3. **For S3:**
   - Enter Access Key ID and Secret Access Key
   - Select endpoint (Cloudflare R2, Backblaze B2, AWS S3, or custom)
   - Bucket name and region
4. **For Dropbox:**
   - Click "Connect to Dropbox"
   - Authorize OAuth (popup)
   - Browse and select target folder
   - Click "Save & Connect"
5. **For Google Drive:**
   - Click "Connect to Google"
   - Select folder via Google Picker
   - Click "Save & Connect"
6. Verify:
   - The Share page's band lists the destination and says "Not sent"
   - Send uploads the latest package; the row reads "Sent just now"; the switch is on
   - Published shows the book on the destination; Copy feed link gives the catalog URL; Remove deletes the file and updates the feed
7. Reload page — remote config and credentials should persist

**Debugging in browser console:**
- Network tab: check API calls for correct headers, request/response formats
- Dropbox: look for 401 (auth expired) or 400 (bad request) errors — check path format and parameter names
- Google Drive: verify Picker opens and folder selection callback fires
- S3: verify aws4fetch signature and endpoint URL construction
- All remotes: check localStorage for persisted config


## Known Issues & Future Work

**Current status:** All three remotes (S3/R2, Dropbox, Google Drive) confirmed working end-to-end.

**Current limitations:**
- Dropbox shared links are looked up only when a catalog is written (`resolveDropboxLinks`), for the files the feed carries; the listing itself is one call
- No batch upload UI (files uploaded one at a time)
- Google Drive token expires after ~1 hour — user must click "Connect to Google Drive" banner to re-authorize
- **Google Drive can't host an OPDS catalog (feed).** The catalog editor is intentionally hidden for `google-drive` remotes (S3/WebDAV only) — see below.

### Google Drive: no OPDS catalog (feed)

Google serves public Drive files only through generic/sandboxed responses — a virus-scan interstitial or `text/html`/`application/octet-stream`, never a controllable content type — so an OPDS reader rejects the *catalog feed document* ("Not a valid OPDS HTTP Content-Type … (text/html)"). Individual **book** downloads are fine (a download's content type doesn't matter), so Drive is good for publishing/sharing books, just not for hosting the feed. Verified dead ends: `files.get?alt=media&key=…` → 404; `drive.usercontent.google.com/download?…&confirm=t` → still ends at `text/html`. This is a Google policy wall, not a bug — do not try to "fix" it by tweaking the URL. Use an **S3 or WebDAV** remote for a catalog. The gate is `hasCatalog()` in `src/catalog.ts` (S3, Dropbox and WebDAV only).

Note `uploadToGoogleDrive` is **update-in-place** (find by name → PATCH, else create), so re-publishing a same-named book replaces it rather than duplicating.

**Nice-to-haves for future sessions:**
- Add file preview/metadata display in file list
- Support nested folder browser for Google Drive (currently one-level picker)
- Optimize file listing: cache shared links or use metadata API instead of individual calls
- Add upload progress bar (currently just success/failure)
- Support OPDS catalog generation from uploaded files
- Export/import remote config as JSON for easy sharing
- Add retry logic for failed uploads
- Support multiple remotes of same type with different credentials

## Recent Changes

**ESLint setup:** Added `eslint.config.js` (ESLint 9 flat config) with TypeScript and Svelte support. Run `npm run lint`.

**Svelte 5 migration fixes:** Corrected `$derived()` → `$state()` for all mutable state variables. Fixed `SvelteMap` to mutate in place rather than reassign. Fixed event syntax (`onclick` not `on:click`).

**Google Drive auth fix:** Removed auto-refresh popup on page load (browsers block it). Token now persisted in OPFS config. `GOOGLE_AUTH_REQUIRED` sentinel propagates to a banner UI with a user-triggered reconnect button.

**EPUB validation:** Validation report modal fixed (duplicate key crash on repeated messages). Validation status tracked per-file in `SvelteMap`.
