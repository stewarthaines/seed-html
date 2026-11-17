import { describe, it, expect, vi } from 'vitest';
import { setPackageValidator, waitForPackageValidator } from './package-validator.js';

describe('package validator holder', () => {
  it('hands a waiting caller the validator once it registers', async () => {
    const validator = vi.fn();
    const waited = waitForPackageValidator(1000);
    const clear = setPackageValidator(validator);
    await expect(waited).resolves.toBe(validator);
    await expect(waitForPackageValidator(10)).resolves.toBe(validator);
    clear();
    await expect(waitForPackageValidator(10)).rejects.toThrow('did not load');
  });

  it("an old frame's clear leaves a newer validator in place", async () => {
    const clearOld = setPackageValidator(vi.fn());
    const newer = vi.fn();
    const clearNewer = setPackageValidator(newer);
    clearOld();
    await expect(waitForPackageValidator(10)).resolves.toBe(newer);
    clearNewer();
  });
});
