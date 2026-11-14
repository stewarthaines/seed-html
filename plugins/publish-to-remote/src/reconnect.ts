/**
 * Getting a destination reachable again: a fresh Google token, a new Solid
 * sign-in, or the device folder's permission re-granted. All need a user
 * gesture, so the surfaces call these from a button.
 */
import { loadGoogleScripts, authorizeGoogleDrive } from './google-drive.js';
import { connectDevice } from './device-upload.js';
import { signInWithSolid } from './solid-auth.js';
import { updateRemote } from './remotes.js';
import type { RemoteConfig } from './types.js';

export async function reconnectGoogle(remote: RemoteConfig): Promise<void> {
  if (remote.type !== 'google-drive') return;
  await loadGoogleScripts();
  const accessToken = await authorizeGoogleDrive(remote.clientId);
  await updateRemote({ ...remote, accessToken });
}

/**
 * Sign the destination's account in again. Call it straight from the click:
 * the sign-in window opens before anything is awaited. Signing in as someone
 * else moves the destination to that account.
 */
export async function reconnectSolid(remote: RemoteConfig): Promise<void> {
  if (remote.type !== 'solid') return;
  const account = await signInWithSolid(remote.oidcIssuer);
  if (account.webId !== remote.webId) {
    await updateRemote({ ...remote, webId: account.webId });
  }
}

/** True when the device is reachable again; false when it needs picking anew. */
export async function reconnectDevice(remote: RemoteConfig): Promise<boolean> {
  if (remote.type !== 'device') return false;
  const conn = await connectDevice(remote, { interactive: true });
  return !!conn.handle;
}
