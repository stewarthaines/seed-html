import { describe, it, expect } from 'vitest';
import { answerConfirm, confirmDialog, currentConfirm } from './confirm.svelte';

describe('confirmDialog', () => {
  it('resolves with the answer and shows queued requests in turn', async () => {
    expect(currentConfirm()).toBeNull();
    const first = confirmDialog({ message: 'Delete a?', confirmLabel: 'Delete', danger: true });
    const second = confirmDialog({ message: 'Overwrite b?', confirmLabel: 'Overwrite' });

    expect(currentConfirm()?.message).toBe('Delete a?');
    answerConfirm(true);
    await expect(first).resolves.toBe(true);

    expect(currentConfirm()?.message).toBe('Overwrite b?');
    answerConfirm(false);
    await expect(second).resolves.toBe(false);

    expect(currentConfirm()).toBeNull();
  });
});
