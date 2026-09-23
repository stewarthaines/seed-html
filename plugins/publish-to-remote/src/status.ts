/**
 * The transient status line every surface shares: a store the surfaces write
 * and the Toast component renders. Successes clear themselves.
 */
import { writable } from 'svelte/store';

export type StatusKind = 'info' | 'success' | 'error';

export interface StatusMessage {
  text: string;
  type: StatusKind;
}

export const statusMessage = writable<StatusMessage | null>(null);

export function showStatus(text: string, type: StatusKind): void {
  statusMessage.set({ text, type });
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.update((current) =>
        current?.text === text ? null : current,
      );
    }, 3000);
  }
}

export function clearStatus(): void {
  statusMessage.set(null);
}
