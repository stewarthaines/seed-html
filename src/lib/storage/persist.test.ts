import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persist.js';

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks the browser to persist storage, synchronously', () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does nothing where the Storage API is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(() => requestPersistentStorage()).not.toThrow();
  });

  it('warns instead of throwing when the request is rejected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockRejectedValue(new Error('blocked')) },
    });
    requestPersistentStorage();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
  });
});
