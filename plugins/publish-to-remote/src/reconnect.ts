/**
 * Getting a destination reachable again: a fresh Google token, or the device
 * folder's permission re-granted. Both need a user gesture, so the surfaces
 * call these from a button.
 */
import { loadGoogleScripts, authorizeGoogleDrive } from './google-drive.js';
import { connectDevice } from './device-upload.js';
import { updateRemote } from './remotes.js';
import type { RemoteConfig } from './types.js';

export async function reconnectGoogle(remote: RemoteConfig): Promise<void> {
  if (remote.type !== 'google-drive') return;
  await loadGoogleScripts();
  const accessToken = await authorizeGoogleDrive(remote.clientId);
  await updateRemote({ ...remote, accessToken });
}

/** True when the device is reachable again; false when it needs picking anew. */
export async function reconnectDevice(remote: RemoteConfig): Promise<boolean> {
  if (remote.type !== 'device') return false;
  const conn = await connectDevice(remote, { interactive: true });
  return !!conn.handle;
}
