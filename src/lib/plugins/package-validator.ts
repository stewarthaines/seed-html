/**
 * Where the agent bridge's `seed_validate` finds the publish plugin's epubcheck
 * (process/BRIDGE_HANDOVER_TOOLS.md, section 3). The Send surface's
 * `PluginFrame` registers a validator while its plugin is alive; the bridge
 * context switches the app to Share and waits here for it. Nothing is
 * registered while the plugin is off, not yet loaded, or failed.
 */
import type { ValidationReport } from './validation-report.js';

export type PackageValidator = () => Promise<ValidationReport>;

let current: PackageValidator | null = null;
const waiting = new Set<(validator: PackageValidator) => void>();

/**
 * Register the live validator, or clear it with null. Returns a function that
 * clears it only if it is still the one registered, so a frame unmounting
 * after a newer one mounted does not remove the newer one.
 */
export function setPackageValidator(validator: PackageValidator | null): () => void {
  current = validator;
  if (validator) {
    for (const resolve of waiting) resolve(validator);
    waiting.clear();
  }
  return () => {
    if (current === validator) current = null;
  };
}

/** The registered validator, waiting up to `timeoutMs` for one to appear. */
export function waitForPackageValidator(timeoutMs: number): Promise<PackageValidator> {
  if (current) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const settle = (validator: PackageValidator) => {
      clearTimeout(timer);
      resolve(validator);
    };
    const timer = setTimeout(() => {
      waiting.delete(settle);
      reject(new Error('the publish plugin did not load on the Share page'));
    }, timeoutMs);
    waiting.add(settle);
  });
}
