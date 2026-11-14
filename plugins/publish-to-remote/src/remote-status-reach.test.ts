import { describe, it, expect, vi } from 'vitest';

vi.mock('./remote-ops.js', () => ({
  listFiles: vi.fn(),
  getThumbnailUrl: vi.fn(),
}));

import { listFiles } from './remote-ops.js';
import { listRemote, typeLabel } from './remote-status.js';
import type { SolidRemoteConfig } from './types.js';

const pod: SolidRemoteConfig = {
  id: 'pod',
  name: 'Pod',
  type: 'solid',
  oidcIssuer: 'https://idp.example/',
  webId: 'https://pod.example/me#me',
  containerUrl: 'https://pod.example/books/',
};

describe('a Solid destination', () => {
  it('asks for a sign-in when the account has lapsed', async () => {
    vi.mocked(listFiles).mockResolvedValue({ objects: [], error: 'SOLID_AUTH_REQUIRED' });
    expect(await listRemote(pod)).toEqual({ reach: 'sign-in', objects: [] });
  });

  it('is badged Solid', () => {
    expect(typeLabel(pod)).toBe('Solid');
  });
});
