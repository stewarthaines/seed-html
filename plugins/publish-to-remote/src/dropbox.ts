function generateCodeVerifier(): string {
  const array = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateState(): string {
  const array = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function authorizeDropbox(
  appKey: string,
  redirectUri?: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Use provided redirect_uri or fall back to this (plugin) page's URL. It must be
  // the page that handles the OAuth callback (App.svelte's onMount) — i.e. the
  // plugin page itself (origin + path), not the host app root (origin only).
  const actualRedirectUri =
    redirectUri || `${window.location.origin}${window.location.pathname}`;

  sessionStorage.setItem('dropbox_code_verifier', codeVerifier);
  sessionStorage.setItem('dropbox_state', state);

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== actualRedirectUri.split('/').slice(0, 3).join('/'))
        return;
      if (event.data.type !== 'dropbox-auth') return;

      window.removeEventListener('message', handleMessage);

      if (event.data.state !== state) {
        reject(new Error('State mismatch in OAuth response'));
        return;
      }

      sessionStorage.removeItem('dropbox_code_verifier');
      sessionStorage.removeItem('dropbox_state');

      exchangeCodeForToken(
        appKey,
        event.data.code,
        codeVerifier,
        actualRedirectUri,
      )
        .then(resolve)
        .catch(reject);
    };

    window.addEventListener('message', handleMessage);

    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', appKey);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('token_access_type', 'offline');
    authUrl.searchParams.set(
      'scope',
      'files.content.write files.metadata.read sharing.read sharing.write',
    );
    authUrl.searchParams.set('redirect_uri', actualRedirectUri);
    authUrl.searchParams.set('state', state);

    const popup = window.open(
      authUrl.toString(),
      'dropbox_auth',
      'width=500,height=600',
    );
    if (!popup) {
      reject(new Error('Failed to open authorization popup'));
      window.removeEventListener('message', handleMessage);
    }
  });
}

async function exchangeCodeForToken(
  appKey: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; tokenExpiry: number }> {
  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      client_id: appKey,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry: Date.now() + data.expires_in * 1000,
  };
}

export async function listDropboxFolders(
  accessToken: string,
  path: string,
): Promise<{ name: string; path: string }[]> {
  const folders: { name: string; path: string }[] = [];
  let cursor: string;

  try {
    while (true) {
      const response = await fetch(
        'https://api.dropboxapi.com/2/files/list_folder',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: path || '',
            include_non_downloadable_files: false,
          }),
        },
      );

      if (response.status === 401) {
        throw new Error('DROPBOX_AUTH_EXPIRED');
      }

      if (!response.ok) {
        throw new Error(
          `Failed to list Dropbox folders: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Filter and map folder entries
      if (data.entries && Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          if (entry['.tag'] === 'folder') {
            folders.push({
              name: entry.name,
              path: entry.path_display,
            });
          }
        }
      }

      // Handle pagination
      if (!data.has_more) {
        break;
      }

      cursor = data.cursor;

      // Continue listing with cursor
      const continueResponse = await fetch(
        'https://api.dropboxapi.com/2/files/list_folder/continue',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cursor }),
        },
      );

      if (!continueResponse.ok) {
        throw new Error(
          `Failed to continue listing folders: ${continueResponse.status}`,
        );
      }
    }

    return folders;
  } catch (error) {
    if (error instanceof Error && error.message === 'DROPBOX_AUTH_EXPIRED') {
      throw error;
    }
    throw error;
  }
}

export async function refreshDropboxToken(
  appKey: string,
  refreshToken: string,
): Promise<{ accessToken: string; tokenExpiry: number }> {
  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    tokenExpiry: Date.now() + data.expires_in * 1000,
  };
}
