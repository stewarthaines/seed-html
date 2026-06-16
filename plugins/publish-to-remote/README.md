# Plugin for SEED.html for remote publish

Support for
- webDAV
- S3/R2 buckets
- Google Drive
- Dropbox

All credentials are entered at runtime in the plugin's "Add Remote" form and stored
per-remote in the browser's private OPFS storage (`remotes.json`). Nothing is baked into
the build — Google Drive and Dropbox are **bring-your-own OAuth app**, so an advanced user
can use their own Google/Dropbox credentials rather than the project owner's.

## Google Drive setup

1. Create a project at <https://console.cloud.google.com/>.
2. Enable the **Google Drive API** and the **Google Picker API**.
3. Create an **OAuth 2.0 Client ID** (type: Web application) and add this app's origin
   (the value shown in the form, e.g. `https://your-app.example`) to **Authorized
   JavaScript origins**.
4. Create an **API key** (you may restrict it to the Picker API).
5. In the plugin: Add Remote → Google Drive → paste the **Client ID** and **API key**, then
   Connect & pick a folder.

## Dropbox setup

1. Create an app at <https://www.dropbox.com/developers/apps> (Scoped access, Full Dropbox).
2. Enable the permissions `files.content.write`, `files.metadata.read`,
   `sharing.read`, `sharing.write`.
3. Under **OAuth 2 → Redirect URIs**, register the exact redirect URI shown in the form
   (this app's origin, e.g. `https://your-app.example`).
4. In the plugin: Add Remote → Dropbox → paste the **App key** and confirm the **Redirect
   URI**, then Connect.

> Credentials in OPFS are volatile: not backed up or synced, and lost if the browser's
> storage is cleared. Keep a copy of your keys.
