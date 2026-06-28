/**
 * Toast notifications — fleeting, auto-dismissing messages shown at the bottom of
 * the screen. The core style for transient, non-blocking information (originally
 * prototyped by the publish-to-remote plugin). Prefer this over inline banners for
 * brief "it happened / nothing to do" feedback.
 *
 * Usage: `import { showToast } from '$lib/stores/toast.svelte.js'` then
 * `showToast($t('Saved'))` / `showToast(msg, 'error')`. Render <Toast /> once near
 * the app root (already mounted in App.svelte).
 */

export type ToastType = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  text: string;
  type: ToastType;
}

let nextId = 0;

/** Active toasts (shared reactive state; mutate via the helpers below). */
export const toasts = $state<Toast[]>([]);

export function dismissToast(id: number): void {
  const index = toasts.findIndex(t => t.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

/**
 * Show a toast that auto-dismisses after `durationMs` (0 keeps it until dismissed).
 * Returns the toast id so callers can dismiss it early if needed.
 */
export function showToast(text: string, type: ToastType = 'info', durationMs = 4000): number {
  const id = nextId++;
  toasts.push({ id, text, type });
  if (durationMs > 0 && typeof setTimeout !== 'undefined') {
    setTimeout(() => dismissToast(id), durationMs);
  }
  return id;
}
