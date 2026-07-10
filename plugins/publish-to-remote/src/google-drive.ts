// Minimal structural types for the pieces of the dynamically-loaded Google
// Identity Services / Picker globals this plugin actually touches (Google
// ships no TypeScript types for these script-tag APIs).
interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options: { prompt: string }): void;
}

interface GooglePickerDoc {
  id: string;
  name: string;
}

interface GooglePickerView {
  setIncludeFolders(include: boolean): void;
  setSelectFolderEnabled(enabled: boolean): void;
  setMimeTypes(mimeTypes: string): void;
}

interface GooglePickerBuilder {
  addView(view: GooglePickerView): GooglePickerBuilder;
  enableFeature(feature: string): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  setCallback(
    callback: (data: Record<string, unknown>) => void,
  ): GooglePickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }): GoogleTokenClient;
    };
  };
  picker: {
    DocsView: new () => GooglePickerView;
    PickerBuilder: new () => GooglePickerBuilder;
    Feature: { NAV_HIDDEN: string };
    Response: { ACTION: string; DOCUMENTS: string };
    Action: { PICKED: string; CANCEL: string };
  };
}

declare global {
  interface Window {
    onGoogleLibraryLoad?: () => void;
    google?: GoogleGlobal;
    gapi?: { load?: (library: string, callback: () => void) => void };
  }
}

let scriptsLoaded = false;

export async function loadGoogleScripts(): Promise<void> {
  if (scriptsLoaded) return;

  return new Promise((resolve, reject) => {
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => {
      const pickerScript = document.createElement('script');
      pickerScript.src = 'https://apis.google.com/js/api.js';
      pickerScript.onload = () => {
        window.gapi?.load?.('picker', () => {
          scriptsLoaded = true;
          resolve();
        });
      };
      pickerScript.onerror = () =>
        reject(new Error('Failed to load Picker API'));
      document.head.appendChild(pickerScript);
    };
    gisScript.onerror = () =>
      reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(gisScript);
  });
}

export function authorizeGoogleDrive(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = window.google;
    if (!google) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.access_token) {
          resolve(response.access_token);
        } else {
          reject(new Error('Authorization failed'));
        }
      },
    });

    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function pickGoogleDriveFolder(
  accessToken: string,
  apiKey: string,
): Promise<{ folderId: string; folderName: string }> {
  await loadGoogleScripts();

  return new Promise((resolve, reject) => {
    const google = window.google;
    if (!google) {
      reject(new Error('Google Picker API not loaded'));
      return;
    }
    const folderView = new google.picker.DocsView();
    folderView.setIncludeFolders(true);
    folderView.setSelectFolderEnabled(true);
    folderView.setMimeTypes('application/vnd.google-apps.folder');

    const picker = new google.picker.PickerBuilder()
      .addView(folderView)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setOAuthToken(accessToken)
      .setAppId(apiKey)
      .setCallback((data) => {
        if (
          data[google.picker.Response.ACTION] === google.picker.Action.PICKED
        ) {
          const docs = data[
            google.picker.Response.DOCUMENTS
          ] as GooglePickerDoc[];
          resolve({
            folderId: docs[0].id,
            folderName: docs[0].name,
          });
        } else if (
          data[google.picker.Response.ACTION] === google.picker.Action.CANCEL
        ) {
          reject(new Error('Folder selection cancelled'));
        }
      })
      .build();

    picker.setVisible(true);
  });
}

function waitForGoogle(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }
    // GSI calls this when ready
    window.onGoogleLibraryLoad = () => resolve();
  });
}

export async function refreshGoogleToken(clientId: string): Promise<string> {
  await waitForGoogle();
  return new Promise((resolve, reject) => {
    const google = window.google;
    if (!google) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.access_token) {
          resolve(response.access_token);
        } else {
          reject(new Error('Token refresh failed'));
        }
      },
    });

    client.requestAccessToken({ prompt: 'none' });
  });
}
