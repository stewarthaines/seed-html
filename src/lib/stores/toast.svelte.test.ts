/**
 * Toasts always auto-dismiss (process/AGENT_BRIDGE.md companion decision):
 * a non-positive duration falls back to the default instead of sticking.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { toasts, showToast, dismissToast } from './toast.svelte.js';

afterEach(() => {
  vi.useRealTimers();
  toasts.splice(0, toasts.length);
});

describe('toast auto-dismiss', () => {
  it('dismisses after the given duration', () => {
    vi.useFakeTimers();
    showToast('saved', 'info', 1000);
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(1001);
    expect(toasts).toHaveLength(0);
  });

  it('never sticks: duration 0 falls back to the default timer', () => {
    vi.useFakeTimers();
    showToast('would-be sticky', 'info', 0);
    expect(toasts).toHaveLength(1);
    vi.advanceTimersByTime(4001);
    expect(toasts).toHaveLength(0);
  });

  it('early dismissal by id still works', () => {
    vi.useFakeTimers();
    const id = showToast('bye', 'info', 5000);
    dismissToast(id);
    expect(toasts).toHaveLength(0);
  });
});
